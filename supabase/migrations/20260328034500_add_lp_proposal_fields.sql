-- Add richer LP strategy fields for dynamic lofty-deals proposals
ALTER TABLE lofty_lp_strategy
ADD COLUMN IF NOT EXISTS asset_unit TEXT,
ADD COLUMN IF NOT EXISTS property_id TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS tier TEXT,
ADD COLUMN IF NOT EXISTS proposal_draft TEXT,
ADD COLUMN IF NOT EXISTS proposal_rank INTEGER,
ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_lofty_lp_strategy_asset_unit ON lofty_lp_strategy(asset_unit);
CREATE INDEX IF NOT EXISTS idx_lofty_lp_strategy_proposal_rank ON lofty_lp_strategy(proposal_rank) WHERE proposal_rank IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lofty_lp_strategy_featured ON lofty_lp_strategy(featured) WHERE featured = true;
