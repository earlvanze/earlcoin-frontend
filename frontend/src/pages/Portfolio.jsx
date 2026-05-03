import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, DatabaseZap, DollarSign, FileUp, Layers3, RefreshCcw } from 'lucide-react';
import PageTitle from '@/components/PageTitle';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  DEFAULT_LOFTY_PORTFOLIO_SEED,
  buildPortfolioSummary,
  normalizeLoftyPortfolioPayload,
} from '@/lib/loftyPortfolioSeed';

const STORAGE_KEY = 'earlcoin:lofty-portfolio-seed';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring' } },
};

const formatUsd = (value) => {
  if (!Number.isFinite(value) || value <= 0) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
};

const Portfolio = () => {
  const [seed, setSeed] = useState(DEFAULT_LOFTY_PORTFOLIO_SEED);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      setSeed(normalizeLoftyPortfolioPayload(parsed));
    } catch (error) {
      console.error('Failed to load Lofty portfolio seed:', error);
    }
  }, []);

  const summary = useMemo(() => buildPortfolioSummary(seed), [seed]);
  const holdings = useMemo(
    () => [...(seed?.holdings || [])].sort((a, b) => Number(b.sharesOwned || 0) - Number(a.sharesOwned || 0)),
    [seed]
  );

  const handleImport = () => {
    try {
      const parsed = JSON.parse(importText);
      const normalized = normalizeLoftyPortfolioPayload(parsed);
      setSeed(normalized);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      setImportError('');
    } catch (error) {
      setImportError(error?.message || 'Invalid Lofty import payload.');
    }
  };

  const resetToDefault = () => {
    setSeed(DEFAULT_LOFTY_PORTFOLIO_SEED);
    localStorage.removeItem(STORAGE_KEY);
    setImportText('');
    setImportError('');
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={containerVariants} className="space-y-6">
      <PageTitle
        title="Seed Portfolio"
        description="Current-version in-kind contribution set for EarlCoin, modeled from Lofty account-style holdings."
      />

      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Lofty seed set</Badge>
              <Badge variant="secondary">State-driven</Badge>
              <Badge variant="outline">Snapshot as of {seed.snapshotAsOf || 'unknown'}</Badge>
            </div>
            <CardTitle>Portfolio seeding basis</CardTitle>
            <CardDescription>
              This page now treats Earl&apos;s Lofty holdings as the initial in-kind contribution set. Until a live Lofty export is wired,
              the portfolio runs off an importable seed payload instead of fake placeholder assets.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p><span className="text-foreground font-medium">Source:</span> {seed.source}</p>
            {seed.notes && <p>{seed.notes}</p>}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Properties</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2"><Building2 className="h-6 w-6" /> {summary.propertyCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total shares</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2"><Layers3 className="h-6 w-6" /> {summary.totalShares.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Known current value</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2"><DollarSign className="h-6 w-6" /> {formatUsd(summary.totalValueUsd)}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">Shows only holdings with imported value data.</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Known monthly income</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2"><DatabaseZap className="h-6 w-6" /> {formatUsd(summary.totalMonthlyIncomeUsd)}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">Can be populated once a richer Lofty export is imported.</CardContent>
        </Card>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>In-kind contribution holdings</CardTitle>
            <CardDescription>
              These are the property positions the fund can seed from Earl&apos;s personal Lofty holdings. Default view is the checked-in seed snapshot;
              paste a fresher Lofty export JSON below to override it locally.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {holdings.map((holding) => (
                <Card key={holding.id} className="border-border/60 bg-background/40">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-lg leading-tight">{holding.propertyName}</CardTitle>
                        <CardDescription>
                          {holding.lastUpdated ? `Snapshot updated ${holding.lastUpdated}` : 'Snapshot date pending'}
                        </CardDescription>
                      </div>
                      <Badge variant="outline">{Number(holding.sharesOwned).toLocaleString()} shares</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Current value</p>
                      <p className="font-semibold">{formatUsd(holding.currentValueUsd)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Cost basis</p>
                      <p className="font-semibold">{formatUsd(holding.investedUsd)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Unit price</p>
                      <p className="font-semibold">{formatUsd(holding.unitPriceUsd)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Monthly income</p>
                      <p className="font-semibold">{formatUsd(holding.monthlyIncomeUsd)}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Status</p>
                      <p className="font-semibold capitalize">{holding.status || 'seeded'}</p>
                    </div>
                    {holding.notes && (
                      <div className="col-span-2 text-muted-foreground">{holding.notes}</div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Import fresher Lofty holdings</CardTitle>
            <CardDescription>
              Supported shape: either <span className="font-mono">{"{ holdings: [...] }"}</span> or a raw array.
              Each holding should include a property/address field and a shares field.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              placeholder={`{
  "source": "Lofty account export",
  "snapshotAsOf": "2026-03-13",
  "holdings": [
    {
      "property": "123 Main St, City, ST",
      "shares": 42,
      "currentValueUsd": 4200,
      "monthlyIncomeUsd": 31.5
    }
  ]
}`}
              className="min-h-[220px] font-mono text-xs"
            />
            {importError && <p className="text-sm text-destructive">{importError}</p>}
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleImport}><FileUp className="mr-2 h-4 w-4" /> Import Lofty snapshot</Button>
              <Button variant="outline" onClick={resetToDefault}><RefreshCcw className="mr-2 h-4 w-4" /> Reset to checked-in seed</Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default Portfolio;
