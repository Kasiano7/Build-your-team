/**
 * Minimal static server with SPA fallback, to test the production web export
 * (apps/game/dist) exactly as a static host such as Vercel would serve it.
 *   node e2e/serve-dist.mjs [dir] [port]
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const dir = resolve(process.argv[2] ?? 'apps/game/dist');
const port = Number(process.argv[3] ?? 8090);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.wav': 'audio/wav', '.ttf': 'font/ttf', '.svg': 'image/svg+xml' };

createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)).replace(/^([/\\])+/, '');
  let file = join(dir, path);
  if (!file.startsWith(dir) || !existsSync(file) || statSync(file).isDirectory()) file = join(dir, 'index.html');
  res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`serving ${dir} on http://localhost:${port}`));
