import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { wsHandler } from './ws/handler.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';
const USE_DB = !!process.env.DATABASE_URL;

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(websocket);

  if (USE_DB) {
    // PostgreSQL mode
    const { lobbyRoutes } = await import('./routes/lobby.js');
    const { gameRoutes } = await import('./routes/game.js');
    await app.register(lobbyRoutes, { prefix: '/api/game' });
    await app.register(gameRoutes, { prefix: '/api/game' });
    console.log('📦 Using PostgreSQL database');
  } else {
    // In-memory mode (no DB needed)
    const { lobbyMemRoutes } = await import('./routes/lobby-mem.js');
    const { gameMemRoutes } = await import('./routes/game-mem.js');
    await app.register(lobbyMemRoutes, { prefix: '/api/game' });
    await app.register(gameMemRoutes, { prefix: '/api/game' });
    console.log('🧠 Using in-memory storage (no database)');
  }

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
