const path = require('node:path');
const { loadConfigFromFile, optimizeDeps } = require('vite');

(async () => {
  const root = path.resolve(__dirname, '..');
  const configEnv = { command: 'serve', mode: 'development' };
  const loaded = await loadConfigFromFile(configEnv, path.join(root, 'vite.config.js'));
  const config = loaded?.config || {};

  const res = await optimizeDeps({
    config,
    force: true,
    command: 'serve',
    mode: 'development',
    root,
    logLevel: 'info',
  });

  console.log('optimizeDeps done', res);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
