const esbuild = require('esbuild');

// Build E2E test files
// index.ts runs inside Extension Host (has access to vscode API)
// runTest.ts runs outside (launches VS Code)

esbuild.build({
  entryPoints: [
    'src/e2e/index.ts',
    'src/e2e/runTest.ts',
  ],
  bundle: true,
  outdir: 'dist/e2e',
  platform: 'node',
  format: 'cjs',
  sourcemap: true,
  external: ['vscode', '@vscode/test-electron'],
}).catch(() => process.exit(1));
