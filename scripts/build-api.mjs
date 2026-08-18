import { build } from 'esbuild';
import fs from 'fs';
import path from 'path';

const apiDir = path.resolve('api');

function findTsFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    if (file.startsWith('_')) continue; // Skip helper files
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

const entryPoints = findTsFiles(apiDir);
console.log(`[build-api] Found ${entryPoints.length} serverless endpoints to bundle...`);

await build({
  entryPoints,
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outdir: apiDir,
  outbase: apiDir,
  allowOverwrite: true,
  sourcemap: false,
  banner: {
    js: `// Auto-generated bundled serverless function for JugaadVision\n`,
  },
});

console.log('[build-api] Successfully bundled all API serverless endpoints!');
