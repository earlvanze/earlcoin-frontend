// Tracked wallet addresses
export const WALLETS = {
  W1: 'YILY2YPFH2HODAZSMVJ6C2URUTBJSEPB3377SIKHFCFMGQEEFAJ3E5TYDM',
  TREASURY: 'EARLNMGRC6FCNRHRZGKRMU3ILJJE5ONNPBGIFQ5GLIZIL3BTAGNIQ5ZBEE',
  GOV_ADMIN: 'EQVAIIFMQCDUWXPGXMDPMBZE4EDK667OTOPYMVJOKFUYSQ6BT2NGSIQOZU',
};

// 1 Coolwood Dr ASA ID (not in LoftyAssist, manually tracked)
export const COOLWOOD_ASA = 2021905123;
export const COOLWOOD_TOKEN_PRICE = 50.00; // Manual override until in LoftyAssist
export const COOLWOOD_MORTGAGE = 0;

// Solar ASA (110 N Saddle Dr) - will be set after creation
// Total: 2,000 shares @ $50 = $100,000
// Escrow: 1,920 shares in GOV_ADMIN ($96k principal)
// Fund: 80 shares in TREASURY ($4k equity)
export const SOLAR_ASA = 3492895002; // Set after ASA creation
export const SOLAR_TOKEN_PRICE = 50.00;
export const SOLAR_TOTAL_SHARES = 2000;
export const SOLAR_PRINCIPAL_SHARES = 1920; // Held in GOV_ADMIN for loan escrow
export const SOLAR_LOAN_BALANCE = 96000;

// API endpoints
export const INDEXER_BASE = 'https://mainnet-idx.4160.nodely.dev';
export const LOFTY_API = '/api/lofty.php';
