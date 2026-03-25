// Tracked wallet addresses
export const WALLETS = {
  W1: 'YILY2YPFH2HODAZSMVJ6C2URUTBJSEPB3377SIKHFCFMGQEEFAJ3E5TYDM',
  TREASURY: 'EARLNMGRC6FCNRHRZGKRMU3ILJJE5ONNPBGIFQ5GLIZIL3BTAGNIQ5ZBEE', // GOV_ADMIN mnemonic = TREASURY mnemonic
  GOV_ADMIN: 'EQVAIIFMQCDUWXPGXMDPMBZE4EDK667OTOPYMVJOKFUYSQ6BT2NGSIQOZU', // Same seed phrase as TREASURY
};

// 1 Coolwood Dr ASA ID (not in LoftyAssist, manually tracked)
export const COOLWOOD_ASA = 2021905123;
export const COOLWOOD_TOKEN_PRICE = 50.00; // Manual override until in LoftyAssist
export const COOLWOOD_MORTGAGE = 0;

// ECSOLAR Token (Solar PV System - 110 N Saddle Dr, Conway AR)
// ASA 3492895002 | 2,000 total @ $50 = $100k
// GOV_ADMIN holds all tokens (same as TREASURY)
// - 80 tokens = $4k equity (Treasury portion)
// - 1,920 tokens = $96k loan escrow (GovAdmin portion)
export const SOLAR_ASA = 3492895002;
export const SOLAR_TOKEN_PRICE = 50.00;
export const SOLAR_TOTAL_SHARES = 2000;
export const SOLAR_EQUITY_SHARES = 80;      // Treasury (GovAdmin) equity portion
export const SOLAR_ESCROW_SHARES = 1920;    // Loan escrow (GovAdmin) portion
export const SOLAR_LOAN_BALANCE = 96000;    // Remaining loan balance

// API endpoints
export const INDEXER_BASE = 'https://mainnet-idx.4160.nodely.dev';
export const LOFTY_API = '/api/lofty.php';
