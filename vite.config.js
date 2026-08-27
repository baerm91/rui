import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ACTIVE_PROJECT_URL = '/active-project.json';
const projectDirectory = join(process.cwd(), 'project');

function findProjectFile() {
  let files = [];
  try {
    files = readdirSync(projectDirectory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
      .map((entry) => {
        const path = join(projectDirectory, entry.name);
        return {
          name: entry.name,
          path,
          modifiedAt: statSync(path).mtimeMs
        };
      })
      .sort((left, right) => (
        right.modifiedAt - left.modifiedAt
        || right.name.localeCompare(left.name)
      ));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  return files[0]?.path ?? null;
}

function activeProjectPlugin() {
  return {
    name: 'active-project-file',
    configResolved() {
      findProjectFile();
    },
    configureServer(server) {
      server.middlewares.use(ACTIVE_PROJECT_URL, (_request, response) => {
        try {
          const projectFile = findProjectFile();
          if (!projectFile) {
            response.statusCode = 404;
            response.end('Keine JSON-Datei im Ordner project gefunden.');
            return;
          }
          response.setHeader('Content-Type', 'application/json; charset=utf-8');
          response.setHeader('Cache-Control', 'no-store');
          response.end(readFileSync(projectFile));
        } catch (error) {
          response.statusCode = 500;
          response.end(error.message);
        }
      });
    },
    buildStart() {
      const projectFile = findProjectFile();
      if (!projectFile) return;
      this.emitFile({
        type: 'asset',
        fileName: ACTIVE_PROJECT_URL.slice(1),
        source: readFileSync(projectFile)
      });
    }
  };
}

export default defineConfig({
  // Supabase's Vercel Marketplace integration provisions NEXT_PUBLIC_* names.
  // Keep VITE_* for local development and expose both public-only prefixes.
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  plugins: [activeProjectPlugin(), react()],
  server: {
    port: 3005,
    // Project data is stored per browser origin. Silently falling back to
    // 3006 would therefore make existing projects on 3005 appear missing.
    strictPort: true
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('three')) {
              return 'three';
            }
            if (id.includes('gsap')) {
              return 'gsap';
            }
            if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) {
              return 'vendor';
            }
          }
        }
      }
    }
  }
});
