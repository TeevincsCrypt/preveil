// Copies the compiled contract's ZK assets (keys, zkir, manifest) into
// ui/public/managed/priveil so the network mode can fetch them from the page
// origin. Keys are produced by `npm run compile` at the repo root and are not
// committed (80 MB). Without keys the Local Simulation still works fully.
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, '../../contract/managed/priveil');
const dst = path.resolve(here, '../public/managed/priveil');

rmSync(dst, { recursive: true, force: true });
if (!existsSync(path.join(src, 'keys'))) {
  console.log('[copy-zk] no proving keys found (run `npm run compile` at the repo root for network mode); skipping');
  process.exit(0);
}
mkdirSync(dst, { recursive: true });
for (const dir of ['keys', 'zkir', 'compiler']) cpSync(path.join(src, dir), path.join(dst, dir), { recursive: true });
console.log('[copy-zk] copied ZK assets to public/managed/priveil');
