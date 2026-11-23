import React, { useEffect, useRef } from 'react';
import { Castle2DEngine, EngineCallbacks } from '../game2d/Castle2DEngine';
import { FloatingCombatPopup, GameState } from '../types/game';

interface CastleCanvasProps {
  stateRef: React.MutableRefObject<GameState>;
  engineRef: React.MutableRefObject<Castle2DEngine | null>;
  onStateSync: EngineCallbacks['onStateSync'];
  onPopup: EngineCallbacks['onPopup'];
  onSelectSlot: EngineCallbacks['onSelectSlot'];
  popups: FloatingCombatPopup[];
}

export const CastleCanvas: React.FC<CastleCanvasProps> = ({
  stateRef,
  engineRef,
  onStateSync,
  onPopup,
  onSelectSlot,
  popups,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const callbacksRef = useRef({ onStateSync, onPopup, onSelectSlot });
  callbacksRef.current = { onStateSync, onPopup, onSelectSlot };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new Castle2DEngine(canvas, stateRef, {
      onStateSync: (updater) => callbacksRef.current.onStateSync(updater),
      onPopup: (popup) => callbacksRef.current.onPopup(popup),
      onSelectSlot: (slotIndex) => callbacksRef.current.onSelectSlot(slotIndex),
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [engineRef, stateRef]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0f172a]">
      <canvas ref={canvasRef} className="block w-full h-full cursor-crosshair" />

      {/* Floating Combat Popups */}
      <div className="pointer-events-none fixed inset-0 z-10 overflow-hidden">
        {popups.map((p) => {
          const toneClass =
            p.tone === 'gold'
              ? 'text-amber-300 font-bold text-xs sm:text-sm'
              : p.tone === 'crit'
                ? 'text-rose-400 font-extrabold text-sm sm:text-base'
                : p.tone === 'heal'
                  ? 'text-emerald-300 font-bold text-xs sm:text-sm'
                  : 'text-slate-100 font-semibold text-xs';
          return (
            <div
              key={p.id}
              className={`floating-combat-text absolute font-mono-num drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] ${toneClass}`}
              style={{ left: `${p.x}px`, top: `${p.y}px` }}
            >
              {p.text}
            </div>
          );
        })}
      </div>
    </div>
  );
};
