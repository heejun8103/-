import { useCallback, useEffect, useRef, useState } from 'react';
import { CastleCanvas } from './components/CastleCanvas';
import { TopHud } from './components/TopHud';
import { BottomDock, DockTab } from './components/BottomDock';
import { HelpModal } from './components/HelpModal';
import { Castle2DEngine } from './game2d/Castle2DEngine';
import { soundEngine } from './audio/soundEngine';
import {
  createInitialGameState,
  DEFENDER_CATALOG,
  DefenderClass,
  FloatingCombatPopup,
  GameState,
  getCastleMaxHp,
  getCastleUpgradeCost,
  getDefenderUpgradeCost,
  getGateBallistaCost,
  getGoldMineCost,
  getManaShrineCost,
  getPetUpgradeCost,
  getResearchCost,
  PET_CATALOG,
  PetType,
  ResearchId,
  SkillId,
} from './types/game';

const STORAGE_KEY = 'bastion_crown_2d_save_v1';

function loadSavedState(): GameState {
  const initial = createInitialGameState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('bastion_crown_3d_save_v1');
    if (!raw) return initial;
    const parsed = JSON.parse(raw) as Partial<GameState>;
    const legacyMap: Record<string, DefenderClass> = {
      ballista: 'frostmage',
      obelisk: 'stormmage',
      cannon: 'summoner',
    };
    const rawSlots =
      Array.isArray(parsed.slots) && parsed.slots.length === 6 ? parsed.slots : initial.slots;
    const migratedSlots = rawSlots.map((slot) => ({
      ...slot,
      unitClass: slot.unitClass
        ? (legacyMap[slot.unitClass as string] ?? slot.unitClass)
        : null,
    }));

    const rawPetSlots =
      Array.isArray(parsed.petSlots) && parsed.petSlots.length === 2
        ? parsed.petSlots
        : initial.petSlots;

    const merged: GameState = {
      ...initial,
      ...parsed,
      slots: migratedSlots,
      petSlots: rawPetSlots,
      research: { ...initial.research, ...(parsed.research || {}) },
      stats: { ...initial.stats, ...(parsed.stats || {}) },
      waveActive: false,
      waveEnemiesRemaining: 0,
      waveEnemiesTotal: 0,
      isBossWave: false,
      skillCooldowns: { meteor: 0, volley: 0, fortify: 0 },
      rallyBuffRemaining: 0,
      lastOutcome: null,
    };
    const maxHp = getCastleMaxHp(merged.castleLevel, merged.research.castleArmor);
    merged.castleMaxHp = maxHp;
    merged.castleHp = maxHp;
    return merged;
  } catch {
    return initial;
  }
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>(() => loadSavedState());
  const stateRef = useRef<GameState>(gameState);
  stateRef.current = gameState;

  const engineRef = useRef<Castle2DEngine | null>(null);
  const popupIdRef = useRef(1);

  const [popups, setPopups] = useState<FloatingCombatPopup[]>([]);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<DockTab>('castle');
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [selectedPetSlot, setSelectedPetSlot] = useState(0);
  const [muted, setMuted] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stateRef.current));
      } catch {
        // Ignore storage quota errors
      }
    }, 2500);
    return () => window.clearInterval(timer);
  }, []);

  const handlePopup = useCallback((popup: Omit<FloatingCombatPopup, 'id'>) => {
    const id = popupIdRef.current++;
    setPopups((prev) => [...prev.slice(-18), { ...popup, id }]);
    window.setTimeout(() => {
      setPopups((prev) => prev.filter((item) => item.id !== id));
    }, 860);
  }, []);

  const handleSelectSlotFromScene = useCallback((slotIndex: number) => {
    if (slotIndex >= 100) {
      setSelectedPetSlot(slotIndex - 100);
      setActiveTab('pets');
      setDockCollapsed(false);
      return;
    }
    setSelectedSlot(slotIndex);
    setActiveTab('defenders');
    setDockCollapsed(false);
  }, []);

  const handleStartWave = useCallback(() => {
    engineRef.current?.startWave();
  }, []);

  const handleTriggerSkill = useCallback((skillId: SkillId) => {
    engineRef.current?.triggerSkill(skillId);
  }, []);

  const handleUpgradeCastle = useCallback(() => {
    setGameState((prev) => {
      const cost = getCastleUpgradeCost(prev.castleLevel);
      if (prev.gold < cost) return prev;
      const nextLv = prev.castleLevel + 1;
      const nextMaxHp = getCastleMaxHp(nextLv, prev.research.castleArmor);
      const hpDiff = nextMaxHp - prev.castleMaxHp;
      soundEngine.playUpgrade();
      return {
        ...prev,
        gold: prev.gold - cost,
        castleLevel: nextLv,
        castleMaxHp: nextMaxHp,
        castleHp: Math.min(nextMaxHp, prev.castleHp + hpDiff + Math.round(nextMaxHp * 0.15)),
      };
    });
  }, []);

  const handleUpgradeGateBallista = useCallback(() => {
    setGameState((prev) => {
      const cost = getGateBallistaCost(prev.gateBallistaLevel);
      if (prev.gold < cost) return prev;
      soundEngine.playUpgrade();
      return {
        ...prev,
        gold: prev.gold - cost,
        gateBallistaLevel: prev.gateBallistaLevel + 1,
      };
    });
  }, []);

  const handleUpgradeGoldMine = useCallback(() => {
    setGameState((prev) => {
      const cost = getGoldMineCost(prev.goldMineLevel);
      if (prev.gold < cost) return prev;
      soundEngine.playUpgrade();
      return {
        ...prev,
        gold: prev.gold - cost,
        goldMineLevel: prev.goldMineLevel + 1,
      };
    });
  }, []);

  const handleUpgradeManaShrine = useCallback(() => {
    setGameState((prev) => {
      const cost = getManaShrineCost(prev.manaShrineLevel);
      if (prev.gold < cost) return prev;
      soundEngine.playUpgrade();
      return {
        ...prev,
        gold: prev.gold - cost,
        manaShrineLevel: prev.manaShrineLevel + 1,
        maxMana: prev.maxMana + 10,
      };
    });
  }, []);

  const handleAssignDefender = useCallback((slotIndex: number, unitClass: DefenderClass) => {
    setGameState((prev) => {
      const slot = prev.slots[slotIndex];
      if (!slot || prev.castleLevel < slot.unlockedAtCastleLevel) return prev;
      const cost = DEFENDER_CATALOG[unitClass].recruitCost;
      if (prev.gold < cost || slot.unitClass === unitClass) return prev;
      soundEngine.playUpgrade();
      const nextSlots = prev.slots.map((s) =>
        s.slotIndex === slotIndex ? { ...s, unitClass, level: 1 } : s,
      );
      return {
        ...prev,
        gold: prev.gold - cost,
        slots: nextSlots,
      };
    });
  }, []);

  const handleUpgradeDefender = useCallback((slotIndex: number) => {
    setGameState((prev) => {
      const slot = prev.slots[slotIndex];
      if (!slot || !slot.unitClass) return prev;
      const cost = getDefenderUpgradeCost(slot.unitClass, slot.level);
      if (prev.gold < cost) return prev;
      soundEngine.playUpgrade();
      const nextSlots = prev.slots.map((s) =>
        s.slotIndex === slotIndex ? { ...s, level: s.level + 1 } : s,
      );
      return {
        ...prev,
        gold: prev.gold - cost,
        slots: nextSlots,
      };
    });
  }, []);

  const handleUpgradeResearch = useCallback((id: ResearchId) => {
    setGameState((prev) => {
      const lv = prev.research[id];
      const cost = getResearchCost(id, lv);
      if (prev.gold < cost) return prev;
      soundEngine.playUpgrade();
      const nextResearch = { ...prev.research, [id]: lv + 1 };
      const nextMaxHp = getCastleMaxHp(prev.castleLevel, nextResearch.castleArmor);
      const hpDiff = nextMaxHp - prev.castleMaxHp;
      return {
        ...prev,
        gold: prev.gold - cost,
        research: nextResearch,
        castleMaxHp: nextMaxHp,
        castleHp: Math.min(nextMaxHp, prev.castleHp + Math.max(0, hpDiff)),
      };
    });
  }, []);

  const handleAssignPet = useCallback((petSlotIndex: number, petType: PetType) => {
    setGameState((prev) => {
      const slot = prev.petSlots[petSlotIndex];
      if (!slot || prev.castleLevel < slot.unlockedAtCastleLevel) return prev;
      const cost = PET_CATALOG[petType].recruitCost;
      if (prev.gold < cost || slot.petType === petType) return prev;
      soundEngine.playUpgrade();
      const nextPetSlots = prev.petSlots.map((s) =>
        s.slotIndex === petSlotIndex ? { ...s, petType, level: 1 } : s,
      );
      return {
        ...prev,
        gold: prev.gold - cost,
        petSlots: nextPetSlots,
      };
    });
  }, []);

  const handleUpgradePet = useCallback((petSlotIndex: number) => {
    setGameState((prev) => {
      const slot = prev.petSlots[petSlotIndex];
      if (!slot || !slot.petType) return prev;
      const cost = getPetUpgradeCost(slot.petType, slot.level);
      if (prev.gold < cost) return prev;
      soundEngine.playUpgrade();
      const nextPetSlots = prev.petSlots.map((s) =>
        s.slotIndex === petSlotIndex ? { ...s, level: s.level + 1 } : s,
      );
      return {
        ...prev,
        gold: prev.gold - cost,
        petSlots: nextPetSlots,
      };
    });
  }, []);

  const handleResetSave = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('bastion_crown_3d_save_v1');
    engineRef.current?.resetBattlefield();
    setGameState(createInitialGameState());
    setSelectedSlot(0);
    setSelectedPetSlot(0);
    setActiveTab('castle');
  }, []);

  const handleToggleSpeed = useCallback(() => {
    setGameState((prev) => ({ ...prev, gameSpeed: prev.gameSpeed === 1 ? 2 : 1 }));
  }, []);

  const handleToggleAutoWave = useCallback(() => {
    setGameState((prev) => ({ ...prev, autoWave: !prev.autoWave }));
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '1') engineRef.current?.triggerSkill('meteor');
      else if (e.key === '2') engineRef.current?.triggerSkill('volley');
      else if (e.key === '3') engineRef.current?.triggerSkill('fortify');
      else if (e.code === 'Space') {
        e.preventDefault();
        engineRef.current?.startWave();
      } else if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#0f172a]">
      <CastleCanvas
        stateRef={stateRef}
        engineRef={engineRef}
        onStateSync={setGameState}
        onPopup={handlePopup}
        onSelectSlot={handleSelectSlotFromScene}
        popups={popups}
      />

      <TopHud
        state={gameState}
        muted={muted}
        onToggleSpeed={handleToggleSpeed}
        onToggleAutoWave={handleToggleAutoWave}
        onToggleMute={handleToggleMute}
        onOpenHelp={() => setHelpOpen(true)}
      />

      {gameState.lastOutcome === 'defeat' && !gameState.waveActive && (
        <div className="pointer-events-none fixed top-20 left-1/2 -translate-x-1/2 z-20">
          <div className="hud-surface rounded-xl px-5 py-2.5 text-center border-rose-500/40">
            <span className="text-xs sm:text-sm font-semibold text-rose-300">
              성문이 돌파되어 웨이브 {gameState.wave} 재정비 중입니다 · 수비대와 성벽을 강화한 뒤 다시 도전하세요
            </span>
          </div>
        </div>
      )}

      <BottomDock
        state={gameState}
        collapsed={dockCollapsed}
        activeTab={activeTab}
        selectedSlot={selectedSlot}
        selectedPetSlot={selectedPetSlot}
        onToggleCollapse={() => setDockCollapsed((prev) => !prev)}
        onChangeTab={setActiveTab}
        onSelectSlot={(idx) => {
          setSelectedSlot(idx);
          engineRef.current?.setSelectedSlot(idx);
        }}
        onSelectPetSlot={(idx) => {
          setSelectedPetSlot(idx);
          engineRef.current?.setSelectedPetSlot(idx);
        }}
        onStartWave={handleStartWave}
        onTriggerSkill={handleTriggerSkill}
        onUpgradeCastle={handleUpgradeCastle}
        onUpgradeGateBallista={handleUpgradeGateBallista}
        onUpgradeGoldMine={handleUpgradeGoldMine}
        onUpgradeManaShrine={handleUpgradeManaShrine}
        onAssignDefender={handleAssignDefender}
        onUpgradeDefender={handleUpgradeDefender}
        onAssignPet={handleAssignPet}
        onUpgradePet={handleUpgradePet}
        onUpgradeResearch={handleUpgradeResearch}
        onResetSave={handleResetSave}
      />

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </main>
  );
}
