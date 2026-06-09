import * as esbuild from 'esbuild';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const config = {
    entryPoints: ['src/extension.ts'],
    outfile: 'out/extension.js',
    bundle: true,
    external: ['vscode'],   // vscode is provided by the extension host at runtime
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    sourcemap: !production ? 'inline' : false,
    minify: production,
    logLevel: 'info',
};

if (watch) {
    const ctx = await esbuild.context(config);
    await ctx.watch();
    console.log('[esbuild] Watching for changes…');
} else {
    await esbuild.build(config);
}
