export type DefenderCategory = 'martial' | 'magic' | 'god';

export type DefenderClass =
  | 'archer'
  | 'paladin'
  | 'darkknight'
  | 'lancer'
  | 'pyromancer'
  | 'frostmage'
  | 'stormmage'
  | 'summoner'
  | 'zeus'
  | 'poseidon'
  | 'athena'
  | 'ra';

export type EnemyType = 'goblin' | 'orc' | 'golem' | 'wyvern' | 'boss';

export type CameraPreset = 'tactical' | 'gate' | 'aerial' | 'flank';

export type SkillId = 'meteor' | 'volley' | 'fortify';

export type ResearchId = 'arrowPower' | 'magicAmp' | 'goldPlunder' | 'castleArmor';

export type PetType = 'puppy' | 'slimeking' | 'worm' | 'dragon' | 'phoenix' | 'cerberus';

export interface PetSlot {
  slotIndex: number;
  label: string;
  unlockedAtCastleLevel: number;
  petType: PetType | null;
  level: number;
}

export interface DefenderSlot {
  slotIndex: number;
  label: string;
  unlockedAtCastleLevel: number;
  unitClass: DefenderClass | null;
  level: number;
}

export interface ResearchLevels {
  arrowPower: number;
  magicAmp: number;
  goldPlunder: number;
  castleArmor: number;
}

export interface GameStats {
  totalKills: number;
  totalGoldEarned: number;
  wavesCleared: number;
  highestWave: number;
  smiteClicks: number;
}

export interface GameState {
  gold: number;
  mana: number;
  maxMana: number;
  wave: number;
  castleLevel: number;
  castleHp: number;
  castleMaxHp: number;
  gateBallistaLevel: number;
  goldMineLevel: number;
  manaShrineLevel: number;
  slots: DefenderSlot[];
  petSlots: PetSlot[];
  research: ResearchLevels;
  stats: GameStats;
  autoWave: boolean;
  gameSpeed: 1 | 2;
  waveActive: boolean;
  waveEnemiesRemaining: number;
  waveEnemiesTotal: number;
  isBossWave: boolean;
  skillCooldowns: Record<SkillId, number>;
  rallyBuffRemaining: number;
  lastOutcome: 'victory' | 'defeat' | null;
}

export interface FloatingCombatPopup {
  id: number;
  x: number;
  y: number;
  text: string;
  tone: 'damage' | 'crit' | 'gold' | 'heal' | 'skill';
}

export interface DefenderMeta {
  id: DefenderClass;
  category: DefenderCategory;
  name: string;
  role: string;
  recruitCost: number;
  baseDamage: number;
  attackInterval: number; // seconds
  range: number;
  color: string;
  description: string;
}

export const DEFENDER_CATALOG: Record<DefenderClass, DefenderMeta> = {
  archer: {
    id: 'archer',
    category: 'martial',
    name: '왕국 궁수',
    role: '고속 단일 사격',
    recruitCost: 90,
    baseDamage: 18,
    attackInterval: 0.72,
    range: 28,
    color: '#22c55e',
    description: '빠른 연사 속도로 지상과 공중의 적을 정확히 요격합니다.',
  },
  paladin: {
    id: 'paladin',
    category: 'martial',
    name: '성벽 성기사',
    role: '신성 충격파 · 둔화',
    recruitCost: 140,
    baseDamage: 26,
    attackInterval: 1.25,
    range: 16,
    color: '#60a5fa',
    description: '성문 앞 적들에게 신성 충격파를 날려 이동 속도를 늦춥니다.',
  },
  darkknight: {
    id: 'darkknight',
    category: 'martial',
    name: '칠흑 기사',
    role: '검기 참격 · 관통',
    recruitCost: 185,
    baseDamage: 34,
    attackInterval: 1.35,
    range: 25,
    color: '#f43f5e',
    description: '거대한 대검을 휘둘러 최대 4명의 적을 관통하는 붉은 검기를 날립니다.',
  },
  lancer: {
    id: 'lancer',
    category: 'martial',
    name: '용기병 기사',
    role: '용창 투척 · 치명/넉백',
    recruitCost: 210,
    baseDamage: 42,
    attackInterval: 1.15,
    range: 27,
    color: '#2dd4bf',
    description: '강력한 용창을 던져 높은 치명타 확률로 적을 꿰뚫고 뒤로 밀쳐냅니다.',
  },
  pyromancer: {
    id: 'pyromancer',
    category: 'magic',
    name: '화염 술사',
    role: '광역 폭발 마법',
    recruitCost: 150,
    baseDamage: 28,
    attackInterval: 1.55,
    range: 26,
    color: '#f97316',
    description: '착탄 지점 주변 적들에게 화염 폭발 피해를 입힙니다.',
  },
  frostmage: {
    id: 'frostmage',
    category: 'magic',
    name: '빙결 마법사',
    role: '냉기 파편 · 광역 둔화',
    recruitCost: 165,
    baseDamage: 25,
    attackInterval: 1.45,
    range: 28,
    color: '#38bdf8',
    description: '차가운 얼음 결정을 날려 범위 내 적들을 얼리고 이동 속도를 늦춥니다.',
  },
  stormmage: {
    id: 'stormmage',
    category: 'magic',
    name: '번개 대마법사',
    role: '연쇄 감전 (3체)',
    recruitCost: 220,
    baseDamage: 32,
    attackInterval: 1.35,
    range: 27,
    color: '#a78bfa',
    description: '최대 3명의 적에게 연쇄적으로 번개 마법을 튕겨 공격합니다.',
  },
  summoner: {
    id: 'summoner',
    category: 'magic',
    name: '정령 소환사',
    role: '숲 정령 소환 · 돌진',
    recruitCost: 240,
    baseDamage: 36,
    attackInterval: 2.3,
    range: 30,
    color: '#34d399',
    description: '귀여운 숲의 정령을 전장에 소환해 적들과 직접 맞서 싸우게 합니다.',
  },
  zeus: {
    id: 'zeus',
    category: 'god',
    name: '천둥신 제우스',
    role: '신벌 낙뢰 (4체) · 경직',
    recruitCost: 320,
    baseDamage: 48,
    attackInterval: 1.5,
    range: 32,
    color: '#fde047',
    description: '하늘에서 황금 번개를 내려쳐 최대 4명의 적을 강타하고 잠시 경직시킵니다.',
  },
  poseidon: {
    id: 'poseidon',
    category: 'god',
    name: '바다신 포세이돈',
    role: '해일 파도 · 광역 밀쳐내기',
    recruitCost: 310,
    baseDamage: 44,
    attackInterval: 1.65,
    range: 30,
    color: '#06b6d4',
    description: '삼지창으로 거대한 해일을 일으켜 적 무리를 휩쓸고 뒤로 밀쳐냅니다.',
  },
  athena: {
    id: 'athena',
    category: 'god',
    name: '전쟁여신 아테나',
    role: '성창 광선 · 아군 공속 +12%',
    recruitCost: 330,
    baseDamage: 38,
    attackInterval: 1.25,
    range: 30,
    color: '#fcd34d',
    description: '신성한 창 빛을 쏘며 배치된 수만큼 모든 수비대의 공격 속도를 12% 높입니다.',
  },
  ra: {
    id: 'ra',
    category: 'god',
    name: '태양신 라',
    role: '태양 섬광 · 초대형 광역',
    recruitCost: 350,
    baseDamage: 54,
    attackInterval: 1.75,
    range: 31,
    color: '#fb923c',
    description: '눈부신 태양 불꽃을 떨어뜨려 매우 넓은 범위의 적들을 불태웁니다.',
  },
};

export interface PetMeta {
  id: PetType;
  name: string;
  role: string;
  recruitCost: number;
  baseDamage: number;
  attackInterval: number;
  range: number;
  color: string;
  description: string;
}

export const PET_CATALOG: Record<PetType, PetMeta> = {
  puppy: {
    id: 'puppy',
    name: '황금 다이어울프',
    role: '근접 돌진 물기 · 처치 금화 +10%',
    recruitCost: 110,
    baseDamage: 20,
    attackInterval: 0.9,
    range: 18,
    color: '#fbbf24',
    description: '적에게 빠르게 달려들어 근거리에서 물어뜯고, 처치 금화를 10% 늘립니다.',
  },
  slimeking: {
    id: 'slimeking',
    name: '심연 패왕 슬라임',
    role: '근접 산성 강타 · 강력 둔화',
    recruitCost: 135,
    baseDamage: 22,
    attackInterval: 1.25,
    range: 20,
    color: '#38bdf8',
    description: '적 무리 앞까지 도약해 근접 산성 충격파를 일으켜 3초간 느리게 만듭니다.',
  },
  worm: {
    id: 'worm',
    name: '거대 데스웜',
    role: '땅굴 돌진 · 근접 암석 가시',
    recruitCost: 160,
    baseDamage: 30,
    attackInterval: 1.45,
    range: 22,
    color: '#84cc16',
    description: '땅속을 파고들어 적 바로 아래에서 암석 가시를 솟구치게 해 꿰뚫습니다.',
  },
  dragon: {
    id: 'dragon',
    name: '화염 패왕 드래곤',
    role: '비행 급강하 · 근접 화염 폭발',
    recruitCost: 230,
    baseDamage: 38,
    attackInterval: 1.35,
    range: 26,
    color: '#ef4444',
    description: '하늘을 날며 적 위를 선회하다 급강하해 근거리 화염 폭발을 일으킵니다.',
  },
  phoenix: {
    id: 'phoenix',
    name: '불멸의 대불사조',
    role: '비행 성염 타격 · 성벽 회복',
    recruitCost: 260,
    baseDamage: 34,
    attackInterval: 1.3,
    range: 27,
    color: '#fb923c',
    description: '창공을 가르며 날아들어 근접 성염 타격을 가하고 매 공격마다 성벽 체력을 회복시킵니다.',
  },
  cerberus: {
    id: 'cerberus',
    name: '지옥문장 케르베로스',
    role: '근접 3두 난타 · 동시 3체 타격',
    recruitCost: 290,
    baseDamage: 36,
    attackInterval: 1.2,
    range: 24,
    color: '#f43f5e',
    description: '전선으로 돌격해 세 개의 머리로 가까운 적 최대 3명을 동시에 물어뜯습니다.',
  },
};

export interface SkillMeta {
  id: SkillId;
  hotkey: string;
  name: string;
  manaCost: number;
  cooldown: number;
  description: string;
}

export const SKILL_CATALOG: SkillMeta[] = [
  {
    id: 'meteor',
    hotkey: '1',
    name: '운석 낙하',
    manaCost: 35,
    cooldown: 12,
    description: '전장에 5개의 불타는 운석을 떨어뜨려 광역 피해를 입힙니다.',
  },
  {
    id: 'volley',
    hotkey: '2',
    name: '화살 폭풍',
    manaCost: 25,
    cooldown: 9,
    description: '성벽에서 18발의 화살 비를 퍼부어 적 전열을 휩씁니다.',
  },
  {
    id: 'fortify',
    hotkey: '3',
    name: '수호와 격려',
    manaCost: 30,
    cooldown: 16,
    description: '성벽 체력 25% 즉시 회복 + 8초간 모든 수비대 공격속도 +80%',
  },
];

export interface ResearchMeta {
  id: ResearchId;
  name: string;
  description: string;
  baseCost: number;
  costScale: number;
  bonusPerLevel: string;
}

export const RESEARCH_CATALOG: ResearchMeta[] = [
  {
    id: 'arrowPower',
    name: '물리 탄도학',
    description: '궁수, 기사(성기사·칠흑·용기병), 성문 대노포 공격력 증가',
    baseCost: 140,
    costScale: 1.45,
    bonusPerLevel: '+12% / Lv',
  },
  {
    id: 'magicAmp',
    name: '비전 마력 증폭',
    description: '마법사, 소환사, 신(제우스·포세이돈·아테나·라), 스킬 위력 증가',
    baseCost: 150,
    costScale: 1.48,
    bonusPerLevel: '+14% / Lv',
  },
  {
    id: 'goldPlunder',
    name: '전리품 징수',
    description: '몬스터 처치 시 획득하는 금화량 증가',
    baseCost: 130,
    costScale: 1.42,
    bonusPerLevel: '+10% / Lv',
  },
  {
    id: 'castleArmor',
    name: '화강암 성벽 보강',
    description: '성채 최대 체력 추가 및 받는 피해 감소',
    baseCost: 160,
    costScale: 1.45,
    bonusPerLevel: '+10% HP / Lv',
  },
];

export const CAMERA_PRESETS: { id: CameraPreset; label: string }[] = [
  { id: 'tactical', label: '전술 뷰' },
  { id: 'gate', label: '성문 근접' },
  { id: 'aerial', label: '항공 뷰' },
  { id: 'flank', label: '측면 성채' },
];

export function getCastleUpgradeCost(level: number): number {
  return Math.round(120 * Math.pow(1.42, level - 1));
}

export function getCastleMaxHp(castleLevel: number, armorResearch: number): number {
  const base = 450 + (castleLevel - 1) * 180 + Math.pow(castleLevel - 1, 1.45) * 45;
  return Math.round(base * (1 + armorResearch * 0.1));
}

export function getGateBallistaCost(level: number): number {
  return Math.round(75 * Math.pow(1.36, level - 1));
}

export function getGoldMineCost(level: number): number {
  return Math.round(95 * Math.pow(1.38, level - 1));
}

export function getManaShrineCost(level: number): number {
  return Math.round(105 * Math.pow(1.38, level - 1));
}

export function getDefenderUpgradeCost(unitClass: DefenderClass, level: number): number {
  const base = DEFENDER_CATALOG[unitClass].recruitCost * 0.68;
  return Math.round(base * Math.pow(1.34, level - 1));
}

export function getPetUpgradeCost(petType: PetType, level: number): number {
  const base = PET_CATALOG[petType].recruitCost * 0.7;
  return Math.round(base * Math.pow(1.35, level - 1));
}

export function getResearchCost(id: ResearchId, currentLevel: number): number {
  const meta = RESEARCH_CATALOG.find((r) => r.id === id)!;
  return Math.round(meta.baseCost * Math.pow(meta.costScale, currentLevel));
}

export function createInitialGameState(): GameState {
  return {
    gold: 240,
    mana: 80,
    maxMana: 100,
    wave: 1,
    castleLevel: 1,
    castleHp: 450,
    castleMaxHp: 450,
    gateBallistaLevel: 1,
    goldMineLevel: 1,
    manaShrineLevel: 1,
    slots: [
      { slotIndex: 0, label: '좌측 망루', unlockedAtCastleLevel: 1, unitClass: 'archer', level: 1 },
      { slotIndex: 1, label: '우측 망루', unlockedAtCastleLevel: 1, unitClass: null, level: 1 },
      { slotIndex: 2, label: '성문 흉벽', unlockedAtCastleLevel: 2, unitClass: null, level: 1 },
      { slotIndex: 3, label: '본성 테라스', unlockedAtCastleLevel: 3, unitClass: null, level: 1 },
      { slotIndex: 4, label: '외성 좌익 보루', unlockedAtCastleLevel: 5, unitClass: null, level: 1 },
      { slotIndex: 5, label: '외성 우익 보루', unlockedAtCastleLevel: 7, unitClass: null, level: 1 },
    ],
    petSlots: [
      { slotIndex: 0, label: '성문 앞 1번 자리', unlockedAtCastleLevel: 1, petType: null, level: 1 },
      { slotIndex: 1, label: '성문 앞 2번 자리', unlockedAtCastleLevel: 2, petType: null, level: 1 },
    ],
    research: {
      arrowPower: 0,
      magicAmp: 0,
      goldPlunder: 0,
      castleArmor: 0,
    },
    stats: {
      totalKills: 0,
      totalGoldEarned: 0,
      wavesCleared: 0,
      highestWave: 1,
      smiteClicks: 0,
    },
    autoWave: false,
    gameSpeed: 1,
    waveActive: false,
    waveEnemiesRemaining: 0,
    waveEnemiesTotal: 0,
    isBossWave: false,
    skillCooldowns: {
      meteor: 0,
      volley: 0,
      fortify: 0,
    },
    rallyBuffRemaining: 0,
    lastOutcome: null,
  };
}
