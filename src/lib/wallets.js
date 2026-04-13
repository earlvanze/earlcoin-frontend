const custodyHotAddress = import.meta.env.VITE_CUSTODY_HOT_ADDRESS || 'EQVAIIFMQCDUWXPGXMDPMBZE4EDK667OTOPYMVJOKFUYSQ6BT2NGSIQOZU';

// Tracked wallet addresses
export const WALLETS = {
  W1: 'YILY2YPFH2HODAZSMVJ6C2URUTBJSEPB3377SIKHFCFMGQEEFAJ3E5TYDM',
  TREASURY: 'EARLNMGRC6FCNRHRZGKRMU3ILJJE5ONNPBGIFQ5GLIZIL3BTAGNIQ5ZBEE',
  GOV_ADMIN: 'EQVAIIFMQCDUWXPGXMDPMBZE4EDK667OTOPYMVJOKFUYSQ6BT2NGSIQOZU',
  CUSTODY_HOT: custodyHotAddress,
};

export const WALLET_ROLES = {
  TREASURY: 'TREASURY',
  GOV_ADMIN: 'GOV_ADMIN',
  CUSTODY_HOT: custodyHotAddress === 'EQVAIIFMQCDUWXPGXMDPMBZE4EDK667OTOPYMVJOKFUYSQ6BT2NGSIQOZU' ? 'GOV_ADMIN_TEMP_CUSTODY' : 'CUSTODY_HOT',
};

// 1 Coolwood Dr ASA ID (not in LoftyAssist, manually tracked)
export const COOLWOOD_ASA = 2021905123;
export const COOLWOOD_TOKEN_PRICE = 50.00;
export const COOLWOOD_MORTGAGE = 0;

// ECSOLAR Token (Solar PV System - 110 N Saddle Dr, Conway AR)
// TREASURY = equity inventory
// GOV_ADMIN = collateral / escrow
// CUSTODY_HOT = user liability reserve (defaults to GOV_ADMIN until a dedicated wallet is configured)
export const SOLAR_ASA = 3492895002;
export const SOLAR_TOKEN_PRICE = 50.00;
export const SOLAR_TOTAL_SHARES = 2000;
export const SOLAR_EQUITY_SHARES = 80;
export const SOLAR_ESCROW_SHARES = 1920;
export const SOLAR_LOAN_BALANCE = 96000;

export const INDEXER_BASE = 'https://mainnet-idx.4160.nodely.dev';
export const LOFTY_API = '/api/lofty.php';
