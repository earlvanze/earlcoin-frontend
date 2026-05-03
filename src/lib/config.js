export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

export const ALGOD_URL = import.meta.env.VITE_ALGOD_URL || 'https://testnet-api.algonode.cloud';
export const INDEXER_URL = import.meta.env.VITE_INDEXER_URL || 'https://testnet-idx.algonode.cloud';
export const NETWORK = import.meta.env.VITE_NETWORK || 'testnet';

export const EARL_ASA_ID = Number(import.meta.env.VITE_EARL_ASA_ID || '747899490');
export const VNFT_ADMIN_ADDRESS = import.meta.env.VITE_VNFT_ADMIN_ADDRESS || 'M7FJSBLDR6BK4ELZCGUZQIKCQPRAKSOAJNLC6WR6QH3UNTE4YLY5WX3NFE';
export const USDC_ASA_ID = Number(import.meta.env.VITE_USDC_ASA_ID || '10458941');
export const GOV_APP_ID = Number(import.meta.env.VITE_GOV_APP_ID || '756389510');
export const TREASURY_ADDRESS = import.meta.env.VITE_TREASURY_ADDRESS || 'M7FJSBLDR6BK4ELZCGUZQIKCQPRAKSOAJNLC6WR6QH3UNTE4YLY5WX3NFE';

export const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
export const EARL_STRIPE_PRICE_ID = import.meta.env.VITE_EARL_STRIPE_PRICE_ID || '';
export const MEMBERSHIP_STRIPE_PRICE_ID = import.meta.env.VITE_MEMBERSHIP_STRIPE_PRICE_ID || '';
export const SITE_URL = import.meta.env.VITE_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
export const ATOMIC_SWAP_ENABLED = (import.meta.env.VITE_ENABLE_ATOMIC_SWAP || '').toLowerCase() === 'true';
