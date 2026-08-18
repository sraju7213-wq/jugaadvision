import { build } from 'esbuild';
import fs from 'fs';
import path from 'path';

const srcDir = path.resolve('api-src');
const outDir = path.resolve('api');

function findTsFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    if (file.startsWith('_')) continue; // Skip internal helper files
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(findTsFiles(fullPath));
    } else if (file.endsWith('.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

const entryPoints = findTsFiles(srcDir);
console.log(`[build-api] Found ${entryPoints.length} serverless endpoints to bundle...`);

// Ensure output directories exist
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

await build({
  entryPoints,
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outdir: outDir,
  outbase: srcDir,
  allowOverwrite: true,
  sourcemap: false,
  banner: {
    js: `// Auto-generated bundled serverless function for JugaadVision\n`,
  },
});

console.log('[build-api] Successfully bundled all API serverless endpoints to api/ !');
