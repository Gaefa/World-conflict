/**
 * Typed accessor for the preload-exposed `window.conflictLAN` API.
 *
 * The web UI runs in three environments:
 *   1. dev browser (no Electron, no bridge)
 *   2. packaged Electron desktop (bridge present)
 *   3. other player's browser connecting over LAN (no bridge)
 *
 * This module gives the UI a single typed way to ask "am I the host, and
 * if so what's my LAN URL?" without sprinkling `typeof window !== 'undefined'`
 * and `any`-casts through components.
 */

export interface LanInfo {
  port: number;
  /** Non-loopback IPv4 addresses detected on this host. */
  ipv4: string[];
}

interface ConflictLANBridge {
  getInfo: () => Promise<LanInfo>;
}

declare global {
  interface Window {
    conflictLAN?: ConflictLANBridge;
  }
}

/** True iff we're running inside the Electron desktop build (preload loaded). */
export function isDesktopHost(): boolean {
  return typeof window !== 'undefined' && !!window.conflictLAN;
}

/**
 * Ask the main process for this machine's LAN URLs. Returns null outside
 * of Electron (so callers can show/hide UI based on a single check).
 */
export async function getLanInfo(): Promise<LanInfo | null> {
  if (typeof window === 'undefined' || !window.conflictLAN) return null;
  try {
    return await window.conflictLAN.getInfo();
  } catch {
    return null;
  }
}
