#!/usr/bin/env python3
"""
Compass Yield Position Sizer

Computes recommended_shares and position_size_usd for each alpha opportunity
using a risk-adjusted fractional Kelly criterion.

Inputs:
  - lofty_alpha_opportunities (Supabase): alpha_pct, market_price, nav_per_token
  - lofty_portfolio_avm (Supabase): lp_depth info
  - LoftyAssist API: live LP depth / price data

Sizing model:
  - Base: half-Kelly fraction = alpha_pct / (2 * max_alpha)
  - Capped per-position: max 5% of deployable capital
  - Floor: minimum 10 tokens if alpha > 50%
  - LP depth constraint: can't buy more than 10% of LP depth
  - Deployable capital: $5,000 (tunable via TREASURY_DEPLOYABLE_CAPITAL env)

Output:
  - Upserts recommended_shares, position_size_usd, lp_depth_tokens
    back to lofty_alpha_opportunities
"""
import json
import math
import os
import sys

import requests

SUPABASE_URL = os.environ.get('EARLCOIN_SUPABASE_URL', 'https://aeaufjjeimtkiixdmrtq.supabase.co')
SERVICE_ROLE_KEY = os.environ.get('PROJECT_SECRET_KEY') or os.environ.get('EARLCOIN_SUPABASE_SERVICE_ROLE_KEY')
if not SERVICE_ROLE_KEY:
    raise RuntimeError('Missing PROJECT_SECRET_KEY or EARLCOIN_SUPABASE_SERVICE_ROLE_KEY')

DEPLOYABLE_CAPITAL = float(os.environ.get('TREASURY_DEPLOYABLE_CAPITAL', '5000'))
MAX_POSITION_PCT = float(os.environ.get('MAX_POSITION_PCT', '0.05'))  # 5% cap
MIN_TOKENS = int(os.environ.get('MIN_POSITION_TOKENS', '10'))
MIN_ALPHA_PCT = float(os.environ.get('MIN_ALPHA_FOR_SIZING', '50'))
LP_DEPTH_PCT_CAP = float(os.environ.get('LP_DEPTH_PCT_CAP', '0.10'))  # max 10% of LP depth
LOFTY_API = os.environ.get('LOFTY_API', 'https://www.loftyassist.com/api/properties')
LP_MARKETPLACE_API = 'https://lp.lofty.ai/prod/liquidity/v1/marketplace'

headers = {
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': f'Bearer {SERVICE_ROLE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates',
}


def fetch_alpha_opportunities():
    """Fetch all alpha opportunities from Supabase, enriched with assetId from LoftyAssist."""
    url = f"{SUPABASE_URL}/rest/v1/lofty_alpha_opportunities?select=id,address,slug,nav_per_token,market_price,alpha_pct,alpha_amount"
    get_headers = {'apikey': SERVICE_ROLE_KEY, 'Authorization': f'Bearer {SERVICE_ROLE_KEY}'}
    resp = requests.get(url, headers=get_headers, timeout=30)
    resp.raise_for_status()
    rows = resp.json()

    # Build address -> assetId lookup from LoftyAssist API
    try:
        lofty_resp = requests.get(LOFTY_API, timeout=30)
        lofty_data = lofty_resp.json() if lofty_resp.ok else []
    except Exception:
        lofty_data = []

    addr_to_asset = {}
    for item in (lofty_data or []):
        p = item.get('property') or {}
        addr = (p.get('address') or '').strip().lower()
        if addr:
            for aid in [p.get('assetId'), p.get('newAssetId')]:
                if aid:
                    addr_to_asset[addr] = int(aid)

    # Enrich rows with assetId
    for row in rows:
        addr = (row.get('address') or '').strip().lower()
        row['assetId'] = addr_to_asset.get(addr)

    return rows


def fetch_lp_depth():
    """Fetch LP depth (token counts) from Lofty LP marketplace API."""
    try:
        resp = requests.get(LP_MARKETPLACE_API, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'
        }, timeout=30)
        if not resp.ok:
            print(f"LP API returned {resp.status_code}, skipping LP depth")
            return {}
        data = resp.json()
        pools = data.get('data', {}).get('pools', [])
        depth_map = {}
        for pool in pools:
            asset_id = pool.get('property', {}).get('assetId')
            if asset_id is None:
                continue
            # LP pool 'liquidity.base' is the base token amount in micro-units (10^-6)
            # e.g. 264000000 = 264 tokens in the pool
            liq = pool.get('liquidity', {})
            base_micro = liq.get('base', 0)
            base_tokens = int(base_micro / 1_000_000) if base_micro else 0
            depth_map[int(asset_id)] = {
                'base_tokens': base_tokens,
            }
        return depth_map
    except Exception as e:
        print(f"LP depth fetch failed: {e}")
        return {}


def compute_position_sizes(opportunities, lp_depth):
    """
    Half-Kelly position sizer with constraints.

    Kelly fraction: f* = (alpha_pct/100) / 1 = alpha_pct/100 (for binary win/loss)
    Half-Kelly: f = f* / 2 (more conservative)

    Constraints:
    - Max position size: MAX_POSITION_PCT of deployable capital
    - LP depth: can't exceed LP_DEPTH_PCT_CAP of available LP tokens
    - Minimum: MIN_TOKENS if alpha > MIN_ALPHA_PCT
    """
    if not opportunities:
        return []

    max_alpha = max((opp.get('alpha_pct') or 0) for opp in opportunities) or 1
    max_position_usd = DEPLOYABLE_CAPITAL * MAX_POSITION_PCT

    sized = []
    for opp in opportunities:
        alpha_pct = opp.get('alpha_pct') or 0
        market_price = opp.get('market_price') or 0
        asset_id = opp.get('assetId')

        if alpha_pct < MIN_ALPHA_PCT or market_price <= 0:
            sized.append({
                'id': opp['id'],
                'recommended_shares': None,
                'position_size_usd': None,
                'lp_depth_tokens': None,
                'assetId': opp.get('assetId'),
            })
            continue

        # Half-Kelly fraction scaled to max_alpha
        kelly_fraction = (alpha_pct / 100) / 2  # half-Kelly
        scaled_fraction = kelly_fraction / (max_alpha / 100)  # normalize to [0, ~1]
        scaled_fraction = min(scaled_fraction, 1.0)

        # Dollar allocation
        position_usd = DEPLOYABLE_CAPITAL * scaled_fraction * MAX_POSITION_PCT / 0.05
        # The 0.05 normalizer: if scaled_fraction=1, we want 5% (=MAX_POSITION_PCT)
        # if scaled_fraction=0.5, we want 2.5%, etc.
        # Simplify: position_usd = scaled_fraction * max_position_usd
        position_usd = scaled_fraction * max_position_usd

        # Share count from dollar allocation
        recommended_shares = int(position_usd / market_price)

        # LP depth constraint
        lp_info = lp_depth.get(asset_id, {})
        lp_tokens = lp_info.get('base_tokens', 0)
        if lp_tokens > 0:
            lp_cap = max(1, int(lp_tokens * LP_DEPTH_PCT_CAP))
            if recommended_shares > lp_cap:
                recommended_shares = lp_cap
                position_usd = recommended_shares * market_price

        # Floor constraint
        if recommended_shares < MIN_TOKENS and alpha_pct >= MIN_ALPHA_PCT:
            recommended_shares = MIN_TOKENS
            position_usd = recommended_shares * market_price

        # Final validation
        if recommended_shares < 1:
            recommended_shares = None
            position_usd = None

        sized.append({
            'id': opp['id'],
            'recommended_shares': recommended_shares,
            'position_size_usd': round(position_usd, 2) if position_usd else None,
            'lp_depth_tokens': lp_tokens if lp_tokens > 0 else None,
            'assetId': opp.get('assetId'),
        })

    return sized


def upsert_sizing(sized_rows):
    """Upsert position sizing data back to Supabase."""
    if not sized_rows:
        print("No rows to upsert")
        return

    url = f"{SUPABASE_URL}/rest/v1/lofty_alpha_opportunities"
    patch_headers = {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': f'Bearer {SERVICE_ROLE_KEY}',
        'Content-Type': 'application/json',
    }
    updated = 0
    for row in sized_rows:
        if row['recommended_shares'] is None and row['position_size_usd'] is None:
            patch = {'recommended_shares': None, 'position_size_usd': None, 'lp_depth_tokens': row.get('lp_depth_tokens')}
        else:
            patch = {
                'recommended_shares': row['recommended_shares'],
                'position_size_usd': row['position_size_usd'],
                'lp_depth_tokens': row.get('lp_depth_tokens'),
            }
        if row.get('assetId') is not None:
            patch['assetId'] = row['assetId']

        resp = requests.patch(
            f"{url}?id=eq.{row['id']}",
            headers=patch_headers,
            data=json.dumps(patch),
            timeout=15,
        )
        if resp.ok:
            updated += 1
        else:
            print(f"  Failed id={row['id']}: {resp.status_code} {resp.text[:200]}")

    print(f"Updated {updated}/{len(sized_rows)} rows")


def main():
    print("Fetching alpha opportunities...")
    opportunities = fetch_alpha_opportunities()
    print(f"  {len(opportunities)} opportunities loaded")

    print("Fetching LP depth...")
    lp_depth = fetch_lp_depth()
    print(f"  {len(lp_depth)} pools with depth data")

    print(f"Computing sizes (capital=${DEPLOYABLE_CAPITAL:.0f}, max_pos={MAX_POSITION_PCT*100:.1f}%, min_alpha={MIN_ALPHA_PCT:.0f}%)...")
    sized = compute_position_sizes(opportunities, lp_depth)

    active = sum(1 for s in sized if s['recommended_shares'] is not None)
    print(f"  {active} opportunities with position sizes")

    for s in sized:
        if s['recommended_shares']:
            opp = next((o for o in opportunities if o['id'] == s['id']), {})
            print(f"  {opp.get('address', '?')[:40]}: {s['recommended_shares']} shares (${s['position_size_usd']}) alpha={opp.get('alpha_pct', 0):.1f}%")

    print("Upserting to Supabase...")
    upsert_sizing(sized)
    print("Done.")


if __name__ == '__main__':
    main()