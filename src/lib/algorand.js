import algosdk from 'algosdk';
import { ALGOD_URL, INDEXER_URL, VNFT_ADMIN_ADDRESS } from './config';

export const algodClient = new algosdk.Algodv2('', ALGOD_URL, '');
export const indexerClient = new algosdk.Indexer('', INDEXER_URL, '');

export async function hasAsset(accountAddress, assetId) {
  if (!accountAddress || !assetId) return false;
  try {
    const res = await indexerClient.lookupAccountAssets(accountAddress).assetId(assetId).do();
    const assets = res?.assets || [];
    return assets.some((a) => a['asset-id'] === assetId && (a.amount ?? 0) > 0);
  } catch (err) {
    // Fallback: full account lookup
    try {
      const acct = await indexerClient.lookupAccountByID(accountAddress).do();
      const assets = acct?.account?.assets || [];
      return assets.some((a) => a['asset-id'] === assetId && (a.amount ?? 0) > 0);
    } catch {
      return false;
    }
  }
}

export async function getVnftAssetId(accountAddress) {
  if (!accountAddress || !VNFT_ADMIN_ADDRESS) return null;
  try {
    const acct = await indexerClient.lookupAccountByID(accountAddress).do();
    const assets = acct?.account?.assets || [];
    for (const a of assets) {
      if (!a['asset-id'] || (a.amount ?? 0) === 0) continue;
      const asset = await indexerClient.lookupAssetByID(a['asset-id']).do();
      const params = asset?.asset?.params || {};
      if (
        params['unit-name'] === 'VNFT' &&
        (params.manager === VNFT_ADMIN_ADDRESS || params.creator === VNFT_ADMIN_ADDRESS)
      ) {
        return a['asset-id'];
      }
    }
  } catch {
    return null;
  }
  return null;
}

export async function hasVnft(accountAddress) {
  const assetId = await getVnftAssetId(accountAddress);
  return !!assetId;
}
