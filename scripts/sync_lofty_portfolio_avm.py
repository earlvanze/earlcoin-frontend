#!/usr/bin/env python3
import json
from pathlib import Path
import requests

SUPABASE_URL = 'https://aeaufjjeimtkiixdmrtq.supabase.co'
SERVICE_ROLE_KEY = '***REMOVED_SERVICE_ROLE_KEY***'
DATA_PATH = Path('/home/umbrel/.openclaw/workspace-investment-advisor/data/portfolio_avm_merged.json')

headers = {
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': f'Bearer {SERVICE_ROLE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates',
}

raw = json.loads(DATA_PATH.read_text())
rows = raw['properties']
fetch_date = (raw.get('fetched_at') or '')[:10] or None
payload = []
for row in rows:
    payload.append({
        'property_id': row.get('id'),
        'address': row.get('address'),
        'state': row.get('state'),
        'property_type': row.get('type'),
        'total_investment': row.get('total_investment'),
        'market_cap': row.get('market_cap'),
        'avm': row.get('avm'),
        'avm_range_low': row.get('avm_range_low'),
        'avm_range_high': row.get('avm_range_high'),
        'avm_corrected': row.get('avm_corrected', False),
        'avm_source': row.get('avm_source'),
        'token_price': row.get('token_price'),
        'tokens_outstanding': row.get('tokens'),
        'monthly_rent': row.get('monthly_rent'),
        'cap_rate': row.get('cap_rate'),
        'avm_vs_investment_pct': row.get('avm_vs_investment'),
        'is_owned': row.get('is_owned', False),
        'data_fetch_date': fetch_date,
    })

url = f"{SUPABASE_URL}/rest/v1/lofty_portfolio_avm?on_conflict=property_id"
resp = requests.post(url, headers=headers, data=json.dumps(payload), timeout=120)
print(resp.status_code)
print(resp.text[:1000])
resp.raise_for_status()
print(f'Upserted {len(payload)} rows')
