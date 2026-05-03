-- Add raw return columns (decimal format) for LP strategy
ALTER TABLE lofty_lp_strategy 
ADD COLUMN IF NOT EXISTS quote_return FLOAT,
ADD COLUMN IF NOT EXISTS base_return FLOAT,
ADD COLUMN IF NOT EXISTS hybrid_return FLOAT;
-- Update existing records to populate raw returns (percentage / 100)
UPDATE lofty_lp_strategy 
SET 
    quote_return = quote_return_pct / 100,
    base_return = base_return_pct / 100,
    hybrid_return = hybrid_return_pct / 100
WHERE quote_return IS NULL;
