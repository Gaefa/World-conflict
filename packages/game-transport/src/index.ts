import type { FastifyRequest } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import type { ClientMessage, ServerMessage, GameState } from '@conflict-game/shared-types';
import { PAUSES_PER_PLAYER, PAUSE_MAX_MS } from '@conflict-game/shared-types';
import { enqueueAction, type GameLoop } from '@conflict-game/game-engine';

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

/** Seat check — set by game-mem.ts. playerIds are visible to everyone in the
 *  game state, so joining a seat also needs that seat's secret token. */
let seatVerifier: ((sessionId: string, playerId: string, token: string) => boolean) | null = null;

export function setSeatVerifier(verifier: (sessionId: string, playerId: string, token: string) => boolean): void {
  seatVerifier = verifier;
}

interface Connection {
  socket: WebSocket;
  sessionId: string;
}

const connections = new Map<string, Connection>();

/** The running pause per session: who took it and the timer that ends it. */
const activePauses = new Map<string, { playerId: string; timer: ReturnType<typeof setTimeout> }>();
/** Pauses each player has used this game. */
const pausesUsed = new Map<string, number>();

/** A player's country lives in the game state only — never on the socket. */
function countryOf(sessionId: string, playerId: string): string | null {
  return stateResolver?.(sessionId)?.players.find(p => p.id === playerId)?.countryCode || null;
}

/** End a session's pause — early by whoever took it, or by its timer. */
function resumeSession(sessionId: string): void {
  const pause = activePauses.get(sessionId);
  if (pause) clearTimeout(pause.timer);
  activePauses.delete(sessionId);
  if (!gameLoopRef?.resume(sessionId)) return;
  broadcastToSession(sessionId, {
    type: 'session_status',
    payload: { status: 'resumed', message: 'Game resumed' },
  });
}

export function wsHandler(socket: WebSocket, request: FastifyRequest) {
  let playerId: string | null = null;
  let sessionId: string | null = null;

  socket.on('message', (rawData: Buffer | ArrayBuffer | Buffer[]) => {
    try {
      const message: ClientMessage = JSON.parse(rawData.toString());

      switch (message.type) {
        case 'join_session': {
          const { sessionId: wantedSession, playerId: wantedPlayer, token } = message.payload;
          if (!seatVerifier?.(wantedSession, wantedPlayer, token)) {
            send(socket, { type: 'error', payload: { code: 'UNAUTHORIZED', message: 'Invalid seat token' } });
            break;
          }
          playerId = wantedPlayer;
          sessionId = wantedSession;
          connections.set(playerId, { socket, sessionId });
          send(socket, {
            type: 'session_status',
            payload: { status: 'joined', message: `Joined session ${sessionId}` },
          });
          console.log(`Player ${playerId} joined session ${sessionId}`);
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
          const countryCode = countryOf(sessionId, playerId);
          if (!countryCode) {
            send(socket, { type: 'error', payload: { code: 'NO_COUNTRY', message: 'Select a country first' } });
            break;
          }

          // Queue action for processing in next game tick
          // Result will be sent back from game loop after processing
          const queued = enqueueAction(sessionId, {
            playerId,
            countryCode,
            sessionId,
            action: message.payload,
          });
          if (!queued) {
            send(socket, {
              type: 'error',
              payload: { code: 'RATE_LIMITED', message: 'Too many actions this turn — wait for the next tick' },
            });
          }
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

        case 'toggle_pause': {
          if (!sessionId || !playerId || !gameLoopRef) break;

          if (gameLoopRef.isPaused(sessionId)) {
            // Only whoever paused may resume early — otherwise a rival could
            // cancel every pause instantly. The timer resumes it regardless.
            if (activePauses.get(sessionId)?.playerId !== playerId) {
              send(socket, { type: 'error', payload: { code: 'NOT_YOUR_PAUSE', message: 'Only the player who paused can resume' } });
              break;
            }
            resumeSession(sessionId);
            break;
          }

          if (stateResolver?.(sessionId)?.session.status !== 'active') break;
          const used = pausesUsed.get(playerId) ?? 0;
          if (used >= PAUSES_PER_PLAYER) {
            send(socket, { type: 'error', payload: { code: 'NO_PAUSES_LEFT', message: 'No pauses left' } });
            break;
          }
          gameLoopRef.pause(sessionId);
          pausesUsed.set(playerId, used + 1);
          const pausedSession = sessionId;
          activePauses.set(pausedSession, {
            playerId,
            timer: setTimeout(() => resumeSession(pausedSession), PAUSE_MAX_MS),
          });
          broadcastToSession(pausedSession, {
            type: 'session_status',
            payload: { status: 'paused', message: 'Game paused', playerId },
          });
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
      // Only remove if this specific socket is still the active connection.
      // A reconnect may have already replaced it — deleting blindly would
      // evict the new connection.
      const currentConn = connections.get(playerId);
      if (currentConn && currentConn.socket === socket) {
        connections.delete(playerId);
        console.log(`Player ${playerId} disconnected`);
      }
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

/** Get all player connections for a session (for per-player fog broadcasts) */
export function getPlayerConnections(sessionId: string): { playerId: string; countryCode: string | null }[] {
  const result: { playerId: string; countryCode: string | null }[] = [];
  for (const [pid, conn] of connections) {
    if (conn.sessionId === sessionId) {
      result.push({ playerId: pid, countryCode: countryOf(sessionId, pid) });
    }
  }
  return result;
}
