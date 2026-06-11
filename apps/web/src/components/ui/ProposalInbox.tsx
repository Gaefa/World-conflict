'use client';

import { useLocaleStore } from '@/stores/localeStore';
import type { DiplomaticRelation, PlayerAction } from '@conflict-game/shared-types';
import type { Translations } from '@/lib/i18n/types';

interface Props {
  playerCountryCode: string;
  relations: DiplomaticRelation[];
  countryNames: Record<string, string>;
  onAction: (action: PlayerAction) => void;
}

const PROPOSAL_TYPES = new Set<DiplomaticRelation['type']>([
  'alliance',
  'trade_agreement',
  'non_aggression',
]);

const ICONS: Record<string, string> = {
  alliance: '🤝',
  trade_agreement: '📦',
  non_aggression: '🕊️',
};

function proposalLabel(t: Translations, type: DiplomaticRelation['type']): string {
  switch (type) {
    case 'alliance': return t.inbox_proposal_alliance;
    case 'trade_agreement': return t.inbox_proposal_trade;
    case 'non_aggression': return t.inbox_proposal_peace;
    default: return type;
  }
}

export function ProposalInbox({ playerCountryCode, relations, countryNames, onAction }: Props) {
  const { t } = useLocaleStore();

  const incoming = relations.filter(
    r => r.status === 'proposed'
      && r.toCountry === playerCountryCode
      && PROPOSAL_TYPES.has(r.type),
  );

  if (incoming.length === 0) return null;

  // Cap visible cards so a flood of AI proposals doesn't cover the screen
  const visible = incoming.slice(0, 3);
  const hiddenCount = incoming.length - visible.length;

  function accept(id: string) {
    onAction({ type: 'accept_proposal', relationId: id } as PlayerAction);
  }

  function reject(id: string) {
    onAction({ type: 'reject_proposal', relationId: id } as PlayerAction);
  }

  return (
    <div className="fixed right-4 bottom-[260px] z-40 flex flex-col gap-2 max-w-[240px]">
      {hiddenCount > 0 && (
        <div className="text-center text-text-muted text-xs bg-bg-secondary/80 border border-border-default rounded px-2 py-1">
          +{hiddenCount}
        </div>
      )}
      {visible.map(r => {
        const fromName = countryNames[r.fromCountry] ?? r.fromCountry;
        const icon = ICONS[r.type] ?? '📨';
        const label = proposalLabel(t, r.type);

        return (
          <div
            key={r.id}
            className="bg-bg-secondary border border-border-default rounded shadow-lg px-3 py-2"
          >
            <div className="text-xs text-text-muted mb-1 uppercase tracking-wider">
              {t.diplo_incoming_proposals}
            </div>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-base leading-none">{icon}</span>
              <div className="flex flex-col min-w-0">
                <span className="text-text-primary text-xs font-semibold truncate">{label}</span>
                <span className="text-text-muted text-xs truncate">
                  {t.inbox_from} {fromName}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => accept(r.id)}
                className="flex-1 bg-accent-green/20 hover:bg-accent-green/40 text-accent-green text-xs font-bold py-1 rounded transition-colors cursor-pointer"
              >
                {t.diplo_accept}
              </button>
              <button
                onClick={() => reject(r.id)}
                className="flex-1 bg-severity-high/15 hover:bg-severity-high/30 text-severity-high text-xs font-bold py-1 rounded transition-colors cursor-pointer"
              >
                {t.diplo_reject}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
