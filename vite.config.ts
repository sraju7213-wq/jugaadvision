import path from "path";
import { defineConfig, loadEnv, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from 'vite-plugin-pwa';

function aiDevServerPlugin(): Plugin {
  return {
    name: 'ai-dev-server-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && (req.url.startsWith('/api/ai') || req.url.startsWith('/api/settings') || req.url.startsWith('/api/creative-mix') || req.url.startsWith('/api/remove-bg'))) {
          try {
            const { handleAIRequest } = await server.ssrLoadModule('./server/ai/serverHandler.ts');
            const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || '127.0.0.1';

            let body: any = {};
            if (req.method === 'POST' || req.method === 'PUT') {
              const buffers: any[] = [];
              let totalBytes = 0;
              const maxPayloadBytes = 15 * 1024 * 1024; // 15MB limit

              for await (const chunk of req) {
                totalBytes += chunk.length;
                if (totalBytes > maxPayloadBytes) {
                  res.statusCode = 413;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: false, error: 'Payload exceeds maximum limit (15MB)' }));
                  return;
                }
                buffers.push(chunk);
              }
              const rawBody = Buffer.concat(buffers).toString('utf-8');
              if (rawBody) {
                try {
                  body = JSON.parse(rawBody);
                } catch {
                  body = { prompt: rawBody };
                }
              }
            }

            const result = await handleAIRequest(req.url, req.method || 'GET', body, clientIp);
            res.statusCode = result.status;
            res.setHeader('Content-Type', 'application/json');
            
            if (result.headers) {
              for (const [k, v] of Object.entries(result.headers)) {
                res.setHeader(k, v);
              }
            }

            res.end(JSON.stringify(result.data));
            return;
          } catch (err: any) {
            console.error('[ViteDevServer] AI Middleware Error:', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: 'Internal server security error' }));
            return;
          }
        }
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");

  // Populate server-side process.env for local adapters
  Object.assign(process.env, env);

  return {
    base: process.env.CAPACITOR_BUILD ? "./" : "/",
    server: {
      port: 3000,
      host: "0.0.0.0",
    },
    plugins: [
      react(),
      aiDevServerPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
        manifest: {
          name: 'Jugaad Visuals',
          short_name: 'Jugaad',
          description: 'An all-in-one AI toolkit for creators. Craft professional prompts.',
          theme_color: '#050505',
          background_color: '#050505',
          display: 'standalone',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    build: {
      cssMinify: true,
      sourcemap: false,
      minify: 'esbuild',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            'ui-heavy': ['lucide-react'],
          },
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
        },
      },
      chunkSizeWarningLimit: 500,
    },
  };
});
