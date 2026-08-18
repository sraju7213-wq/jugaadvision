import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const srcDir = path.resolve('api-src');
const outDir = path.resolve('api');

function getAllFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!file.startsWith('_')) {
        getAllFiles(fullPath, fileList);
      }
    } else if (file.endsWith('.ts') && !file.startsWith('_')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

async function bundleAll() {
  const entryPoints = getAllFiles(srcDir);
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
      minify: false,
      sourcemap: false,
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
