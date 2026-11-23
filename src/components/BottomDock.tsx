import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Coins,
  Crosshair,
  Crown,
  Flame,
  Hammer,
  PawPrint,
  RotateCcw,
  Shield,
  ShieldPlus,
  Sparkles,
  Swords,
  Zap,
} from 'lucide-react';
import {
  DEFENDER_CATALOG,
  DefenderCategory,
  DefenderClass,
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
  RESEARCH_CATALOG,
  ResearchId,
  SKILL_CATALOG,
  SkillId,
} from '../types/game';

export type DockTab = 'castle' | 'defenders' | 'pets' | 'research';

interface BottomDockProps {
  state: GameState;
  collapsed: boolean;
  activeTab: DockTab;
  selectedSlot: number;
  selectedPetSlot: number;
  onToggleCollapse: () => void;
  onChangeTab: (tab: DockTab) => void;
  onSelectSlot: (slotIndex: number) => void;
  onSelectPetSlot: (petSlotIndex: number) => void;
  onStartWave: () => void;
  onTriggerSkill: (skillId: SkillId) => void;
  onUpgradeCastle: () => void;
  onUpgradeGateBallista: () => void;
  onUpgradeGoldMine: () => void;
  onUpgradeManaShrine: () => void;
  onAssignDefender: (slotIndex: number, unitClass: DefenderClass) => void;
  onUpgradeDefender: (slotIndex: number) => void;
  onAssignPet: (petSlotIndex: number, petType: PetType) => void;
  onUpgradePet: (petSlotIndex: number) => void;
  onUpgradeResearch: (id: ResearchId) => void;
  onResetSave: () => void;
}

export const BottomDock: React.FC<BottomDockProps> = ({
  state,
  collapsed,
  activeTab,
  selectedSlot,
  selectedPetSlot,
  onToggleCollapse,
  onChangeTab,
  onSelectSlot,
  onSelectPetSlot,
  onStartWave,
  onTriggerSkill,
  onUpgradeCastle,
  onUpgradeGateBallista,
  onUpgradeGoldMine,
  onUpgradeManaShrine,
  onAssignDefender,
  onUpgradeDefender,
  onAssignPet,
  onUpgradePet,
  onUpgradeResearch,
  onResetSave,
}) => {
  const [confirmReset, setConfirmReset] = useState(false);
  const [defenderFilter, setDefenderFilter] = useState<'all' | DefenderCategory>('all');

  const castleCost = getCastleUpgradeCost(state.castleLevel);
  const nextCastleHp = getCastleMaxHp(state.castleLevel + 1, state.research.castleArmor);
  const ballistaCost = getGateBallistaCost(state.gateBallistaLevel);
  const mineCost = getGoldMineCost(state.goldMineLevel);
  const shrineCost = getManaShrineCost(state.manaShrineLevel);

  const activeSlot = state.slots[selectedSlot] || state.slots[0];
  const slotUnlocked = state.castleLevel >= activeSlot.unlockedAtCastleLevel;
  const activeUnitMeta = activeSlot.unitClass ? DEFENDER_CATALOG[activeSlot.unitClass] : null;
  const activeUnitUpgradeCost = activeSlot.unitClass
    ? getDefenderUpgradeCost(activeSlot.unitClass, activeSlot.level)
    : 0;

  const activePetSlot = state.petSlots[selectedPetSlot] || state.petSlots[0];
  const petSlotUnlocked = state.castleLevel >= activePetSlot.unlockedAtCastleLevel;
  const activePetMeta = activePetSlot.petType ? PET_CATALOG[activePetSlot.petType] : null;
  const activePetUpgradeCost = activePetSlot.petType
    ? getPetUpgradeCost(activePetSlot.petType, activePetSlot.level)
    : 0;

  return (
    <div
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-20 w-[94vw] max-w-[940px] transition-transform duration-200 ease-out ${
        collapsed ? 'translate-y-[calc(100%-36px)]' : 'translate-y-0'
      }`}
    >
      {/* Collapse / Expand Handle + Outcome Notice */}
      <div className="flex items-center justify-center gap-3 mb-1.5">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="hud-surface flex items-center gap-1.5 px-3.5 py-1 rounded-t-lg text-xs font-medium text-slate-200 hover:text-amber-300 transition-colors cursor-pointer"
        >
          {collapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {collapsed ? '컨트롤 열기 (H)' : '컨트롤 숨기기 (H)'}
        </button>

        {state.rallyBuffRemaining > 0 && (
          <div className="hud-surface px-3 py-1 rounded-t-lg text-xs font-medium text-amber-300">
            격려 오라 활성 · 공속 +80% ({state.rallyBuffRemaining.toFixed(1)}초)
          </div>
        )}
      </div>

      {/* Main Dock Panel */}
      <div className="hud-surface rounded-2xl p-3 sm:p-4">
        {/* Top Row inside Dock: Tabs + Primary Battle CTA */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-700/60">
          <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => onChangeTab('castle')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'castle'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              성채 · 전투
            </button>
            <button
              type="button"
              onClick={() => onChangeTab('defenders')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'defenders'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              수비대 배치 ({state.slots.filter((s) => s.unitClass !== null).length}/6)
            </button>
            <button
              type="button"
              onClick={() => onChangeTab('pets')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'pets'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              성 앞 펫 ({state.petSlots.filter((p) => p.petType !== null).length}/2)
            </button>
            <button
              type="button"
              onClick={() => onChangeTab('research')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'research'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              연구 · 기록
            </button>
          </div>

          {/* Primary Wave CTA */}
          <div className="flex items-center gap-2">
            {!state.waveActive ? (
              <button
                type="button"
                onClick={onStartWave}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Swords className="w-4 h-4" />
                웨이브 {state.wave} 시작 (Space)
              </button>
            ) : (
              <div className="flex items-center gap-3 px-4 py-1.5 rounded-lg bg-slate-900 border border-slate-700/70 text-xs">
                <span className="text-slate-400">남은 적</span>
                <span className="font-mono-num font-bold text-amber-300">
                  {state.waveEnemiesRemaining} / {state.waveEnemiesTotal}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Tab 1: Castle & Battle */}
        {activeTab === 'castle' && (
          <div className="space-y-3">
            {/* Active Tactical Skills */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {SKILL_CATALOG.map((skill) => {
                const cd = state.skillCooldowns[skill.id];
                const enoughMana = state.mana >= skill.manaCost;
                const ready = cd <= 0 && enoughMana;
                const Icon =
                  skill.id === 'meteor' ? Flame : skill.id === 'volley' ? Crosshair : ShieldPlus;

                return (
                  <button
                    key={skill.id}
                    type="button"
                    disabled={!ready}
                    onClick={() => onTriggerSkill(skill.id)}
                    className={`hud-subsurface flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-left transition-colors ${
                      ready
                        ? 'hover:border-amber-400/50 hover:bg-slate-800/90 cursor-pointer'
                        : 'opacity-55 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700/70 flex items-center justify-center shrink-0 text-amber-400">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-100 truncate">
                          <span>[{skill.hotkey}]</span>
                          <span>{skill.name}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">{skill.description}</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {cd > 0 ? (
                        <span className="font-mono-num text-xs font-bold text-rose-400">
                          {cd.toFixed(1)}s
                        </span>
                      ) : (
                        <span className="font-mono-num text-xs font-semibold text-sky-300">
                          {skill.manaCost} MP
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 4 Core Castle Facilities */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <FacilityCard
                title="성벽 증축"
                level={state.castleLevel}
                detail={`최대 HP ${state.castleMaxHp} → ${nextCastleHp}`}
                cost={castleCost}
                canAfford={state.gold >= castleCost}
                icon={<Hammer className="w-4 h-4 text-amber-300" />}
                onUpgrade={onUpgradeCastle}
              />
              <FacilityCard
                title="성문 대노포"
                level={state.gateBallistaLevel}
                detail={`공격력 ${15 + state.gateBallistaLevel * 7} · 자동 사격`}
                cost={ballistaCost}
                canAfford={state.gold >= ballistaCost}
                icon={<Crosshair className="w-4 h-4 text-emerald-300" />}
                onUpgrade={onUpgradeGateBallista}
              />
              <FacilityCard
                title="전리품 교역소"
                level={state.goldMineLevel}
                detail={`처치 금화 +${(state.goldMineLevel - 1) * 12}%`}
                cost={mineCost}
                canAfford={state.gold >= mineCost}
                icon={<Coins className="w-4 h-4 text-yellow-300" />}
                onUpgrade={onUpgradeGoldMine}
              />
              <FacilityCard
                title="마나 성소"
                level={state.manaShrineLevel}
                detail={`초당 +${(2 + state.manaShrineLevel * 1.5).toFixed(1)} 마나`}
                cost={shrineCost}
                canAfford={state.gold >= shrineCost}
                icon={<Sparkles className="w-4 h-4 text-sky-300" />}
                onUpgrade={onUpgradeManaShrine}
              />
            </div>
          </div>
        )}

        {/* Tab 2: Defenders Management (6 Slots) */}
        {activeTab === 'defenders' && (
          <div className="space-y-3">
            {/* 6 Slot Selector */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {state.slots.map((slot) => {
                const unlocked = state.castleLevel >= slot.unlockedAtCastleLevel;
                const isSelected = selectedSlot === slot.slotIndex;
                const meta = slot.unitClass ? DEFENDER_CATALOG[slot.unitClass] : null;
                return (
                  <button
                    key={slot.slotIndex}
                    type="button"
                    onClick={() => onSelectSlot(slot.slotIndex)}
                    className={`rounded-lg px-2.5 py-2 text-left transition-colors border cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-400 text-amber-200'
                        : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="text-[11px] text-slate-400 truncate">{slot.label}</div>
                    <div className="text-xs font-semibold truncate mt-0.5">
                      {!unlocked
                        ? `성채 Lv.${slot.unlockedAtCastleLevel}`
                        : meta
                          ? `${meta.name} Lv.${slot.level}`
                          : '빈 성벽 슬롯'}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Slot Action Area */}
            {!slotUnlocked ? (
              <div className="hud-subsurface rounded-xl p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-100">
                    {activeSlot.label} — 미해금 슬롯
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    성채 레벨 {activeSlot.unlockedAtCastleLevel}에 도달하면 성벽이 확장되며 수비대를 배치할 수 있습니다.
                  </div>
                </div>
                <button
                  type="button"
                  disabled={state.gold < castleCost}
                  onClick={onUpgradeCastle}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 ${
                    state.gold >= castleCost
                      ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 cursor-pointer'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  성벽 증축 ({castleCost.toLocaleString()}G)
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {activeUnitMeta && (
                  <div className="hud-subsurface rounded-xl px-3.5 py-2 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                        <span>{activeSlot.label}</span>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <span className="text-amber-300">
                          {activeUnitMeta.name} Lv.{activeSlot.level}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 truncate">
                        {activeUnitMeta.role} · 기본 피해{' '}
                        {Math.round(activeUnitMeta.baseDamage * (1 + (activeSlot.level - 1) * 0.28))} ·{' '}
                        사거리 {activeUnitMeta.range}m · {activeUnitMeta.description}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={state.gold < activeUnitUpgradeCost}
                      onClick={() => onUpgradeDefender(activeSlot.slotIndex)}
                      className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                        state.gold >= activeUnitUpgradeCost
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      유닛 강화 ({activeUnitUpgradeCost.toLocaleString()}G)
                    </button>
                  </div>
                )}

                {/* Category Filter Tabs */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-lg border border-slate-800">
                    {(
                      [
                        { id: 'all', label: '전체 (12)' },
                        { id: 'martial', label: '기사 · 궁수 (4)' },
                        { id: 'magic', label: '마법 · 소환 (4)' },
                        { id: 'god', label: '신화 · 신격 (4)' },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setDefenderFilter(tab.id)}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          defenderFilter === tab.id
                            ? 'bg-amber-500 text-slate-950'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {activeSlot.label}에 배치할 수비대를 선택하세요
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 max-h-[158px] overflow-y-auto pr-0.5">
                  {(Object.keys(DEFENDER_CATALOG) as DefenderClass[])
                    .filter((cls) => defenderFilter === 'all' || DEFENDER_CATALOG[cls].category === defenderFilter)
                    .map((cls) => {
                      const meta = DEFENDER_CATALOG[cls];
                      const isEquipped = activeSlot.unitClass === cls;
                      const canAfford = state.gold >= meta.recruitCost;
                      const CatIcon =
                        meta.category === 'god'
                          ? Crown
                          : meta.category === 'magic'
                            ? Sparkles
                            : Shield;
                      return (
                        <button
                          key={cls}
                          type="button"
                          title={meta.description}
                          disabled={isEquipped || !canAfford}
                          onClick={() => onAssignDefender(activeSlot.slotIndex, cls)}
                          className={`rounded-xl p-2 text-left border transition-colors ${
                            isEquipped
                              ? 'bg-amber-500/15 border-amber-400/70 text-amber-200 cursor-default'
                              : canAfford
                                ? 'bg-slate-900/90 border-slate-800 hover:border-slate-500 text-slate-100 cursor-pointer'
                                : 'bg-slate-900/50 border-slate-800/60 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-semibold truncate">{meta.name}</span>
                            <CatIcon
                              className="w-3.5 h-3.5 shrink-0"
                              style={{ color: meta.color }}
                            />
                          </div>
                          <div className="text-[11px] text-slate-400 truncate mt-0.5">{meta.role}</div>
                          <div className="flex items-center justify-between gap-1 font-mono-num text-[11px] font-bold mt-1">
                            <span className="text-amber-300">
                              {isEquipped ? '배치됨' : `${meta.recruitCost}G`}
                            </span>
                            <span className="text-[10px] font-normal text-slate-400">
                              피해 {meta.baseDamage}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2.5: Castle Front Pets (2 Slots) */}
        {activeTab === 'pets' && (
          <div className="space-y-3">
            {/* 2 Pet Slots Selector */}
            <div className="grid grid-cols-2 gap-2">
              {state.petSlots.map((pSlot) => {
                const unlocked = state.castleLevel >= pSlot.unlockedAtCastleLevel;
                const isSelected = selectedPetSlot === pSlot.slotIndex;
                const meta = pSlot.petType ? PET_CATALOG[pSlot.petType] : null;
                return (
                  <button
                    key={pSlot.slotIndex}
                    type="button"
                    onClick={() => onSelectPetSlot(pSlot.slotIndex)}
                    className={`rounded-lg px-3 py-2 text-left transition-colors border cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-400 text-amber-200'
                        : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="text-[11px] text-slate-400 truncate">{pSlot.label}</div>
                    <div className="text-xs font-semibold truncate mt-0.5">
                      {!unlocked
                        ? `성채 Lv.${pSlot.unlockedAtCastleLevel} 해금`
                        : meta
                          ? `${meta.name} Lv.${pSlot.level}`
                          : '빈 펫 자리'}
                    </div>
                  </button>
                );
              })}
            </div>

            {!petSlotUnlocked ? (
              <div className="hud-subsurface rounded-xl p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-100">
                    {activePetSlot.label} — 미해금 자리
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    성채 레벨 {activePetSlot.unlockedAtCastleLevel}에 도달하면 성문 앞 두 번째 펫 자리가 열립니다.
                  </div>
                </div>
                <button
                  type="button"
                  disabled={state.gold < castleCost}
                  onClick={onUpgradeCastle}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 ${
                    state.gold >= castleCost
                      ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 cursor-pointer'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  성벽 증축 ({castleCost.toLocaleString()}G)
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {activePetMeta && (
                  <div className="hud-subsurface rounded-xl px-3.5 py-2 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                        <span>{activePetSlot.label}</span>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <span className="text-amber-300">
                          {activePetMeta.name} Lv.{activePetSlot.level}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 truncate">
                        {activePetMeta.role} · 기본 피해{' '}
                        {Math.round(activePetMeta.baseDamage * (1 + (activePetSlot.level - 1) * 0.28))} ·{' '}
                        {activePetMeta.description}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={state.gold < activePetUpgradeCost}
                      onClick={() => onUpgradePet(activePetSlot.slotIndex)}
                      className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                        state.gold >= activePetUpgradeCost
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      펫 강화 ({activePetUpgradeCost.toLocaleString()}G)
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
                  {(Object.keys(PET_CATALOG) as PetType[]).map((petId) => {
                    const meta = PET_CATALOG[petId];
                    const isEquipped = activePetSlot.petType === petId;
                    const canAfford = state.gold >= meta.recruitCost;
                    return (
                      <button
                        key={petId}
                        type="button"
                        title={meta.description}
                        disabled={isEquipped || !canAfford}
                        onClick={() => onAssignPet(activePetSlot.slotIndex, petId)}
                        className={`rounded-xl p-2 text-left border transition-colors ${
                          isEquipped
                            ? 'bg-amber-500/15 border-amber-400/70 text-amber-200 cursor-default'
                            : canAfford
                              ? 'bg-slate-900/90 border-slate-800 hover:border-slate-500 text-slate-100 cursor-pointer'
                              : 'bg-slate-900/50 border-slate-800/60 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-semibold truncate">{meta.name}</span>
                          <PawPrint className="w-3.5 h-3.5 shrink-0" style={{ color: meta.color }} />
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">{meta.role}</div>
                        <div className="flex items-center justify-between gap-1 font-mono-num text-[11px] font-bold mt-1">
                          <span className="text-amber-300">
                            {isEquipped ? '동행 중' : `${meta.recruitCost}G`}
                          </span>
                          <span className="text-[10px] font-normal text-slate-400">
                            피해 {meta.baseDamage}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Research & Stats */}
        {activeTab === 'research' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {RESEARCH_CATALOG.map((item) => {
                const lv = state.research[item.id];
                const cost = getResearchCost(item.id, lv);
                const canAfford = state.gold >= cost;
                return (
                  <div
                    key={item.id}
                    className="hud-subsurface rounded-xl p-3 flex flex-col justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-100">
                        <span className="flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-sky-400" />
                          {item.name}
                        </span>
                        <span className="font-mono-num text-amber-300">Lv.{lv}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                        {item.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={!canAfford}
                      onClick={() => onUpgradeResearch(item.id)}
                      className={`w-full py-1.5 rounded-lg text-xs font-semibold font-mono-num transition-colors ${
                        canAfford
                          ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 cursor-pointer'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {item.bonusPerLevel} · {cost.toLocaleString()}G
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs text-slate-400">
              <div className="flex flex-wrap items-center gap-3 font-mono-num">
                <span>최고 웨이브 {state.stats.highestWave}</span>
                <span aria-hidden="true">·</span>
                <span>총 처치 {state.stats.totalKills.toLocaleString()}</span>
                <span aria-hidden="true">·</span>
                <span>누적 금화 {Math.floor(state.stats.totalGoldEarned).toLocaleString()}G</span>
                <span aria-hidden="true">·</span>
                <span>천벌 클릭 {state.stats.smiteClicks.toLocaleString()}회</span>
              </div>

              {!confirmReset ? (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-slate-400 hover:text-rose-300 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  진행 초기화
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-rose-300">초기화할까요?</span>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmReset(false);
                      onResetSave();
                    }}
                    className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold cursor-pointer"
                  >
                    확인
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                  >
                    취소
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface FacilityCardProps {
  title: string;
  level: number;
  detail: string;
  cost: number;
  canAfford: boolean;
  icon: React.ReactNode;
  onUpgrade: () => void;
}

const FacilityCard: React.FC<FacilityCardProps> = ({
  title,
  level,
  detail,
  cost,
  canAfford,
  icon,
  onUpgrade,
}) => (
  <button
    type="button"
    disabled={!canAfford}
    onClick={onUpgrade}
    className={`hud-subsurface rounded-xl px-3 py-2 text-left transition-colors flex flex-col justify-between gap-1.5 ${
      canAfford
        ? 'hover:border-amber-400/50 hover:bg-slate-800/90 cursor-pointer'
        : 'opacity-55 cursor-not-allowed'
    }`}
  >
    <div className="flex items-center justify-between gap-2 w-full">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-100 truncate">
        {icon}
        {title}
      </span>
      <span className="font-mono-num text-[11px] font-bold text-slate-300 shrink-0">
        Lv.{level}
      </span>
    </div>
    <div className="flex items-center justify-between gap-2 w-full">
      <span className="text-[11px] text-slate-400 truncate">{detail}</span>
      <span className="font-mono-num text-xs font-bold text-amber-300 shrink-0">
        {cost.toLocaleString()}G
      </span>
    </div>
  </button>
);
