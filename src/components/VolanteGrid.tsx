import React from 'react';
import { padDezena } from '../lib/lotteryMath';

export type VolanteNumberState = 'neutral' | 'fixed' | 'excluded' | 'selected' | 'matched';

interface VolanteGridProps {
  mode: 'fix-exclude' | 'select' | 'display';
  fixedNumbers?: number[];
  excludedNumbers?: number[];
  selectedNumbers?: number[];
  matchedNumbers?: number[];
  onToggleNumber?: (num: number) => void;
  compact?: boolean;
}

export const VolanteGrid: React.FC<VolanteGridProps> = ({
  mode,
  fixedNumbers = [],
  excludedNumbers = [],
  selectedNumbers = [],
  matchedNumbers = [],
  onToggleNumber,
  compact = false,
}) => {
  const fixedSet = new Set(fixedNumbers);
  const excludedSet = new Set(excludedNumbers);
  const selectedSet = new Set(selectedNumbers);
  const matchedSet = new Set(matchedNumbers);

  const getState = (num: number): VolanteNumberState => {
    if (matchedSet.has(num)) return 'matched';
    if (fixedSet.has(num)) return 'fixed';
    if (excludedSet.has(num)) return 'excluded';
    if (selectedSet.has(num)) return 'selected';
    return 'neutral';
  };

  return (
    <div
      className={`grid grid-cols-10 ${compact ? 'gap-1.5' : 'gap-2'} select-none`}
      role="group"
      aria-label="Volante Mega-Sena de 01 a 60"
    >
      {Array.from({ length: 60 }, (_, idx) => {
        const num = idx + 1;
        const state = getState(num);
        const isInteractive = mode !== 'display' && Boolean(onToggleNumber);

        let stateClasses =
          'bg-slate-100 dark:bg-[#162127] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-[#208494] hover:text-slate-900 dark:hover:text-white';

        if (state === 'fixed' || state === 'selected') {
          stateClasses =
            'bg-[#208494] text-white border-[#238B8B] shadow-sm font-semibold';
        } else if (state === 'excluded') {
          stateClasses =
            'bg-rose-50 dark:bg-rose-950/35 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60 line-through opacity-75';
        } else if (state === 'matched') {
          stateClasses =
            'bg-emerald-600 text-white border-emerald-500 font-semibold';
        }

        return (
          <button
            key={num}
            type="button"
            disabled={!isInteractive}
            onClick={() => isInteractive && onToggleNumber?.(num)}
            aria-pressed={state === 'fixed' || state === 'selected'}
            title={
              state === 'fixed'
                ? `Dezena ${padDezena(num)} (Fixa)`
                : state === 'excluded'
                  ? `Dezena ${padDezena(num)} (Excluída)`
                  : state === 'selected'
                    ? `Dezena ${padDezena(num)} (Selecionada)`
                    : `Dezena ${padDezena(num)}`
            }
            className={`font-mono tabular-nums border rounded-lg transition-colors duration-150 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#208494] ${
              compact ? 'h-8 text-xs' : 'h-10 sm:h-11 text-sm'
            } ${isInteractive ? 'cursor-pointer active:scale-95' : 'cursor-default'} ${stateClasses}`}
          >
            {padDezena(num)}
          </button>
        );
      })}
    </div>
  );
};
