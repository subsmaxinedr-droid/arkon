/**
 * service-worker.js — Arkade Wallet PWA Service Worker
 *
 * Runs the wallet in the background via the SDK's MessageBus + WalletMessageHandler.
 * The main thread communicates with this worker through ServiceWorkerWallet (postMessage).
 */
import {
  MessageBus,
  WalletMessageHandler,
  IndexedDBWalletRepository,
  IndexedDBContractRepository,
} from '@arkade-os/sdk'

const walletRepo = new IndexedDBWalletRepository()
const contractRepo = new IndexedDBContractRepository()

const bus = new MessageBus(walletRepo, contractRepo, {
  messageHandlers: [new WalletMessageHandler()],
  tickIntervalMs: 10_000,
})

bus.start()
