export type GameMode = "briefing" | "active" | "won" | "lost";
export type EventLevel = "HIGH" | "MEDIUM" | "LOW";
export type RegionStatus = "critical" | "strained" | "steady";

export type Region = {
  id: string;
  name: string;
  alignment: string;
  stability: number;
  tension: number;
  economy: number;
  support: number;
  volatility: number;
  pressure: string;
  posture: string;
  summary: string;
  flashpoint: string;
  x: number;
  y: number;
};

export type Resources = {
  budget: number;
  diplomacy: number;
  readiness: number;
  intel: number;
};

export type EventCard = {
  id: number;
  level: EventLevel;
  regionId: string;
  headline: string;
  detail: string;
  effect: string;
  minutesAgo: number;
};

export type RegionDelta = Partial<
  Pick<Region, "stability" | "tension" | "economy" | "support">
>;

export type GameState = {
  mode: GameMode;
  turn: number;
  maxTurns: number;
  operationsLeft: number;
  countdownMs: number;
  selectedRegionId: string;
  resources: Resources;
  regions: Region[];
  events: EventCard[];
  briefing: string;
  outcomeReason: string | null;
  nextEventId: number;
};

export type ActionDefinition = {
  id: string;
  label: string;
  family: string;
  description: string;
  goodFor: string;
  risk: string;
  costs: Partial<Resources>;
  delta: RegionDelta;
};

export const TURN_DURATION_MS = 20000;
export const OPERATIONS_PER_TURN = 2;

export const worldMapPaths = [
  "M98 137C128 90 176 72 226 79C264 84 290 99 321 118C340 129 362 135 386 142C378 168 344 186 309 194C264 204 213 204 170 188C129 173 101 158 98 137Z",
  "M271 224C297 219 330 224 347 248C364 271 365 304 352 330C342 349 321 367 299 389C282 408 273 439 252 445C236 434 230 408 220 388C209 365 187 344 182 313C179 278 200 245 227 231C241 224 255 223 271 224Z",
  "M418 119C440 95 477 86 514 88C553 90 594 105 619 127C635 140 647 157 647 175C636 184 616 182 596 182C566 183 535 186 507 196C488 203 466 214 443 210C424 205 407 189 403 167C401 148 405 132 418 119Z",
  "M459 216C489 205 521 211 553 223C592 238 635 248 662 281C682 303 691 341 684 370C672 411 630 439 588 448C550 456 523 445 496 424C474 407 443 396 428 371C415 351 417 327 423 307C429 289 438 275 444 257C446 243 446 228 459 216Z",
  "M714 283C734 272 757 271 779 281C803 292 820 314 820 335C819 356 803 373 782 384C761 395 735 400 716 390C698 379 689 349 689 325C690 308 699 291 714 283Z"
] as const;

export const statusLabel: Record<RegionStatus, string> = {
  critical: "Critical",
  strained: "Strained",
  steady: "Stable"
};

export const actionDeck: ActionDefinition[] = [
  {
    id: "aid-airlift",
    label: "Aid Airlift",
    family: "Humanitarian",
    description:
      "Open relief corridors, restore confidence and buy time for civilians before systems seize up.",
    goodFor: "Best when stability is low and support is collapsing.",
    risk: "Expensive. It buys time, but does not solve a military spiral by itself.",
    costs: { budget: 9, diplomacy: 2, intel: 1 },
    delta: { stability: 8, tension: -5, economy: 4, support: 6 }
  },
  {
    id: "backchannel",
    label: "Backchannel Talks",
    family: "Diplomacy",
    description:
      "Open a deniable line and slow retaliation cycles before public positions harden.",
    goodFor: "Best when tension is peaking and you need a fast drop in escalation.",
    risk: "Burns diplomacy that you may need later for recovery turns.",
    costs: { diplomacy: 7, intel: 2 },
    delta: { stability: 4, tension: -8, economy: 1, support: 2 }
  },
  {
    id: "recon",
    label: "Recon Surge",
    family: "Intelligence",
    description:
      "Flood the theater with ISR and reduce the chance of blind escalation.",
    goodFor: "Best when a region is unstable but not yet in full collapse.",
    risk: "Smaller immediate impact than aid or diplomacy.",
    costs: { intel: 8, budget: 3 },
    delta: { stability: 2, tension: -3, economy: 0, support: 1 }
  },
  {
    id: "deterrence",
    label: "Naval Deterrence",
    family: "Military posture",
    description:
      "Deploy a visible force package to deter escalation and reassure allies.",
    goodFor: "Best when readiness matters more than near-term popularity.",
    risk: "Can raise tension and hurt the local economy if misread.",
    costs: { readiness: 8, budget: 5, intel: 1 },
    delta: { stability: 2, tension: 7, economy: -2, support: -2 }
  },
  {
    id: "energy-package",
    label: "Energy Package",
    family: "Economic shield",
    description:
      "Stabilize fuel, shipping and logistics pricing so the civilian system keeps moving.",
    goodFor: "Best when economy and support are slipping together.",
    risk: "Less effective once violence is already spiraling out of control.",
    costs: { budget: 7, diplomacy: 3 },
    delta: { stability: 3, tension: -2, economy: 7, support: 4 }
  }
];

const initialRegions: Region[] = [
  {
    id: "baltic",
    name: "Baltic Corridor",
    alignment: "Western bloc",
    stability: 63,
    tension: 71,
    economy: 62,
    support: 58,
    volatility: 3,
    pressure: "Air-defense saturation",
    posture: "Forward deterrence",
    summary:
      "A dense logistics frontier where aircraft interceptions and force posture shifts can snowball quickly.",
    flashpoint: "Interceptions over a reinforcement rail corridor",
    x: 55,
    y: 27
  },
  {
    id: "levant",
    name: "Levant Arc",
    alignment: "Multi-faction theater",
    stability: 39,
    tension: 86,
    economy: 43,
    support: 35,
    volatility: 4,
    pressure: "Proxy escalation",
    posture: "Fragmented control",
    summary:
      "The hottest theater on the board, where maritime pressure and cross-border strikes can collapse trade routes.",
    flashpoint: "Port strike risk with cascading shipping disruption",
    x: 57,
    y: 43
  },
  {
    id: "indo-pacific",
    name: "Indo-Pacific Rim",
    alignment: "Contested maritime sphere",
    stability: 58,
    tension: 65,
    economy: 80,
    support: 54,
    volatility: 2,
    pressure: "Naval shadowing",
    posture: "Competitive signaling",
    summary:
      "Commerce remains strong, but naval maneuvering and alliance signaling keep strategic nerves tight.",
    flashpoint: "Carrier shadowing near contested sea lanes",
    x: 79,
    y: 49
  },
  {
    id: "sahel",
    name: "Sahel Belt",
    alignment: "Non-aligned fracture zone",
    stability: 32,
    tension: 56,
    economy: 30,
    support: 28,
    volatility: 3,
    pressure: "Insurgency momentum",
    posture: "Patchwork authority",
    summary:
      "Weak institutions and a stretched aid footprint make every disruption more expensive to contain.",
    flashpoint: "Resource corridor sabotage and convoy ambushes",
    x: 46,
    y: 52
  }
];

const initialEvents: EventCard[] = [
  {
    id: 101,
    level: "HIGH",
    regionId: "levant",
    headline: "Drone swarm detected over shipping lane",
    detail:
      "Insurers reprice risk immediately as escorts scramble to keep a corridor open.",
    effect: "+6 tension, -4 trade confidence",
    minutesAgo: 6
  },
  {
    id: 102,
    level: "MEDIUM",
    regionId: "baltic",
    headline: "Rail hub moved to military priority",
    detail:
      "Civilian freight slows while reinforcement tempo rises across the frontier.",
    effect: "+3 readiness, -2 economy",
    minutesAgo: 18
  },
  {
    id: 103,
    level: "LOW",
    regionId: "indo-pacific",
    headline: "Quiet deconfliction channel reopens",
    detail:
      "A summit cools collision risk temporarily, but doctrine remains unchanged.",
    effect: "-3 tension, +1 stability",
    minutesAgo: 29
  }
];

const clamp = (value: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, value));

const average = (values: number[]) =>
  Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);

const applyRegionDelta = (region: Region, delta: RegionDelta): Region => ({
  ...region,
  stability: clamp(region.stability + (delta.stability ?? 0)),
  tension: clamp(region.tension + (delta.tension ?? 0)),
  economy: clamp(region.economy + (delta.economy ?? 0)),
  support: clamp(region.support + (delta.support ?? 0))
});

const ageEvents = (events: EventCard[], ms: number) => {
  const deltaMinutes = Math.max(0, Math.floor(ms / 1000));
  if (deltaMinutes === 0) {
    return events;
  }

  return events.map((event) => ({
    ...event,
    minutesAgo: event.minutesAgo + deltaMinutes
  }));
};

const buildWorldEvent = (state: GameState) => {
  const hottestRegion = [...state.regions].sort(
    (left, right) => right.tension - left.tension
  )[0];

  const catalog: Record<
    string,
    {
      headline: string;
      detail: string;
      level: EventLevel;
      regionDelta: RegionDelta;
      resourceDelta: Partial<Resources>;
    }
  > = {
    baltic: {
      headline: "Intercept scramble over northern corridor",
      detail:
        "An aircraft incident spikes air-defense readiness and rattles civilian logistics.",
      level: "HIGH",
      regionDelta: { tension: 7, stability: -3, economy: -2, support: -1 },
      resourceDelta: { readiness: -3, intel: -1 }
    },
    levant: {
      headline: "Proxy strike wave hits maritime edge",
      detail:
        "Regional actors synchronize pressure on ports and shipping, forcing immediate trade shock.",
      level: "HIGH",
      regionDelta: { tension: 8, stability: -4, economy: -4, support: -2 },
      resourceDelta: { diplomacy: -2, budget: -2 }
    },
    "indo-pacific": {
      headline: "Shadow fleet maneuver near contested lane",
      detail:
        "A prolonged naval shadow operation raises rates and forces alliance signaling.",
      level: "MEDIUM",
      regionDelta: { tension: 5, stability: -2, economy: -2, support: -1 },
      resourceDelta: { readiness: -2, diplomacy: -1 }
    },
    sahel: {
      headline: "Cross-border raid fractures aid corridor",
      detail:
        "Convoy disruption weakens public confidence and stretches stabilization capacity.",
      level: "MEDIUM",
      regionDelta: { tension: 6, stability: -4, economy: -1, support: -3 },
      resourceDelta: { budget: -2, intel: -1 }
    }
  };

  return catalog[hottestRegion.id];
};

export const createInitialState = (): GameState => ({
  mode: "briefing",
  turn: 1,
  maxTurns: 8,
  operationsLeft: OPERATIONS_PER_TURN,
  countdownMs: TURN_DURATION_MS,
  selectedRegionId: initialRegions[1].id,
  resources: {
    budget: 68,
    diplomacy: 54,
    readiness: 57,
    intel: 46
  },
  regions: initialRegions,
  events: initialEvents,
  briefing:
    "Mission loaded. Select a theater, launch up to two programs, then end the turn before the timer does it for you.",
  outcomeReason: null,
  nextEventId: 200
});

export const getSelectedRegion = (state: GameState) =>
  state.regions.find((region) => region.id === state.selectedRegionId) ??
  state.regions[0];

export const classifyRegion = (region: Region): RegionStatus => {
  if (region.tension >= 80 || region.stability <= 30) {
    return "critical";
  }

  if (region.tension >= 65 || region.stability <= 45) {
    return "strained";
  }

  return "steady";
};

export const describeCosts = (costs: Partial<Resources>) =>
  Object.entries(costs)
    .map(([key, value]) => `-${value} ${key}`)
    .join(" · ");

export const describeDelta = (delta: RegionDelta) =>
  [
    delta.stability
      ? `${delta.stability > 0 ? "+" : ""}${delta.stability} stability`
      : null,
    delta.tension ? `${delta.tension > 0 ? "+" : ""}${delta.tension} tension` : null,
    delta.economy ? `${delta.economy > 0 ? "+" : ""}${delta.economy} economy` : null,
    delta.support ? `${delta.support > 0 ? "+" : ""}${delta.support} support` : null
  ]
    .filter(Boolean)
    .join(" · ");

export const getWorldMetrics = (regions: Region[]) => {
  const worldTension = average(regions.map((region) => region.tension));
  const worldStability = average(regions.map((region) => region.stability));
  const economicHeat = average(regions.map((region) => region.economy));
  const publicSupport = average(regions.map((region) => region.support));
  const collapsedRegions = regions.filter(
    (region) => region.stability <= 24 || region.economy <= 18
  ).length;
  const criticalRegions = regions.filter(
    (region) => classifyRegion(region) === "critical"
  ).length;

  return {
    worldTension,
    worldStability,
    economicHeat,
    publicSupport,
    collapsedRegions,
    criticalRegions
  };
};

const evaluateOutcome = (state: GameState): GameState => {
  const metrics = getWorldMetrics(state.regions);

  if (metrics.worldTension >= 92) {
    return {
      ...state,
      mode: "lost",
      outcomeReason:
        "Global tension crossed 92. The crisis network outran your control window."
    };
  }

  if (metrics.collapsedRegions >= 2) {
    return {
      ...state,
      mode: "lost",
      outcomeReason:
        "Two theaters collapsed at the same time. The board is no longer recoverable."
    };
  }

  if (state.turn > state.maxTurns) {
    if (
      metrics.worldTension <= 65 &&
      metrics.worldStability >= 48 &&
      metrics.collapsedRegions === 0
    ) {
      return {
        ...state,
        mode: "won",
        outcomeReason:
          "Mission contained. You reached turn 8 with the global system still functioning."
      };
    }

    return {
      ...state,
      mode: "lost",
      outcomeReason:
        "Turn 8 ended without stabilization. The mission expired under sustained crisis pressure."
    };
  }

  return state;
};

export const canAffordAction = (resources: Resources, costs: Partial<Resources>) =>
  Object.entries(costs).every(([key, value]) => {
    const resourceKey = key as keyof Resources;
    return resources[resourceKey] >= (value ?? 0);
  });

export const startCampaign = (state: GameState): GameState => ({
  ...state,
  mode: "active",
  briefing:
    "Turn 1 started. Select a theater, commit programs from the decision dock, then resolve the turn."
});

export const selectRegion = (state: GameState, regionId: string): GameState => {
  const region =
    state.regions.find((candidate) => candidate.id === regionId) ?? state.regions[0];

  return {
    ...state,
    selectedRegionId: regionId,
    briefing: `${region.name} selected. Flashpoint: ${region.flashpoint}.`
  };
};

export const applyAction = (state: GameState, actionId: string): GameState => {
  if (state.mode !== "active" || state.operationsLeft <= 0) {
    return state;
  }

  const action = actionDeck.find((item) => item.id === actionId);

  if (!action || !canAffordAction(state.resources, action.costs)) {
    return state;
  }

  const targetRegion = getSelectedRegion(state);
  const updatedResources: Resources = {
    budget: clamp(state.resources.budget - (action.costs.budget ?? 0)),
    diplomacy: clamp(state.resources.diplomacy - (action.costs.diplomacy ?? 0)),
    readiness: clamp(state.resources.readiness - (action.costs.readiness ?? 0)),
    intel: clamp(state.resources.intel - (action.costs.intel ?? 0))
  };

  const updatedRegions = state.regions.map((region) =>
    region.id === targetRegion.id ? applyRegionDelta(region, action.delta) : region
  );

  const actionLevel: EventLevel =
    (action.delta.tension ?? 0) >= 4
      ? "HIGH"
      : (action.delta.tension ?? 0) <= -4
        ? "LOW"
        : "MEDIUM";

  return evaluateOutcome({
    ...state,
    operationsLeft: state.operationsLeft - 1,
    resources: updatedResources,
    regions: updatedRegions,
    events: [
      {
        id: state.nextEventId,
        level: actionLevel,
        regionId: targetRegion.id,
        headline: `${action.label} launched in ${targetRegion.name}`,
        detail: action.description,
        effect: `${describeCosts(action.costs)} · ${describeDelta(action.delta)}`,
        minutesAgo: 0
      },
      ...state.events
    ].slice(0, 7),
    briefing: `${action.label} committed to ${targetRegion.name}. ${action.goodFor}`,
    nextEventId: state.nextEventId + 1
  });
};

export const resolveTurn = (state: GameState, forcedByTimer = false): GameState => {
  if (state.mode !== "active") {
    return state;
  }

  const event = buildWorldEvent(state);
  const hottestRegion = [...state.regions].sort(
    (left, right) => right.tension - left.tension
  )[0];

  const driftedRegions = state.regions.map((region) => {
    const passiveDelta: RegionDelta = {
      tension: region.volatility + (region.stability < 40 ? 1 : 0),
      stability: region.tension > 70 ? -2 : -1,
      economy: region.tension > 68 ? -2 : -1,
      support: region.economy < 40 ? -2 : -1
    };

    const withPassive = applyRegionDelta(region, passiveDelta);

    if (region.id === hottestRegion.id) {
      return applyRegionDelta(withPassive, event.regionDelta);
    }

    return applyRegionDelta(withPassive, {
      tension: 1,
      stability: 0,
      economy: 0,
      support: 0
    });
  });

  const metricsAfterDrift = getWorldMetrics(driftedRegions);
  const refreshedResources: Resources = {
    budget: clamp(
      state.resources.budget +
        Math.round(metricsAfterDrift.economicHeat / 22) +
        (forcedByTimer ? -4 : 0) +
        (event.resourceDelta.budget ?? 0)
    ),
    diplomacy: clamp(
      state.resources.diplomacy +
        (metricsAfterDrift.worldTension < 70 ? 3 : 1) +
        (forcedByTimer ? -2 : 0) +
        (event.resourceDelta.diplomacy ?? 0)
    ),
    readiness: clamp(
      state.resources.readiness +
        3 -
        metricsAfterDrift.collapsedRegions +
        (event.resourceDelta.readiness ?? 0)
    ),
    intel: clamp(
      state.resources.intel +
        2 +
        metricsAfterDrift.criticalRegions -
        (forcedByTimer ? 1 : 0) +
        (event.resourceDelta.intel ?? 0)
    )
  };

  return evaluateOutcome({
    ...state,
    turn: state.turn + 1,
    operationsLeft: OPERATIONS_PER_TURN,
    countdownMs: TURN_DURATION_MS,
    resources: refreshedResources,
    regions: driftedRegions,
    events: [
      {
        id: state.nextEventId,
        level: forcedByTimer ? "HIGH" : event.level,
        regionId: hottestRegion.id,
        headline: forcedByTimer
          ? `Decision window expired in ${hottestRegion.name}`
          : event.headline,
        detail: forcedByTimer
          ? "No second move arrived in time, so the most unstable theater dictated the turn."
          : event.detail,
        effect: forcedByTimer
          ? "-4 budget · -2 diplomacy · crisis worsens"
          : describeDelta(event.regionDelta),
        minutesAgo: 0
      },
      ...ageEvents(state.events, forcedByTimer ? TURN_DURATION_MS : 1800)
    ].slice(0, 7),
    briefing: forcedByTimer
      ? `Timer expired. ${hottestRegion.name} seized the initiative and the next turn opened worse.`
      : `${event.headline}. ${hottestRegion.name} remains the most dangerous theater on the board.`,
    nextEventId: state.nextEventId + 1
  });
};

export const advanceStateByTime = (state: GameState, ms: number): GameState => {
  if (state.mode !== "active" || ms <= 0) {
    return state;
  }

  let remaining = ms;
  let nextState = {
    ...state,
    events: ageEvents(state.events, ms)
  };

  while (remaining > 0 && nextState.mode === "active") {
    const step = Math.min(remaining, nextState.countdownMs);
    nextState = {
      ...nextState,
      countdownMs: nextState.countdownMs - step
    };
    remaining -= step;

    if (nextState.countdownMs <= 0) {
      nextState = resolveTurn(nextState, true);
    }
  }

  return nextState;
};

export const buildTextState = (state: GameState) => {
  const metrics = getWorldMetrics(state.regions);
  const selectedRegion = getSelectedRegion(state);

  return JSON.stringify({
    coordinateSystem:
      "Map uses percentage coordinates with origin at top-left; x grows right, y grows down.",
    mode: state.mode,
    turn: state.turn,
    maxTurns: state.maxTurns,
    operationsLeft: state.operationsLeft,
    countdownMs: state.countdownMs,
    selectedRegionId: state.selectedRegionId,
    selectedRegion: {
      name: selectedRegion.name,
      status: classifyRegion(selectedRegion)
    },
    resources: state.resources,
    world: metrics,
    briefing: state.briefing,
    outcomeReason: state.outcomeReason,
    instructions: [
      "1. Open or close the mission briefing if needed.",
      "2. Select a theater from the map or theater chips.",
      "3. Use up to two program buttons in the decision dock.",
      "4. Press End turn or wait for the timer.",
      "Win by reaching turn 8 with tension 65 or below and no collapsed theater."
    ],
    visibleRegions: state.regions.map((region) => ({
      id: region.id,
      x: region.x,
      y: region.y,
      name: region.name,
      tension: region.tension,
      stability: region.stability,
      economy: region.economy,
      support: region.support,
      status: classifyRegion(region)
    })),
    visiblePrograms: actionDeck.map((action) => ({
      id: action.id,
      label: action.label,
      costs: action.costs,
      delta: action.delta,
      disabled:
        state.mode !== "active" ||
        state.operationsLeft <= 0 ||
        !canAffordAction(state.resources, action.costs)
    })),
    visibleEvents: state.events.map((event) => ({
      headline: event.headline,
      regionId: event.regionId,
      level: event.level,
      minutesAgo: event.minutesAgo
    }))
  });
};
