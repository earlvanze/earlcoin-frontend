-- LP Strategy table for lofty-deals third tab
CREATE TABLE IF NOT EXISTS lofty_lp_strategy (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    strategy_type TEXT NOT NULL,
    scenario TEXT NOT NULL,
    market_discount_pct FLOAT,
    quote_return_pct FLOAT,
    base_return_pct FLOAT,
    hybrid_return_pct FLOAT,
    winner TEXT,
    recommendation TEXT,
    notes TEXT
);
-- Enable RLS
ALTER TABLE lofty_lp_strategy ENABLE ROW LEVEL SECURITY;
-- Anon read access
CREATE POLICY "anon_read_lp_strategy" ON lofty_lp_strategy
    FOR SELECT TO anon USING (true);
-- Service role full access
CREATE POLICY "service_role_lp_strategy" ON lofty_lp_strategy
    FOR ALL TO service_role USING (true) WITH CHECK (true);
-- Index for queries
CREATE INDEX IF NOT EXISTS idx_lp_strategy_type ON lofty_lp_strategy(strategy_type);
