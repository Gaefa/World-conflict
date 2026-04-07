import type { FastifyRequest } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import type { ClientMessage, ServerMessage, GameState } from '@conflict-game/shared-types';
import { enqueueAction } from '../game/action-queue.js';
import type { GameLoop } from '../game/loop.js';

/** Resolver to look up game loop — set by game-mem.ts on startup */
let gameLoopRef: GameLoop | null = null;

export function setGameLoopRef(loop: GameLoop): void {
  gameLoopRef = loop;
}

/** Resolver to look up game state — set by game-mem.ts on startup */
let stateResolver: ((sessionId: string) => GameState | null) | null = null;

export function setStateResolver(resolver: (sessionId: string) => GameState | null): void {
  stateResolver = resolver;
}

interface Connection {
  socket: WebSocket;
  sessionId: string;
  countryCode: string | null;
}

const connections = new Map<string, Connection>();

/** Register a player's country code (called after country selection / game start) */
export function setPlayerCountry(playerId: string, countryCode: string): void {
  const conn = connections.get(playerId);
  if (conn) conn.countryCode = countryCode;
}

export function wsHandler(socket: WebSocket, request: FastifyRequest) {
  let playerId: string | null = null;
  let sessionId: string | null = null;

  socket.on('message', (rawData: Buffer | ArrayBuffer | Buffer[]) => {
    try {
      const message: ClientMessage = JSON.parse(rawData.toString());

      switch (message.type) {
        case 'join_session': {
          playerId = message.payload.playerId;
          sessionId = message.payload.sessionId;
          // Auto-detect country from game state
          let detectedCountry: string | null = null;
          if (stateResolver) {
            const gs = stateResolver(sessionId);
            if (gs) {
              const player = gs.players.find(p => p.id === playerId);
              if (player?.countryCode) detectedCountry = player.countryCode;
            }
          }
          connections.set(playerId, { socket, sessionId, countryCode: detectedCountry });
          send(socket, {
            type: 'session_status',
            payload: { status: 'joined', message: `Joined session ${sessionId}` },
          });
          console.log(`Player ${playerId} joined session ${sessionId} (country: ${detectedCountry || 'none'})`);
          break;
        }

        case 'leave_session':
          if (playerId) connections.delete(playerId);
          send(socket, {
            type: 'session_status',
            payload: { status: 'left', message: 'Left session' },
          });
          break;

        case 'player_action': {
          if (!playerId || !sessionId) {
            send(socket, { type: 'error', payload: { code: 'NOT_IN_SESSION', message: 'Join a session first' } });
            break;
          }
          const conn = connections.get(playerId);
          const countryCode = conn?.countryCode;
          if (!countryCode) {
            send(socket, { type: 'error', payload: { code: 'NO_COUNTRY', message: 'Select a country first' } });
            break;
          }

          // Queue action for processing in next game tick
          // Result will be sent back from game loop after processing
          enqueueAction(sessionId, {
            playerId,
            countryCode,
            sessionId,
            action: message.payload,
          });
          break;
        }

        case 'chat_message':
          if (sessionId && playerId) {
            broadcastToSession(sessionId, {
              type: 'chat_message',
              payload: {
                from: playerId,
                text: message.payload.text,
                channel: message.payload.channel,
                timestamp: new Date().toISOString(),
              },
            }, playerId);
          }
          break;

        case 'select_country':
          if (playerId) {
            const conn = connections.get(playerId);
            if (conn) conn.countryCode = message.payload.countryCode;
          }
          send(socket, {
            type: 'session_status',
            payload: { status: 'country_selected', message: `Selected ${message.payload.countryCode}` },
          });
          break;

        case 'toggle_pause': {
          if (!sessionId || !gameLoopRef) break;
          const paused = gameLoopRef.isPaused(sessionId);
          if (paused) {
            gameLoopRef.resume(sessionId);
            broadcastToSession(sessionId, {
              type: 'session_status',
              payload: { status: 'resumed', message: 'Game resumed' },
            });
          } else {
            gameLoopRef.pause(sessionId);
            broadcastToSession(sessionId, {
              type: 'session_status',
              payload: { status: 'paused', message: 'Game paused' },
            });
          }
          break;
        }

        case 'ready':
          break;

        case 'ping':
          send(socket, { type: 'pong' });
          break;
      }
    } catch (err) {
      send(socket, { type: 'error', payload: { code: 'INVALID_MESSAGE', message: 'Invalid message format' } });
    }
  });

  socket.on('close', () => {
    if (playerId) {
      connections.delete(playerId);
      console.log(`Player ${playerId} disconnected`);
    }
  });
}

function send(socket: WebSocket, message: ServerMessage) {
  if (socket.readyState === 1) {
    socket.send(JSON.stringify(message));
  }
}

export function broadcastToSession(sessionId: string, message: ServerMessage, excludePlayerId?: string) {
  for (const [pid, conn] of connections) {
    if (conn.sessionId === sessionId && pid !== excludePlayerId) {
      send(conn.socket, message);
    }
  }
}

/** Send action result to a specific player */
export function sendToPlayer(playerId: string, message: ServerMessage): void {
  const conn = connections.get(playerId);
  if (conn) send(conn.socket, message);
}

export function getConnectionCount(sessionId: string): number {
  let count = 0;
  for (const conn of connections.values()) {
    if (conn.sessionId === sessionId) count++;
  }
  return count;
}

/** Get all player connections for a session (for per-player fog broadcasts) */
export function getPlayerConnections(sessionId: string): { playerId: string; countryCode: string | null }[] {
  const result: { playerId: string; countryCode: string | null }[] = [];
  for (const [pid, conn] of connections) {
    if (conn.sessionId === sessionId) {
      result.push({ playerId: pid, countryCode: conn.countryCode });
    }
  }
  return result;
}
