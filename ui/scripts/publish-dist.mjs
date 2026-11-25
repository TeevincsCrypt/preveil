// Copies the built app (ui/dist) to <repo>/dist as well, so the output is
// found whether the hosting project's root is the repository or ui/
// (Vercel's default output directory is "dist" relative to its root).
import { cpSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, '../dist');
const dst = path.resolve(here, '../../dist');
if (!existsSync(path.join(src, 'index.html'))) {
  console.error('[publish-dist] ui/dist/index.html not found — did vite build run?');
  process.exit(1);
}
rmSync(dst, { recursive: true, force: true });
cpSync(src, dst, { recursive: true });
console.log('[publish-dist] copied ui/dist → dist');
