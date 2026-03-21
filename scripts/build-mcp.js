const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['src/mcp/server.ts'],
  bundle: true,
  outfile: 'dist/mcp.js',
  platform: 'node',
  format: 'cjs',
  sourcemap: true,
  banner: { js: '#!/usr/bin/env node' },
}).catch(() => process.exit(1));
