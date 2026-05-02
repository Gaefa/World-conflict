/**
 * Simple sound effects using Web Audio API (no external files needed).
 * Generates procedural sounds for game events.
 */

let audioCtx: AudioContext | null = null;

// Global volume multiplier (0 = mute, 1 = full). Persisted to localStorage.
let _volume: number = (() => {
  if (typeof window === 'undefined') return 0.5;
  const saved = localStorage.getItem('conflict_volume');
  return saved !== null ? parseFloat(saved) : 0.5;
})();

export function getVolume(): number { return _volume; }

export function setVolume(v: number): void {
  _volume = Math.max(0, Math.min(1, v));
  if (typeof window !== 'undefined') {
    localStorage.setItem('conflict_volume', String(_volume));
  }
}

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

function beep(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.15) {
  if (_volume === 0) return;
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(volume * _volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Audio not available
  }
}

/** Tick sound — subtle low click */
export function playTick() {
  beep(200, 0.05, 'square', 0.05);
}

/** War declared — ominous low tone */
export function playWarDeclared() {
  beep(100, 0.4, 'sawtooth', 0.2);
  setTimeout(() => beep(80, 0.6, 'sawtooth', 0.15), 200);
}

/** Alliance formed — pleasant chord */
export function playAlliance() {
  beep(440, 0.3, 'sine', 0.1);
  setTimeout(() => beep(554, 0.3, 'sine', 0.1), 100);
  setTimeout(() => beep(660, 0.3, 'sine', 0.1), 200);
}

/** Action success — short bright ping */
export function playActionSuccess() {
  beep(880, 0.15, 'sine', 0.1);
}

/** Action failed — low buzz */
export function playActionFailed() {
  beep(150, 0.2, 'square', 0.1);
}

/** Critical event — alarm tone */
export function playCriticalEvent() {
  beep(600, 0.15, 'square', 0.15);
  setTimeout(() => beep(800, 0.15, 'square', 0.15), 200);
  setTimeout(() => beep(600, 0.15, 'square', 0.15), 400);
}

/** Research completed — rising melody */
export function playResearchComplete() {
  beep(523, 0.15, 'sine', 0.1);
  setTimeout(() => beep(659, 0.15, 'sine', 0.1), 150);
  setTimeout(() => beep(784, 0.2, 'sine', 0.12), 300);
}

/** Notification — soft double click */
export function playNotification() {
  beep(500, 0.08, 'sine', 0.08);
  setTimeout(() => beep(600, 0.08, 'sine', 0.08), 100);
}

/** Play sound based on event type */
export function playEventSound(eventType: string, severity?: string) {
  switch (eventType) {
    case 'war_declared':
      playWarDeclared();
      break;
    case 'alliance_formed':
    case 'peace_treaty':
      playAlliance();
      break;
    case 'tech_completed':
    case 'technology_breakthrough':
      playResearchComplete();
      break;
    default:
      if (severity === 'critical') {
        playCriticalEvent();
      } else if (severity === 'high') {
        playNotification();
      }
  }
}
