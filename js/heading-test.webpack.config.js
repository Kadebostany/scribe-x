const path = require('path');
const config = require('flarum-webpack-config');

module.exports = () => {
  const base = config();
  base.mode = 'development';
  base.optimization = { minimize: false };
  base.entry = { main: path.resolve(__dirname, 'heading-test-entry.ts') };
  base.output.path = '/tmp/claude-1010/-var-www-lovelodyx-com-data-www-forum-lovelodyx-com/c1e41b07-d62d-4ee6-aa8e-495f9015628a/scratchpad';
  base.output.filename = 'heading-test-bundle.js';
  base.externals = {};
  for (const rule of base.module.rules) {
    if (String(rule.test) === String(/\.[jt]sx?$/)) {
      rule.exclude = /node_modules/;
    }
  }
  return base;
};
