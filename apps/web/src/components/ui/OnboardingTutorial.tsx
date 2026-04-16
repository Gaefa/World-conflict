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
}

const STEPS: Step[] = [
  { icon: '\u{1F30D}', title: 'onb_welcome_title', body: 'onb_welcome_body' },
  { icon: '\u{1F5FA}\uFE0F', title: 'onb_step_globe_title', body: 'onb_step_globe_body' },
  { icon: '\u{1F195}', title: 'onb_step_session_title', body: 'onb_step_session_body' },
  { icon: '\u23F1\uFE0F', title: 'onb_step_header_title', body: 'onb_step_header_body' },
  { icon: '\u{1F4CA}', title: 'onb_step_tabs_title', body: 'onb_step_tabs_body' },
  { icon: '\u{1F4B0}', title: 'onb_step_economy_title', body: 'onb_step_economy_body' },
  { icon: '\u2694\uFE0F', title: 'onb_step_military_title', body: 'onb_step_military_body' },
  { icon: '\u{1F91D}', title: 'onb_step_diplomacy_title', body: 'onb_step_diplomacy_body' },
  { icon: '\u{1F575}\uFE0F', title: 'onb_step_intel_title', body: 'onb_step_intel_body' },
  { icon: '\u{1F9EA}', title: 'onb_step_research_title', body: 'onb_step_research_body' },
  { icon: '\u{1F3DB}\uFE0F', title: 'onb_step_domestic_title', body: 'onb_step_domestic_body' },
  { icon: '\u{1F4F0}', title: 'onb_step_events_title', body: 'onb_step_events_body' },
  { icon: '\u{1F3C6}', title: 'onb_step_victory_title', body: 'onb_step_victory_body' },
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
        {/* Close (X) button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-text-muted hover:text-text-primary text-xl leading-none w-8 h-8 flex items-center justify-center rounded hover:bg-bg-card transition-colors"
          aria-label={t.onb_skip}
        >
          {'\u2715'}
        </button>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 mb-5">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStepIdx(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === stepIdx
                  ? 'w-8 bg-accent-red'
                  : i < stepIdx
                    ? 'w-1.5 bg-accent-red/60'
                    : 'w-1.5 bg-border-default'
              }`}
              aria-label={`Step ${i + 1}`}
            />
          ))}
        </div>

        {/* Icon */}
        <div className="text-center text-6xl mb-4 select-none" aria-hidden>
          {step.icon}
        </div>

        {/* Step counter */}
        <p className="text-center text-text-muted text-xs uppercase tracking-wider mb-2">
          {t.onb_step_of_fmt
            .replace('{current}', String(stepIdx + 1))
            .replace('{total}', String(STEPS.length))}
        </p>

        {/* Title */}
        <h2 className="text-center text-text-primary text-xl font-bold mb-3">
          {t[step.title]}
        </h2>

        {/* Body */}
        <p className="text-center text-text-secondary text-sm leading-relaxed mb-6 px-2">
          {t[step.body]}
        </p>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary text-xs uppercase tracking-wider px-3 py-2"
          >
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
