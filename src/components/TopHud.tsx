import React from 'react';
import {
  FastForward,
  HelpCircle,
  Pause,
  Play,
  Shield,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { GameState } from '../types/game';

interface TopHudProps {
  state: GameState;
  muted: boolean;
  onToggleSpeed: () => void;
  onToggleAutoWave: () => void;
  onToggleMute: () => void;
  onOpenHelp: () => void;
}

export const TopHud: React.FC<TopHudProps> = ({
  state,
  muted,
  onToggleSpeed,
  onToggleAutoWave,
  onToggleMute,
  onOpenHelp,
}) => {
  const hpPct = Math.max(0, Math.min(100, (state.castleHp / Math.max(1, state.castleMaxHp)) * 100));
  const manaPct = Math.max(0, Math.min(100, (state.mana / Math.max(1, state.maxMana)) * 100));

  return (
    <header className="pointer-events-none fixed top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-3">
      {/* Left: Brand + Core Vitality & Economy */}
      <div className="pointer-events-auto hud-surface flex flex-wrap items-center gap-4 rounded-xl px-4 py-2.5">
        <div className="flex items-baseline gap-2.5 pr-3 border-r border-slate-700/70">
          <h1 className="font-display text-base sm:text-lg font-bold tracking-wide text-amber-300 whitespace-nowrap">
            바스티온 크라운
          </h1>
          <span className="text-xs text-slate-400 font-mono-num whitespace-nowrap">
            성채 Lv.{state.castleLevel}
          </span>
        </div>

        {/* Wave & Enemies */}
        <div className="flex items-center gap-2 text-xs sm:text-sm pr-3 border-r border-slate-700/70 whitespace-nowrap">
          <span className="text-slate-400">웨이브</span>
          <span className="font-mono-num font-bold text-slate-100">{state.wave}</span>
          {state.waveActive ? (
            <>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className={state.isBossWave ? 'text-rose-400 font-semibold' : 'text-amber-300'}>
                {state.isBossWave ? '보스 출현' : '전투 중'} ({state.waveEnemiesRemaining}/{state.waveEnemiesTotal})
              </span>
            </>
          ) : (
            <>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-slate-400">정비 대기</span>
            </>
          )}
        </div>

        {/* Castle HP */}
        <div className="flex items-center gap-2.5 pr-3 border-r border-slate-700/70">
          <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="w-28 sm:w-32">
            <div className="flex items-center justify-between text-[11px] leading-none mb-1">
              <span className="text-slate-400">성벽 체력</span>
              <span className="font-mono-num font-semibold text-slate-100">
                {Math.ceil(state.castleHp)}/{state.castleMaxHp}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-sm bg-slate-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-150 ${
                  hpPct > 50 ? 'bg-emerald-500' : hpPct > 25 ? 'bg-amber-500' : 'bg-rose-500'
                }`}
                style={{ width: `${hpPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Gold & Mana */}
        <div className="flex items-center gap-4 text-xs sm:text-sm whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            <span className="text-amber-400 font-medium">금화</span>
            <span className="font-mono-num font-bold text-amber-200">
              {Math.floor(state.gold).toLocaleString()}
            </span>
          </div>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <div className="flex items-center gap-2">
            <span className="text-sky-400 font-medium">마나</span>
            <div className="w-16 h-1.5 rounded-sm bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-sky-400 transition-all duration-150"
                style={{ width: `${manaPct}%` }}
              />
            </div>
            <span className="font-mono-num font-semibold text-sky-200">
              {Math.floor(state.mana)}
            </span>
          </div>
        </div>
      </div>

      {/* Right: Simulation Controls */}
      <div className="pointer-events-auto hud-surface flex items-center gap-1.5 rounded-xl px-2.5 py-1.5">
        <button
          type="button"
          onClick={onToggleSpeed}
          title="전투 배속 전환"
          className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-mono-num font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            state.gameSpeed === 2
              ? 'bg-sky-500/20 text-sky-300 border border-sky-400/40'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          <FastForward className="w-3.5 h-3.5" />
          {state.gameSpeed}x
        </button>

        <button
          type="button"
          onClick={onToggleAutoWave}
          title="자동 다음 웨이브"
          className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            state.autoWave
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          {state.autoWave ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          자동 진행
        </button>

        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? '효과음 켜기' : '효과음 끄기'}
          title={muted ? '효과음 켜기' : '효과음 끄기'}
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={onOpenHelp}
          aria-label="조작법 안내"
          title="조작법 안내"
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
