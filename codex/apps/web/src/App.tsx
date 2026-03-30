import { useEffect, useMemo, useState } from "react";
import {
  actionDeck,
  advanceStateByTime,
  applyAction,
  buildTextState,
  canAffordAction,
  classifyRegion,
  createInitialState,
  describeCosts,
  describeDelta,
  GameState,
  getSelectedRegion,
  getWorldMetrics,
  OPERATIONS_PER_TURN,
  resolveTurn,
  selectRegion,
  startCampaign,
  statusLabel,
  worldMapPaths
} from "@codex/game-core";

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
  }
}

function App() {
  const [game, setGame] = useState<GameState>(createInitialState);
  const [showMission, setShowMission] = useState(true);

  const selectedRegion = getSelectedRegion(game);
  const metrics = useMemo(() => getWorldMetrics(game.regions), [game.regions]);
  const hottestRegions = useMemo(
    () => [...game.regions].sort((left, right) => right.tension - left.tension),
    [game.regions]
  );

  const nextStep =
    game.mode === "briefing"
      ? "Open the mission briefing and start the command cycle."
      : game.operationsLeft === OPERATIONS_PER_TURN
        ? "Pick the theater you want to stabilize this turn."
        : game.operationsLeft > 0
          ? "Use one more program or end the turn now."
          : "You spent both programs. End the turn before the timer does it for you.";

  useEffect(() => {
    if (game.mode !== "active") {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setGame((current) => advanceStateByTime(current, 1000));
    }, 1000);

    return () => window.clearInterval(timer);
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

  return (
    <div className="shell">
      {showMission ? (
        <div className="mission-overlay">
          <div className="mission-panel">
            <div className="mission-header">
              <div>
                <p className="eyebrow">Mission Brief</p>
                <h2>Shared engine. Web and mobile on the same rules.</h2>
              </div>
              <span className="mission-badge">Campaign Protocol</span>
            </div>

            <p>
              The board is a live geopolitical dashboard, but the loop is a
              clean strategy game: select one theater, spend up to two programs,
              then absorb the world response.
            </p>

            <div className="mission-grid">
              <div>
                <span>Loop</span>
                <strong>1. Pick a theater</strong>
                <strong>2. Launch up to two programs</strong>
                <strong>3. End the turn</strong>
              </div>
              <div>
                <span>Victory</span>
                <strong>Reach turn 8</strong>
                <strong>Keep world tension at 65 or below</strong>
                <strong>No theater collapse</strong>
              </div>
              <div>
                <span>Failure</span>
                <strong>World tension reaches 92</strong>
                <strong>Two theaters collapse</strong>
                <strong>Or turn 8 ends in disorder</strong>
              </div>
            </div>

            <div className="mission-actions">
              <button
                className="primary-button"
                id="start-campaign"
                onClick={() => {
                  setShowMission(false);
                  setGame((current) => startCampaign(current));
                }}
                type="button"
              >
                Start Mission
              </button>
              <button
                className="ghost-button"
                id="hide-briefing"
                onClick={() => setShowMission(false)}
                type="button"
              >
                Hide Briefing
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <header className="command-header">
        <div className="brand-block">
          <p className="eyebrow">Cross-Platform Command Layer</p>
          <h1>Geopolitical Crisis Simulator</h1>
          <p className="subline">
            Web UI today, Expo shell ready next to it, one shared game-core underneath both.
          </p>
        </div>

        <div className="command-strip">
          <div className="metric-card">
            <span>Turn</span>
            <strong>
              {Math.min(game.turn, game.maxTurns)}/{game.maxTurns}
            </strong>
          </div>
          <div className="metric-card">
            <span>Programs Left</span>
            <strong>{game.operationsLeft}</strong>
          </div>
          <div className="metric-card danger">
            <span>World Tension</span>
            <strong>{metrics.worldTension}</strong>
          </div>
          <div className="metric-card">
            <span>Turn Timer</span>
            <strong>{Math.ceil(game.countdownMs / 1000)}s</strong>
          </div>
          <button
            className="ghost-button top-button"
            id="show-briefing"
            onClick={() => setShowMission(true)}
            type="button"
          >
            Brief
          </button>
          <button
            className="secondary-button top-button"
            id="end-turn"
            disabled={game.mode !== "active"}
            onClick={() => setGame((current) => resolveTurn(current))}
            type="button"
          >
            End Turn
          </button>
          <button
            className="ghost-button top-button"
            id="reset-campaign"
            onClick={() => {
              setShowMission(true);
              setGame(createInitialState());
            }}
            type="button"
          >
            Reset
          </button>
        </div>
      </header>

      <section className="control-banner card">
        <div>
          <span>Current instruction</span>
          <strong>{nextStep}</strong>
        </div>
        <div>
          <span>Mission status</span>
          <strong>{game.briefing}</strong>
        </div>
        <div>
          <span>Win / Lose</span>
          <strong>Win: turn 8 + tension 65 or below. Lose: tension 92 or two collapsed theaters.</strong>
        </div>
      </section>

      <section className="battlefield-grid">
        <aside className="feed-panel card">
          <div className="panel-head">
            <div>
              <p className="card-kicker">Pulse Feed</p>
              <h2>Live Crisis Log</h2>
            </div>
            <span className="panel-pill">Live</span>
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
        </aside>

        <main className="board-panel card">
          <div className="panel-head">
            <div>
              <p className="card-kicker">World Board</p>
              <h2>Conflict Theater Map</h2>
            </div>
            <div className="legend-row">
              <span className="legend critical">Critical</span>
              <span className="legend strained">Strained</span>
              <span className="legend steady">Stable</span>
            </div>
          </div>

          <div className="board-surface">
            <svg
              aria-hidden="true"
              className="world-svg"
              role="img"
              viewBox="0 0 900 560"
            >
              <defs>
                <radialGradient id="boardGlow" cx="50%" cy="45%" r="82%">
                  <stop offset="0%" stopColor="rgba(77, 170, 255, 0.14)" />
                  <stop offset="100%" stopColor="rgba(8, 16, 31, 0)" />
                </radialGradient>
              </defs>

              <ellipse cx="450" cy="280" fill="url(#boardGlow)" rx="420" ry="240" />

              {Array.from({ length: 7 }, (_, index) => (
                <line
                  key={`lat-${index}`}
                  className="grid-line"
                  x1="70"
                  x2="830"
                  y1={110 + index * 52}
                  y2={110 + index * 52}
                />
              ))}

              {Array.from({ length: 9 }, (_, index) => (
                <line
                  key={`lon-${index}`}
                  className="grid-line"
                  x1={110 + index * 84}
                  x2={110 + index * 84}
                  y1="82"
                  y2="470"
                />
              ))}

              {worldMapPaths.map((path) => (
                <path key={path} className="continent" d={path} />
              ))}

              <path className="arc" d="M492 139C505 180 507 210 515 220" />
              <path className="arc" d="M516 221C481 238 449 252 418 269" />
              <path className="arc" d="M517 221C569 219 643 228 711 252" />
              <path className="arc" d="M417 269C441 228 468 183 492 139" />
            </svg>

            {game.regions.map((region) => {
              const status = classifyRegion(region);

              return (
                <button
                  key={region.id}
                  className={`map-node ${status} ${
                    region.id === game.selectedRegionId ? "active" : ""
                  }`}
                  id={`region-${region.id}`}
                  onClick={() => setGame((current) => selectRegion(current, region.id))}
                  style={{ left: `${region.x}%`, top: `${region.y}%` }}
                  type="button"
                >
                  <span>{region.name}</span>
                  <strong>{region.tension}</strong>
                  <small>{statusLabel[status]}</small>
                </button>
              );
            })}

            <div className="selected-overlay">
              <p className="card-kicker">Selected Theater</p>
              <h3>{selectedRegion.name}</h3>
              <p>{selectedRegion.flashpoint}</p>
              <div className="overlay-stats">
                <span>Stability {selectedRegion.stability}</span>
                <span>Tension {selectedRegion.tension}</span>
                <span>Economy {selectedRegion.economy}</span>
              </div>
            </div>
          </div>

          <div className="theater-tabs">
            {hottestRegions.map((region, index) => {
              const status = classifyRegion(region);

              return (
                <button
                  key={region.id}
                  className={`theater-chip ${status} ${
                    region.id === game.selectedRegionId ? "active" : ""
                  }`}
                  onClick={() => setGame((current) => selectRegion(current, region.id))}
                  type="button"
                >
                  <span>#{index + 1}</span>
                  <strong>{region.name}</strong>
                  <small>{region.tension} tension</small>
                </button>
              );
            })}
          </div>
        </main>

        <aside className="intel-panel">
          <article className="intel-card card">
            <div className="panel-head">
              <div>
                <p className="card-kicker">Region Intel</p>
                <h2>{selectedRegion.name}</h2>
              </div>
              <span className={`panel-pill ${classifyRegion(selectedRegion)}`}>
                {statusLabel[classifyRegion(selectedRegion)]}
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

          <article className="systems-card card">
            <div className="panel-head">
              <div>
                <p className="card-kicker">Global Systems</p>
                <h2>Pressure Indicators</h2>
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

          <article className="resources-card card">
            <div className="panel-head">
              <div>
                <p className="card-kicker">Command Resources</p>
                <h2>Spend Carefully</h2>
              </div>
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
          </article>
        </aside>
      </section>

      <section className="decision-dock card">
        <div className="panel-head">
          <div>
            <p className="card-kicker">Program Dock</p>
            <h2>Launch Programs Into {selectedRegion.name}</h2>
          </div>
          <div className="dock-status">
            <span>{game.operationsLeft} of 2 program slots left this turn</span>
            <strong>Press End Turn when you are done</strong>
          </div>
        </div>

        <div className="program-dock-grid">
          {actionDeck.map((action) => {
            const disabled =
              game.mode !== "active" ||
              game.operationsLeft <= 0 ||
              !canAffordAction(game.resources, action.costs);

            return (
              <article key={action.id} className="program-card">
                <div className="program-topline">
                  <div>
                    <span>{action.family}</span>
                    <h3>{action.label}</h3>
                  </div>
                  <strong>{describeDelta(action.delta)}</strong>
                </div>
                <p>{action.description}</p>
                <div className="program-notes">
                  <small>Use when: {action.goodFor}</small>
                  <small>Risk: {action.risk}</small>
                </div>
                <div className="program-footer">
                  <span className="cost-pill">{describeCosts(action.costs)}</span>
                  <button
                    className="program-button"
                    disabled={disabled}
                    id={`action-${action.id}`}
                    onClick={() => setGame((current) => applyAction(current, action.id))}
                    type="button"
                  >
                    Apply to {selectedRegion.name}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {game.mode === "won" || game.mode === "lost" ? (
        <div className="result-overlay">
          <div className="result-panel">
            <p className="eyebrow">
              {game.mode === "won" ? "Mission Success" : "Mission Failure"}
            </p>
            <h2>{game.outcomeReason}</h2>
            <p>
              Final state: turn {Math.min(game.turn, game.maxTurns)}, world
              tension {metrics.worldTension}, critical theaters {metrics.criticalRegions}.
            </p>
            <button
              className="primary-button"
              onClick={() => {
                setShowMission(true);
                setGame(createInitialState());
              }}
              type="button"
            >
              Restart Mission
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;
