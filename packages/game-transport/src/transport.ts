import type { ServerMessage, GameState } from '@conflict-game/shared-types';
import type { GameLoop, GameLoopAdapter } from '@conflict-game/game-engine';
import type { FastifyRequest } from 'fastify';
import type { WebSocket } from '@fastify/websocket';

export interface ITransport extends GameLoopAdapter {
  setGameLoopRef(loop: GameLoop): void;
  setStateResolver(resolver: (sessionId: string) => GameState | null): void;
  broadcastToSession(sessionId: string, message: ServerMessage, excludePlayerId?: string): void;
  sendToPlayer(playerId: string, message: ServerMessage): void;
  getPlayerConnections(sessionId: string): { playerId: string; countryCode: string | null }[];
}

// We define the type for the specific fastify websocket handler so consumers can easily bind it
export type FastifyWSHandler = (socket: WebSocket, request: FastifyRequest) => void;
