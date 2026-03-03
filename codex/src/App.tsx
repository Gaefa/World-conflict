import { useEffect, useState } from "react";

type GameMode = "briefing" | "active" | "won" | "lost";
type EventLevel = "HIGH" | "MEDIUM" | "LOW";

type Region = {
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

type Resources = {
  budget: number;
  diplomacy: number;
  readiness: number;
  intel: number;
};

type EventCard = {
  id: number;
  level: EventLevel;
  regionId: string;
  headline: string;
  detail: string;
  effect: string;
  minutesAgo: number;
};

type GameState = {
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

type RegionDelta = Partial<Pick<Region, "stability" | "tension" | "economy" | "support">>;

type ActionDefinition = {
  id: string;
  label: string;
  tag: string;
  description: string;
  costs: Partial<Resources>;
  delta: RegionDelta;
};

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
  }
}

const TURN_DURATION_MS = 9000;
const OPERATIONS_PER_TURN = 2;

const worldMapPaths = [
  "M102 136C125 94 170 72 224 77C265 81 289 98 321 119C341 132 364 136 385 143C374 171 340 185 308 194C264 206 213 204 168 187C128 172 100 157 102 136Z",
  "M270 224C293 218 327 224 344 249C360 271 362 302 351 326C341 349 318 366 298 389C282 407 274 437 252 443C234 431 228 405 218 385C207 362 186 341 183 312C180 279 201 246 228 232C242 225 255 225 270 224Z",
  "M418 118C438 95 476 86 513 88C550 90 593 105 618 126C634 139 648 160 647 176C634 185 616 181 599 181C566 181 535 186 507 196C487 203 467 214 443 211C424 206 406 189 404 169C401 149 406 132 418 118Z",
  "M460 215C488 205 520 212 551 222C590 236 634 248 661 280C683 304 692 341 683 369C670 411 628 438 587 447C550 455 525 444 496 424C473 408 442 396 427 371C414 350 416 326 422 307C428 289 438 274 443 258C447 244 446 229 460 215Z",
  "M713 283C732 272 757 272 778 280C803 291 821 314 820 336C819 356 801 373 782 383C761 394 735 400 716 388C697 376 689 348 690 325C691 308 698 290 713 283Z"
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
    summary: "A dense logistics frontier where aircraft interceptions and force posture shifts can snowball quickly.",
    flashpoint: "Interceptions over a reinforcement rail corridor",
    x: 55,
    y: 26
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
    summary: "The hottest theater on the board, where maritime pressure and cross-border strikes can collapse trade routes.",
    flashpoint: "Port strike risk with cascading shipping disruption",
    x: 57,
    y: 42
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
    summary: "Commerce remains strong, but naval maneuvering and alliance signaling keep strategic nerves tight.",
    flashpoint: "Carrier shadowing near contested sea lanes",
    x: 79,
    y: 48
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
    summary: "Weak institutions and a stretched aid footprint make every disruption more expensive to contain.",
    flashpoint: "Resource corridor sabotage and convoy ambushes",
    x: 46,
    y: 51
  }
];

const initialEvents: EventCard[] = [
  {
    id: 101,
    level: "HIGH",
    regionId: "levant",
    headline: "Drone swarm detected over shipping lane",
    detail: "Insurers reprice risk immediately as escorts scramble to keep a corridor open.",
    effect: "+6 tension, -4 trade confidence",
    minutesAgo: 6
  },
  {
    id: 102,
    level: "MEDIUM",
    regionId: "baltic",
    headline: "Rail hub moved to military priority",
    detail: "Civilian freight slows while reinforcement tempo rises across the frontier.",
    effect: "+3 readiness, -2 economy",
    minutesAgo: 18
  },
  {
    id: 103,
    level: "LOW",
    regionId: "indo-pacific",
    headline: "Quiet deconfliction channel reopens",
    detail: "A summit cools collision risk temporarily, but doctrine remains unchanged.",
    effect: "-3 tension, +1 stability",
    minutesAgo: 29
  }
];

const actionDeck: ActionDefinition[] = [
  {
    id: "aid-airlift",
    label: "Aid Airlift",
    tag: "Stability",
    description: "Push relief corridors and critical supplies into the selected theater.",
    costs: { budget: 9, diplomacy: 2, intel: 1 },
    delta: { stability: 8, tension: -5, economy: 4, support: 6 }
  },
  {
    id: "backchannel",
    label: "Backchannel Talks",
    tag: "Diplomacy",
    description: "Open a deniable line and slow decision cycles before reprisals harden.",
    costs: { diplomacy: 7, intel: 2 },
    delta: { stability: 4, tension: -8, economy: 1, support: 2 }
  },
  {
    id: "recon",
    label: "Recon Surge",
    tag: "Intel",
    description: "Flood the theater with ISR, improve clarity and harden early warning.",
    costs: { intel: 8, budget: 3 },
    delta: { stability: 2, tension: -3, economy: 0, support: 1 }
  },
  {
    id: "deterrence",
    label: "Naval Deterrence",
    tag: "Readiness",
    description: "Send a visible force package to deter escalation, accepting signaling risk.",
    costs: { readiness: 8, budget: 5, intel: 1 },
    delta: { stability: 2, tension: 7, economy: -2, support: -2 }
  },
  {
    id: "energy-package",
    label: "Energy Package",
    tag: "Economy",
    description: "Stabilize fuel and logistics prices to keep the civilian system moving.",
    costs: { budget: 7, diplomacy: 3 },
    delta: { stability: 3, tension: -2, economy: 7, support: 4 }
  }
];

const clamp = (value: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, value));

const average = (values: number[]) =>
  Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);

const createInitialState = (): GameState => ({
  mode: "briefing",
  turn: 1,
  maxTurns: 8,
  operationsLeft: OPERATIONS_PER_TURN,
  countdownMs: TURN_DURATION_MS,
  selectedRegionId: initialRegions[0].id,
  resources: {
    budget: 68,
    diplomacy: 54,
    readiness: 57,
    intel: 46
  },
  regions: initialRegions,
  events: initialEvents,
  briefing:
    "Campaign ready. Choose a theater, spend operations carefully, and keep the world below systemic rupture for eight turns.",
  outcomeReason: null,
  nextEventId: 200
});

const applyRegionDelta = (region: Region, delta: RegionDelta): Region => ({
  ...region,
  stability: clamp(region.stability + (delta.stability ?? 0)),
  tension: clamp(region.tension + (delta.tension ?? 0)),
  economy: clamp(region.economy + (delta.economy ?? 0)),
  support: clamp(region.support + (delta.support ?? 0))
});

const classifyRegion = (region: Region) => {
  if (region.tension >= 80 || region.stability <= 30) {
    return "critical";
  }

  if (region.tension >= 65 || region.stability <= 45) {
    return "strained";
  }

  return "steady";
};

const describeCosts = (costs: Partial<Resources>) =>
  Object.entries(costs)
    .map(([key, value]) => `-${value} ${key}`)
    .join(", ");

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

const getWorldMetrics = (regions: Region[]) => {
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
        "Systemic escalation. Global tension crossed the point where diplomacy can keep pace."
    };
  }

  if (metrics.collapsedRegions >= 2) {
    return {
      ...state,
      mode: "lost",
      outcomeReason:
        "Campaign failure. Two theaters suffered structural collapse before the command net stabilized them."
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
          "Campaign contained. The system ends tense but operational, with no theater collapse."
      };
    }

    return {
      ...state,
      mode: "lost",
      outcomeReason:
        "Campaign expired. The clock ran out before the theaters were stabilized."
    };
  }

  return state;
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
        "A military aircraft incident spikes air-defense readiness and rattles civilian logistics.",
      level: "HIGH",
      regionDelta: { tension: 7, stability: -3, economy: -2, support: -1 },
      resourceDelta: { readiness: -3, intel: -1 }
    },
    levant: {
      headline: "Proxy strike wave hits maritime edge",
      detail:
        "Regional actors launch a synchronized pressure cycle that ripples through ports and energy shipping.",
      level: "HIGH",
      regionDelta: { tension: 8, stability: -4, economy: -4, support: -2 },
      resourceDelta: { diplomacy: -2, budget: -2 }
    },
    "indo-pacific": {
      headline: "Shadow fleet maneuver near contested lane",
      detail:
        "An extended naval shadow operation raises premium rates and forces alliance signaling.",
      level: "MEDIUM",
      regionDelta: { tension: 5, stability: -2, economy: -2, support: -1 },
      resourceDelta: { readiness: -2, diplomacy: -1 }
    },
    sahel: {
      headline: "Cross-border raid fractures aid corridor",
      detail:
        "Convoy disruption weakens local confidence and stretches already thin stabilization efforts.",
      level: "MEDIUM",
      regionDelta: { tension: 6, stability: -4, economy: -1, support: -3 },
      resourceDelta: { budget: -2, intel: -1 }
    }
  };

  return catalog[hottestRegion.id];
};

const resolveTurn = (state: GameState, forcedByTimer = false): GameState => {
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

  const nextState = evaluateOutcome({
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
          ? "Command hesitation amplified the hottest crisis before a new turn began."
          : event.detail,
        effect: forcedByTimer
          ? "-4 budget, -2 diplomacy, region tension surges"
          : `${event.regionDelta.tension ?? 0 >= 0 ? "+" : ""}${event.regionDelta.tension ?? 0} tension, ${event.regionDelta.stability ?? 0 >= 0 ? "+" : ""}${event.regionDelta.stability ?? 0} stability`,
        minutesAgo: 0
      },
      ...ageEvents(state.events, forcedByTimer ? TURN_DURATION_MS : 1800)
    ].slice(0, 7),
    briefing: forcedByTimer
      ? `${hottestRegion.name} deteriorated while command stalled. New turn issued under pressure.`
      : `${event.headline}. ${hottestRegion.name} now anchors the crisis picture.`,
    nextEventId: state.nextEventId + 1
  });

  return nextState;
};

const advanceStateByTime = (state: GameState, ms: number): GameState => {
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

const canAffordAction = (resources: Resources, costs: Partial<Resources>) =>
  Object.entries(costs).every(([key, value]) => {
    const resourceKey = key as keyof Resources;
    return resources[resourceKey] >= (value ?? 0);
  });

const buildTextState = (state: GameState) => {
  const metrics = getWorldMetrics(state.regions);
  return JSON.stringify({
    coordinateSystem: "Map uses percentage coordinates with origin at top-left; x grows right, y grows down.",
    mode: state.mode,
    turn: state.turn,
    maxTurns: state.maxTurns,
    operationsLeft: state.operationsLeft,
    countdownMs: state.countdownMs,
    selectedRegionId: state.selectedRegionId,
    resources: state.resources,
    world: metrics,
    briefing: state.briefing,
    outcomeReason: state.outcomeReason,
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
    visibleEvents: state.events.map((event) => ({
      headline: event.headline,
      regionId: event.regionId,
      level: event.level,
      minutesAgo: event.minutesAgo
    }))
  });
};

function App() {
  const [game, setGame] = useState<GameState>(createInitialState);

  const selectedRegion =
    game.regions.find((region) => region.id === game.selectedRegionId) ??
    game.regions[0];

  const metrics = getWorldMetrics(game.regions);

  useEffect(() => {
    if (game.mode !== "active") {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setGame((current) => advanceStateByTime(current, 1000));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [game.mode]);

  useEffect(() => {
    window.render_game_to_text = () => buildTextState(game);
    window.advanceTime = (ms: number) => {
      setGame((current) => advanceStateByTime(current, ms));
    };

    return () => {
      delete window.render_game_to_text;
      delete window.advanceTime;
    };
  }, [game]);

  const runAction = (actionId: string) => {
    if (game.mode !== "active" || game.operationsLeft <= 0) {
      return;
    }

    const action = actionDeck.find((item) => item.id === actionId);

    if (!action || !canAffordAction(game.resources, action.costs)) {
      return;
    }

    setGame((current) => {
      const targetRegion =
        current.regions.find((region) => region.id === current.selectedRegionId) ??
        current.regions[0];

      const updatedResources: Resources = {
        budget: clamp(current.resources.budget - (action.costs.budget ?? 0)),
        diplomacy: clamp(
          current.resources.diplomacy - (action.costs.diplomacy ?? 0)
        ),
        readiness: clamp(
          current.resources.readiness - (action.costs.readiness ?? 0)
        ),
        intel: clamp(current.resources.intel - (action.costs.intel ?? 0))
      };

      const updatedRegions = current.regions.map((region) =>
        region.id === targetRegion.id ? applyRegionDelta(region, action.delta) : region
      );
      const actionLevel: EventLevel =
        (action.delta.tension ?? 0) >= 4
          ? "HIGH"
          : (action.delta.tension ?? 0) <= -4
            ? "LOW"
            : "MEDIUM";

      const nextState = evaluateOutcome({
        ...current,
        operationsLeft: current.operationsLeft - 1,
        resources: updatedResources,
        regions: updatedRegions,
        events: [
          {
            id: current.nextEventId,
            level: actionLevel,
            regionId: targetRegion.id,
            headline: `${action.label} executed in ${targetRegion.name}`,
            detail: action.description,
            effect: `${describeCosts(action.costs)} | ${action.delta.tension ?? 0 >= 0 ? "+" : ""}${action.delta.tension ?? 0} tension`,
            minutesAgo: 0
          },
          ...current.events
        ].slice(0, 7),
        briefing: `${targetRegion.name}: ${action.description}`,
        nextEventId: current.nextEventId + 1
      });

      return nextState;
    });
  };

  const startCampaign = () => {
    setGame((current) => ({
      ...current,
      mode: "active",
      briefing:
        "Command net online. You have two operations per turn before the world phase fires."
    }));
  };

  const endTurn = () => {
    setGame((current) => resolveTurn(current));
  };

  const resetCampaign = () => {
    setGame(createInitialState());
  };

  return (
    <div className="shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Codex / World Conflict Simulator</p>
          <h1>Play the crisis map before it turns into a cascade.</h1>
          <p className="lede">
            A React strategy shell with a stylized world map, turn-based crisis
            management, region selection, command resources and deterministic
            testing hooks.
          </p>
        </div>

        <div className="status-panel">
          <div>
            <span>Turn</span>
            <strong>
              {Math.min(game.turn, game.maxTurns)}/{game.maxTurns}
            </strong>
          </div>
          <div>
            <span>Operations</span>
            <strong>{game.operationsLeft}</strong>
          </div>
          <div>
            <span>World Tension</span>
            <strong>{metrics.worldTension}</strong>
          </div>
          <div>
            <span>Threat Clock</span>
            <strong>{(game.countdownMs / 1000).toFixed(0)}s</strong>
          </div>
        </div>
      </section>

      <section className="top-grid">
        <article className="world-card card">
          <div className="card-head">
            <div>
              <p className="card-kicker">World Theater</p>
              <h2>Operational map</h2>
            </div>
            <span className={`pill mode-${game.mode}`}>{game.mode}</span>
          </div>

          <div className="world-stage">
            <svg
              aria-hidden="true"
              className="world-svg"
              viewBox="0 0 900 520"
              role="img"
            >
              <defs>
                <linearGradient id="glowStroke" x1="0%" x2="100%">
                  <stop offset="0%" stopColor="#50d7b3" />
                  <stop offset="100%" stopColor="#ff8a4c" />
                </linearGradient>
              </defs>

              {worldMapPaths.map((path, index) => (
                <path
                  key={path}
                  className={`continent continent-${index}`}
                  d={path}
                />
              ))}

              <line className="route" x1="495" y1="135" x2="513" y2="218" />
              <line className="route" x1="513" y1="218" x2="414" y2="268" />
              <line className="route" x1="513" y1="218" x2="711" y2="249" />
              <line className="route" x1="414" y1="268" x2="495" y2="135" />
            </svg>

            {game.regions.map((region) => (
              <button
                key={region.id}
                className={`map-node ${region.id === game.selectedRegionId ? "active" : ""} ${classifyRegion(region)}`}
                id={`region-${region.id}`}
                onClick={() =>
                  setGame((current) => ({
                    ...current,
                    selectedRegionId: region.id,
                    briefing: `${region.name} selected. ${region.flashpoint}.`
                  }))
                }
                style={{ left: `${region.x}%`, top: `${region.y}%` }}
                type="button"
              >
                <span>{region.name}</span>
                <strong>{region.tension}</strong>
              </button>
            ))}
          </div>

          <div className="objective-strip">
            <div>
              <span>Objective</span>
              <strong>Survive 8 turns without a dual-theater collapse.</strong>
            </div>
            <div>
              <span>Win State</span>
              <strong>Finish with tension 65 or below and no collapsed region.</strong>
            </div>
          </div>
        </article>

        <article className="command-card card">
          <div className="card-head">
            <div>
              <p className="card-kicker">Command Net</p>
              <h2>Campaign controls</h2>
            </div>
          </div>

          <div className="control-stack">
            <button
              className="primary-button"
              id="start-campaign"
              onClick={startCampaign}
              type="button"
            >
              {game.mode === "briefing" ? "Start campaign" : "Resume command"}
            </button>
            <button
              className="secondary-button"
              id="end-turn"
              onClick={endTurn}
              type="button"
            >
              End turn
            </button>
            <button
              className="ghost-button"
              id="reset-campaign"
              onClick={resetCampaign}
              type="button"
            >
              Reset campaign
            </button>
          </div>

          <div className="briefing-box">
            <p className="card-kicker">Briefing</p>
            <p>{game.briefing}</p>
          </div>

          <div className="meter-list compact">
            <div>
              <label>Budget</label>
              <progress max={100} value={game.resources.budget} />
              <span>{game.resources.budget}</span>
            </div>
            <div>
              <label>Diplomacy</label>
              <progress max={100} value={game.resources.diplomacy} />
              <span>{game.resources.diplomacy}</span>
            </div>
            <div>
              <label>Readiness</label>
              <progress max={100} value={game.resources.readiness} />
              <span>{game.resources.readiness}</span>
            </div>
            <div>
              <label>Intel</label>
              <progress max={100} value={game.resources.intel} />
              <span>{game.resources.intel}</span>
            </div>
          </div>

          {game.mode === "won" || game.mode === "lost" ? (
            <div className={`outcome-banner ${game.mode}`}>
              <span>{game.mode === "won" ? "Campaign won" : "Campaign lost"}</span>
              <strong>{game.outcomeReason}</strong>
            </div>
          ) : null}
        </article>
      </section>

      <section className="bottom-grid">
        <article className="intel-card card">
          <div className="card-head">
            <div>
              <p className="card-kicker">Selected Theater</p>
              <h2>{selectedRegion.name}</h2>
            </div>
            <span className={`pill status-${classifyRegion(selectedRegion)}`}>
              {classifyRegion(selectedRegion)}
            </span>
          </div>

          <p className="region-summary">{selectedRegion.summary}</p>

          <div className="meter-list">
            <div>
              <label>Stability</label>
              <progress max={100} value={selectedRegion.stability} />
              <span>{selectedRegion.stability}</span>
            </div>
            <div>
              <label>Tension</label>
              <progress max={100} value={selectedRegion.tension} />
              <span>{selectedRegion.tension}</span>
            </div>
            <div>
              <label>Economy</label>
              <progress max={100} value={selectedRegion.economy} />
              <span>{selectedRegion.economy}</span>
            </div>
            <div>
              <label>Support</label>
              <progress max={100} value={selectedRegion.support} />
              <span>{selectedRegion.support}</span>
            </div>
          </div>

          <div className="details-grid">
            <div>
              <span>Alignment</span>
              <strong>{selectedRegion.alignment}</strong>
            </div>
            <div>
              <span>Pressure</span>
              <strong>{selectedRegion.pressure}</strong>
            </div>
            <div>
              <span>Flashpoint</span>
              <strong>{selectedRegion.flashpoint}</strong>
            </div>
          </div>
        </article>

        <article className="actions-card card">
          <div className="card-head">
            <div>
              <p className="card-kicker">Decision Desk</p>
              <h2>Two operations per turn</h2>
            </div>
          </div>

          <div className="action-list">
            {actionDeck.map((action) => {
              const disabled =
                game.mode !== "active" ||
                game.operationsLeft <= 0 ||
                !canAffordAction(game.resources, action.costs);

              return (
                <button
                  key={action.id}
                  className="action-button"
                  disabled={disabled}
                  id={`action-${action.id}`}
                  onClick={() => runAction(action.id)}
                  type="button"
                >
                  <div className="action-topline">
                    <strong>{action.label}</strong>
                    <span>{action.tag}</span>
                  </div>
                  <p>{action.description}</p>
                  <small>{describeCosts(action.costs)}</small>
                </button>
              );
            })}
          </div>
        </article>

        <article className="summary-card card">
          <div className="card-head">
            <div>
              <p className="card-kicker">Strategic Picture</p>
              <h2>World gauges</h2>
            </div>
          </div>

          <div className="summary-grid">
            <div>
              <span>World Stability</span>
              <strong>{metrics.worldStability}</strong>
            </div>
            <div>
              <span>Economic Heat</span>
              <strong>{metrics.economicHeat}</strong>
            </div>
            <div>
              <span>Public Support</span>
              <strong>{metrics.publicSupport}</strong>
            </div>
            <div>
              <span>Critical Theaters</span>
              <strong>{metrics.criticalRegions}</strong>
            </div>
          </div>
        </article>

        <article className="feed-card card">
          <div className="card-head">
            <div>
              <p className="card-kicker">Pulse Feed</p>
              <h2>Escalation log</h2>
            </div>
          </div>

          <div className="feed-list">
            {game.events.map((event) => {
              const region = game.regions.find(
                (candidate) => candidate.id === event.regionId
              );

              return (
                <article key={event.id} className="feed-item">
                  <div className="feed-meta">
                    <span className={`level ${event.level.toLowerCase()}`}>
                      {event.level}
                    </span>
                    <span>{region?.name ?? event.regionId}</span>
                    <span>{event.minutesAgo}m ago</span>
                  </div>
                  <h3>{event.headline}</h3>
                  <p>{event.detail}</p>
                  <strong>{event.effect}</strong>
                </article>
              );
            })}
          </div>
        </article>
      </section>
    </div>
  );
}

export default App;
