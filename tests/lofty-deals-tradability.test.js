import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMarketplaceIdSet,
  buildLoftyPropertyLookup,
  attachLoftyPropertyMeta,
  shouldIncludeTradableDeal,
} from '../src/lib/loftyDeals.js';

test('shouldIncludeTradableDeal requires Active listing and marketplace membership via assetId or newAssetId', () => {
  const marketplaceIds = buildMarketplaceIdSet([
    { assetId: 1001 },
    { assetId: 9002 },
  ]);

  assert.equal(
    shouldIncludeTradableDeal({ listingStatus: 'Active', assetId: 1001 }, marketplaceIds),
    true,
  );

  assert.equal(
    shouldIncludeTradableDeal({ listingStatus: 'Active', newAssetId: 9002 }, marketplaceIds),
    true,
  );

  assert.equal(
    shouldIncludeTradableDeal({ listingStatus: 'Paused', assetId: 1001 }, marketplaceIds),
    false,
  );

  assert.equal(
    shouldIncludeTradableDeal({ listingStatus: 'Active', assetId: 7777, newAssetId: 8888 }, marketplaceIds),
    false,
  );
});

test('attachLoftyPropertyMeta carries tradability fields from LoftyAssist matches', () => {
  const loftyLookup = buildLoftyPropertyLookup([
    {
      property: {
        address: '3514 W 123rd St, Cleveland, OH 44111',
        id: 'lofty-123',
        slug: '3514-w-123rd-st',
        assetId: 310079703,
        newAssetId: 2834558381,
        listingStatus: 'Active',
      },
    },
  ]);

  const [enriched] = attachLoftyPropertyMeta([
    { address: '3514 W 123rd St, Cleveland, OH 44111' },
  ], loftyLookup);

  assert.equal(enriched.property_id, 'lofty-123');
  assert.equal(enriched.slug, '3514-w-123rd-st');
  assert.equal(enriched.assetId, 310079703);
  assert.equal(enriched.newAssetId, 2834558381);
  assert.equal(enriched.listingStatus, 'Active');
});
