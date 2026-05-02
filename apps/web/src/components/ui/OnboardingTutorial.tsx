'use client';

import { useState } from 'react';
import { useLocaleStore } from '@/stores/localeStore';
import type { Translations } from '@/lib/i18n/types';

interface OnboardingTutorialProps {
  onClose: () => void;
}

interface Step {
  icon: string;
  title: keyof Translations;
  body: keyof Translations;
  tip?: keyof Translations;
}

// 5 action-oriented steps replacing the original 13 feature-explanation slides
const STEPS: Step[] = [
  { icon: '🏆', title: 'onb_goal_title',    body: 'onb_goal_body',    tip: 'onb_goal_tip' },
  { icon: '🌍', title: 'onb_start_title',   body: 'onb_start_body',   tip: 'onb_start_tip' },
  { icon: '💰', title: 'onb_econ_title',    body: 'onb_econ_body',    tip: 'onb_econ_tip' },
  { icon: '🤝', title: 'onb_diplo_title',   body: 'onb_diplo_body',   tip: 'onb_diplo_tip' },
  { icon: '⚔️', title: 'onb_win_title',     body: 'onb_win_body',     tip: 'onb_win_tip' },
];

export function OnboardingTutorial({ onClose }: OnboardingTutorialProps) {
  const [stepIdx, setStepIdx] = useState(0);
  const { t } = useLocaleStore();

  const step = STEPS[stepIdx];
  const isLast = stepIdx === STEPS.length - 1;
  const isFirst = stepIdx === 0;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/85 animate-fade-in">
      <div className="bg-bg-secondary border-2 border-accent-red/40 rounded-xl p-6 w-full max-w-lg mx-4 relative">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-text-muted hover:text-text-primary text-xl leading-none w-8 h-8 flex items-center justify-center rounded hover:bg-bg-card transition-colors"
          aria-label={t.onb_skip}
        >
          ✕
        </button>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 mb-5">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStepIdx(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === stepIdx ? 'w-8 bg-accent-red' : i < stepIdx ? 'w-1.5 bg-accent-red/60' : 'w-1.5 bg-border-default'
              }`}
              aria-label={`Step ${i + 1}`}
            />
          ))}
        </div>

        {/* Icon */}
        <div className="text-center text-5xl mb-4 select-none" aria-hidden>{step.icon}</div>

        {/* Counter */}
        <p className="text-center text-text-muted text-xs uppercase tracking-wider mb-2">
          {t.onb_step_of_fmt.replace('{current}', String(stepIdx + 1)).replace('{total}', String(STEPS.length))}
        </p>

        {/* Title */}
        <h2 className="text-center text-text-primary text-xl font-bold mb-3">{t[step.title]}</h2>

        {/* Body */}
        <p className="text-center text-text-secondary text-sm leading-relaxed mb-4 px-2">{t[step.body]}</p>

        {/* Tip box */}
        {step.tip && (
          <div className="bg-accent-amber/10 border border-accent-amber/30 rounded-lg px-4 py-2.5 mb-5 text-xs text-accent-amber text-center">
            💡 {t[step.tip]}
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-xs uppercase tracking-wider px-3 py-2">
            {t.onb_skip}
          </button>
          <div className="flex-1" />
          {!isFirst && (
            <button
              onClick={() => setStepIdx(stepIdx - 1)}
              className="px-4 py-2 rounded border border-border-default text-text-secondary hover:bg-bg-card hover:text-text-primary text-sm font-bold uppercase tracking-wider transition-colors"
            >
              {t.onb_prev}
            </button>
          )}
          {isLast ? (
            <button
              onClick={onClose}
              className="px-5 py-2 rounded bg-accent-green hover:bg-green-600 text-white text-sm font-bold uppercase tracking-wider transition-colors"
            >
              {t.onb_start_playing}
            </button>
          ) : (
            <button
              onClick={() => setStepIdx(stepIdx + 1)}
              className="px-5 py-2 rounded bg-accent-red hover:bg-red-600 text-white text-sm font-bold uppercase tracking-wider transition-colors"
            >
              {t.onb_next}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
