import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMarketplaceIdSet,
  buildLoftyPropertyLookup,
  attachLoftyPropertyMeta,
  buildLpPriceMap,
  normalizeAssetAmount,
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

test('buildLpPriceMap supports the current Lofty marketplace SDK response and migrated ASAs', () => {
  const prices = buildLpPriceMap([
    {
      property: { assetId: 237913743, newAssetId: 3686994105 },
      liquidityPool: { price: 40.657227 },
    },
  ]);

  assert.equal(prices[237913743], 40.657227);
  assert.equal(prices[3686994105], 40.657227);
});

test('buildLpPriceMap retains compatibility with the legacy pool response', () => {
  const prices = buildLpPriceMap({
    data: { pools: [{ property: { assetId: 1001 }, price: 12.34 }] },
  });

  assert.equal(prices[1001], 12.34);
});

test('normalizeAssetAmount converts migrated ASA micro-units', () => {
  assert.equal(normalizeAssetAmount(120000000, 6), 120);
  assert.equal(normalizeAssetAmount(18, 0), 18);
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
