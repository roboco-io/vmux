const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

// Find all test files
const testDir = path.join(__dirname, '..', 'src', 'test');
const testFiles = fs.readdirSync(testDir)
  .filter(f => f.endsWith('.test.ts'))
  .map(f => path.join(testDir, f));

esbuild.build({
  entryPoints: testFiles,
  bundle: true,
  outdir: 'dist/test',
  platform: 'node',
  format: 'cjs',
  sourcemap: true,
  external: ['vscode'],
}).catch(() => process.exit(1));
