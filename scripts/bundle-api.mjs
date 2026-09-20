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
      alias: {
        // Local GGUF inference cannot run on Vercel (read-only/ephemeral disk),
        // and @vercel/nft would otherwise trace node-llama-cpp + every
        // @node-llama-cpp/* platform binary (~1 GB) into each of the functions,
        // OOM-killing the build container. The stub throws only when local
        // inference is actually attempted.
        'node-llama-cpp': path.resolve('scripts/node-llama-cpp.serverless.stub.js'),
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
        // node-llama-cpp uses native .node bindings — must stay external
        'node-llama-cpp',
        '@reflink/reflink-linux-x64-gnu',
        '@node-llama-cpp/*',
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
