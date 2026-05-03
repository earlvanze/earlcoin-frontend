-- NAV data for Portfolio.jsx FMV values
CREATE TABLE IF NOT EXISTS lofty_nav_data (
    id SERIAL PRIMARY KEY,
    address TEXT UNIQUE NOT NULL,
    slug TEXT,
    city TEXT,
    state TEXT,
    comparable_value FLOAT,
    dao_net_cash FLOAT,
    eco_operating_cash FLOAT,
    total_tokens INT DEFAULT 2000,
    nav_per_token FLOAT,
    cap_rate FLOAT,
    data_source TEXT,
    dao_net_cash_date TEXT,
    eco_cash_date TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Alpha opportunities for lofty-deals
CREATE TABLE IF NOT EXISTS lofty_alpha_opportunities (
    id SERIAL PRIMARY KEY,
    address TEXT UNIQUE NOT NULL,
    slug TEXT,
    city TEXT,
    state TEXT,
    nav_per_token FLOAT,
    market_price FLOAT,
    alpha_amount FLOAT,
    alpha_pct FLOAT,
    comparable_value FLOAT,
    dao_net_cash FLOAT,
    cap_rate FLOAT,
    recommendation TEXT,
    reasoning TEXT,
    proposal_ready BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Create indexes
CREATE INDEX IF NOT EXISTS idx_nav_address ON lofty_nav_data(address);
CREATE INDEX IF NOT EXISTS idx_nav_slug ON lofty_nav_data(slug);
CREATE INDEX IF NOT EXISTS idx_alpha_opportunities ON lofty_alpha_opportunities(alpha_pct DESC);
CREATE INDEX IF NOT EXISTS idx_alpha_recommendation ON lofty_alpha_opportunities(recommendation);
-- Enable RLS
ALTER TABLE lofty_nav_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE lofty_alpha_opportunities ENABLE ROW LEVEL SECURITY;
-- Allow service role full access (drop existing policies first)
DROP POLICY IF EXISTS "service_role_nav" ON lofty_nav_data;
DROP POLICY IF EXISTS "service_role_alpha" ON lofty_alpha_opportunities;
DROP POLICY IF EXISTS "anon_read_nav" ON lofty_nav_data;
DROP POLICY IF EXISTS "anon_read_alpha" ON lofty_alpha_opportunities;
CREATE POLICY "service_role_nav" ON lofty_nav_data FOR ALL USING (true);
CREATE POLICY "service_role_alpha" ON lofty_alpha_opportunities FOR ALL USING (true);
-- Allow anonymous read (for frontend)
CREATE POLICY "anon_read_nav" ON lofty_nav_data FOR SELECT USING (true);
CREATE POLICY "anon_read_alpha" ON lofty_alpha_opportunities FOR SELECT USING (true);
