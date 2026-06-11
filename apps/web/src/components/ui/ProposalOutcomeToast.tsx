'use client';

import { useEffect } from 'react';
import { useGameStore, type ProposalOutcome } from '@/stores/gameStore';
import { useLocaleStore } from '@/stores/localeStore';
import type { Translations } from '@/lib/i18n/types';

interface Props {
  countryNames: Record<string, string>;
}

function typeLabel(t: Translations, type: ProposalOutcome['type']): string {
  switch (type) {
    case 'alliance': return t.inbox_proposal_alliance;
    case 'trade_agreement': return t.inbox_proposal_trade;
    case 'non_aggression': return t.inbox_proposal_peace;
    default: return type;
  }
}

function OutcomeCard({ outcome, countryNames }: { outcome: ProposalOutcome; countryNames: Record<string, string> }) {
  const dismiss = useGameStore((s) => s.dismissProposalOutcome);
  const { t } = useLocaleStore();

  useEffect(() => {
    const timer = setTimeout(() => dismiss(outcome.id), 10_000);
    return () => clearTimeout(timer);
  }, [outcome.id, dismiss]);

  const name = countryNames[outcome.country] ?? outcome.country;
  const headline = (outcome.accepted ? t.outcome_accepted : t.outcome_rejected)
    .replace('{country}', name);

  return (
    <div
      className={`bg-bg-secondary border rounded shadow-lg px-3 py-2 ${
        outcome.accepted ? 'border-accent-green/50' : 'border-severity-high/50'
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-base leading-none">{outcome.accepted ? '✅' : '❌'}</span>
        <div className="flex flex-col min-w-0">
          <span
            className={`text-xs font-semibold truncate ${
              outcome.accepted ? 'text-accent-green' : 'text-severity-high'
            }`}
          >
            {headline}
          </span>
          <span className="text-text-muted text-xs truncate">{typeLabel(t, outcome.type)}</span>
        </div>
        <button
          onClick={() => dismiss(outcome.id)}
          className="ml-auto text-text-muted hover:text-text-primary text-xs cursor-pointer"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

/** Floating toasts: AI answered one of the player's outgoing proposals. */
export function ProposalOutcomeToast({ countryNames }: Props) {
  const outcomes = useGameStore((s) => s.proposalOutcomes);

  if (outcomes.length === 0) return null;

  return (
    <div className="fixed right-4 top-24 z-40 flex flex-col gap-2 max-w-[260px]">
      {outcomes.map((o) => (
        <OutcomeCard key={o.id} outcome={o} countryNames={countryNames} />
      ))}
    </div>
  );
}
