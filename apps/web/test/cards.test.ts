import { describe, it, expect } from 'vitest';
import { CARDS, CARD_BY_ID, DOMAINS, cardsForLane, requirementMet } from '../src/lib/cards';
import { mkCountry } from '../../../packages/game-logic/test/helpers';

const noTechs: string[] = [];

describe('action panel catalogue', () => {
  it('gives every card a builder that produces an action', () => {
    const ctx = {
      target: 'BB',
      country: mkCountry({ tech: { researchedTechs: [], activeResearch: null, bonuses: {} } as never }),
      home: { lat: 10, lng: 20 },
      warEnemies: ['BB'],
    };
    for (const card of CARDS) {
      expect(card.build(ctx), `${card.id} built nothing`).not.toBeNull();
    }
  });

  it('covers all four lanes', () => {
    for (const d of DOMAINS) {
      expect(cardsForLane(d, noTechs, false).length, `${d} lane is empty`).toBeGreaterThan(0);
    }
  });

  it('offers research in every lane that has a tech branch', () => {
    // The bug this guards: with no research card the deck could never grow,
    // leaving tier 5+ actions permanently unreachable.
    const withResearch = DOMAINS.filter(d =>
      cardsForLane(d, noTechs, false).some(c => c.id.startsWith('research_')));
    expect(withResearch).toEqual(['military', 'economy', 'covert']);
  });
});

describe('unlocks', () => {
  it('hides tech-gated cards until the tech is researched', () => {
    expect(cardsForLane('military', noTechs, false).map(c => c.id)).not.toContain('airstrike');
    expect(cardsForLane('military', ['mil_5'], false).map(c => c.id)).toContain('airstrike');
  });

  it('shows war-only cards only during a war', () => {
    expect(cardsForLane('military', noTechs, false).map(c => c.id)).not.toContain('invade');
    expect(cardsForLane('military', noTechs, true).map(c => c.id)).toContain('invade');
  });
});

describe('requirements mirror the engine gates', () => {
  const c = mkCountry();
  it.each([
    ['alliance', 'diplomaticInfluence', 5],
    ['sanctions', 'diplomaticInfluence', 3],
    ['coup', 'diplomaticInfluence', 10],
  ] as const)('%s needs %s >= %i', (id, _field, amount) => {
    const req = CARD_BY_ID[id].requirement!;
    expect(requirementMet(req, { ...c, diplomaticInfluence: amount - 1 })).toBe(false);
    expect(requirementMet(req, { ...c, diplomaticInfluence: amount })).toBe(true);
  });

  it('blocks the blockade without a fleet and the nuke without a warhead', () => {
    const noNavy = { ...c, military: { ...c.military, navy: 19 } };
    const noNukes = { ...c, military: { ...c.military, nuclearWeapons: 0 } };
    expect(requirementMet(CARD_BY_ID.blockade.requirement!, noNavy)).toBe(false);
    expect(requirementMet(CARD_BY_ID.nuke_tactical.requirement!, noNukes)).toBe(false);
  });
});

describe('research cards', () => {
  const withTech = (researchedTechs: string[], activeResearch: unknown = null) =>
    mkCountry({ tech: { researchedTechs, activeResearch, bonuses: {} } as never });

  it('targets the lowest available tier first', () => {
    const card = CARD_BY_ID.research_military;
    expect(card.subtitle!(withTech([]))).toBe('Advanced Infantry'); // mil_1, tier 1
  });

  it('moves to the next tech once the previous one is done', () => {
    const card = CARD_BY_ID.research_military;
    const after = card.subtitle!(withTech(['mil_1']));
    expect(after).not.toBe('Advanced Infantry');
    expect(after).toBeTruthy();
  });

  it('goes idle while another research is running', () => {
    const card = CARD_BY_ID.research_military;
    const busy = withTech([], { techId: 'mil_1', ticksRemaining: 3 });
    expect(card.ready!(busy)).toBe(false);
    expect(card.build({ target: null, country: busy, home: null, warEnemies: [] })).toBeNull();
  });

  it('prices itself at the real cost of the tech it will start', () => {
    const card = CARD_BY_ID.research_military;
    expect(card.budgetCost!(withTech([]))).toBeGreaterThan(0);
  });
});
