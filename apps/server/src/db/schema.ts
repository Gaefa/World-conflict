import { pgTable, text, integer, real, boolean, jsonb, timestamp, uuid } from 'drizzle-orm/pg-core';

export const gameSessions = pgTable('game_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  status: text('status').notNull().default('lobby'), // lobby | starting | running | paused | finished
  settings: jsonb('settings').notNull(),
  hostPlayerId: text('host_player_id').notNull(),
  currentTick: integer('current_tick').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  startedAt: timestamp('started_at'),
  finishedAt: timestamp('finished_at'),
  winnerId: text('winner_id'),
  victoryType: text('victory_type'),
});

export const players = pgTable('players', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  sessionId: uuid('session_id').notNull().references(() => gameSessions.id),
  name: text('name').notNull(),
  countryCode: text('country_code').notNull(),
  isAi: boolean('is_ai').notNull().default(false),
  isConnected: boolean('is_connected').notNull().default(false),
  lastSeenAt: timestamp('last_seen_at').notNull().defaultNow(),
});

export const countryStates = pgTable('country_states', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => gameSessions.id),
  countryCode: text('country_code').notNull(),
  economy: jsonb('economy').notNull(),
  military: jsonb('military').notNull(),
  resources: jsonb('resources').notNull(),
  stability: real('stability').notNull().default(50),
  approval: real('approval').notNull().default(50),
  techLevel: real('tech_level').notNull().default(1),
  diplomaticInfluence: real('diplomatic_influence').notNull().default(50),
  indexOfPower: real('index_of_power').notNull().default(0),
});

export const armies = pgTable('armies', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => gameSessions.id),
  countryCode: text('country_code').notNull(),
  type: text('type').notNull(), // infantry | armored | naval | airforce | special_ops
  size: integer('size').notNull(),
  morale: real('morale').notNull().default(80),
  experience: real('experience').notNull().default(10),
  latitude: real('latitude').notNull(),
  longitude: real('longitude').notNull(),
  targetLatitude: real('target_latitude'),
  targetLongitude: real('target_longitude'),
  status: text('status').notNull().default('idle'), // idle | moving | attacking | defending | retreating
});

export const diplomaticRelations = pgTable('diplomatic_relations', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => gameSessions.id),
  fromCountry: text('from_country').notNull(),
  toCountry: text('to_country').notNull(),
  type: text('type').notNull(), // alliance | war | trade_agreement | sanction | non_aggression | ceasefire
  status: text('status').notNull().default('active'),
  createdAtTick: integer('created_at_tick').notNull(),
  expiresAtTick: integer('expires_at_tick'),
});

export const gameEvents = pgTable('game_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => gameSessions.id),
  tick: integer('tick').notNull(),
  type: text('type').notNull(),
  data: jsonb('data').notNull().default({}),
  affectedCountries: jsonb('affected_countries').notNull().default([]),
  severity: text('severity').notNull().default('info'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const actionsQueue = pgTable('actions_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => gameSessions.id),
  playerId: uuid('player_id').notNull().references(() => players.id),
  actionType: text('action_type').notNull(),
  payload: jsonb('payload').notNull(),
  tick: integer('tick').notNull(),
  processed: boolean('processed').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
