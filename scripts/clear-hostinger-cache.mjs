#!/usr/bin/env node
// Clear Hostinger LiteSpeed origin cache via hPanel CDP automation.
// Usage: NODE_PATH=$(npm root -g) node scripts/clear-hostinger-cache.mjs

import puppeteer from 'puppeteer';

const HPANEL_URL = 'https://hpanel.hostinger.com/websites/app.earlco.in/performance/cache-manager';
const HOSTINGER_EMAIL = process.env.HOSTINGER_EMAIL || '';
const HOSTINGER_PASSWORD = process.env.HOSTINGER_PASSWORD || '';

async function clearCache() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Navigate to cache manager — will redirect to login if not authenticated.
    console.log('Navigating to hPanel cache manager...');
    await page.goto(HPANEL_URL, { waitUntil: 'networkidle2', timeout: 30000 });

    // Check if we need to log in.
    const url = page.url();
    if (url.includes('login') || url.includes('auth')) {
      if (!HOSTINGER_EMAIL || !HOSTINGER_PASSWORD) {
        throw new Error('Login required but HOSTINGER_EMAIL / HOSTINGER_PASSWORD not set');
      }
      console.log('Logging in to hPanel...');
      await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });
      await page.type('input[type="email"], input[name="email"]', HOSTINGER_EMAIL);
      await page.type('input[type="password"], input[name="password"]', HOSTINGER_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });

      // Navigate to cache manager after login.
      await page.goto(HPANEL_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    }

    // Look for the "Purge All" / "Clear Cache" button.
    console.log('Looking for cache purge button...');

    // Try multiple selectors — Hostinger changes their UI.
    const selectors = [
      'button:has-text("Purge All")',
      'button:has-text("Clear Cache")',
      'button:has-text("Purge")',
      '[data-testid="purge-cache"]',
      '[data-qa="purge-cache"]',
      '.cache-purge-btn',
    ];

    let clicked = false;
    for (const sel of selectors) {
      try {
        const btn = await page.$(sel);
        if (btn) {
          await btn.click();
          clicked = true;
          console.log(`Clicked: ${sel}`);
          break;
        }
      } catch { /* try next */ }
    }

    if (!clicked) {
      // Fallback: find any button with purge/clear text via XPath.
      const buttons = await page.$$('button');
      for (const btn of buttons) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (/purge|clear.*cache/i.test(text)) {
          await btn.click();
          clicked = true;
          console.log(`Clicked button: "${text.trim()}"`);
          break;
        }
      }
    }

    if (!clicked) {
      // Last resort: intercept the hPanel API call directly.
      console.log('No button found — attempting direct API call via page context...');
      const cookies = await page.cookies();
      const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');

      const result = await page.evaluate(async (cookieHeader) => {
        const res = await fetch('/api/cache/purge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Cookie': cookieHeader },
          credentials: 'include',
        });
        return { status: res.status, body: await res.text() };
      }, cookieStr);

      console.log('API response:', result.status, result.body.slice(0, 200));
    } else {
      // Wait for confirmation.
      await new Promise(r => setTimeout(r, 3000));
      console.log('Cache purge initiated.');
    }

  } finally {
    await browser.close();
  }
}

clearCache()
  .then(() => { console.log('Done.'); process.exit(0); })
  .catch(err => { console.error('Error:', err.message); process.exit(1); });
