import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const commitHash = execSync('git rev-parse --short HEAD').toString().trim();
const commitDate = execSync('git log -1 --format=%cI').toString().trim();
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'));

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(commitHash),
    __APP_BUILD_DATE__: JSON.stringify(commitDate),
    __PACKAGE_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
