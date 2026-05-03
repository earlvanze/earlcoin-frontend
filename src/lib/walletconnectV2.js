import SignClient from '@walletconnect/sign-client';
import algosdk from 'algosdk';
import { NETWORK } from './config';

const PROJECT_ID = import.meta.env.VITE_WC_PROJECT_ID || '';
const CHAIN_ID = NETWORK === 'testnet' ? 'algorand:testnet' : 'algorand:mainnet';

const metadata = {
  name: 'EarlCoin DAO',
  description: 'EarlCoin DAO wallet connection',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://earlco.in',
  icons: ['https://earlco.in/favicon.ico'],
};

let client;
let modal;
let session;
let connecting = false;
let initPromise;

async function getWalletConnectModal() {
  if (!modal) {
    const { WalletConnectModal } = await import('@walletconnect/modal');
    modal = new WalletConnectModal({ projectId: PROJECT_ID, chains: [CHAIN_ID], themeMode: 'dark' });
  }
  return modal;
}

export async function initWalletConnect() {
  if (!PROJECT_ID) throw new Error('Missing VITE_WC_PROJECT_ID');
  if (client) {
    const sessions = client.session.getAll();
    if (sessions.length) session = sessions[0];
    return { client, session };
  }
  if (!initPromise) {
    initPromise = (async () => {
      client = await SignClient.init({ projectId: PROJECT_ID, metadata });
      const sessions = client.session.getAll();
      if (sessions.length) session = sessions[0];
      return { client, session };
    })();
  }
  return initPromise;
}

function extractAccounts(sess) {
  const accounts = sess?.namespaces?.algorand?.accounts || [];
  return accounts.map((a) => a.split(':').pop());
}

export async function reconnectWallet() {
  // Only init if there's evidence of a session to avoid unnecessary overhead on every load
  // though SignClient.init is generally fine, we'll keep it simple.
  await initWalletConnect();
  if (session) return extractAccounts(session);
  return [];
}

export async function connectWallet() {
  if (connecting) return [];
  connecting = true;
  try {
    await initWalletConnect();
    if (session) return extractAccounts(session);
    const { uri, approval } = await client.connect({
      optionalNamespaces: {
        algorand: {
          chains: [CHAIN_ID],
          methods: ['algo_signTxn', 'algo_signData'],
          events: [],
        },
      },
    });
    if (uri) {
      const wcModal = await getWalletConnectModal();
      try { wcModal?.closeModal(); } catch {}
      wcModal.openModal({ uri, chains: [CHAIN_ID] });
    }
    session = await approval();
    const wcModal = await getWalletConnectModal();
    wcModal.closeModal();
    return extractAccounts(session);
  } finally {
    connecting = false;
  }
}

export async function disconnectWallet() {
  if (!client || !session) return;
  await client.disconnect({ topic: session.topic, reason: { code: 6000, message: 'USER_DISCONNECTED' } });
  session = undefined;
}

export async function signTransactions(txnGroups = []) {
  await initWalletConnect();
  if (!client || !session) throw new Error('Wallet not connected');
  const toBase64 = (bytes) => {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };
  const fromBase64 = (b64) => {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  };

  const flatTxns = txnGroups.flatMap((group) =>
    group.map((txnObj) => {
      const txn = txnObj.txn;
      const encoded = toBase64(algosdk.encodeUnsignedTransaction(txn));
      const out = { txn: encoded };
      if (txnObj.signers) out.signers = txnObj.signers;
      if (txnObj.authAddr) out.authAddr = txnObj.authAddr;
      if (txnObj.message) out.message = txnObj.message;
      if (txnObj.msig) out.msig = txnObj.msig;
      return out;
    })
  );

  const result = await client.request({
    topic: session.topic,
    chainId: CHAIN_ID,
    request: { method: 'algo_signTxn', params: [flatTxns] },
  });

  return result.map((r) => (r ? fromBase64(r) : null));
}

export function resetWalletConnectStorage() {
  try {
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith('wc@2') || k.includes('walletconnect')) localStorage.removeItem(k);
    });
  } catch (e) {
    // ignore
  }
}
