import { db, schema } from './index.js';
import { SEED_COUNTRIES } from '@conflict-game/shared-types';

async function seed() {
  console.log('🌱 Seeding database...');

  // Push schema first (tables must exist)
  console.log('📋 Inserting seed countries as a test session...');

  // Create a demo session
  const [session] = await db
    .insert(schema.gameSessions)
    .values({
      name: 'Demo Session',
      status: 'lobby',
      settings: {
        maxPlayers: 30,
        tickIntervalMs: 10000,
        startingYear: 2024,
        victoryConditions: ['domination', 'economic', 'diplomatic', 'technological', 'survival'],
      },
      hostPlayerId: 'system',
    })
    .returning();

  console.log(`✅ Created session: ${session.id}`);

  // Insert country states from seed data
  const countryRows = SEED_COUNTRIES.map((c) => ({
    sessionId: session.id,
    countryCode: c.code,
    economy: c.startingState.economy,
    military: c.startingState.military,
    resources: c.startingState.resources,
    stability: c.startingState.stability,
    approval: c.startingState.approval,
    techLevel: c.startingState.techLevel,
    diplomaticInfluence: c.startingState.diplomaticInfluence,
    indexOfPower: 0,
  }));

  await db.insert(schema.countryStates).values(countryRows);

  console.log(`✅ Inserted ${countryRows.length} countries`);
  console.log('🎉 Seed complete!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
