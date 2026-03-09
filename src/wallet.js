/**
 * wallet.js — @arkade-os/sdk wrapper
 * Arkade Wallet V1 Mainnet
 *
 * SECURITY: Private key is now encrypted at rest using AES-GCM (Web Crypto API).
 * An encryption key is generated once and stored in IndexedDB (non-exportable path).
 * The encrypted private key is stored in localStorage. Reading localStorage alone
 * no longer reveals the private key — both stores are required.
 */
import { SingleKey, Wallet, Ramps, waitForIncomingFunds, VtxoManager } from '@arkade-os/sdk'
import { ArkadeSwaps, BoltzSwapProvider, decodeInvoice } from '@arkade-os/boltz-swap'
import { LocalStorageAdapter } from '@arkade-os/sdk/adapters/localStorage'

const ARK_SERVER  = 'https://arkade.computer'
const STORAGE_KEY = 'arkade_wallet_privkey_mainnet_v2_enc'  // v2/v3 encrypted
const PASS_FLAG_KEY = 'arkade_wallet_password_enabled'
const IDB_DB      = 'arkade_secure'
const IDB_STORE   = 'keys'
const IDB_KEY_ID  = 'wallet_aes_key'

let _wallet  = null
let _manager = null
let _storage = null
let _sessionPrivKeyHex = null
let _passwordUnlocked = false
let _swaps = null


// ─── Crypto helpers ────────────────────────────────────────────────────────

async function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB, 1)
    req.onupgradeneeded = e => e.target.result.createObjectStore(IDB_STORE)
    req.onsuccess = e => resolve(e.target.result)
    req.onerror   = e => reject(e.target.error)
  })
}

async function getOrCreateAesKey() {
  const db = await openIDB()
  // Try to get existing key
  const existing = await new Promise((resolve, reject) => {
    const tx  = db.transaction(IDB_STORE, 'readonly')
    const req = tx.objectStore(IDB_STORE).get(IDB_KEY_ID)
    req.onsuccess = e => resolve(e.target.result)
    req.onerror   = e => reject(e.target.error)
  })
  if (existing) return existing

  // Generate new AES-GCM key
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,   // non-extractable — can't be read out of IndexedDB as raw bytes
    ['encrypt', 'decrypt']
  )
  await new Promise((resolve, reject) => {
    const tx  = db.transaction(IDB_STORE, 'readwrite')
    const req = tx.objectStore(IDB_STORE).put(key, IDB_KEY_ID)
    req.onsuccess = () => resolve()
    req.onerror   = e => reject(e.target.error)
  })
  return key
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++)
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return bytes
}

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}


async function derivePasswordKey(password, salt) {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

async function encryptPrivKeyWithPassword(privKeyHex, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv   = crypto.getRandomValues(new Uint8Array(12))
  const key  = await derivePasswordKey(password, salt)
  const data = new TextEncoder().encode(privKeyHex)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data)
  return JSON.stringify({
    mode: 'password',
    salt: bytesToHex(salt),
    iv: bytesToHex(iv),
    ct: bytesToHex(new Uint8Array(ciphertext)),
  })
}

async function decryptPrivKeyWithPassword(stored, password) {
  const payload = typeof stored === 'string' ? JSON.parse(stored) : stored
  if (!payload || payload.mode !== 'password') throw new Error('Invalid password-protected key format')
  const salt = hexToBytes(payload.salt)
  const iv   = hexToBytes(payload.iv)
  const ct   = hexToBytes(payload.ct)
  const key  = await derivePasswordKey(password, salt)
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
  return new TextDecoder().decode(plaintext)
}

function isPasswordEnvelope(stored) {
  if (!stored || typeof stored !== 'string') return false
  return stored.trim().startsWith('{') && stored.includes('"mode":"password"')
}

async function encryptPrivKey(privKeyHex) {
  const key   = await getOrCreateAesKey()
  const iv    = crypto.getRandomValues(new Uint8Array(12))
  const data  = new TextEncoder().encode(privKeyHex)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data)
  // Store as iv:ciphertext (hex)
  return bytesToHex(iv) + ':' + bytesToHex(new Uint8Array(ciphertext))
}

async function decryptPrivKey(stored) {
  const [ivHex, ctHex] = stored.split(':')
  if (!ivHex || !ctHex) throw new Error('Invalid encrypted key format')
  const key        = await getOrCreateAesKey()
  const iv         = hexToBytes(ivHex)
  const ciphertext = hexToBytes(ctHex)
  const plaintext  = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return new TextDecoder().decode(plaintext)
}


const BOLTZ_APIS = [
  'https://api.ark.boltz.exchange',
  'https://api.boltz.exchange',
]
const BOLTZ_NETWORK = 'bitcoin'
let _activeBoltzApi = BOLTZ_APIS[0]

async function buildSwaps(apiUrl = _activeBoltzApi) {
  const wallet = await init()
  const swapProvider = new BoltzSwapProvider({
    apiUrl,
    network: BOLTZ_NETWORK,
    referralId: 'arkade',
  })
  _activeBoltzApi = apiUrl
  return new ArkadeSwaps({ wallet, swapProvider, swapManager: true })
}

async function getSwaps(forceNew = false, preferredApi = null) {
  if (_swaps && !forceNew && (!preferredApi || preferredApi === _activeBoltzApi)) return _swaps
  if (forceNew) await disposeSwaps()
  _swaps = await buildSwaps(preferredApi || _activeBoltzApi)
  return _swaps
}

async function withSwapApiFallback(fn) {
  let lastErr = null
  for (const apiUrl of BOLTZ_APIS) {
    try {
      const swaps = await getSwaps(lastErr !== null, apiUrl)
      return await fn(swaps, apiUrl)
    } catch (err) {
      lastErr = err
      const msg = String(err?.message || err || '')
      const isFetchy = /fetch|network|cors|load failed|failed to fetch/i.test(msg)
      if (!isFetchy) throw err
    }
  }
  throw lastErr || new Error('Lightning provider unavailable')
}

async function disposeSwaps() {
  if (_swaps && typeof _swaps.dispose === 'function') {
    try { await _swaps.dispose() } catch {}
  }
  _swaps = null
}

// ─── Migration: upgrade unencrypted v1 key if present ─────────────────────

async function migrateV1Key(storage) {
  const OLD_KEY = 'arkade_wallet_privkey_mainnet_v1'
  const rawHex  = await storage.getItem(OLD_KEY)
  if (!rawHex || !/^[0-9a-fA-F]{64}$/.test(rawHex.trim())) return null
  console.log('[ArkON] Migrating v1 key to encrypted v2 storage…')
  const encrypted = await encryptPrivKey(rawHex.trim())
  await storage.setItem(STORAGE_KEY, encrypted)
  await storage.removeItem(OLD_KEY)
  console.log('[ArkON] Migration complete — v1 key removed')
  return rawHex.trim()
}

// ─── Init ──────────────────────────────────────────────────────────────────

export async function init() {
  if (_wallet) return _wallet

  _storage = new LocalStorageAdapter()

  let privateKeyHex = null

  const encryptedStored = await _storage.getItem(STORAGE_KEY)
  if (encryptedStored) {
    try {
      if (isPasswordEnvelope(encryptedStored)) {
        if (!_passwordUnlocked || !_sessionPrivKeyHex) {
          const err = new Error('Wallet password required')
          err.code = 'PASSWORD_REQUIRED'
          throw err
        }
        privateKeyHex = _sessionPrivKeyHex
      } else {
        privateKeyHex = await decryptPrivKey(encryptedStored)
        _sessionPrivKeyHex = privateKeyHex
        _passwordUnlocked = false
        console.log('[ArkON] Mainnet wallet decrypted from secure storage')
      }
    } catch (e) {
      if (e?.code === 'PASSWORD_REQUIRED') throw e
      console.warn('[ArkON] Decryption failed, attempting migration:', e)
    }
  }

  if (!privateKeyHex) {
    privateKeyHex = await migrateV1Key(_storage)
  }

  if (!privateKeyHex) {
    const newIdentity = SingleKey.fromRandomBytes()
    privateKeyHex = newIdentity.toHex()
    const encrypted = await encryptPrivKey(privateKeyHex)
    await _storage.setItem(STORAGE_KEY, encrypted)
    _sessionPrivKeyHex = privateKeyHex
    _passwordUnlocked = false
    console.log('[ArkON] New mainnet wallet created (encrypted)')
  }

  const identity = SingleKey.fromHex(privateKeyHex)

  _wallet = await Wallet.create({
    identity,
    arkServerUrl: ARK_SERVER,
    storage: _storage,
  })

  _manager = new VtxoManager(_wallet, { enabled: true, thresholdPercentage: 10 })

  console.log('[ArkON] Connected to', ARK_SERVER)
  return _wallet
}


export async function hasPasswordEnabled() {
  if (!_storage) _storage = new LocalStorageAdapter()
  const raw = await _storage.getItem(STORAGE_KEY)
  return isPasswordEnvelope(raw)
}

export async function unlockWithPassword(password) {
  if (!_storage) _storage = new LocalStorageAdapter()
  const raw = await _storage.getItem(STORAGE_KEY)
  if (!isPasswordEnvelope(raw)) return true
  const privKeyHex = await decryptPrivKeyWithPassword(raw, password)
  _sessionPrivKeyHex = privKeyHex
  _passwordUnlocked = true
  return true
}

export function lockWallet() {
  disposeSwaps().catch(() => {})
  _wallet = null
  _manager = null
  _sessionPrivKeyHex = null
  _passwordUnlocked = false
}

export async function enablePassword(password) {
  if (!_storage) _storage = new LocalStorageAdapter()
  const privKeyHex = await getPrivKey()
  if (!privKeyHex) throw new Error('No wallet key found')
  const encrypted = await encryptPrivKeyWithPassword(privKeyHex, password)
  await _storage.setItem(STORAGE_KEY, encrypted)
  _sessionPrivKeyHex = privKeyHex
  _passwordUnlocked = true
  disposeSwaps().catch(() => {})
  _wallet = null
  _manager = null
  return true
}

export async function disablePassword() {
  if (!_storage) _storage = new LocalStorageAdapter()
  const privKeyHex = await getPrivKey()
  if (!privKeyHex) throw new Error('No wallet key found')
  const encrypted = await encryptPrivKey(privKeyHex)
  await _storage.setItem(STORAGE_KEY, encrypted)
  _passwordUnlocked = false
  disposeSwaps().catch(() => {})
  _wallet = null
  _manager = null
  return true
}

export function getWallet() {
  if (!_wallet) throw new Error('Wallet not initialised — call init() first')
  return _wallet
}

export function getVtxoManager() {
  if (!_manager) throw new Error('VtxoManager not initialised — call init() first')
  return _manager
}

export async function getBalance() {
  const w = getWallet()
  try { await w.getVtxos() } catch { /* non-fatal */ }
  const bal = await w.getBalance()
  const available = Number(bal.available ?? bal.total ?? 0)
  const boarding  = Number(bal.boarding?.total ?? bal.boarding ?? 0)
  return {
    sats:     available + boarding,
    offchain: available,
    onchain:  boarding,
  }
}

export async function getArkFees() {
  try {
    const { fees } = await getWallet().arkProvider.getInfo()
    return fees ?? null
  } catch {
    return null
  }
}

export async function getAddress() {
  return await getWallet().getAddress()
}

export async function getBoardingAddress() {
  return await getWallet().getBoardingAddress()
}

export function detectAddressType(address) {
  if (!address || typeof address !== 'string') return 'unknown'
  let a = address.trim()
  a = a.replace(/^(ark|bitcoin|lightning):/i, '')
  const lower = a.toLowerCase()

  if (
    lower.startsWith('lnbc')  ||
    lower.startsWith('lntbs') ||
    lower.startsWith('lntb')  ||
    lower.startsWith('lnurl') ||
    (a.includes('@') && !a.includes('://'))
  ) return 'lightning'

  if (lower.startsWith('tark1') || lower.startsWith('ark1')) return 'ark'

  if (
    lower.startsWith('bc1')   ||
    lower.startsWith('tb1')   ||
    lower.startsWith('sb1')   ||
    lower.startsWith('bcrt1') ||
    /^[13]/.test(a)           ||
    /^[2mn]/.test(a)
  ) return 'bitcoin'

  return 'unknown'
}

export async function sendBitcoin({ address, amount }) {
  const cleanAddress = address.replace(/^(ark|bitcoin|lightning):/i, '')
  const satoshis = Math.floor(typeof amount === 'bigint' ? Number(amount) : Number(amount))
  if (!Number.isFinite(satoshis) || satoshis <= 0) {
    throw new Error('Amount must be a positive integer number of sats')
  }
  return await getWallet().sendBitcoin({ address: cleanAddress, amount: satoshis })
}

export async function onboard(eventCallback) {
  const w = getWallet()
  const { fees } = await w.arkProvider.getInfo()
  const ramps = new Ramps(w)
  return await ramps.onboard(fees, undefined, undefined, eventCallback)
}

export async function offboard({ address, amount, eventCallback }) {
  const w = getWallet()
  const { fees } = await w.arkProvider.getInfo()
  const ramps = new Ramps(w)
  const bigAmt = amount ? BigInt(Math.floor(amount)) : undefined
  return await ramps.offboard(address, fees, bigAmt, eventCallback)
}

// ─── VTXO Management ───────────────────────────────────────────────────────

export async function checkAndRenewVtxos() {
  const m = getVtxoManager()
  const expiring = await m.getExpiringVtxos()
  if (expiring.length === 0) return { renewed: false, count: 0 }
  console.log(`[ArkON] Renewing ${expiring.length} expiring VTXOs…`)
  const txid = await m.renewVtxos()
  console.log('[ArkON] Renewal txid:', txid)
  return { renewed: true, count: expiring.length, txid }
}

export async function getVtxoStatus() {
  const w = getWallet()
  const m = getVtxoManager()
  try { await w.getVtxos() } catch { /* non-fatal */ }
  const bal = await w.getBalance()
  const expiring = await m.getExpiringVtxos()
  const recoverable = await m.getRecoverableBalance()
  return {
    spendable: Number(bal.available ?? bal.total ?? 0),
    boarding: Number(bal.boarding?.total ?? bal.boarding ?? 0),
    expiringCount: expiring?.length || 0,
    recoverable: Number(recoverable?.recoverable ?? 0n),
    subdust: Number(recoverable?.subdust ?? 0n),
    recoverableCount: recoverable?.vtxoCount ?? 0,
  }
}

export async function getRecoverableBalance() {
  const m = getVtxoManager()
  const bal = await m.getRecoverableBalance()
  return {
    recoverable: Number(bal.recoverable ?? 0n),
    subdust:     Number(bal.subdust ?? 0n),
    vtxoCount:   bal.vtxoCount ?? 0,
  }
}

export async function recoverVtxos(eventCallback) {
  const m = getVtxoManager()
  return await m.recoverVtxos(eventCallback)
}

export async function getTransactionHistory() {
  try {
    const list = await getWallet().getTransactionHistory()
    return list.map(tx => {
      const txid = tx.key?.arkTxid || tx.key?.boardingTxid || tx.key?.commitmentTxid || ''
      let network = 'Bitcoin'
      if (tx.key?.arkTxid && !tx.key?.boardingTxid) network = 'Ark'
      if (tx.key?.commitmentTxid)                   network = 'Bitcoin (Exit)'
      return {
        id: txid, type: tx.type, amount: Number(tx.amount),
        settled: tx.settled, createdAt: tx.createdAt,
        date: (() => {
          if (!tx.createdAt && tx.createdAt !== 0) return null
          const n = Number(tx.createdAt)
          if (!n || n < 0 || isNaN(n)) return null
          const d = new Date(n > 1e12 ? n : n * 1000)
          return isNaN(d.getTime()) ? null : d
        })(),
        network,
        arkTxid:        tx.key?.arkTxid        || null,
        boardingTxid:   tx.key?.boardingTxid   || null,
        commitmentTxid: tx.key?.commitmentTxid || null,
      }
    })
  } catch (e) {
    console.warn('[ArkON] History fetch failed:', e)
    throw e
  }
}


export async function exportEncryptedBackup(password) {
  const pwd = String(password || '').trim()
  if (pwd.length < 10) throw new Error('Backup password must be at least 10 characters')
  const privKeyHex = await getPrivKey()
  if (!privKeyHex) throw new Error('Wallet must be unlocked before exporting a backup')
  return {
    version: 1,
    walletType: 'arkon-mainnet',
    createdAt: new Date().toISOString(),
    keyEnvelope: JSON.parse(await encryptPrivKeyWithPassword(privKeyHex, pwd)),
  }
}

export async function restoreFromEncryptedBackup(payload, password) {
  const pwd = String(password || '').trim()
  if (!payload || typeof payload !== 'object') throw new Error('Invalid backup file')
  if (payload.walletType !== 'arkon-mainnet' || !payload.keyEnvelope) throw new Error('Unsupported backup format')
  const privKeyHex = await decryptPrivKeyWithPassword(payload.keyEnvelope, pwd)
  return await restoreFromPrivKey(privKeyHex)
}

// getPrivKey — returns the decrypted hex key for backup display
export async function getPrivKey() {
  if (_sessionPrivKeyHex) return _sessionPrivKeyHex
  if (!_storage) _storage = new LocalStorageAdapter()
  const encrypted = await _storage.getItem(STORAGE_KEY)
  if (!encrypted) {
    const old = await _storage.getItem('arkade_wallet_privkey_mainnet_v1')
    return old || null
  }
  try {
    if (isPasswordEnvelope(encrypted)) {
      return _passwordUnlocked ? _sessionPrivKeyHex : null
    }
    const priv = await decryptPrivKey(encrypted)
    _sessionPrivKeyHex = priv
    return priv
  } catch {
    return null
  }
}


export async function listenForIncoming(cb) {
  const incoming = await waitForIncomingFunds(getWallet())
  let sats = 0
  if (incoming?.type === 'utxo') {
    sats = (incoming.coins || []).reduce((sum, c) => sum + Number(c.value || 0), 0)
  } else if (incoming?.type === 'vtxo') {
    sats = (incoming.newVtxos || []).reduce((sum, v) => sum + Number(v.value || 0), 0)
  }
  if (cb) await cb({ type: incoming?.type, sats, raw: incoming })
  return { type: incoming?.type, sats, raw: incoming }
}

export async function resetWallet() {
  if (!_storage) _storage = new LocalStorageAdapter()
  await _storage.removeItem(STORAGE_KEY)
  await _storage.removeItem('arkade_wallet_privkey_mainnet_v1')
  // Clear the IDB encryption key too (full reset)
  try {
    const db = await openIDB()
    await new Promise((resolve, reject) => {
      const tx  = db.transaction(IDB_STORE, 'readwrite')
      const req = tx.objectStore(IDB_STORE).delete(IDB_KEY_ID)
      req.onsuccess = () => resolve()
      req.onerror   = e => reject(e.target.error)
    })
  } catch { /* non-fatal */ }
  disposeSwaps().catch(() => {})
  _wallet  = null
  _manager = null
  _storage = null
  _sessionPrivKeyHex = null
  _passwordUnlocked = false
}

export async function restoreFromPrivKey(privKeyHex) {
  const hex = (privKeyHex || '').trim()
  if (hex.length !== 64 || !/^[0-9a-fA-F]+$/.test(hex)) return false
  if (!_storage) _storage = new LocalStorageAdapter()
  const encrypted = await encryptPrivKey(hex)
  await _storage.setItem(STORAGE_KEY, encrypted)
  disposeSwaps().catch(() => {})
  _wallet  = null
  _manager = null
  _sessionPrivKeyHex = hex
  _passwordUnlocked = false
  return true
}

export const ARK_SERVER_URL  = ARK_SERVER
export const ESPLORA_API_URL = 'https://mempool.space/api'


export async function createLightningInvoice({ amount, description }) {
  return await withSwapApiFallback(async (swaps) => {
    return await swaps.createLightningInvoice({
      amount: Math.floor(Number(amount)),
      description: String(description || '').trim() || undefined,
    })
  })
}

export async function payLightningInvoice({ invoice, maxFeeSats }) {
  return await withSwapApiFallback(async (swaps) => {
    return await swaps.sendLightningPayment({
      invoice: String(invoice || '').trim(),
      maxFeeSats: maxFeeSats == null ? undefined : Math.floor(Number(maxFeeSats)),
    })
  })
}

export function decodeLightningPaymentRequest(invoice) {
  return decodeInvoice(String(invoice || '').trim())
}

export async function getLightningSwaps() {
  return await getSwaps()
}

export const BOLTZ_API_URL = BOLTZ_APIS[0]
