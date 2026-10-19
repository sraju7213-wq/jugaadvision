import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const srcDir = path.join(repoRoot, 'api-src');
const outDir = path.join(repoRoot, 'api');

async function bundleAll() {
  // Keep the function count below Vercel Hobby's 12-function limit. The
  // catch-all handlers own all nested API routes, including the former
  // static model/health/generate/test endpoints.
  const entryPoints = [
    path.join(srcDir, 'ai/[...slug].ts'),
    path.join(srcDir, 'settings/[...slug].ts'),
    path.join(srcDir, 'creative-mix.ts'),
    path.join(srcDir, 'remove-bg.ts'),
  ];
  console.log(`[bundle-api] Bundling ${entryPoints.length} serverless endpoints...`);

  for (const entry of entryPoints) {
    const relPath = path.relative(srcDir, entry);
    const outFile = path.join(outDir, relPath.replace(/\.ts$/, '.js'));
    const outSubDir = path.dirname(outFile);

    if (!fs.existsSync(outSubDir)) {
      fs.mkdirSync(outSubDir, { recursive: true });
    }

    await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      platform: 'node',
      target: 'node18',
      format: 'esm',
      outfile: outFile,
      minify: true,
      sourcemap: false,
      alias: {
        '@jugaad/api': path.join(repoRoot, 'services/api/src'),
      },
      external: [
        'node:*',
        'fs',
        'path',
        'crypto',
        'http',
        'https',
        'url',
        'stream',
        'buffer',
        'util',
        'os',
        'events',
        'net',
        'tls',
        'zlib',
      ],
    });
    console.log(`  ✓ ${relPath} -> ${path.relative(process.cwd(), outFile)}`);
  }

  console.log('[bundle-api] Successfully bundled all serverless functions!');
}

bundleAll().catch(err => {
  console.error('[bundle-api] Build failed:', err);
  process.exit(1);
});
