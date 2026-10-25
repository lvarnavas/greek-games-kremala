import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createKremalaServer } from './app';

const here = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? '0.0.0.0';
const origins = process.env.CLIENT_ORIGIN?.split(',').map((s) => s.trim()).filter(Boolean);
const staticDir = process.env.STATIC_DIR ?? path.resolve(here, '../../client/dist');

const server = createKremalaServer({
  clientOrigin: origins && origins.length ? origins : undefined,
  staticDir,
  autoNextMs: Number(process.env.AUTO_NEXT_MS ?? 20_000),
});

server.listen(port, host).then((p) => {
  console.log(`🎯 Κρεμάλα server: http://localhost:${p}`);
});

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => void server.close().then(() => process.exit(0)));
}
