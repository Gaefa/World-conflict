import { useState } from "react";

type Region = {
  id: string;
  name: string;
  alignment: string;
  stability: number;
  tension: number;
  economy: number;
  pressure: string;
  posture: string;
  summary: string;
  flashpoint: string;
};

type EventCard = {
  id: number;
  level: "HIGH" | "MEDIUM" | "LOW";
  region: string;
  headline: string;
  detail: string;
  effect: string;
  minutesAgo: number;
};

const initialRegions: Region[] = [
  {
    id: "baltic",
    name: "Baltic Corridor",
    alignment: "Western bloc",
    stability: 64,
    tension: 72,
    economy: 61,
    pressure: "Missile defense saturation",
    posture: "Forward deterrence",
    summary: "Military signaling is high and civilian resilience is under pressure.",
    flashpoint: "Airspace interceptions near a logistics corridor"
  },
  {
    id: "levant",
    name: "Levant Arc",
    alignment: "Multi-faction theater",
    stability: 38,
    tension: 89,
    economy: 42,
    pressure: "Proxy escalation",
    posture: "Fragmented control",
    summary: "Rapid strikes and reprisals are pushing the theater toward spillover.",
    flashpoint: "Port strike risk with maritime disruption"
  },
  {
    id: "indo-pacific",
    name: "Indo-Pacific Rim",
    alignment: "Contested maritime sphere",
    stability: 57,
    tension: 66,
    economy: 78,
    pressure: "Naval shadowing",
    posture: "Competitive signaling",
    summary: "Trade remains strong, but maritime incidents are compounding strategic risk.",
    flashpoint: "Carrier group shadow operations"
  },
  {
    id: "sahel",
    name: "Sahel Belt",
    alignment: "Non-aligned fracture zone",
    stability: 31,
    tension: 58,
    economy: 29,
    pressure: "Insurgency momentum",
    posture: "Patchwork authority",
    summary: "Low state capacity and fragmented armed actors keep the region unstable.",
    flashpoint: "Resource corridor sabotage"
  }
];

const initialEvents: EventCard[] = [
  {
    id: 101,
    level: "HIGH",
    region: "Levant Arc",
    headline: "Drone swarm detected over shipping lane",
    detail: "Insurance costs spike as regional escorts scramble to contain maritime panic.",
    effect: "-4 trade flow, +6 tension",
    minutesAgo: 4
  },
  {
    id: 102,
    level: "MEDIUM",
    region: "Baltic Corridor",
    headline: "Rail logistics route moved to military priority",
    detail: "Civilian freight slows while reinforcement tempo rises across the frontier.",
    effect: "+3 readiness, -2 economy",
    minutesAgo: 12
  },
  {
    id: 103,
    level: "LOW",
    region: "Indo-Pacific Rim",
    headline: "Regional summit opens quiet deconfliction channel",
    detail: "Backchannel talks reduce immediate collision risk, but no doctrine changes follow.",
    effect: "-3 tension, +1 stability",
    minutesAgo: 28
  }
];

const actionDeck = [
  {
    id: "aid",
    label: "Deploy Aid",
    outcome: "Humanitarian corridors reduce immediate pressure.",
    modify: { stability: 5, tension: -4, economy: 2 }
  },
  {
    id: "sanctions",
    label: "Targeted Sanctions",
    outcome: "Coercive pressure lands, but commercial confidence softens.",
    modify: { stability: -1, tension: 6, economy: -5 }
  },
  {
    id: "backchannel",
    label: "Open Backchannel",
    outcome: "Negotiators slow the tempo of escalation.",
    modify: { stability: 2, tension: -7, economy: 1 }
  },
  {
    id: "surveillance",
    label: "Increase Surveillance",
    outcome: "Detection improves, yet every actor reads the move as a signal.",
    modify: { stability: 1, tension: 3, economy: 0 }
  }
];

const clamp = (value: number) => Math.max(0, Math.min(100, value));

function App() {
  const [regions, setRegions] = useState(initialRegions);
  const [events, setEvents] = useState(initialEvents);
  const [selectedRegionId, setSelectedRegionId] = useState(initialRegions[0].id);
  const [turn, setTurn] = useState(1);
  const [briefing, setBriefing] = useState(
    "Simulation initialized. Select a theater and choose a response posture."
  );

  const selectedRegion =
    regions.find((region) => region.id === selectedRegionId) ?? regions[0];

  const worldTension = Math.round(
    regions.reduce((sum, region) => sum + region.tension, 0) / regions.length
  );
  const worldStability = Math.round(
    regions.reduce((sum, region) => sum + region.stability, 0) / regions.length
  );
  const economicHeat = Math.round(
    regions.reduce((sum, region) => sum + region.economy, 0) / regions.length
  );

  const runAction = (actionId: string) => {
    const action = actionDeck.find((item) => item.id === actionId);

    if (!action) {
      return;
    }

    setRegions((current) =>
      current.map((region) =>
        region.id === selectedRegionId
          ? {
              ...region,
              stability: clamp(region.stability + action.modify.stability),
              tension: clamp(region.tension + action.modify.tension),
              economy: clamp(region.economy + action.modify.economy)
            }
          : region
      )
    );

    setEvents((current) => [
      {
        id: Date.now(),
        level:
          action.modify.tension >= 4
            ? "HIGH"
            : action.modify.tension <= -4
              ? "LOW"
              : "MEDIUM",
        region: selectedRegion.name,
        headline: `${action.label} executed in ${selectedRegion.name}`,
        detail: action.outcome,
        effect: `${action.modify.stability >= 0 ? "+" : ""}${action.modify.stability} stability, ${action.modify.tension >= 0 ? "+" : ""}${action.modify.tension} tension, ${action.modify.economy >= 0 ? "+" : ""}${action.modify.economy} economy`,
        minutesAgo: 0
      },
      ...current.slice(0, 5)
    ]);

    setTurn((current) => current + 1);
    setBriefing(`${selectedRegion.name}: ${action.outcome}`);
  };

  return (
    <div className="shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Codex / Geopolitical Simulator</p>
          <h1>Command tension, trade and diplomacy before the map ignites.</h1>
          <p className="lede">
            This React app is the first playable shell for a strategy simulator
            inspired by conflict dashboards, but structured as a decision game.
          </p>
        </div>

        <div className="status-panel">
          <div>
            <span>Turn</span>
            <strong>{turn}</strong>
          </div>
          <div>
            <span>World Tension</span>
            <strong>{worldTension}</strong>
          </div>
          <div>
            <span>Stability</span>
            <strong>{worldStability}</strong>
          </div>
          <div>
            <span>Economic Heat</span>
            <strong>{economicHeat}</strong>
          </div>
        </div>
      </section>

      <section className="grid">
        <article className="map-card card">
          <div className="card-head">
            <div>
              <p className="card-kicker">Theaters</p>
              <h2>Strategic map shell</h2>
            </div>
            <span className="pill">Prototype</span>
          </div>

          <div className="map-stage">
            {regions.map((region) => (
              <button
                key={region.id}
                className={`region-node ${region.id === selectedRegionId ? "active" : ""}`}
                onClick={() => setSelectedRegionId(region.id)}
                type="button"
              >
                <span>{region.name}</span>
                <strong>{region.tension}</strong>
              </button>
            ))}
          </div>

          <p className="map-note">
            Next step: replace this abstract theater map with a real React world
            map layer and live event clustering.
          </p>
        </article>

        <article className="intel-card card">
          <div className="card-head">
            <div>
              <p className="card-kicker">Selected Region</p>
              <h2>{selectedRegion.name}</h2>
            </div>
            <span className="pill subtle">{selectedRegion.alignment}</span>
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
          </div>

          <div className="details-grid">
            <div>
              <span>Pressure</span>
              <strong>{selectedRegion.pressure}</strong>
            </div>
            <div>
              <span>Posture</span>
              <strong>{selectedRegion.posture}</strong>
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
              <h2>Response options</h2>
            </div>
          </div>

          <div className="action-list">
            {actionDeck.map((action) => (
              <button
                key={action.id}
                className="action-button"
                onClick={() => runAction(action.id)}
                type="button"
              >
                <strong>{action.label}</strong>
                <span>{action.outcome}</span>
              </button>
            ))}
          </div>

          <div className="briefing-box">
            <p className="card-kicker">Command Brief</p>
            <p>{briefing}</p>
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
            {events.map((event) => (
              <article key={event.id} className="feed-item">
                <div className="feed-meta">
                  <span className={`level ${event.level.toLowerCase()}`}>
                    {event.level}
                  </span>
                  <span>{event.region}</span>
                  <span>{event.minutesAgo}m ago</span>
                </div>
                <h3>{event.headline}</h3>
                <p>{event.detail}</p>
                <strong>{event.effect}</strong>
              </article>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

export default App;
