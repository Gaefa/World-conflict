'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useLocaleStore } from '@/stores/localeStore';
import { useCountries } from '@/hooks/useCountries';
import type { LobbyView } from '@/lib/transport/types';
import type { LanInfo } from '@/lib/electron-bridge';

/** Polling the lobby is also the server's "still here" heartbeat (30 s timeout). */
const POLL_MS = 2_000;

interface LobbyRoomProps {
  lanInfo: LanInfo | null;
  /** Called once this player is inside the running game. */
  onEntered: () => void;
}

/**
 * Multiplayer waiting room: everyone sees the invite code and who picked
 * which country, picks a free one, and the host starts. Guests follow the
 * host in as soon as their poll sees the session go active.
 */
export function LobbyRoom({ lanInfo, onEntered }: LobbyRoomProps) {
  const { t } = useLocaleStore();
  const { data: countries } = useCountries();
  const { transport, sessionId, playerId, selectCountry, startGame, enterStartedGame } = useGameStore();
  const [lobby, setLobby] = useState<LobbyView | null>(null);
  const [error, setError] = useState('');
  const [picking, setPicking] = useState(false);
  const [starting, setStarting] = useState(false);
  const entered = useRef(false);

  const refresh = useCallback(async () => {
    if (!sessionId) return;
    try {
      setLobby(await transport.getLobby(sessionId));
      setError('');
    } catch {
      setError(t.lobby_lost);
    }
  }, [transport, sessionId, t]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const isHost = !!lobby && lobby.hostPlayerId === playerId;

  // Guests follow the host into the game (once — the effect can re-run).
  useEffect(() => {
    if (lobby?.status !== 'active' || isHost || entered.current) return;
    entered.current = true;
    enterStartedGame().then(onEntered, () => {
      entered.current = false;
      setError(t.lobby_lost);
    });
  }, [lobby?.status, isHost, enterStartedGame, onEntered, t]);

  const pick = async (code: string) => {
    setPicking(true);
    try {
      await selectCountry(code);
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setPicking(false);
    }
  };

  const start = async () => {
    setStarting(true);
    try {
      entered.current = true;
      await startGame();
      onEntered();
    } catch (e: unknown) {
      entered.current = false;
      setError(e instanceof Error ? e.message : 'Error');
      setStarting(false);
    }
  };

  const players = lobby?.players ?? [];
  const owners = new Map(players.filter(p => p.countryCode).map(p => [p.countryCode, p]));
  const myCountry = players.find(p => p.id === playerId)?.countryCode;
  const allPicked = players.length > 0 && players.every(p => p.countryCode);
  const open = lobby?.status === 'lobby';
  const country = (code: string) => countries?.find(c => c.code === code);

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {(error || lobby?.status === 'finished') && (
          <div className="bg-severity-high/20 border border-severity-high/30 rounded p-2 text-sm text-severity-high">
            {lobby?.status === 'finished' ? t.lobby_closed : error}
          </div>
        )}

        <div className="text-center">
          <div className="text-text-muted text-xs uppercase tracking-wider mb-1">{t.mp_invite_code}</div>
          <div className="font-mono text-3xl font-bold tracking-[0.3em] text-accent-green select-all">
            {lobby?.code ?? '······'}
          </div>
          <div className="text-text-muted text-xs mt-1">{t.mp_share_code}</div>
          {isHost && lanInfo && lanInfo.ipv4.length > 0 && (
            <div className="text-text-muted text-xs mt-2">
              {t.mp_lan_urls}
              {lanInfo.ipv4.map((ip) => (
                <code key={ip} className="block text-accent-green font-mono select-all">
                  {`http://${ip}:${lanInfo.port}`}
                </code>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="text-text-secondary text-sm mb-2">{t.lobby_players} · {players.length}</div>
          <ul className="space-y-1">
            {players.map((p) => (
              <li key={p.id} className="flex items-center gap-2 bg-bg-card border border-border-default rounded px-3 py-1.5 text-sm">
                <span className="w-6 text-lg">{p.countryCode ? country(p.countryCode)?.flag : '…'}</span>
                <span className="text-text-primary">{p.name}</span>
                {p.id === lobby?.hostPlayerId && <span className="text-[10px] uppercase text-amber-400">{t.lobby_host}</span>}
                {p.id === playerId && <span className="text-[10px] uppercase text-text-muted">{t.lobby_you}</span>}
                <span className="ml-auto text-text-muted text-xs">
                  {p.countryCode ? country(p.countryCode)?.name : t.lobby_picking}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {countries?.map((c) => {
            const owner = owners.get(c.code);
            const mine = owner?.id === playerId;
            return (
              <button
                key={c.code}
                onClick={() => pick(c.code)}
                disabled={picking || !open || (!!owner && !mine)}
                className={`flex items-center gap-2 bg-bg-card border rounded p-2 text-left transition-colors disabled:opacity-40 ${
                  mine ? 'border-accent-green' : 'border-border-default hover:border-accent-red hover:bg-bg-hover'
                }`}
              >
                <span className="text-xl">{c.flag}</span>
                <div className="min-w-0">
                  <div className="text-text-primary text-sm font-medium truncate">{c.name}</div>
                  <div className="text-text-muted text-xs truncate">
                    {owner ? owner.name : `${t.cp_gdp}: $${(c.startingState.economy.gdp / 1000).toFixed(1)}T`}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4 border-t border-border-default">
        {isHost ? (
          <button
            onClick={start}
            disabled={starting || !open || !allPicked}
            className="w-full bg-accent-green hover:bg-green-600 text-white py-2 rounded font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
          >
            {starting ? t.session_starting : allPicked ? t.session_start : t.lobby_waiting_players}
          </button>
        ) : (
          <div className="text-center text-text-secondary text-sm py-2">
            {myCountry ? t.lobby_waiting_host : t.session_select_country}
          </div>
        )}
      </div>
    </>
  );
}
