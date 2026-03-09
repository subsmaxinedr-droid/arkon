/**
 * main.js — Arkade Wallet v46
 * Drives the full UI on top of @arkade-os/sdk (Bitcoin mainnet — arkade.computer).
 *
 * Send routing:
 *   ark     → sendBitcoin()   — off-chain, instant, batched
 *   bitcoin → offboard()      — collaborative exit to on-chain
 *   lightning → open Boltz    — swap out via Boltz.exchange
 *
 * Fixes in v41:
 *   FIX #3  — _sendInProgress auto-clears after 30s so a stuck flag never
 *             permanently blocks incoming vtxo refresh
 *   FIX #4  — Transaction dedup uses amount+createdAt composite key, not
 *             amount alone (prevented distinct same-value txs from showing)
 *   FIX #5  — window._sdkSendBitcoin now sets _sendInProgress so change VTXOs
 *             from external-app sends don't fire false "Received" notifications
 *   FIX #6  — setInterval IDs stored in _pollIntervals; startPolling() is
 *             idempotent so boot retries don't stack duplicate intervals
 *   FIX #7  — Watcher re-arms immediately on success; 5s delay only on error,
 *             eliminating the blind window where incoming payments were missed
 *   FIX #8  — confirmSend validates amount > 0 and isNaN guard; negative /
 *             NaN amounts no longer reach sendBitcoin / offboard
 *   FIX #9  — showBootError nulls _wallet before retry so a partial init
 *             doesn't return a stale singleton on the next boot attempt
 *   FIX #12 — VtxoManager renewal (daily) and recovery (weekly) wired up in boot
 *   (wallet.js carries fixes #1, #2, #10, #11)
 */

import {
  init,
  getBalance,
  getAddress,
  getBoardingAddress,
  sendBitcoin,
  onboard,
  offboard,
  detectAddressType,
  getTransactionHistory,
  listenForIncoming,
  resetWallet,
  restoreFromPrivKey,
  hasPasswordEnabled,
  unlockWithPassword,
  enablePassword,
  disablePassword,
  exportEncryptedBackup,
  restoreFromEncryptedBackup,
  lockWallet,
  getVtxoManager,
  getArkFees,
  checkAndRenewVtxos,
  getRecoverableBalance,
  getVtxoStatus,
  recoverVtxos,
  ARK_SERVER_URL,
  ESPLORA_API_URL,
  createLightningInvoice,
  decodeLightningPaymentRequest,
  getLightningSwaps,
} from './wallet.js'

// ─── Shared state ──────────────────────────────────────────────────────────
window._btcUsd    = null
window._feeRates  = null
window._wallet    = { sats: 0, offchain: 0, onchain: 0 }
window._refreshTransactions = () => refreshTransactions()
window._detectAddressType   = detectAddressType

// FIX #5 — _sdkSendBitcoin now guards with _sendInProgress so external-app
// sends don't trigger spurious "Bitcoin Received" notifications for change VTXOs
window._sdkSendBitcoin = async ({ address, amount }) => {
  await init()  // ensure wallet is ready before any SDK call
  _sendInProgress = true
  // FIX #3 — safety timeout in case the call crashes without reaching finally
  const safetyTimer = setTimeout(() => { _sendInProgress = false }, 30_000)
  try {
    return await sendBitcoin({ address, amount })
  } finally {
    clearTimeout(safetyTimer)
    _sendInProgress = false
  }
}

// FIX #3 — auto-clear after 30s so a stuck flag never permanently blocks incoming events
window._setSendInProgress = (val) => {
  _sendInProgress = val
  if (val) setTimeout(() => { _sendInProgress = false }, 30_000)
}

window._openBackupSheet = null  // filled in below after definition
window._doRestoreWallet  = null  // filled in below after definition

window._generateLightningInvoice = async ({ amount, description }) => {
  const result = await createLightningInvoice({ amount, description })
  return result
}
window._getLightningSwaps = async () => await getLightningSwaps()
window._decodeLightningInvoice = (invoice) => decodeLightningPaymentRequest(invoice)

// Mutex: prevent concurrent onboard calls (boot + watcher race condition)
let _onboardInProgress = false
// Guard: suppress watcher notifications during an outbound send
let _sendInProgress = false
// Guard: suppress boarding.total from balance sum during a collaborative exit.
// When offboard() broadcasts, the exit UTXO immediately appears in boarding.total
// while the source VTXO hasn't been consumed yet — summing both doubles the display.
let _offboardInProgress = false
// Singleton: only one incoming watcher loop may run at a time
let _watcherRunning = false
// FIX #6 — store interval IDs so startPolling() is idempotent
const _pollIntervals = []
let _passwordPromptedThisSession = false

const AUTO_LOCK_MS = 5 * 60 * 1000
let _autoLockTimer = null

function resetAutoLockTimer() {
  clearTimeout(_autoLockTimer)
  _autoLockTimer = setTimeout(async () => {
    try {
      const needsPassword = await hasPasswordEnabled()
      if (!needsPassword) return
      lockWallet()
      _passwordPromptedThisSession = false
      showToast('Wallet locked')
    } catch {}
  }, AUTO_LOCK_MS)
}

function wireSecurityHardening() {
  ;['click','keydown','pointerdown','touchstart'].forEach(evt => {
    window.addEventListener(evt, resetAutoLockTimer, { passive: true })
  })
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'hidden') {
      try {
        const needsPassword = await hasPasswordEnabled()
        if (needsPassword) {
          lockWallet()
          _passwordPromptedThisSession = false
        }
      } catch {}
    } else {
      resetAutoLockTimer()
    }
  })
  resetAutoLockTimer()
}

async function promptForSecret(message, placeholder = '') {
  const value = window.prompt(message, placeholder)
  if (value === null) throw Object.assign(new Error('Cancelled'), { code: 'CANCELLED' })
  const trimmed = String(value).trim()
  if (!trimmed) throw Object.assign(new Error('Value required'), { code: 'VALUE_REQUIRED' })
  return trimmed
}

function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}


async function ensureUnlockedIfNeeded() {
  const needsPassword = await hasPasswordEnabled()
  if (!needsPassword) return true
  if (_passwordPromptedThisSession) return true

  const password = window.prompt('Enter your wallet password')
  if (password === null) throw Object.assign(new Error('Wallet password required'), { code: 'PASSWORD_REQUIRED' })
  if (!password) throw Object.assign(new Error('Wallet password required'), { code: 'PASSWORD_REQUIRED' })

  try {
    await unlockWithPassword(password)
    _passwordPromptedThisSession = true
    return true
  } catch {
    showToast('Incorrect password')
    throw Object.assign(new Error('Wallet password required'), { code: 'PASSWORD_REQUIRED' })
  }
}

// ─── Boot ──────────────────────────────────────────────────────────────────
async function boot() {
  try {
    console.log('[ArkON] Booting…')
    await ensureUnlockedIfNeeded()
    await init()

    const [arkAddr, boardingAddr] = await Promise.all([
      getAddress(),
      getBoardingAddress(),
    ])

    if (window._setLiveAddresses) {
      window._setLiveAddresses(arkAddr, boardingAddr)
    }

    await Promise.all([
      refreshBalance(),
      refreshTransactions(),
      refreshBtcPrice(),
      refreshFees(),
      refreshAdvancedVtxoPanel(),
    ])

    // Auto-onboard if there are boarding UTXOs waiting
    if ((window._wallet?.onchain || 0) > 0) {
      console.log('[ArkON] Boarding balance found on boot — auto-onboarding…')
      _onboardInProgress = true
      onboard().then(async () => {
        await refreshBalance()
        await refreshTransactions()
        await refreshAdvancedVtxoPanel()
      }).catch(e => console.warn('[ArkON] Auto-onboard on boot failed:', e))
        .finally(() => { _onboardInProgress = false })
    }

    wireConfirmSend()
    wireOnboard()
    wireVtxoManagement()
    wireBackup()
    wireReset()
    wireExternalApps()
    wireSecurityHardening()
    if (window._syncPasswordToggle) await window._syncPasswordToggle()
    startIncomingWatcher()
    startPolling()
    // FIX #12 — wire VTXO renewal and recovery
    startVtxoManager()
  } catch (err) {
    console.error('[ArkON] Boot error:', err)
    showBootError(err)
  }

  hideLoading()
}

function hideLoading() {
  const el = document.getElementById('sdk-loading')
  if (el) {
    el.style.pointerEvents = 'none'
    el.classList.add('fade')
    setTimeout(() => el.remove(), 500)
  }
}

// FIX #9 — null _wallet before retry so a partially-initialised singleton
// isn't returned on the next boot attempt
function showBootError(err) {
  hideLoading()
  if (err?.code === 'PASSWORD_REQUIRED') {
    console.warn('[ArkON] Boot paused — password required')
    const retry = document.getElementById('sdk-loading-retry')
    if (retry) {
      retry.style.display = 'inline-flex'
      retry.textContent = 'Unlock wallet'
      retry.onclick = () => {
        _passwordPromptedThisSession = false
        const el = document.getElementById('sdk-loading')
        if (el) el.classList.remove('fade')
        boot()
      }
    }
    showToast('Wallet locked')
    return
  }
  console.warn('[ArkON] Boot failed, retrying…', err)
  resetWallet().catch(() => {})
  setTimeout(() => boot(), 8000)
}


window._savePasswordSettings = async function({ enabled, password, confirmPassword }) {
  try {
    const currentlyEnabled = await hasPasswordEnabled()

    if (enabled) {
      const first = String(password || '')
      const second = String(confirmPassword || '')
      if (first.length < 4) throw new Error('Use at least 4 characters')
      if (first !== second) throw new Error('Passwords did not match')
      await enablePassword(first)
      _passwordPromptedThisSession = true
      showToast(currentlyEnabled ? 'Password updated' : 'Password enabled')
    } else {
      await disablePassword()
      _passwordPromptedThisSession = false
      showToast('Password disabled')
    }

    if (window._syncPasswordToggle) await window._syncPasswordToggle()
    return { ok: true }
  } catch (err) {
    if (window._syncPasswordToggle) await window._syncPasswordToggle()
    console.warn('[ArkON] Password settings save failed:', err)
    return { ok: false, error: err?.message || 'Could not update password settings' }
  }
}

window._syncPasswordToggle = async function() {
  try {
    const enabled = await hasPasswordEnabled()
    const els = Array.from(document.querySelectorAll('[data-password-toggle]'))
    els.forEach(el => el.classList.toggle('on', !!enabled))

    const statusText = enabled ? 'Password required on app open' : 'No password required'
    const ids = ['password-status-text', 'adv-password-status', 'password-sheet-status']
    ids.forEach(id => {
      const el = document.getElementById(id)
      if (el) el.textContent = statusText
    })

    if (window._setPasswordSheetState) window._setPasswordSheetState(enabled)
    return enabled
  } catch (err) {
    console.warn('[ArkON] Failed to sync password toggle:', err)
    return false
  }
}

// ─── FIX #12 — VtxoManager: renewal + recovery ────────────────────────────
function startVtxoManager() {
  try {
    const manager = getVtxoManager()

    // Daily renewal check
    const dailyRenew = async () => {
      try {
        const expiring = await manager.getExpiringVtxos()
        if (expiring.length > 0) {
          console.log(`[ArkON] Renewing ${expiring.length} expiring VTXO(s)…`)
          const txid = await manager.renewVtxos()
          console.log('[ArkON] VTXO renewal txid:', txid)
          await refreshBalance()
          await refreshTransactions()
        }
      } catch (e) {
        console.warn('[ArkON] VTXO renewal check failed:', e)
      }
    }

    // Weekly recovery check
    const weeklyRecover = async () => {
      try {
        const bal = await manager.getRecoverableBalance()
        if (bal.recoverable > 0n) {
          console.log(`[ArkON] Recovering ${bal.recoverable} sats of swept VTXOs…`)
          const txid = await manager.recoverVtxos((event) => {
            console.log('[ArkON] Recovery event:', event.type)
          })
          console.log('[ArkON] VTXO recovery txid:', txid)
          await refreshBalance()
          await refreshTransactions()
        }
      } catch (e) {
        console.warn('[ArkON] VTXO recovery check failed:', e)
      }
    }

    // Run immediately on boot, then on schedule
    dailyRenew()
    weeklyRecover()

    setInterval(dailyRenew,   24 * 60 * 60 * 1000)
    setInterval(weeklyRecover, 7 * 24 * 60 * 60 * 1000)

    console.log('[ArkON] VtxoManager started')
  } catch (e) {
    console.warn('[ArkON] VtxoManager not available:', e)
  }
}

// ─── BTC Price (Kraken) ────────────────────────────────────────────────────
async function refreshBtcPrice() {
  try {
    const res  = await fetch('https://api.kraken.com/0/public/Ticker?pair=XBTUSD,XBTEUR,XBTCHF')
    const json = await res.json()
    const r    = json.result || {}

    const usd = parseFloat((r['XXBTZUSD'] || r['XBTUSD'] || {}).c?.[0])
    const eur = parseFloat((r['XXBTZEUR'] || r['XBTEUR'] || {}).c?.[0])
    const chf = parseFloat((r['XBTCHF']  || {}).c?.[0])

    if (usd > 1000) {
      window._btcUsd = usd
      if (window._livePrices) {
        if (usd > 1000) window._livePrices.USD = usd
        if (eur > 1000) window._livePrices.EUR = eur
        if (chf > 1000) window._livePrices.CHF = chf
      }
    }

    if (typeof updateChartHeader   === 'function') updateChartHeader()
    if (typeof walletUpdateDisplay === 'function') walletUpdateDisplay()
    console.log('[ArkON] BTC prices — USD:', usd, 'EUR:', eur, 'CHF:', chf)
  } catch (e) {
    console.warn('[ArkON] Kraken price fetch failed:', e)
  }
}

// ─── Fees (mempool.space) ──────────────────────────────────────────────────
async function refreshFees() {
  if (typeof fetchFeeRates  === 'function') await fetchFeeRates()
  if (typeof refreshFeeGrid === 'function') refreshFeeGrid()
}

// ─── Balance ───────────────────────────────────────────────────────────────
async function refreshBalance() {
  try {
    const bal = await getBalance()

    // During an offboard the exit UTXO briefly appears in bal.onchain while the
    // source VTXO hasn't been consumed yet — summing both doubles the display.
    // During an onboard the boarding UTXO and the new preconfirmed VTXO both
    // show their full value simultaneously — same doubling problem.
    // Fix for both: when either operation is in flight, take the MAX of the two
    // sides rather than summing, since the funds are the same sats moving buckets.
    let displaySats
    if (_offboardInProgress) {
      // Offboard: source VTXO still shows, exit UTXO appearing — exclude onchain
      displaySats = bal.offchain
    } else if (_onboardInProgress) {
      // Onboard: boarding UTXO still shows AND new VTXO preconfirmed — take max
      displaySats = Math.max(bal.offchain, bal.onchain)
    } else {
      displaySats = bal.offchain + bal.onchain
    }

    window._wallet = { sats: displaySats, offchain: bal.offchain, onchain: bal.onchain }

    if (typeof walletUpdateDisplay === 'function') walletUpdateDisplay()
    console.log('[ArkON] Balance — total:', displaySats, '| offchain:', bal.offchain, '| boarding:', bal.onchain,
      _offboardInProgress ? '(offboard in progress)' : _onboardInProgress ? '(onboard in progress)' : '')
  } catch (e) {
    console.warn('[ArkON] Balance fetch failed:', e)
  }
}

// ─── Wire onboard ─────────────────────────────────────────────────────────
function wireOnboard() {
  window.doOnboard = async function() {
    if (_onboardInProgress) {
      if (typeof showToast === 'function') showToast('Onboarding already in progress…')
      return
    }
    _onboardInProgress = true
    openSettleProgress('Onboarding to Ark…', 'Moving your boarding funds into Ark. This may take a few seconds.')
    try {
      const txid = await onboard((event) => {
        updateSettleProgress(event)
      })
      console.log('[ArkON] Onboard complete — txid:', txid)
      closeSettleProgress()
      showSettleResult(true, 'Onboarded to Ark!', 'Your funds are now in Ark and ready to use.')
      await refreshBalance()
      await refreshTransactions()
      await refreshAdvancedVtxoPanel()
    } catch (err) {
      console.error('[ArkON] Onboard failed:', err)
      closeSettleProgress()
      showSettleResult(false, 'Onboard Failed', err.message || 'Could not onboard funds')
    } finally {
      _onboardInProgress = false
    }
  }
}

async function refreshAdvancedVtxoPanel() {
  const spendEl = document.getElementById('adv-vtxo-spendable')
  const boardEl = document.getElementById('adv-vtxo-boarding')
  const expEl   = document.getElementById('adv-vtxo-expiring')
  const recEl   = document.getElementById('adv-vtxo-recoverable')
  const subEl   = document.getElementById('adv-vtxo-subdust')
  const cntEl   = document.getElementById('adv-vtxo-count')

  try {
    const s = await getVtxoStatus()
    if (spendEl) spendEl.textContent = `${s.spendable.toLocaleString()} sats`
    if (boardEl) boardEl.textContent = `${s.boarding.toLocaleString()} sats`
    if (expEl)   expEl.textContent   = `${s.expiringCount.toLocaleString()} expiring`
    if (recEl)   recEl.textContent   = `${s.recoverable.toLocaleString()} sats`
    if (subEl)   subEl.textContent   = `${s.subdust.toLocaleString()} sats`
    if (cntEl)   cntEl.textContent   = `${s.recoverableCount.toLocaleString()} recoverable`
  } catch (err) {
    console.warn('[ArkON] Advanced VTXO panel refresh failed:', err)
    if (spendEl) spendEl.textContent = '—'
    if (boardEl) boardEl.textContent = '—'
    if (expEl)   expEl.textContent   = '—'
    if (recEl)   recEl.textContent   = '—'
    if (subEl)   subEl.textContent   = '—'
    if (cntEl)   cntEl.textContent   = '—'
  }
}

window.refreshAdvancedVtxoPanel = refreshAdvancedVtxoPanel

// ─── Wire VTXO management UI buttons ──────────────────────────────────────
function wireVtxoManagement() {
  window.doRenewVtxos = async function() {
    const subEl = document.getElementById('renew-vtxos-sub')
    if (subEl) subEl.textContent = 'Checking…'
    try {
      const { renewed, count, txid } = await checkAndRenewVtxos()
      if (renewed) {
        if (typeof showToast === 'function') showToast(`Renewed ${count} VTXO(s) ✓`)
        if (subEl) subEl.textContent = `Renewed ${count} VTXO(s)`
        await refreshBalance()
        await refreshTransactions()
        await refreshAdvancedVtxoPanel()
      } else {
        if (typeof showToast === 'function') showToast('No VTXOs need renewal right now')
        if (subEl) subEl.textContent = 'All VTXOs are healthy'
        await refreshAdvancedVtxoPanel()
      }
    } catch (err) {
      console.error('[ArkON] Renewal failed:', err)
      if (typeof showToast === 'function') showToast('Renewal failed: ' + (err.message || 'Unknown error'))
      if (subEl) subEl.textContent = 'Check & renew expiring virtual coins'
      await refreshAdvancedVtxoPanel()
    }
  }

  window.doRecoverVtxos = async function() {
    const subEl = document.getElementById('recover-vtxos-sub')
    if (subEl) subEl.textContent = 'Checking…'
    try {
      const bal = await getRecoverableBalance()
      if (bal.recoverable === 0) {
        if (typeof showToast === 'function') showToast('Nothing to recover right now')
        if (subEl) subEl.textContent = 'No recoverable coins found'
        await refreshAdvancedVtxoPanel()
        return
      }
      if (subEl) subEl.textContent = `Recovering ${bal.recoverable.toLocaleString()} sats…`
      openSettleProgress('Recovering VTXOs…', `Reclaiming ${bal.recoverable.toLocaleString()} sats of swept coins.`)
      const txid = await recoverVtxos((event) => updateSettleProgress(event))
      closeSettleProgress()
      showSettleResult(true, 'VTXOs Recovered!', `${bal.recoverable.toLocaleString()} sats returned to your wallet.`)
      if (subEl) subEl.textContent = 'Reclaim swept or expired coins'
      await refreshBalance()
      await refreshTransactions()
      await refreshAdvancedVtxoPanel()
    } catch (err) {
      console.error('[ArkON] Recovery failed:', err)
      closeSettleProgress()
      if (typeof showToast === 'function') showToast('Recovery failed: ' + (err.message || 'Unknown error'))
      if (subEl) subEl.textContent = 'Reclaim swept or expired coins'
      await refreshAdvancedVtxoPanel()
    }
  }
}

// ─── Settlement progress overlay helpers ───────────────────────────────────
function openSettleProgress(title, subtitle) {
  let el = document.getElementById('sheet-settle-progress')
  if (el) {
    document.getElementById('settle-progress-title').textContent   = title    || 'Processing…'
    document.getElementById('settle-progress-subtitle').textContent = subtitle || ''
    document.getElementById('settle-progress-status').textContent  = 'Waiting for Ark round…'
    el.classList.add('open')
  }
}

function updateSettleProgress(event) {
  const el = document.getElementById('settle-progress-status')
  if (!el || !event) return

  const type = String(event.type || '').toLowerCase()
  const messages = {
    streamentified:         'Connected to Ark server…',
    streamstarted:          'Connected to Ark server…',
    batchstarted:           'Batch started…',
    treesigningstarted:     'Signing VTXO tree…',
    treenonces:             'Collecting nonces…',
    treetx:                 'Building transaction…',
    treesignature:          'Collecting signatures…',
    batchfinalization:      'Finalising batch…',
    batchfinalized:         'Batch confirmed ✓',
    batchfailed:            'Batch failed — retrying…',
  }
  el.textContent = messages[type] || el.textContent
}

function closeSettleProgress() {
  const el = document.getElementById('sheet-settle-progress')
  if (el) el.classList.remove('open')
}

function showSettleResult(success, title, message) {
  const iconWrap = document.getElementById('settle-result-icon')
  const iconSvg  = document.getElementById('settle-result-icon-svg')
  const titleEl  = document.getElementById('settle-result-title')
  const subEl    = document.getElementById('settle-result-sub')

  if (iconWrap) iconWrap.style.background = success ? 'var(--grns)' : 'var(--reds)'
  if (iconSvg) {
    iconSvg.style.color = success ? 'var(--grn)' : 'var(--red)'
    iconSvg.innerHTML   = success
      ? '<polyline points="20 6 9 17 4 12"/>'
      : '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'
  }
  if (titleEl) titleEl.textContent = title
  if (subEl)   subEl.textContent   = message

  if (typeof openSheet === 'function') openSheet('settleresult')
}

// ─── Transactions ──────────────────────────────────────────────────────────
window._TX_REGISTRY = {}

function txClass(tx) {
  const t = String(tx.type).toLowerCase()
  if (t.includes('receiv') || t === 'txreceived') return 'in'
  if (t.includes('sent')   || t === 'txsent')     return 'out'
  if (t.includes('board'))                         return 'in'
  if (t.includes('exit')   || t.includes('commit')) return 'out'
  return tx.settled === false ? 'pnd' : 'out'
}

function txLabel(tx, cls) {
  const t = String(tx.type).toLowerCase()
  if (t.includes('board'))                         return 'Boarding deposit'
  if (t.includes('exit') || t.includes('commit'))  return 'Exit to on-chain'
  if (cls === 'in')  return 'Received'
  return 'Sent'
}

function txIcon(cls) {
  if (cls === 'in')  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>`
  if (cls === 'pnd') return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`
}

function txStatusLabel(tx) {
  return tx.settled ? 'Settled' : 'Preconfirmed'
}

function emptyTxState(container) {
  container.innerHTML = `
    <div style="padding:28px 16px;text-align:center;color:var(--t3)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:32px;height:32px;margin:0 auto 10px;display:block;opacity:.4"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
      <div style="font-size:13px">No transactions yet</div>
    </div>`
}

async function refreshTransactions() {
  try {
    const history = await getTransactionHistory()

    if (!history || history.length === 0) {
      const homeList = document.getElementById('home-tx-list')
      const fullList = document.getElementById('tx-list')
      const alreadyHasTxs = (homeList && homeList.children.length > 0) ||
                            (fullList && fullList.children.length > 0)
      if (!alreadyHasTxs) {
        if (homeList) emptyTxState(homeList)
        if (fullList) emptyTxState(fullList)
      }
      return
    }

    // FIX #4 — dedup boarding vs vtxo entries using amount+createdAt composite
    // key instead of amount alone. Using amount alone caused real distinct
    // transactions with the same sat value to be incorrectly hidden.
    const settledVtxoKeys = new Set(
      history
        .filter(tx => tx.arkTxid && !tx.boardingTxid && tx.settled)
        .map(tx => `${tx.amount}:${tx.createdAt}`)
    )
    const deduped = history.filter(tx => {
      if (tx.boardingTxid && !tx.arkTxid) {
        // Hide pure boarding deposit entry only when a settled vtxo entry
        // for the exact same amount AND timestamp exists (onboard completed).
        return !settledVtxoKeys.has(`${tx.amount}:${tx.createdAt}`)
      }
      return true
    })

    const homeList = document.getElementById('home-tx-list')
    const fullList = document.getElementById('tx-list')

    if (homeList) homeList.innerHTML = ''
    if (fullList) fullList.innerHTML = ''

    window._TX_REGISTRY = {}

    deduped.forEach((tx, i) => {
      const cls    = txClass(tx)
      const label  = txLabel(tx, cls)
      const sign   = cls === 'in' ? '+' : '−'

      const activeCur    = document.getElementById('cur-settings-sel')?.value || 'USD'
      const sym          = { USD:'$', EUR:'€', CHF:'CHF ' }[activeCur] || '$'
      const currentPrice = (window._livePrices?.[activeCur]) || window._btcUsd || 96420
      const currentFiat  = (tx.amount * currentPrice / 1e8).toFixed(2)

      const txDate      = tx.date
      const hasDate     = txDate instanceof Date && !isNaN(txDate)
      const dateStr     = hasDate ? txDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Pending'
      const timeStr     = hasDate ? txDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''
      const dateFullStr = hasDate ? txDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Pending'
      const timeFullStr = hasDate ? txDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'

      const status = txStatusLabel(tx)
      const txid   = tx.id || ''
      const rowId  = 'tx_live_' + i

      let historicalFiat = sym + currentFiat
      if (hasDate && tx.amount > 0) {
        const dd = String(txDate.getDate()).padStart(2,'0')
        const mm = String(txDate.getMonth()+1).padStart(2,'0')
        const yyyy = txDate.getFullYear()
        const cgDate = `${dd}-${mm}-${yyyy}`
        const cgCur  = activeCur.toLowerCase()
        const cacheKey = `hist_${cgDate}_${cgCur}`

        if (!window._histPriceCache)   window._histPriceCache   = {}
        if (!window._histPricePending) window._histPricePending  = {}

        if (window._histPriceCache[cacheKey]) {
          const hp = window._histPriceCache[cacheKey]
          historicalFiat = sym + (tx.amount * hp / 1e8).toFixed(2)
        } else {
          const applyHistPrice = (hp) => {
            window._histPriceCache[cacheKey] = hp
            const reg = window._TX_REGISTRY[rowId]
            if (reg) {
              reg.histFiat = sym + (tx.amount * hp / 1e8).toFixed(2)
              reg.nowFiat  = sym + currentFiat
              const rowEl = document.querySelector(`[data-rowid="${rowId}"] .txf`)
              if (rowEl) rowEl.textContent = sign + sym + (tx.amount * hp / 1e8).toFixed(2)
              if (window._openDetailRowId === rowId && typeof showLiveTxDetail === 'function') {
                showLiveTxDetail(rowId)
              }
            }
          }
          if (window._histPricePending[cacheKey]) {
            window._histPricePending[cacheKey].then(hp => { if (hp) applyHistPrice(hp) }).catch(() => {})
          } else {
            const delay = Object.keys(window._histPricePending).length * 350
            const fetchPromise = new Promise((resolve) => {
              setTimeout(async () => {
                try {
                  const r = await fetch(`https://api.coingecko.com/api/v3/coins/bitcoin/history?date=${cgDate}&localization=false`)
                  if (r.status === 429) { resolve(null); return }
                  const d = await r.json()
                  const hp = d?.market_data?.current_price?.[cgCur]
                  resolve((hp && hp > 100) ? hp : null)
                } catch { resolve(null) }
              }, delay)
            })
            window._histPricePending[cacheKey] = fetchPromise
            fetchPromise.then(hp => {
              delete window._histPricePending[cacheKey]
              if (hp) applyHistPrice(hp)
            }).catch(() => { delete window._histPricePending[cacheKey] })
          }
        }
      }

      window._TX_REGISTRY[rowId] = {
        cls, label, sign, status,
        amount:   tx.amount,
        fiat:     historicalFiat,
        histFiat: historicalFiat,
        nowFiat:  sym + currentFiat,
        cur:      activeCur,
        sym,
        date:     dateFullStr,
        time:     timeFullStr,
        rawDate:  txDate instanceof Date && !isNaN(txDate) ? txDate : null,
        network:  tx.network,
        txid,
        settled:  tx.settled,
        arkTxid:        tx.arkTxid,
        boardingTxid:   tx.boardingTxid,
        commitmentTxid: tx.commitmentTxid,
      }

      const row = document.createElement('div')
      row.className = 'txr'
      row.setAttribute('data-type', cls)
      row.setAttribute('data-rowid', rowId)
      row.setAttribute('onclick', `showLiveTxDetail('${rowId}')`)
      row.innerHTML = `
        <div class="txico ${cls}">${txIcon(cls)}</div>
        <div class="txinf">
          <div class="txnm">${label}</div>
          <div class="txmt">${dateStr}${timeStr ? ' · ' + timeStr : ''}${tx.settled ? '' : ' · Pending'}</div>
        </div>
        <div class="txamt">
          <div class="txb ${cls}">${sign}${tx.amount.toLocaleString()} sats</div>
          <div class="txf">${sign}${historicalFiat}</div>
        </div>`

      if (fullList) fullList.appendChild(row.cloneNode(true))
      if (homeList && i < 3) homeList.appendChild(row)
    })
  } catch (e) {
    console.warn('[ArkON] Transactions fetch failed, preserving existing display:', e)
  }
}

window.showLiveTxDetail = function(rowId) {
  const tx = window._TX_REGISTRY[rowId]
  if (!tx) return

  const statusClass = tx.settled ? 'confirmed' : 'pending'
  const explorerUrl = tx.commitmentTxid
    ? `https://mempool.space/tx/${tx.commitmentTxid}`
    : tx.boardingTxid
    ? `https://mempool.space/tx/${tx.boardingTxid}`
    : tx.arkTxid
    ? `https://arkade.space/tx/${tx.arkTxid}`
    : null

  const body = document.getElementById('txd-body')
  if (!body) return

  const noteKey = 'arkade_txnote_' + (tx.txid || rowId)
  const savedNote = localStorage.getItem(noteKey) || ''

  body.innerHTML = `
    <div class="tx-detail-status">
      <div class="tds-icon ${tx.cls}">${txIcon(tx.cls)}</div>
      <div class="tds-title ${tx.cls}">${tx.sign}${tx.amount.toLocaleString()} sats</div>
      <div class="tds-sub">${tx.sign}${tx.histFiat || tx.fiat || ''} <span style="font-size:11px;opacity:.55">at time of tx</span></div>
      <div class="tds-badge ${statusClass}">
        <div class="badge-dot"></div>${tx.status}
      </div>
    </div>

    <div class="tx-details-card">
      <div class="tdrow"><span class="tdlbl">Type</span><span class="tdval">${tx.label}</span></div>
      <div class="tdrow"><span class="tdlbl">Network</span><span class="tdval">${tx.network}</span></div>
      <div class="tdrow"><span class="tdlbl">Date</span><span class="tdval">${tx.date}</span></div>
      <div class="tdrow"><span class="tdlbl">Time</span><span class="tdval">${tx.time}</span></div>
      <div class="tdrow"><span class="tdlbl">Status</span>
        <span class="tdval ${tx.settled ? 'green' : 'amber'}">${tx.status}</span>
      </div>
    </div>

    <div class="tx-details-card">
      <div class="tdrow">
        <span class="tdlbl">${tx.cls === 'in' ? 'You received' : 'You sent'}</span>
        <span class="tdval ${tx.cls}">${tx.sign}${tx.amount.toLocaleString()} sats</span>
      </div>
      <div class="tdrow">
        <span class="tdlbl">Value at time</span>
        <span class="tdval">${tx.sign}${tx.histFiat || tx.fiat || (tx.sym || '$') + '0.00'}</span>
      </div>
      ${tx.nowFiat ? `<div class="tdrow">
        <span class="tdlbl" style="color:var(--t3)">Current value</span>
        <span class="tdval" style="color:var(--t3)">${tx.sign}${tx.nowFiat}</span>
      </div>` : ''}
    </div>

    ${tx.txid ? `
    <div class="tx-details-card">
      <div class="tdrow" style="flex-direction:column;gap:10px;align-items:stretch">
        <span class="tdlbl">Transaction ID</span>
        <div style="display:flex;align-items:center;gap:8px;background:var(--bg3);border-radius:10px;padding:10px 12px">
          <span style="font-family:monospace;font-size:11px;color:var(--t2);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0">${tx.txid}</span>
          <button onclick="navigator.clipboard.writeText('${tx.txid}').then(()=>showToast('Transaction ID copied ✓'))" title="Copy"
            style="flex-shrink:0;width:30px;height:30px;border-radius:8px;background:var(--accs);border:1px solid var(--acc);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--acc2)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
          </button>
        </div>
      </div>
      ${explorerUrl ? `
      <div style="padding:0 16px 14px">
        <a href="${explorerUrl}" target="_blank" style="display:flex;align-items:center;justify-content:center;gap:6px;padding:10px;background:var(--accs);border:1px solid var(--acc);border-radius:var(--r-md);color:var(--acc2);font-size:13px;font-weight:600;text-decoration:none">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          View on Explorer
        </a>
      </div>` : ''}
    </div>` : ''}

    <!-- ── Transaction Note ── -->
    <div class="tx-details-card" style="padding-bottom:6px">
      <div class="tdrow" style="flex-direction:column;align-items:stretch;gap:8px">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span class="tdlbl">Note</span>
          ${savedNote ? `<span style="font-size:10px;color:var(--t3);font-style:italic" id="note-saved-indicator">Saved ✓</span>` : `<span style="font-size:10px;color:var(--t3)" id="note-saved-indicator"></span>`}
        </div>
        <textarea id="tx-note-input" placeholder="Add a note for this transaction…"
          style="width:100%;min-height:64px;background:var(--bg3);border:1.5px solid var(--bdr);border-radius:10px;padding:10px 12px;font-size:13px;color:var(--t1);resize:none;font-family:inherit;line-height:1.5;box-sizing:border-box;transition:border-color .15s;outline:none"
          onfocus="this.style.borderColor='var(--acc)'"
          onblur="this.style.borderColor='var(--bdr)'"
          oninput="window._txNoteDirty=true;document.getElementById('note-saved-indicator').textContent=''"
        >${savedNote}</textarea>
        <button onclick="window.saveTxNote('${noteKey}')"
          style="height:38px;display:flex;align-items:center;justify-content:center;gap:6px;background:var(--accs);border:1px solid var(--acc);border-radius:10px;color:var(--acc2);font-size:12px;font-weight:700;cursor:pointer;width:100%">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:13px;height:13px"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Save note
        </button>
      </div>
    </div>
  `

  if (typeof openSheet === 'function') {
    window._openDetailRowId = rowId
    openSheet('txdetail')
  }
}

window.saveTxNote = function(noteKey) {
  const input = document.getElementById('tx-note-input')
  if (!input) return
  const note = input.value.trim()
  if (note) {
    localStorage.setItem(noteKey, note)
  } else {
    localStorage.removeItem(noteKey)
  }
  const indicator = document.getElementById('note-saved-indicator')
  if (indicator) { indicator.textContent = 'Saved ✓'; indicator.style.color = 'var(--grn)' }
  window._txNoteDirty = false
  showToast('Note saved ✓')
}

// ─── confirmSend — full routing ─────────────────────────────────────────────
function wireConfirmSend() {
  window.confirmSend = async function () {
    const rawAddress = document.getElementById('sc-addr-full')?.value?.trim()
    // Strip URI prefixes (ark:, bitcoin:, lightning:) before passing to SDK
    const address = rawAddress
      ? rawAddress.replace(/^(ark|bitcoin|lightning):/i, '')
      : rawAddress
    // FIX #8 — Math.floor(Number()) correctly rejects decimals, empty strings, NaN
    const rawAmt  = document.getElementById('sc-amount-raw')?.value
    const amount  = Math.floor(Number(rawAmt))
    const netType = document.getElementById('sc-network-type')?.value || 'ark'
    const btn      = document.getElementById('sc-confirm-btn')
    const btnLabel = document.getElementById('sc-confirm-label')

    // FIX #8 — explicit guard against NaN, zero, and negative amounts
    if (!address || !amount || isNaN(amount) || amount <= 0) {
      if (typeof showToast === 'function') showToast('Missing or invalid address / amount')
      return
    }

    // Guard: ensure wallet is initialised before any SDK call.
    // Covers: user taps Send while boot() is still connecting,
    // or after a boot retry that called resetWallet() and nulled _wallet.
    try {
      await init()
    } catch (initErr) {
      console.error('[ArkON] Wallet init failed in confirmSend:', initErr)
      if (typeof showToast === 'function') showToast('Wallet not ready — please wait a moment and try again')
      return
    }

    const detected   = detectAddressType(address)
    const routedType = (detected !== 'unknown') ? detected : netType

    try {
      _sendInProgress = true
      // FIX #3 — safety timer in case the try block throws before finally runs
      const safetyTimer = setTimeout(() => { _sendInProgress = false }, 30_000)

      if (btn) {
        btn.disabled = true
        const iconEl = btn.querySelector('svg')
        if (iconEl) iconEl.style.animation = 'spin .6s linear infinite'
        if (btnLabel) btnLabel.textContent = 'Sending…'
      }

      if (routedType === 'lightning') {
        if (btn) { btn.disabled = false; const iconEl = btn.querySelector('svg'); if (iconEl) iconEl.style.animation = ''; if (btnLabel) btnLabel.textContent = 'Send Now' }
        clearTimeout(safetyTimer)
        _sendInProgress = false
        if (typeof closeSheet === 'function') closeSheet('sendconfirm')

        let boltzUrl = 'https://boltz.exchange'
        const trimmed = address.trim()
        const isBolt11 = /^lnbc|^lntbs|^lntb/i.test(trimmed)
        if (isBolt11) {
          boltzUrl = `https://boltz.exchange/?invoice=${encodeURIComponent(trimmed)}`
        }

        if (typeof showToast === 'function') showToast('Opening Boltz for Lightning payment…')
        setTimeout(() => window.open(boltzUrl, '_blank'), 400)
        return
      }

      let txid

      // FIX — Fetch live balance before ANY send to prevent phantom-balance sends.
      // window._wallet may be stale after a prior send since the SDK caches VTXO state.
      let liveOffchain = 0
      try {
        const liveBal = await getBalance()
        liveOffchain = liveBal.offchain
        window._wallet = { sats: liveBal.sats, offchain: liveBal.offchain, onchain: liveBal.onchain }
        if (typeof walletUpdateDisplay === 'function') walletUpdateDisplay()
      } catch {
        liveOffchain = window._wallet?.offchain ?? window._wallet?.sats ?? 0
      }

      if (amount > liveOffchain) {
        // Before giving up, check if there are expiring/recoverable VTXOs that
        // could explain why the spendable balance is lower than expected.
        let vtxoMsg = `Insufficient balance. Available: ${liveOffchain.toLocaleString()} sats`
        try {
          const { renewed, count } = await checkAndRenewVtxos()
          if (renewed) {
            // VTXOs were renewed — re-fetch balance and retry
            const recheck = await getBalance()
            window._wallet = { sats: recheck.sats, offchain: recheck.offchain, onchain: recheck.onchain }
            if (typeof walletUpdateDisplay === 'function') walletUpdateDisplay()
            liveOffchain = recheck.offchain
            vtxoMsg = `Renewed ${count} expiring VTXO(s). New balance: ${liveOffchain.toLocaleString()} sats. Try sending again.`
          } else {
            // Check if there are recoverable (swept) VTXOs
            const recov = await getRecoverableBalance()
            if (recov.recoverable > 0) {
              vtxoMsg = `Balance low. You have ${recov.recoverable.toLocaleString()} recoverable sats — go to Settings → Recover VTXOs.`
            }
          }
        } catch { /* non-fatal */ }

        if (amount > liveOffchain) {
          if (typeof showToast === 'function') showToast(vtxoMsg)
          _sendInProgress = false
          if (btn) { btn.disabled = false; const iconEl = btn.querySelector('svg'); if (iconEl) iconEl.style.animation = ''; if (btnLabel) btnLabel.textContent = 'Send Now' }
          clearTimeout(safetyTimer)
          return
        }
      }

      if (routedType === 'bitcoin') {
        if (typeof closeSheet === 'function') closeSheet('sendconfirm')

        // FIX — Fee pre-flight: fetch Ark server fees and ensure the user has
        // enough balance to cover both the send amount AND the fee.
        // If not, block with a clear error and show the max sendable amount.
        let arkFeeBuffer = 0
        try {
          const fees = await getArkFees()
          // fees may be a number, BigInt, or object depending on SDK version
          if (fees !== null && fees !== undefined) {
            if (typeof fees === 'bigint')        arkFeeBuffer = Number(fees)
            else if (typeof fees === 'number')   arkFeeBuffer = fees
            else if (typeof fees.offboard === 'bigint') arkFeeBuffer = Number(fees.offboard)
            else if (typeof fees.offboard === 'number') arkFeeBuffer = fees.offboard
            else if (typeof fees.total    === 'bigint') arkFeeBuffer = Number(fees.total)
            else if (typeof fees.total    === 'number') arkFeeBuffer = fees.total
          }
        } catch { /* non-fatal — fall back to safe buffer */ }

        // Add 500 sat margin on top of reported Ark fee to cover miner fee variance
        const safeBuffer = (arkFeeBuffer > 0 ? arkFeeBuffer : 2000) + 500

        // Reuse liveOffchain fetched above — avoids a second stale-VTXO read
        const offchainBalance = liveOffchain

        if (amount + safeBuffer > offchainBalance) {
          const maxSendable = Math.max(0, offchainBalance - safeBuffer)
          if (typeof showToast === 'function') {
            showToast(
              maxSendable > 0
                ? `Insufficient balance for fees. Max sendable: ${maxSendable.toLocaleString()} sats`
                : 'Insufficient balance to cover network fees'
            )
          }
          _sendInProgress = false
          _offboardInProgress = false
          if (btn) {
            btn.disabled = false
            const iconEl = btn.querySelector('svg')
            if (iconEl) iconEl.style.animation = ''
            if (btnLabel) btnLabel.textContent = 'Send Now'
          }
          return
        }

        openSettleProgress('Sending on-chain…', 'Initiating collaborative exit. This joins the next Ark round.')
        _offboardInProgress = true
        txid = await offboard({
          address,
          amount,
          eventCallback: (event) => updateSettleProgress(event),
        })
        _offboardInProgress = false
        closeSettleProgress()
        showSettleResult(true, 'Sent On-chain!', 'Collaborative exit broadcast. Funds will arrive on-chain shortly.')
      } else {
        txid = await sendBitcoin({ address, amount })
        if (typeof closeSheet === 'function') closeSheet('sendconfirm')
        showSendResult(true, amount, 'Transaction broadcast successfully')
      }

      clearTimeout(safetyTimer)
      console.log('[ArkON] Send complete — txid:', txid, '| type:', routedType)
      await refreshBalance()
      await refreshTransactions()

      if (typeof showNotification === 'function') {
        showNotification('success-out', 'Payment Sent', amount.toLocaleString() + ' sats sent')
      }
    } catch (err) {
      console.error('[ArkON] Send failed:', err)
      _offboardInProgress = false
      closeSettleProgress()
      if (typeof closeSheet === 'function') closeSheet('sendconfirm')

      const rawMessage = err?.message || 'Payment failed'
      const friendlyMessage = /bigint|cannot convert.*bigint|mix bigint/i.test(rawMessage)
        ? 'Payment failed due to a BigInt amount bug. Use this fixed build and try again.'
        : rawMessage

      if (routedType === 'bitcoin') {
        showSettleResult(false, 'Send Failed', friendlyMessage || 'Offboard could not complete')
      } else {
        showSendResult(false, amount, friendlyMessage || 'Transaction could not be broadcast')
      }

      if (typeof showNotification === 'function') {
        showNotification('fail', 'Payment Failed', friendlyMessage || 'Could not broadcast transaction')
      }
    } finally {
      _sendInProgress = false
      if (btn) {
        btn.disabled = false
        const iconEl = btn.querySelector('svg')
        if (iconEl) iconEl.style.animation = ''
        if (btnLabel) btnLabel.textContent = 'Send Now'
      }
    }
  }
}

// ─── Send result card (for Ark sends) ──────────────────────────────────────
function showSendResult(success, amount, message) {
  const iconWrap = document.getElementById('sres-icon')
  const iconSvg  = document.getElementById('sres-icon-svg')
  const title    = document.getElementById('sres-title')
  const amtEl    = document.getElementById('sres-amount')
  const sub      = document.getElementById('sres-sub')

  if (iconWrap) iconWrap.style.background = success ? 'var(--grns)' : 'var(--reds)'
  if (iconSvg) {
    iconSvg.style.color = success ? 'var(--grn)' : 'var(--red)'
    iconSvg.innerHTML   = success
      ? '<polyline points="20 6 9 17 4 12"/>'
      : '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'
  }
  if (title)  title.textContent = success ? 'Payment Sent'   : 'Payment Failed'
  if (amtEl)  amtEl.textContent = amount?.toLocaleString()   + ' SATS'
  if (sub)    sub.textContent   = message

  if (typeof openSheet === 'function') openSheet('sendresult')
}

// ─── Incoming watcher ──────────────────────────────────────────────────────
function startIncomingWatcher() {
  if (_watcherRunning) {
    console.log('[ArkON] Watcher already running — skipping duplicate start')
    return
  }
  _watcherRunning = true

  // FIX #7 — re-arm immediately on success; 5s delay only after an error.
  // Previously there was always a 5s blind window between calls.
  async function watch() {
    let errorOccurred = false
    try {
      await listenForIncoming(async ({ type, sats }) => {
        console.log('[ArkON] Incoming funds — type:', type, '| sats:', sats)

        if (type === 'utxo') {
          // If an offboard (on-chain send) is in progress, this utxo event is
          // our OWN exit UTXO appearing on-chain — not an incoming deposit.
          // Suppress entirely: no notification, no auto-onboard.
          if (_offboardInProgress) {
            console.log('[ArkON] utxo event during offboard — skipping (our own exit UTXO)')
            return
          }

          if (_onboardInProgress) {
            console.log('[ArkON] Boarding deposit detected but onboard already running — skipping duplicate')
            await refreshBalance()
            return
          }
          console.log('[ArkON] Boarding deposit detected, auto-onboarding…')
          _onboardInProgress = true
          try {
            await onboard()
            await refreshBalance()
            await refreshTransactions()
            if (typeof showNotification === 'function') {
              showNotification('success-in', 'Bitcoin Received', sats.toLocaleString() + ' sats arrived')
            }
          } catch (e) {
            console.warn('[ArkON] Auto-onboard failed:', e)
            await refreshBalance()
            if (typeof showNotification === 'function') {
              showNotification('success-in', 'Bitcoin Received', sats.toLocaleString() + ' sats arrived on-chain')
            }
          } finally {
            _onboardInProgress = false
          }
        } else {
          // vtxo receive — if a send is in progress this is our own change vtxo
          if (_sendInProgress) {
            console.log('[ArkON] vtxo event during send — skipping (change vtxo)')
            return
          }
          await refreshBalance()
          await refreshTransactions()
          if (typeof showNotification === 'function') {
            showNotification('success-in', 'Bitcoin Received', sats.toLocaleString() + ' sats arrived')
          }
        }
      })
    } catch (e) {
      console.warn('[ArkON] Incoming watcher error:', e)
      errorOccurred = true
    }
    // FIX #7 — 0ms re-arm on success so no payments are missed; 5s backoff on error
    setTimeout(watch, errorOccurred ? 5000 : 0)
  }

  watch()
}

// ─── External apps ─────────────────────────────────────────────────────────
function wireExternalApps() {
  const orig = window.openApp
  window.openApp = function (id) {
    const urls = {
      boltz:    'https://boltz.exchange',
      lendasat: 'https://lendasat.com',
      swap:     'https://swap.lendasat.com',
    }
    if (urls[id]) { window.open(urls[id], '_blank'); return }
    if (typeof orig === 'function') orig(id)
  }
}

// ─── Backup / Reset ────────────────────────────────────────────────────────
function wireBackup() {
  document.querySelectorAll('.sr').forEach(row => {
    if (/Backup|seed|Private Key/i.test(row.textContent)) {
      row.onclick = () => openBackupSheet()
    }
  })
}

// FIX #10 — Backup sheet now shows the private key hex directly for restore.
// The old mnemonic system is removed because it could not faithfully reconstruct
// the full 32-byte key (only 16 bytes were encoded into the 12 words).

window.openBackupSheet = window._openBackupSheet = async function() {
  const body = document.getElementById('backup-body')
  if (!body) return

  body.innerHTML = `
    <div style="background:var(--reds);border:1px solid var(--red);border-radius:var(--r-md);padding:12px 14px;margin-bottom:20px;display:flex;gap:10px;align-items:flex-start">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;flex-shrink:0;color:var(--red);margin-top:1px"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <div>
        <div style="font-size:12px;font-weight:700;color:var(--red);margin-bottom:2px">Private key display disabled</div>
        <div style="font-size:11px;color:var(--red);opacity:.85">This hardened build no longer renders your raw private key into the page or copies it to the clipboard.</div>
      </div>
    </div>

    <div style="font-size:12px;color:var(--t2);line-height:1.65;margin-bottom:14px">Use an encrypted backup file protected by a password you choose. Keep that password offline and separate from the file.</div>

    <button class="btnp" style="height:46px;display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:14px" onclick="window._exportWalletBackup()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Export encrypted backup
    </button>

    <div style="font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Restore from encrypted backup</div>
    <input id="restore-backup-file" type="file" accept="application/json,.json" style="width:100%;background:var(--bg3);border:1.5px solid var(--bdr);border-radius:12px;padding:12px;font-size:13px;color:var(--t1);box-sizing:border-box;margin-bottom:10px;outline:none" />
    <button class="btnp" style="height:46px;display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:16px;background:var(--surf);color:var(--acc2);border:1.5px solid var(--acc)" onclick="window._restoreWalletBackup()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
      Restore encrypted backup
    </button>

    <details style="background:var(--bg3);border:1px solid var(--bdr);border-radius:12px;padding:10px 12px">
      <summary style="cursor:pointer;color:var(--t2);font-size:12px;font-weight:700">Legacy raw private key import</summary>
      <div style="font-size:12px;color:var(--t3);margin:10px 0">Paste a 64-character hex private key to import a wallet. This will replace your current wallet.</div>
      <input id="restore-privkey-input" type="password" placeholder="64-character hex private key…"
        style="width:100%;background:var(--bg);border:1.5px solid var(--bdr);border-radius:12px;padding:12px;font-size:13px;color:var(--t1);font-family:monospace;box-sizing:border-box;margin-bottom:10px;outline:none" />
      <button class="btnp" style="height:46px;display:flex;align-items:center;justify-content:center;gap:6px;background:var(--surf);color:var(--acc2);border:1.5px solid var(--acc)" onclick="doRestoreWallet()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
        Restore from private key
      </button>
    </details>
  `
  openSheet('backup')
}

window._exportWalletBackup = async function() {
  try {
    const password = await promptForSecret('Choose a backup password (min 10 characters). Keep it separate from the backup file.')
    if (password.length < 10) {
      showToast('Backup password must be at least 10 characters')
      return
    }
    const payload = await exportEncryptedBackup(password)
    downloadTextFile(`arkon-backup-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(payload, null, 2))
    showToast('Encrypted backup exported')
  } catch (err) {
    if (err?.code !== 'CANCELLED') showToast(err?.message || 'Backup export failed')
  }
}

window._restoreWalletBackup = async function() {
  const input = document.getElementById('restore-backup-file')
  const file = input?.files?.[0]
  if (!file) {
    showToast('Choose a backup file first')
    return
  }
  try {
    const password = await promptForSecret('Enter the password for this backup file')
    const text = await file.text()
    const payload = JSON.parse(text)
    const ok = await restoreFromEncryptedBackup(payload, password)
    if (!ok) throw new Error('Backup restore failed')
    showToast('Backup restored — reloading…')
    setTimeout(() => location.reload(), 1200)
  } catch (err) {
    showToast(err?.message || 'Backup restore failed')
  }
}

window.doRestoreWallet = window._doRestoreWallet = async function() {
  const input = document.getElementById('restore-privkey-input')
  if (!input) return
  const hex = input.value.trim()
  if (hex.length !== 64 || !/^[0-9a-fA-F]+$/.test(hex)) {
    showToast('Please enter a valid 64-character hex private key')
    return
  }
  if (!confirm('This will replace your current wallet with the imported one.\n\nMake sure you have backed up your current private key first.\n\nContinue?')) return
  const ok = await restoreFromPrivKey(hex)
  if (!ok) {
    showToast('Invalid private key — check the value and try again')
    return
  }
  showToast('Wallet imported — reloading…')
  setTimeout(() => location.reload(), 1200)
}

function wireReset() {
  document.querySelectorAll('.sr').forEach(row => {
    if (/Reset|Delete Wallet/i.test(row.textContent)) {
      row.onclick = async () => {
        if (confirm('This permanently erases your wallet.\n\nMake sure you have backed up your private key first.\n\nContinue?')) {
          await resetWallet()
          location.reload()
        }
      }
    }
  })
}

// Expose server URLs for settings/about display
window._ARK_SERVER_URL  = ARK_SERVER_URL
window._ESPLORA_API_URL = ESPLORA_API_URL

// ─── Polling ───────────────────────────────────────────────────────────────
// FIX #6 — store interval IDs and guard against duplicate registration.
// Previously boot retries could stack multiple overlapping polling intervals
// since the IDs were discarded and there was no idempotency check.
function startPolling() {
  if (_pollIntervals.length > 0) {
    console.log('[ArkON] Polling already running — skipping duplicate start')
    return
  }
  _pollIntervals.push(
    setInterval(refreshBtcPrice, 60_000),
    setInterval(refreshFees, 5 * 60_000),
    setInterval(async () => {
      await refreshBalance()
      await refreshTransactions()
    }, 30_000)
  )
}

// ─── Start ─────────────────────────────────────────────────────────────────
// boot() is NOT auto-called. splashDone() calls window._bootApp() after onboarding.
// This prevents init() from auto-generating a key before the user sees Create/Restore.
window._bootApp = function() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot)
  } else {
    boot()
  }
}

// Hard safety net: remove SDK loading overlay after 12s no matter what
setTimeout(() => {
  const el = document.getElementById('sdk-loading')
  if (el) { el.classList.add('fade'); setTimeout(() => el.remove(), 500) }
}, 12000)
