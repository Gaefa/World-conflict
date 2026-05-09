import type { FastifyRequest } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import type { ClientMessage, ServerMessage, GameState } from '@conflict-game/shared-types';
import { enqueueAction, type GameLoop } from '@conflict-game/game-engine';
import type { ITransport, FastifyWSHandler } from './transport';

interface Connection {
  socket: WebSocket;
  sessionId: string;
  countryCode: string | null;
}

export class FastifyWebSocketTransport implements ITransport {
  private gameLoopRef: GameLoop | null = null;
  private stateResolver: ((sessionId: string) => GameState | null) | null = null;
  private connections = new Map<string, Connection>();

  public setGameLoopRef(loop: GameLoop): void {
    this.gameLoopRef = loop;
  }

  public setStateResolver(resolver: (sessionId: string) => GameState | null): void {
    this.stateResolver = resolver;
  }

  private send(socket: WebSocket, message: ServerMessage) {
    if (socket.readyState === 1) {
      socket.send(JSON.stringify(message));
    }
  }

  public broadcastToSession(sessionId: string, message: ServerMessage, excludePlayerId?: string): void {
    for (const [pid, conn] of this.connections) {
      if (conn.sessionId === sessionId && pid !== excludePlayerId) {
        this.send(conn.socket, message);
      }
    }
  }

  // Alias for broadcast to satisfy GameLoopAdapter
  public broadcast(sessionId: string, message: ServerMessage): void {
    this.broadcastToSession(sessionId, message);
  }

  public sendToPlayer(playerId: string, message: ServerMessage): void {
    const conn = this.connections.get(playerId);
    if (conn) {
      this.send(conn.socket, message);
    }
  }

  public getPlayerConnections(sessionId: string): { playerId: string; countryCode: string | null }[] {
    const result: { playerId: string; countryCode: string | null }[] = [];
    for (const [pid, conn] of this.connections) {
      if (conn.sessionId === sessionId) {
        result.push({ playerId: pid, countryCode: conn.countryCode });
      }
    }
    return result;
  }

  public getHandler(): FastifyWSHandler {
    return (socket: WebSocket, request: FastifyRequest) => {
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
              if (this.stateResolver) {
                const gs = this.stateResolver(sessionId);
                if (gs) {
                  const player = gs.players.find(p => p.id === playerId);
                  if (player?.countryCode) detectedCountry = player.countryCode;
                }
              }
              this.connections.set(playerId, { socket, sessionId, countryCode: detectedCountry });
              this.send(socket, {
                type: 'session_status',
                payload: { status: 'joined', message: `Joined session ${sessionId}` },
              });
              console.log(`Player ${playerId} joined session ${sessionId} (country: ${detectedCountry || 'none'})`);
              break;
            }

            case 'leave_session':
              if (playerId) this.connections.delete(playerId);
              this.send(socket, {
                type: 'session_status',
                payload: { status: 'left', message: 'Left session' },
              });
              break;

            case 'player_action': {
              if (!playerId || !sessionId) {
                this.send(socket, { type: 'error', payload: { code: 'NOT_IN_SESSION', message: 'Join a session first' } });
                break;
              }
              const conn = this.connections.get(playerId);
              const countryCode = conn?.countryCode;
              if (!countryCode) {
                this.send(socket, { type: 'error', payload: { code: 'NO_COUNTRY', message: 'Select a country first' } });
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
                this.broadcastToSession(sessionId, {
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
                const conn = this.connections.get(playerId);
                if (conn) conn.countryCode = message.payload.countryCode;
              }
              this.send(socket, {
                type: 'session_status',
                payload: { status: 'country_selected', message: `Selected ${message.payload.countryCode}` },
              });
              break;

            case 'toggle_pause': {
              if (!sessionId || !this.gameLoopRef) break;
              const paused = this.gameLoopRef.isPaused(sessionId);
              if (paused) {
                this.gameLoopRef.resume(sessionId);
                this.broadcastToSession(sessionId, {
                  type: 'session_status',
                  payload: { status: 'resumed', message: 'Game resumed' },
                });
              } else {
                this.gameLoopRef.pause(sessionId);
                this.broadcastToSession(sessionId, {
                  type: 'session_status',
                  payload: { status: 'paused', message: 'Game paused' },
                });
              }
              break;
            }

            case 'ready':
              break;

            case 'ping':
              this.send(socket, { type: 'pong' });
              break;
          }
        } catch (err) {
          this.send(socket, { type: 'error', payload: { code: 'INVALID_MESSAGE', message: 'Invalid message format' } });
        }
      });

      socket.on('close', () => {
        if (playerId) {
          // Check identity to avoid deleting the connection if the player reconnected with a new socket
          const currentConn = this.connections.get(playerId);
          if (currentConn && currentConn.socket === socket) {
            this.connections.delete(playerId);
            console.log(`Player ${playerId} disconnected`);
          }
        }
      });
    };
  }
}
