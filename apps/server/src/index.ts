import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { wsHandler } from '@conflict-game/game-transport';
import { lobbyMemRoutes } from './routes/lobby-mem.js';
import { gameMemRoutes } from './routes/game-mem.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function main() {
  const app = Fastify({ logger: true });

  // origin: true reflects the request's Origin header back, which works
  // for http://localhost:3000 (dev) but Chromium sends `null` for file://
  // pages inside Electron production builds. Accept anything — the server
  // only listens on 127.0.0.1 anyway.
  await app.register(cors, { origin: '*' });
  await app.register(websocket);

  // All state lives in memory: sessions are short and end with the process.
  await app.register(lobbyMemRoutes, { prefix: '/api/game' });
  await app.register(gameMemRoutes, { prefix: '/api/game' });

  // WebSocket
  app.get('/ws', { websocket: true }, wsHandler);

  // Health check
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`🎮 Conflict.Game server running at http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
