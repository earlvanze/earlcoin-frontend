-- Add proposal-related columns to lofty_alpha_opportunities
ALTER TABLE lofty_alpha_opportunities 
ADD COLUMN IF NOT EXISTS proposal_draft TEXT,
ADD COLUMN IF NOT EXISTS proposal_rank INTEGER,
ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT FALSE;
-- Add index for featured properties
CREATE INDEX IF NOT EXISTS idx_alpha_featured ON lofty_alpha_opportunities(featured) WHERE featured = true;
-- Add index for proposal rank
CREATE INDEX IF NOT EXISTS idx_alpha_proposal_rank ON lofty_alpha_opportunities(proposal_rank) WHERE proposal_rank IS NOT NULL;
