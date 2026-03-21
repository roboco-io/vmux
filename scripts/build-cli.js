const esbuild = require('esbuild');

const watch = process.argv.includes('--watch');

const options = {
  entryPoints: ['src/cli/index.ts'],
  bundle: true,
  outfile: 'dist/cli.js',
  platform: 'node',
  format: 'cjs',
  sourcemap: true,
  banner: { js: '#!/usr/bin/env node' },
};

async function main() {
  if (watch) {
    const ctx = await esbuild.context(options);
    await ctx.watch();
    console.log('Watching cli...');
  } else {
    await esbuild.build(options);
  }
}

main().catch(() => process.exit(1));
