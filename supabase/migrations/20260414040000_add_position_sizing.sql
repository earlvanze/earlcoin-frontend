-- Position sizing columns for Compass Yield alpha opportunities
ALTER TABLE lofty_alpha_opportunities
ADD COLUMN IF NOT EXISTS recommended_shares INTEGER,
ADD COLUMN IF NOT EXISTS position_size_usd FLOAT,
ADD COLUMN IF NOT EXISTS lp_depth_tokens INTEGER;

-- Index for querying sized opportunities
CREATE INDEX IF NOT EXISTS idx_alpha_sized
  ON lofty_alpha_opportunities(recommended_shares)
  WHERE recommended_shares IS NOT NULL;