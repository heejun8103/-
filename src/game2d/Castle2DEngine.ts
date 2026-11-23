import {
  DEFENDER_CATALOG,
  DefenderClass,
  EnemyType,
  FloatingCombatPopup,
  GameState,
  PET_CATALOG,
  SkillId,
} from '../types/game';
import { soundEngine } from '../audio/soundEngine';

interface Enemy2D {
  id: number;
  type: EnemyType;
  hp: number;
  maxHp: number;
  x: number; // world X in virtual 1280x720 coords
  y: number; // world Y
  baseY: number;
  radius: number;
  speed: number;
  damage: number;
  attackCooldown: number;
  attackTimer: number;
  goldReward: number;
  slowTimer: number;
  hitFlashTimer: number;
  phase: number;
}

interface Projectile2D {
  kind:
    | 'arrow'
    | 'fireball'
    | 'frostshard'
    | 'meteor'
    | 'slash'
    | 'lance'
    | 'tidal'
    | 'sunflare'
    | 'divinebeam';
  x: number;
  y: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  targetEnemyId: number | null;
  progress: number;
  duration: number;
  arcHeight: number;
  damage: number;
  splashRadius: number;
  isCrit: boolean;
  angle: number;
  pierceLeft?: number;
  hitEnemyIds?: number[];
  knockback?: number;
}

interface Summon2D {
  x: number;
  y: number;
  damage: number;
  hitsLeft: number;
  attackCooldown: number;
  phase: number;
  life: number;
}

interface Particle2D {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  gravity: number;
}

interface LightningBolt2D {
  points: { x: number; y: number }[];
  color: string;
  life: number;
  maxLife: number;
  width: number;
}

interface Shockwave2D {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  life: number;
  maxLife: number;
}

interface PetRuntime2D {
  x: number;
  y: number;
  alt: number;
  facingRight: boolean;
  lastLeap: number;
}

interface PetSlash2D {
  x: number;
  y: number;
  color: string;
  life: number;
  maxLife: number;
  radius: number;
  facingRight: boolean;
}

export interface EngineCallbacks {
  onStateSync: (updater: (prev: GameState) => GameState) => void;
  onPopup: (popup: Omit<FloatingCombatPopup, 'id'>) => void;
  onSelectSlot: (slotIndex: number) => void;
}

// Virtual coordinate space (1280 x 720) scaled responsively to canvas
const VW = 1280;
const VH = 720;
const GROUND_Y = 486;
const GATE_STOP_X = 338;

// 6 Castle Slot Positions in Virtual 1280x720 space
const SLOT_POSITIONS: { x: number; y: number }[] = [
  { x: 112, y: 298 }, // 0: Left Watchtower
  { x: 256, y: 298 }, // 1: Right Watchtower
  { x: 162, y: 344 }, // 2: Left Gate Rampart
  { x: 210, y: 344 }, // 3: Right Gate Rampart
  { x: 70, y: 348 },  // 4: Outer Left Bastion
  { x: 296, y: 348 }, // 5: Outer Right Bastion
];

const SLOT_UNLOCK_LEVELS = [1, 1, 2, 3, 5, 7];

const PET_SLOT_POSITIONS: { x: number; y: number }[] = [
  { x: 356, y: 528 },
  { x: 424, y: 500 },
];
const PET_UNLOCK_LEVELS = [1, 2];

export class Castle2DEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private stateRef: { current: GameState };
  private callbacks: EngineCallbacks;

  private width = 1280;
  private height = 720;
  private dpr = 1;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;

  private enemies: Enemy2D[] = [];
  private summons: Summon2D[] = [];
  private projectiles: Projectile2D[] = [];
  private particles: Particle2D[] = [];
  private lightnings: LightningBolt2D[] = [];
  private shockwaves: Shockwave2D[] = [];

  private spawnQueue: { type: EnemyType; delay: number }[] = [];
  private spawnTimer = 0;
  private nextEnemyId = 1;

  private slotCooldowns: number[] = [0, 0, 0, 0, 0, 0];
  private slotAttackAnim: number[] = [0, 0, 0, 0, 0, 0];
  private petCooldowns: number[] = [0, 0];
  private petAttackAnim: number[] = [0, 0];
  private petRuntime: PetRuntime2D[] = PET_SLOT_POSITIONS.map((p) => ({
    x: p.x,
    y: p.y,
    alt: 0,
    facingRight: true,
    lastLeap: 0,
  }));
  private petSlashes: PetSlash2D[] = [];
  private gateBallistaCooldown = 0;
  private gateBallistaAngle = -0.15;

  private passiveIncomeTimer = 0;
  private autoWaveDelayTimer = 0;
  private shakeTime = 0;
  private shakeIntensity = 0;
  private elapsed = 0;
  private selectedSlot = 0;
  private selectedPetSlot = 0;

  private clouds: { x: number; y: number; w: number; speed: number }[] = [];
  private stars: { x: number; y: number; r: number; phase: number }[] = [];

  private rafId = 0;
  private lastTimestamp = 0;
  private disposed = false;

  constructor(
    canvas: HTMLCanvasElement,
    stateRef: { current: GameState },
    callbacks: EngineCallbacks,
  ) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('2D canvas context unavailable');
    }
    this.ctx = ctx;
    this.stateRef = stateRef;
    this.callbacks = callbacks;

    for (let i = 0; i < 6; i++) {
      this.clouds.push({
        x: (i * 260) % VW,
        y: 64 + (i % 3) * 42,
        w: 95 + (i % 4) * 26,
        speed: 8 + (i % 3) * 4,
      });
    }
    for (let i = 0; i < 36; i++) {
      this.stars.push({
        x: (i * 197 + 41) % VW,
        y: 26 + ((i * 89) % 190),
        r: 1 + (i % 2) * 0.7,
        phase: i * 0.9,
      });
    }

    this.resize();
    window.addEventListener('resize', this.resize);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);

    this.lastTimestamp = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  public setSelectedSlot(slotIndex: number): void {
    this.selectedSlot = slotIndex;
  }

  public setSelectedPetSlot(petSlotIndex: number): void {
    this.selectedPetSlot = petSlotIndex;
  }

  public startWave(): void {
    const state = this.stateRef.current;
    if (state.waveActive) return;

    const wave = state.wave;
    const isBossWave = wave % 5 === 0;
    const baseCount = 6 + Math.floor(wave * 1.85);
    const queue: { type: EnemyType; delay: number }[] = [];

    for (let i = 0; i < baseCount; i++) {
      let type: EnemyType = 'goblin';
      const roll = (i * 17 + wave * 7) % 10;
      if (wave >= 2 && roll >= 6) type = 'orc';
      if (wave >= 3 && roll >= 8) type = 'wyvern';
      if (wave >= 4 && i % 5 === 4) type = 'golem';
      queue.push({
        type,
        delay: Math.max(0.32, 1.15 - Math.min(0.65, wave * 0.045)),
      });
    }

    if (isBossWave) {
      queue.push({ type: 'boss', delay: 1.0 });
    }

    this.spawnQueue = queue;
    this.spawnTimer = 0.22;
    soundEngine.playWaveStart();

    this.callbacks.onStateSync((prev) => ({
      ...prev,
      waveActive: true,
      isBossWave,
      waveEnemiesTotal: queue.length,
      waveEnemiesRemaining: queue.length,
      lastOutcome: null,
    }));
  }

  public triggerSkill(skillId: SkillId): void {
    const state = this.stateRef.current;
    if (state.skillCooldowns[skillId] > 0) return;

    const manaCost = skillId === 'meteor' ? 35 : skillId === 'volley' ? 25 : 30;
    const cooldown = skillId === 'meteor' ? 12 : skillId === 'volley' ? 9 : 16;
    if (state.mana < manaCost) return;

    const magicMult = 1 + state.research.magicAmp * 0.14;

    if (skillId === 'meteor') {
      soundEngine.playMeteor();
      for (let i = 0; i < 5; i++) {
        const target = this.enemies.length > 0 ? this.enemies[i % this.enemies.length] : null;
        const tx = target ? target.x + (Math.random() - 0.5) * 45 : 520 + i * 145;
        const ty = target ? Math.min(GROUND_Y, target.y) : GROUND_Y;
        this.projectiles.push({
          kind: 'meteor',
          x: tx - 220,
          y: -120 - i * 50,
          startX: tx - 220,
          startY: -120 - i * 50,
          targetX: tx,
          targetY: ty,
          targetEnemyId: null,
          progress: -i * 0.14,
          duration: 0.42,
          arcHeight: 0,
          damage: Math.round((85 + state.castleLevel * 22) * magicMult),
          splashRadius: 115,
          isCrit: true,
          angle: 0.95,
        });
      }
      this.triggerShake(0.35, 9);
    } else if (skillId === 'volley') {
      soundEngine.playBow();
      const arrowMult = 1 + state.research.arrowPower * 0.12;
      for (let i = 0; i < 18; i++) {
        const target = this.enemies.length > 0 ? this.enemies[i % this.enemies.length] : null;
        const tx = target ? target.x + (Math.random() - 0.5) * 40 : 480 + (i % 6) * 120;
        const ty = target ? target.y : GROUND_Y - 12;
        const sx = 120 + (i % 6) * 32;
        const sy = 280 - (i % 3) * 24;
        this.projectiles.push({
          kind: 'arrow',
          x: sx,
          y: sy,
          startX: sx,
          startY: sy,
          targetX: tx,
          targetY: ty,
          targetEnemyId: target ? target.id : null,
          progress: -i * 0.03,
          duration: 0.5,
          arcHeight: 140 + (i % 4) * 22,
          damage: Math.round((28 + state.castleLevel * 8) * arrowMult),
          splashRadius: 48,
          isCrit: false,
          angle: 0,
        });
      }
    } else if (skillId === 'fortify') {
      soundEngine.playUpgrade();
      const healAmount = Math.round(state.castleMaxHp * 0.25);
      this.shockwaves.push({
        x: 200,
        y: GROUND_Y - 30,
        radius: 20,
        maxRadius: 230,
        color: '#fbbf24',
        life: 0.5,
        maxLife: 0.5,
      });
      this.emitPopup(200, 230, `+${healAmount} 수리 · 공속 +80%`, 'heal');
      this.callbacks.onStateSync((prev) => ({
        ...prev,
        mana: Math.max(0, prev.mana - manaCost),
        castleHp: Math.min(prev.castleMaxHp, prev.castleHp + healAmount),
        rallyBuffRemaining: 8,
        skillCooldowns: { ...prev.skillCooldowns, [skillId]: cooldown },
      }));
      return;
    }

    this.callbacks.onStateSync((prev) => ({
      ...prev,
      mana: Math.max(0, prev.mana - manaCost),
      skillCooldowns: { ...prev.skillCooldowns, [skillId]: cooldown },
    }));
  }

  public resetBattlefield(): void {
    this.enemies = [];
    this.summons = [];
    this.projectiles = [];
    this.particles = [];
    this.lightnings = [];
    this.shockwaves = [];
    this.petSlashes = [];
    this.spawnQueue = [];
    this.petRuntime.forEach((rt, idx) => {
      const home = PET_SLOT_POSITIONS[idx];
      const pType = this.stateRef.current.petSlots[idx]?.petType;
      const isFlying = pType === 'dragon' || pType === 'phoenix';
      rt.x = home.x;
      rt.y = home.y;
      rt.alt = isFlying ? 84 : 0;
      rt.facingRight = true;
      rt.lastLeap = 0;
    });
  }

  private triggerShake(duration: number, intensity: number): void {
    this.shakeTime = Math.max(this.shakeTime, duration);
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
  }

  private resize = (): void => {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const w = Math.max(1, parent.clientWidth);
    const h = Math.max(1, parent.clientHeight);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = w;
    this.height = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);

    // Cover-fit virtual 1280x720 keeping ground and castle cleanly centered/anchored
    const scaleX = w / VW;
    const scaleY = h / VH;
    this.scale = Math.max(scaleX, scaleY * 0.92);
    if (w < 900) {
      // On narrower viewports, ensure full horizontal battlefield (castle -> spawn) stays visible
      this.scale = Math.min(scaleX * 1.04, scaleY);
    }
    this.offsetX = (w - VW * this.scale) * 0.5;
    this.offsetY = (h - VH * this.scale) * 0.48;
  };

  private screenToVirtual(clientX: number, clientY: number): { vx: number; vy: number } {
    const rect = this.canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    return {
      vx: (sx - this.offsetX) / this.scale,
      vy: (sy - this.offsetY) / this.scale,
    };
  }

  private virtualToScreen(vx: number, vy: number): { x: number; y: number } {
    return {
      x: this.offsetX + vx * this.scale,
      y: this.offsetY + vy * this.scale,
    };
  }

  private emitPopup(
    vx: number,
    vy: number,
    text: string,
    tone: FloatingCombatPopup['tone'],
  ): void {
    const pos = this.virtualToScreen(vx, vy);
    this.callbacks.onPopup({ x: pos.x, y: pos.y, text, tone });
  }

  private onPointerDown = (e: PointerEvent): void => {
    const { vx, vy } = this.screenToVirtual(e.clientX, e.clientY);

    // 1. Check enemy click (Smite!)
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const en = this.enemies[i];
      const dx = vx - en.x;
      const dy = vy - (en.y - en.radius * 0.8);
      if (dx * dx + dy * dy <= (en.radius + 22) * (en.radius + 22)) {
        const state = this.stateRef.current;
        const smiteDmg = Math.round(
          (24 + state.castleLevel * 9) * (1 + state.research.magicAmp * 0.14),
        );
        soundEngine.playSmite();
        this.spawnLightning(en.x, 40, en.x, en.y - en.radius, '#38bdf8', 3.5);
        this.spawnBurst(en.x, en.y - en.radius * 0.6, '#38bdf8', 8);
        this.damageEnemy(en, smiteDmg, true);
        this.callbacks.onStateSync((prev) => ({
          ...prev,
          stats: { ...prev.stats, smiteClicks: prev.stats.smiteClicks + 1 },
        }));
        return;
      }
    }

    // 2. Check Castle Slot Click
    for (let idx = 0; idx < SLOT_POSITIONS.length; idx++) {
      if (this.stateRef.current.castleLevel < SLOT_UNLOCK_LEVELS[idx]) continue;
      const pos = SLOT_POSITIONS[idx];
      const dx = vx - pos.x;
      const dy = vy - pos.y;
      if (dx * dx + dy * dy <= 28 * 28) {
        this.selectedSlot = idx;
        this.callbacks.onSelectSlot(idx);
        return;
      }
    }

    // 3. Check Front Pet Slot Click (check both live pet position and home pad)
    for (let idx = 0; idx < PET_SLOT_POSITIONS.length; idx++) {
      if (this.stateRef.current.castleLevel < PET_UNLOCK_LEVELS[idx]) continue;
      const pSlot = this.stateRef.current.petSlots[idx];
      const home = PET_SLOT_POSITIONS[idx];
      const rt = this.petRuntime[idx];
      const checkX = pSlot?.petType ? rt.x : home.x;
      const checkY = pSlot?.petType ? rt.y - rt.alt - 22 : home.y - 22;
      const dx = vx - checkX;
      const dy = vy - checkY;
      const hdx = vx - home.x;
      const hdy = vy - (home.y - 16);
      if (dx * dx + dy * dy <= 42 * 42 || hdx * hdx + hdy * hdy <= 32 * 32) {
        this.selectedPetSlot = idx;
        this.callbacks.onSelectSlot(100 + idx);
        return;
      }
    }
  };

  private spawnEnemy(type: EnemyType): void {
    const wave = this.stateRef.current.wave;
    const hpScale = Math.pow(1.22, wave - 1);
    const dmgScale = Math.pow(1.13, wave - 1);

    let baseHp = 46;
    let speed = 64;
    let damage = 11;
    let goldReward = 14;
    let attackCooldown = 1.1;
    let radius = 18;
    let baseY = GROUND_Y + (Math.random() - 0.5) * 18;

    if (type === 'orc') {
      baseHp = 95;
      speed = 48;
      damage = 18;
      goldReward = 24;
      attackCooldown = 1.3;
      radius = 23;
    } else if (type === 'golem') {
      baseHp = 215;
      speed = 32;
      damage = 32;
      goldReward = 44;
      attackCooldown = 1.65;
      radius = 30;
    } else if (type === 'wyvern') {
      baseHp = 78;
      speed = 82;
      damage = 16;
      goldReward = 26;
      attackCooldown = 1.05;
      radius = 22;
      baseY = 265 + (Math.random() - 0.5) * 55;
    } else if (type === 'boss') {
      baseHp = 640;
      speed = 28;
      damage = 58;
      goldReward = 175;
      attackCooldown = 1.5;
      radius = 40;
      baseY = GROUND_Y + 4;
    }

    const maxHp = Math.round(baseHp * hpScale);
    this.enemies.push({
      id: this.nextEnemyId++,
      type,
      hp: maxHp,
      maxHp,
      x: VW + 45,
      y: baseY,
      baseY,
      radius,
      speed,
      damage: Math.round(damage * dmgScale),
      attackCooldown,
      attackTimer: 0.4,
      goldReward: Math.round(goldReward * (1 + (wave - 1) * 0.08)),
      slowTimer: 0,
      hitFlashTimer: 0,
      phase: Math.random() * Math.PI * 2,
    });
  }

  private damageEnemy(enemy: Enemy2D, amount: number, isCrit: boolean): void {
    if (enemy.hp <= 0) return;
    enemy.hp -= amount;
    enemy.hitFlashTimer = 0.11;
    this.emitPopup(
      enemy.x,
      enemy.y - enemy.radius * 1.9,
      `${amount}`,
      isCrit ? 'crit' : 'damage',
    );
    if (enemy.hp <= 0) {
      this.handleEnemyKilled(enemy);
    }
  }

  private handleEnemyKilled(enemy: Enemy2D): void {
    const state = this.stateRef.current;
    const puppyBonus =
      state.petSlots.filter((p) => p.petType === 'puppy').length * 0.1;
    const goldMult =
      1 + state.research.goldPlunder * 0.1 + (state.goldMineLevel - 1) * 0.12 + puppyBonus;
    const goldGain = Math.round(enemy.goldReward * goldMult);

    soundEngine.playCoin();
    this.spawnBurst(
      enemy.x,
      enemy.y - enemy.radius * 0.8,
      enemy.type === 'boss' ? '#fbbf24' : '#ef4444',
      enemy.type === 'boss' ? 18 : 10,
    );
    this.emitPopup(enemy.x, enemy.y - enemy.radius * 2.2, `+${goldGain}G`, 'gold');

    this.enemies = this.enemies.filter((e) => e.id !== enemy.id);
    const remaining = this.enemies.length + this.spawnQueue.length;
    const waveCleared = state.waveActive && remaining === 0;

    if (waveCleared) {
      soundEngine.playUpgrade();
      this.emitPopup(640, 220, `웨이브 ${state.wave} 방어 성공!`, 'heal');
      this.autoWaveDelayTimer = 2.0;
      this.callbacks.onStateSync((prev) => ({
        ...prev,
        gold: prev.gold + goldGain,
        mana: Math.min(prev.maxMana, prev.mana + 18),
        wave: prev.wave + 1,
        waveActive: false,
        waveEnemiesRemaining: 0,
        isBossWave: false,
        lastOutcome: 'victory',
        stats: {
          ...prev.stats,
          totalKills: prev.stats.totalKills + 1,
          totalGoldEarned: prev.stats.totalGoldEarned + goldGain,
          wavesCleared: prev.stats.wavesCleared + 1,
          highestWave: Math.max(prev.stats.highestWave, prev.wave + 1),
        },
      }));
    } else {
      this.callbacks.onStateSync((prev) => ({
        ...prev,
        gold: prev.gold + goldGain,
        mana: Math.min(prev.maxMana, prev.mana + 2),
        waveEnemiesRemaining: remaining,
        stats: {
          ...prev.stats,
          totalKills: prev.stats.totalKills + 1,
          totalGoldEarned: prev.stats.totalGoldEarned + goldGain,
        },
      }));
    }
  }

  private spawnBurst(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 45 + Math.random() * 140;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - 65,
        size: 3 + Math.random() * 4,
        color,
        life: 0.42 + Math.random() * 0.25,
        maxLife: 0.65,
        gravity: 340,
      });
    }
  }

  private spawnLightning(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string,
    width = 2.5,
  ): void {
    const pts: { x: number; y: number }[] = [];
    const segs = 6;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      let px = x1 + (x2 - x1) * t;
      let py = y1 + (y2 - y1) * t;
      if (i > 0 && i < segs) {
        px += (Math.random() - 0.5) * 24;
        py += (Math.random() - 0.5) * 20;
      }
      pts.push({ x: px, y: py });
    }
    this.lightnings.push({ points: pts, color, life: 0.18, maxLife: 0.18, width });
  }

  private findClosestEnemy(originX: number, maxRangePx: number): Enemy2D | null {
    let best: Enemy2D | null = null;
    let bestX = Infinity;
    for (const en of this.enemies) {
      if (en.hp <= 0) continue;
      if (en.x - originX <= maxRangePx && en.x < bestX) {
        bestX = en.x;
        best = en;
      }
    }
    return best;
  }

  private update(dt: number): void {
    const state = this.stateRef.current;
    const simDt = dt * state.gameSpeed;
    this.elapsed += simDt;

    if (this.shakeTime > 0) {
      this.shakeTime = Math.max(0, this.shakeTime - dt);
    }

    for (const c of this.clouds) {
      c.x -= c.speed * dt;
      if (c.x + c.w < -40) c.x = VW + 40;
    }

    // Passive mana regen & skill cooldowns (gold is earned only from monster kills)
    this.passiveIncomeTimer += simDt;
    let passiveMana = 0;
    if (this.passiveIncomeTimer >= 1.0) {
      this.passiveIncomeTimer -= 1.0;
      passiveMana = 2 + state.manaShrineLevel * 1.5;
    }

    const needSync =
      passiveMana > 0 ||
      state.rallyBuffRemaining > 0 ||
      state.skillCooldowns.meteor > 0 ||
      state.skillCooldowns.volley > 0 ||
      state.skillCooldowns.fortify > 0;

    if (needSync) {
      this.callbacks.onStateSync((prev) => ({
        ...prev,
        mana: Math.min(prev.maxMana, prev.mana + passiveMana),
        rallyBuffRemaining: Math.max(0, prev.rallyBuffRemaining - simDt),
        skillCooldowns: {
          meteor: Math.max(0, prev.skillCooldowns.meteor - simDt),
          volley: Math.max(0, prev.skillCooldowns.volley - simDt),
          fortify: Math.max(0, prev.skillCooldowns.fortify - simDt),
        },
      }));
    }

    if (!state.waveActive && state.autoWave) {
      this.autoWaveDelayTimer -= simDt;
      if (this.autoWaveDelayTimer <= 0) {
        this.startWave();
      }
    }

    if (state.waveActive && this.spawnQueue.length > 0) {
      this.spawnTimer -= simDt;
      if (this.spawnTimer <= 0) {
        const next = this.spawnQueue.shift()!;
        this.spawnEnemy(next.type);
        this.spawnTimer = next.delay;
      }
    }

    // Move Enemies & Attack Castle
    let castleDmg = 0;
    for (const en of this.enemies) {
      if (en.hitFlashTimer > 0) en.hitFlashTimer -= simDt;
      if (en.slowTimer > 0) en.slowTimer -= simDt;
      const slowFactor = en.slowTimer > 0 ? 0.55 : 1.0;
      const stopX = GATE_STOP_X + en.radius * 0.5;

      if (en.x > stopX) {
        en.x = Math.max(stopX, en.x - en.speed * slowFactor * simDt);
        en.phase += simDt * (en.type === 'wyvern' ? 9 : en.speed * 0.14);
        if (en.type === 'wyvern') {
          en.y = en.baseY + Math.sin(en.phase) * 14;
        }
      } else {
        en.attackTimer -= simDt;
        if (en.attackTimer <= 0) {
          en.attackTimer = en.attackCooldown;
          castleDmg += en.damage;
          this.triggerShake(0.16, en.type === 'boss' ? 7 : 3);
          this.spawnBurst(GATE_STOP_X - 10, en.y - en.radius * 0.6, '#f59e0b', 5);
        }
      }
    }

    if (castleDmg > 0) {
      const armorMult = Math.max(0.45, 1 - state.research.castleArmor * 0.04);
      const finalDmg = Math.max(1, Math.round(castleDmg * armorMult));
      this.emitPopup(235, 360, `-${finalDmg}`, 'crit');
      if (state.castleHp - finalDmg <= 0) {
        this.resetBattlefield();
        this.callbacks.onStateSync((prev) => ({
          ...prev,
          castleHp: prev.castleMaxHp,
          waveActive: false,
          waveEnemiesRemaining: 0,
          isBossWave: false,
          autoWave: false,
          lastOutcome: 'defeat',
        }));
        return;
      } else {
        this.callbacks.onStateSync((prev) => ({
          ...prev,
          castleHp: Math.max(0, prev.castleHp - finalDmg),
        }));
      }
    }

    const rallyMult = state.rallyBuffRemaining > 0 ? 1.8 : 1.0;
    const athenaCount = state.slots.filter((s) => s.unitClass === 'athena').length;
    const speedAuraMult = rallyMult * (1 + athenaCount * 0.12);
    const arrowMult = 1 + state.research.arrowPower * 0.12;
    const magicMult = 1 + state.research.magicAmp * 0.14;

    // Gate Auto-Ballista
    this.gateBallistaCooldown -= simDt * speedAuraMult;
    const gateOrigin = { x: 292, y: 392 };
    const gateTarget = this.findClosestEnemy(gateOrigin.x, 960);
    if (gateTarget) {
      this.gateBallistaAngle = Math.atan2(
        gateTarget.y - gateTarget.radius - gateOrigin.y,
        gateTarget.x - gateOrigin.x,
      );
      if (this.gateBallistaCooldown <= 0) {
        this.gateBallistaCooldown = Math.max(0.3, 0.85 - state.gateBallistaLevel * 0.025);
        const dmg = Math.round((15 + state.gateBallistaLevel * 7) * arrowMult);
        soundEngine.playBow();
        this.projectiles.push({
          kind: 'arrow',
          x: gateOrigin.x,
          y: gateOrigin.y,
          startX: gateOrigin.x,
          startY: gateOrigin.y,
          targetX: gateTarget.x,
          targetY: gateTarget.y - gateTarget.radius * 0.8,
          targetEnemyId: gateTarget.id,
          progress: 0,
          duration: 0.34,
          arcHeight: 48,
          damage: dmg,
          splashRadius: 0,
          isCrit: Math.random() < 0.14,
          angle: this.gateBallistaAngle,
        });
      }
    }

    // 6 Castle Wall Slots
    state.slots.forEach((slot, idx) => {
      if (this.slotAttackAnim[idx] > 0) {
        this.slotAttackAnim[idx] = Math.max(0, this.slotAttackAnim[idx] - simDt * 4);
      }
      if (!slot.unitClass) return;
      const meta = DEFENDER_CATALOG[slot.unitClass];
      const pos = SLOT_POSITIONS[idx];
      const rangePx = meta.range * 31;
      const target = this.findClosestEnemy(pos.x, rangePx);

      this.slotCooldowns[idx] -= simDt * speedAuraMult;
      if (target && this.slotCooldowns[idx] <= 0) {
        this.slotCooldowns[idx] = meta.attackInterval;
        this.slotAttackAnim[idx] = 1.0;

        const lvMult = 1 + (slot.level - 1) * 0.28;
        const isMagicOrGod = meta.category === 'magic' || meta.category === 'god';
        const dmg = Math.round(meta.baseDamage * lvMult * (isMagicOrGod ? magicMult : arrowMult));

        if (slot.unitClass === 'archer') {
          soundEngine.playBow();
          this.projectiles.push({
            kind: 'arrow',
            x: pos.x + 12,
            y: pos.y - 8,
            startX: pos.x + 12,
            startY: pos.y - 8,
            targetX: target.x,
            targetY: target.y - target.radius * 0.8,
            targetEnemyId: target.id,
            progress: 0,
            duration: 0.34,
            arcHeight: 58,
            damage: dmg,
            splashRadius: 0,
            isCrit: Math.random() < 0.16,
            angle: 0,
          });
        } else if (slot.unitClass === 'darkknight') {
          soundEngine.playSlash();
          const endX = Math.min(VW + 40, pos.x + rangePx);
          this.projectiles.push({
            kind: 'slash',
            x: pos.x + 18,
            y: target.y - target.radius * 0.6,
            startX: pos.x + 18,
            startY: pos.y - 8,
            targetX: endX,
            targetY: target.y - target.radius * 0.55,
            targetEnemyId: null,
            progress: 0,
            duration: 0.55,
            arcHeight: 0,
            damage: dmg,
            splashRadius: 0,
            isCrit: Math.random() < 0.18,
            angle: 0,
            pierceLeft: 4,
            hitEnemyIds: [],
          });
        } else if (slot.unitClass === 'lancer') {
          soundEngine.playSlash();
          this.projectiles.push({
            kind: 'lance',
            x: pos.x + 14,
            y: pos.y - 10,
            startX: pos.x + 14,
            startY: pos.y - 10,
            targetX: target.x,
            targetY: target.y - target.radius * 0.8,
            targetEnemyId: target.id,
            progress: 0,
            duration: 0.3,
            arcHeight: 28,
            damage: dmg,
            splashRadius: 0,
            isCrit: Math.random() < 0.3,
            angle: 0,
            knockback: 16,
          });
        } else if (slot.unitClass === 'pyromancer') {
          soundEngine.playFire();
          this.projectiles.push({
            kind: 'fireball',
            x: pos.x + 12,
            y: pos.y - 12,
            startX: pos.x + 12,
            startY: pos.y - 12,
            targetX: target.x,
            targetY: target.y - target.radius * 0.7,
            targetEnemyId: target.id,
            progress: 0,
            duration: 0.45,
            arcHeight: 68,
            damage: dmg,
            splashRadius: 72,
            isCrit: false,
            angle: 0,
          });
        } else if (slot.unitClass === 'frostmage') {
          soundEngine.playSmite();
          this.projectiles.push({
            kind: 'frostshard',
            x: pos.x + 14,
            y: pos.y - 14,
            startX: pos.x + 14,
            startY: pos.y - 14,
            targetX: target.x,
            targetY: target.y - target.radius * 0.7,
            targetEnemyId: target.id,
            progress: 0,
            duration: 0.36,
            arcHeight: 42,
            damage: dmg,
            splashRadius: 76,
            isCrit: false,
            angle: 0,
          });
        } else if (slot.unitClass === 'summoner') {
          soundEngine.playUpgrade();
          const spawnX = 328;
          const spawnY = GROUND_Y + (Math.random() - 0.5) * 14;
          this.spawnBurst(spawnX, spawnY - 12, '#34d399', 8);
          this.summons.push({
            x: spawnX,
            y: spawnY,
            damage: dmg,
            hitsLeft: 3,
            attackCooldown: 0,
            phase: Math.random() * Math.PI * 2,
            life: 11,
          });
        } else if (slot.unitClass === 'paladin') {
          soundEngine.playSmite();
          this.shockwaves.push({
            x: target.x,
            y: GROUND_Y,
            radius: 10,
            maxRadius: 110,
            color: '#38bdf8',
            life: 0.36,
            maxLife: 0.36,
          });
          for (const en of [...this.enemies]) {
            if (Math.abs(en.x - target.x) <= 110) {
              en.slowTimer = 2.4;
              this.damageEnemy(en, dmg, false);
            }
          }
        } else if (slot.unitClass === 'stormmage') {
          soundEngine.playLightning();
          const targets = this.enemies
            .filter((e) => e.hp > 0)
            .sort((a, b) => a.x - b.x)
            .slice(0, 3);
          let px = pos.x + 10;
          let py = pos.y - 22;
          targets.forEach((en, ci) => {
            const tx = en.x;
            const ty = en.y - en.radius * 0.8;
            this.spawnLightning(px, py, tx, ty, '#a78bfa', 2.6);
            px = tx;
            py = ty;
            this.damageEnemy(en, Math.round(dmg * (1 - ci * 0.18)), ci === 0);
          });
        } else if (slot.unitClass === 'zeus') {
          soundEngine.playDivine();
          soundEngine.playLightning();
          const targets = this.enemies
            .filter((e) => e.hp > 0)
            .sort((a, b) => a.x - b.x)
            .slice(0, 4);
          targets.forEach((en, ci) => {
            const tx = en.x;
            const ty = en.y - en.radius * 0.7;
            this.spawnLightning(tx + (Math.random() - 0.5) * 30, 18, tx, ty, '#fde047', 4.0);
            this.spawnBurst(tx, ty, '#fef08a', 7);
            en.slowTimer = Math.max(en.slowTimer, 0.9);
            this.damageEnemy(en, Math.round(dmg * (1 - ci * 0.12)), ci === 0);
          });
        } else if (slot.unitClass === 'poseidon') {
          soundEngine.playDivine();
          this.projectiles.push({
            kind: 'tidal',
            x: pos.x + 14,
            y: pos.y - 12,
            startX: pos.x + 14,
            startY: pos.y - 12,
            targetX: target.x,
            targetY: GROUND_Y - 12,
            targetEnemyId: target.id,
            progress: 0,
            duration: 0.42,
            arcHeight: 48,
            damage: dmg,
            splashRadius: 96,
            isCrit: false,
            angle: 0,
            knockback: 24,
          });
        } else if (slot.unitClass === 'athena') {
          soundEngine.playDivine();
          this.projectiles.push({
            kind: 'divinebeam',
            x: pos.x + 14,
            y: pos.y - 14,
            startX: pos.x + 14,
            startY: pos.y - 14,
            targetX: target.x,
            targetY: target.y - target.radius * 0.7,
            targetEnemyId: target.id,
            progress: 0,
            duration: 0.28,
            arcHeight: 16,
            damage: dmg,
            splashRadius: 58,
            isCrit: Math.random() < 0.25,
            angle: 0,
          });
        } else if (slot.unitClass === 'ra') {
          soundEngine.playDivine();
          soundEngine.playFire();
          this.projectiles.push({
            kind: 'sunflare',
            x: target.x - 40,
            y: 36,
            startX: target.x - 40,
            startY: 36,
            targetX: target.x,
            targetY: target.y - target.radius * 0.6,
            targetEnemyId: target.id,
            progress: 0,
            duration: 0.38,
            arcHeight: 0,
            damage: dmg,
            splashRadius: 112,
            isCrit: true,
            angle: 0,
          });
        }
      }
    });

    // 2 Front Castle Pets (Close-Range Melee & Flying Swoop Combat)
    state.petSlots.forEach((pSlot, idx) => {
      if (this.petAttackAnim[idx] > 0) {
        this.petAttackAnim[idx] = Math.max(0, this.petAttackAnim[idx] - simDt * 4.2);
      }
      const home = PET_SLOT_POSITIONS[idx];
      const rt = this.petRuntime[idx];

      if (!pSlot.petType || state.castleLevel < PET_UNLOCK_LEVELS[idx]) {
        rt.x = home.x;
        rt.y = home.y;
        rt.alt = 0;
        rt.facingRight = true;
        rt.lastLeap = 0;
        return;
      }

      const meta = PET_CATALOG[pSlot.petType];
      const isFlying = pSlot.petType === 'dragon' || pSlot.petType === 'phoenix';
      const maxAggroX = home.x + meta.range * 36;

      // Pick nearest valid enemy (ground pets prioritize ground enemies, flying pets hunt both air & ground)
      let target: Enemy2D | null = null;
      let bestScore = Infinity;
      for (const en of this.enemies) {
        if (en.hp <= 0 || en.x > maxAggroX) continue;
        const dx = en.x - rt.x;
        const dy = (en.type === 'wyvern' ? GROUND_Y + 4 : en.y) - rt.y;
        let dist = Math.hypot(dx, dy);
        if (!isFlying && en.type === 'wyvern') {
          dist += 520; // Prefer ground targets first, only leap at wyverns if needed
        }
        // Slight slot spread when multiple enemies exist
        if (idx === 1 && this.enemies.length > 1) {
          dist += en.id % 2 === 0 ? -18 : 18;
        }
        if (dist < bestScore) {
          bestScore = dist;
          target = en;
        }
      }

      const moveSpeed =
        pSlot.petType === 'phoenix'
          ? 295
          : pSlot.petType === 'dragon'
            ? 275
            : pSlot.petType === 'puppy'
              ? 260
              : pSlot.petType === 'cerberus'
                ? 235
                : pSlot.petType === 'worm'
                  ? 210
                  : 185;

      let desiredX = home.x;
      let desiredY = home.y;
      let desiredAlt = isFlying ? 84 : 0;

      if (target) {
        const targetGroundY = target.type === 'wyvern' ? GROUND_Y + 4 : target.y;
        const sideOffset =
          rt.x <= target.x
            ? -(target.radius + (isFlying ? 24 : 20))
            : target.radius + (isFlying ? 24 : 20);
        desiredX = Math.max(342, Math.min(VW - 40, target.x + sideOffset));
        desiredY = Math.max(468, Math.min(542, targetGroundY));
        if (isFlying) {
          if (target.type === 'wyvern') {
            desiredAlt = Math.max(76, GROUND_Y + 4 - target.y + 6);
          } else {
            desiredAlt = 70;
          }
        } else {
          desiredAlt = 0;
        }
      }

      const toX = desiredX - rt.x;
      const toY = desiredY - rt.y;
      const planarDist = Math.hypot(toX, toY);
      if (planarDist > 2) {
        const step = Math.min(planarDist, moveSpeed * simDt);
        rt.x += (toX / planarDist) * step;
        rt.y += (toY / planarDist) * step;
        if (pSlot.petType === 'worm' && Math.random() < simDt * 18) {
          this.particles.push({
            x: rt.x + (Math.random() - 0.5) * 20,
            y: rt.y + 4,
            vx: (Math.random() - 0.5) * 40,
            vy: -25 - Math.random() * 35,
            size: 3 + Math.random() * 2.5,
            color: '#78350f',
            life: 0.3,
            maxLife: 0.3,
            gravity: 160,
          });
        }
      }

      const altDiff = desiredAlt - rt.alt;
      if (Math.abs(altDiff) > 0.5) {
        const altStep = Math.min(Math.abs(altDiff), 240 * simDt);
        rt.alt += Math.sign(altDiff) * altStep;
      } else {
        rt.alt = desiredAlt;
      }

      if (target) {
        rt.facingRight = target.x >= rt.x;
      } else if (planarDist > 6) {
        rt.facingRight = toX >= 0;
      } else {
        rt.facingRight = true;
      }

      this.petCooldowns[idx] -= simDt * speedAuraMult;
      if (target && this.petCooldowns[idx] <= 0) {
        const targetGroundY = target.type === 'wyvern' ? GROUND_Y + 4 : target.y;
        const meleeDistX = Math.abs(target.x - rt.x);
        const meleeDistY = Math.abs(targetGroundY - rt.y);
        const meleeReachX = (isFlying ? 62 : 52) + target.radius;
        const meleeReachY = 46;

        if (meleeDistX <= meleeReachX && meleeDistY <= meleeReachY) {
          this.petCooldowns[idx] = meta.attackInterval;
          this.petAttackAnim[idx] = 1.0;
          rt.lastLeap = !isFlying && target.type === 'wyvern' ? 1 : 0;

          const lvMult = 1 + (pSlot.level - 1) * 0.28;
          const isMagicPet =
            pSlot.petType === 'dragon' ||
            pSlot.petType === 'phoenix' ||
            pSlot.petType === 'cerberus' ||
            pSlot.petType === 'slimeking';
          const dmg = Math.round(meta.baseDamage * lvMult * (isMagicPet ? magicMult : arrowMult));

          const hitX = target.x;
          const hitY = target.y - target.radius * 0.65;

          if (pSlot.petType === 'puppy') {
            soundEngine.playSlash();
            const isCrit = Math.random() < 0.25;
            this.petSlashes.push({
              x: hitX,
              y: hitY,
              color: '#fbbf24',
              life: 0.24,
              maxLife: 0.24,
              radius: 36,
              facingRight: rt.facingRight,
            });
            this.spawnBurst(hitX, hitY, '#fde047', 8);
            this.damageEnemy(target, isCrit ? Math.round(dmg * 1.55) : dmg, isCrit);
          } else if (pSlot.petType === 'slimeking') {
            soundEngine.playSmite();
            const splash = 82;
            this.petSlashes.push({
              x: hitX,
              y: hitY,
              color: '#38bdf8',
              life: 0.28,
              maxLife: 0.28,
              radius: 40,
              facingRight: rt.facingRight,
            });
            this.shockwaves.push({
              x: hitX,
              y: targetGroundY,
              radius: 12,
              maxRadius: splash,
              color: '#38bdf8',
              life: 0.36,
              maxLife: 0.36,
            });
            this.spawnBurst(hitX, hitY, '#38bdf8', 11);
            for (const en of [...this.enemies]) {
              const edx = en.x - hitX;
              const edy = en.y - en.radius * 0.65 - hitY;
              if (edx * edx + edy * edy <= splash * splash) {
                en.slowTimer = Math.max(en.slowTimer, 3.0);
                this.damageEnemy(en, dmg, false);
              }
            }
          } else if (pSlot.petType === 'worm') {
            soundEngine.playSlash();
            const splash = 74;
            this.petSlashes.push({
              x: hitX,
              y: hitY,
              color: '#84cc16',
              life: 0.26,
              maxLife: 0.26,
              radius: 42,
              facingRight: rt.facingRight,
            });
            this.shockwaves.push({
              x: hitX,
              y: targetGroundY,
              radius: 10,
              maxRadius: splash,
              color: '#84cc16',
              life: 0.34,
              maxLife: 0.34,
            });
            this.spawnBurst(hitX, targetGroundY - 12, '#a3e635', 12);
            for (const en of [...this.enemies]) {
              const edx = en.x - hitX;
              const edy = en.y - en.radius * 0.65 - hitY;
              if (edx * edx + edy * edy <= splash * splash) {
                en.slowTimer = Math.max(en.slowTimer, 2.0);
                this.damageEnemy(en, dmg, false);
              }
            }
          } else if (pSlot.petType === 'dragon') {
            soundEngine.playFire();
            const splash = 86;
            this.petSlashes.push({
              x: hitX,
              y: hitY,
              color: '#ef4444',
              life: 0.28,
              maxLife: 0.28,
              radius: 48,
              facingRight: rt.facingRight,
            });
            this.shockwaves.push({
              x: hitX,
              y: hitY,
              radius: 12,
              maxRadius: splash,
              color: '#f97316',
              life: 0.38,
              maxLife: 0.38,
            });
            this.spawnBurst(hitX, hitY, '#f97316', 14);
            for (const en of [...this.enemies]) {
              const edx = en.x - hitX;
              const edy = en.y - en.radius * 0.65 - hitY;
              if (edx * edx + edy * edy <= splash * splash) {
                this.damageEnemy(en, dmg, false);
              }
            }
          } else if (pSlot.petType === 'phoenix') {
            soundEngine.playDivine();
            const healAmt = 3 + pSlot.level * 2;
            this.callbacks.onStateSync((prev) => ({
              ...prev,
              castleHp: Math.min(prev.castleMaxHp, prev.castleHp + healAmt),
            }));
            const splash = 78;
            this.petSlashes.push({
              x: hitX,
              y: hitY,
              color: '#fde047',
              life: 0.28,
              maxLife: 0.28,
              radius: 46,
              facingRight: rt.facingRight,
            });
            this.shockwaves.push({
              x: hitX,
              y: hitY,
              radius: 12,
              maxRadius: splash,
              color: '#fbbf24',
              life: 0.36,
              maxLife: 0.36,
            });
            this.spawnBurst(hitX, hitY, '#fbbf24', 14);
            for (const en of [...this.enemies]) {
              const edx = en.x - hitX;
              const edy = en.y - en.radius * 0.65 - hitY;
              if (edx * edx + edy * edy <= splash * splash) {
                this.damageEnemy(en, dmg, false);
              }
            }
          } else if (pSlot.petType === 'cerberus') {
            soundEngine.playFire();
            const nearbyTargets = this.enemies
              .filter((e) => {
                if (e.hp <= 0) return false;
                const ey = e.type === 'wyvern' ? GROUND_Y + 4 : e.y;
                return Math.hypot(e.x - rt.x, ey - rt.y) <= 138;
              })
              .sort((a, b) => Math.abs(a.x - rt.x) - Math.abs(b.x - rt.x))
              .slice(0, 3);
            const finalTargets = nearbyTargets.length > 0 ? nearbyTargets : [target];
            finalTargets.forEach((en, hi) => {
              const ex = en.x;
              const ey = en.y - en.radius * 0.65;
              const isCrit = hi === 0 && Math.random() < 0.25;
              this.petSlashes.push({
                x: ex,
                y: ey,
                color: '#f43f5e',
                life: 0.25,
                maxLife: 0.25,
                radius: 36,
                facingRight: ex >= rt.x,
              });
              this.spawnBurst(ex, ey, '#f43f5e', 9);
              this.damageEnemy(en, isCrit ? Math.round(dmg * 1.4) : dmg, isCrit);
            });
          }
        }
      }
    });

    // Update Summoned Forest Spirits
    for (let i = this.summons.length - 1; i >= 0; i--) {
      const s = this.summons[i];
      s.life -= simDt;
      s.phase += simDt * 10;
      if (s.attackCooldown > 0) s.attackCooldown -= simDt;

      // Find nearest ground/air enemy to charge toward
      let nearest: Enemy2D | null = null;
      let minDist = Infinity;
      for (const en of this.enemies) {
        if (en.hp <= 0) continue;
        const d = Math.abs(en.x - s.x);
        if (d < minDist) {
          minDist = d;
          nearest = en;
        }
      }

      if (nearest) {
        if (minDist > 30) {
          const dir = nearest.x >= s.x ? 1 : -1;
          s.x += dir * 135 * simDt;
        } else if (s.attackCooldown <= 0) {
          s.attackCooldown = 0.45;
          s.hitsLeft -= 1;
          soundEngine.playSmite();
          this.spawnBurst(nearest.x, nearest.y - nearest.radius * 0.6, '#34d399', 6);
          this.damageEnemy(nearest, s.damage, s.hitsLeft === 0);
        }
      } else {
        // Patrol forward slowly if waiting for wave
        if (s.x < 520) s.x += 55 * simDt;
      }

      if (s.hitsLeft <= 0 || s.life <= 0) {
        this.spawnBurst(s.x, s.y - 12, '#6ee7b7', 6);
        this.summons.splice(i, 1);
      }
    }

    // Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.progress += simDt / p.duration;
      if (p.progress < 0) continue;

      if (p.targetEnemyId !== null) {
        const tracked = this.enemies.find((e) => e.id === p.targetEnemyId);
        if (tracked) {
          p.targetX = tracked.x;
          p.targetY = tracked.y - tracked.radius * 0.8;
        }
      }

      const t = Math.min(1, p.progress);
      const prevX = p.x;
      const prevY = p.y;
      p.x = p.startX + (p.targetX - p.startX) * t;
      p.y = p.startY + (p.targetY - p.startY) * t - Math.sin(t * Math.PI) * p.arcHeight;
      p.angle = Math.atan2(p.y - prevY, p.x - prevX);

      // Piercing crescent sword wave (Dark Knight)
      if (p.kind === 'slash' && p.pierceLeft && p.pierceLeft > 0) {
        const hitIds = p.hitEnemyIds || [];
        for (const en of [...this.enemies]) {
          if (hitIds.includes(en.id)) continue;
          const dx = Math.abs(en.x - p.x);
          const dy = Math.abs(en.y - en.radius * 0.6 - p.y);
          if (dx <= en.radius + 24 && dy <= en.radius + 54) {
            hitIds.push(en.id);
            p.pierceLeft -= 1;
            this.spawnBurst(en.x, en.y - en.radius * 0.6, '#f43f5e', 6);
            this.damageEnemy(en, p.isCrit ? Math.round(p.damage * 1.45) : p.damage, p.isCrit);
            if (p.pierceLeft <= 0) break;
          }
        }
        p.hitEnemyIds = hitIds;
        if (p.pierceLeft <= 0 || t >= 1) {
          this.projectiles.splice(i, 1);
          continue;
        }
      }

      if (t >= 1) {
        if (p.splashRadius > 0) {
          const burstColor =
            p.kind === 'frostshard'
              ? '#38bdf8'
              : p.kind === 'tidal'
                ? '#06b6d4'
                : p.kind === 'sunflare' || p.kind === 'divinebeam'
                  ? '#fde047'
                  : p.kind === 'meteor' || p.kind === 'fireball'
                    ? '#f97316'
                    : '#fbbf24';
          this.spawnBurst(
            p.targetX,
            p.targetY,
            burstColor,
            p.kind === 'meteor' || p.kind === 'sunflare' ? 16 : 9,
          );
          if (
            p.kind === 'meteor' ||
            p.kind === 'frostshard' ||
            p.kind === 'tidal' ||
            p.kind === 'sunflare'
          ) {
            this.shockwaves.push({
              x: p.targetX,
              y: p.targetY,
              radius: 10,
              maxRadius: p.splashRadius,
              color: burstColor,
              life: 0.38,
              maxLife: 0.38,
            });
          }
          for (const en of [...this.enemies]) {
            const dx = en.x - p.targetX;
            const dy = en.y - en.radius * 0.7 - p.targetY;
            if (dx * dx + dy * dy <= p.splashRadius * p.splashRadius) {
              if (p.kind === 'frostshard' || p.kind === 'tidal') {
                const slowDur = p.kind === 'tidal' ? 2.8 : 2.5;
                en.slowTimer = Math.max(en.slowTimer, slowDur);
              }
              if (p.knockback && en.type !== 'boss') {
                en.x = Math.min(VW - 20, en.x + p.knockback);
              }
              this.damageEnemy(en, p.damage, p.isCrit);
            }
          }
        } else if (p.targetEnemyId !== null) {
          const hit = this.enemies.find((e) => e.id === p.targetEnemyId);
          if (hit) {
            if (p.knockback && hit.type !== 'boss') {
              hit.x = Math.min(VW - 20, hit.x + p.knockback);
            }
            this.damageEnemy(
              hit,
              p.isCrit ? Math.round(p.damage * 1.55) : p.damage,
              p.isCrit,
            );
          }
        }
        this.projectiles.splice(i, 1);
      }
    }

    // Update Particles, Lightnings, Shockwaves
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= simDt;
      pt.vy += pt.gravity * simDt;
      pt.x += pt.vx * simDt;
      pt.y += pt.vy * simDt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.lightnings.length - 1; i >= 0; i--) {
      this.lightnings[i].life -= simDt;
      if (this.lightnings[i].life <= 0) this.lightnings.splice(i, 1);
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      this.shockwaves[i].life -= simDt;
      if (this.shockwaves[i].life <= 0) this.shockwaves.splice(i, 1);
    }

    for (let i = this.petSlashes.length - 1; i >= 0; i--) {
      this.petSlashes[i].life -= simDt;
      if (this.petSlashes[i].life <= 0) this.petSlashes.splice(i, 1);
    }
  }

  private render(): void {
    const ctx = this.ctx;
    const state = this.stateRef.current;

    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, this.width, this.height);

    const shakeX = this.shakeTime > 0 ? (Math.random() - 0.5) * this.shakeIntensity : 0;
    const shakeY = this.shakeTime > 0 ? (Math.random() - 0.5) * this.shakeIntensity : 0;

    ctx.translate(this.offsetX + shakeX, this.offsetY + shakeY);
    ctx.scale(this.scale, this.scale);

    // 1. Sky Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    skyGrad.addColorStop(0, '#0c1628');
    skyGrad.addColorStop(0.55, '#1b3152');
    skyGrad.addColorStop(1, '#364d63');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(-100, -100, VW + 200, GROUND_Y + 120);

    // Stars & Moon
    for (const s of this.stars) {
      const alpha = 0.35 + 0.35 * Math.sin(this.elapsed * 2 + s.phase);
      ctx.fillStyle = `rgba(226, 232, 240, ${alpha})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(1040, 108, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(253, 230, 138, 0.14)';
    ctx.beginPath();
    ctx.arc(1040, 108, 54, 0, Math.PI * 2);
    ctx.fill();

    // Drifting Clouds
    ctx.fillStyle = 'rgba(148, 163, 184, 0.16)';
    for (const c of this.clouds) {
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.w * 0.5, 16, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x - c.w * 0.22, c.y + 6, c.w * 0.32, 13, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x + c.w * 0.24, c.y + 7, c.w * 0.3, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Parallax Distant Mountains & Forest Silhouettes
    ctx.fillStyle = '#1e2c42';
    ctx.beginPath();
    ctx.moveTo(-60, GROUND_Y);
    ctx.lineTo(140, 320);
    ctx.lineTo(360, 410);
    ctx.lineTo(590, 275);
    ctx.lineTo(840, 385);
    ctx.lineTo(1060, 260);
    ctx.lineTo(1360, 390);
    ctx.lineTo(1360, GROUND_Y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#203b31';
    ctx.beginPath();
    ctx.moveTo(-60, GROUND_Y);
    for (let x = -40; x <= VW + 60; x += 48) {
      const peak = 420 - Math.abs(Math.sin(x * 0.013)) * 42;
      ctx.lineTo(x, peak);
    }
    ctx.lineTo(VW + 60, GROUND_Y);
    ctx.closePath();
    ctx.fill();

    // 3. Ground Meadow & Stone Battlefield Road
    const groundGrad = ctx.createLinearGradient(0, GROUND_Y, 0, VH + 100);
    groundGrad.addColorStop(0, '#325331');
    groundGrad.addColorStop(0.22, '#284228');
    groundGrad.addColorStop(1, '#162419');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(-100, GROUND_Y, VW + 200, VH - GROUND_Y + 120);

    // Cobblestone road strip
    ctx.fillStyle = '#524b44';
    ctx.fillRect(260, GROUND_Y - 10, VW - 180, 46);
    ctx.fillStyle = '#685f56';
    for (let rx = 280; rx < VW + 40; rx += 42) {
      ctx.fillRect(rx, GROUND_Y - 2, 26, 9);
      ctx.fillRect(rx + 18, GROUND_Y + 16, 22, 8);
    }

    // Moat water channel in front of gate
    ctx.fillStyle = '#1d4e6b';
    ctx.fillRect(298, GROUND_Y - 8, 42, 44);
    ctx.fillStyle = '#785032';
    ctx.fillRect(294, GROUND_Y - 12, 50, 12); // drawbridge

    // 4. Courtyard Facilities (Gold Mine & Mana Shrine)
    this.drawCourtyardFacilities(ctx, state);

    // 5. Evolving 2D Castle
    this.drawCastle(ctx, state);

    // 6. 6 Wall Slots + Defenders
    this.drawDefenders(ctx, state);

    // 6.5 Summoned Cute Spirits & Castle Pet Guard Pads
    for (const s of this.summons) {
      this.drawSummon(ctx, s);
    }
    this.drawPetPads(ctx, state);

    // 7. Ground Pets & Enemies (Ground pass)
    this.drawPets(ctx, state, false);
    for (const en of this.enemies) {
      this.drawEnemy(ctx, en);
    }

    // 7.5 Flying Pets (Airborne pass so Dragon & Phoenix soar visibly above monsters)
    this.drawPets(ctx, state, true);

    // 8. Projectiles
    for (const p of this.projectiles) {
      if (p.progress < 0) continue;
      this.drawProjectile(ctx, p);
    }

    // 9. Pet Melee Slash Arcs, Shockwaves, Lightnings & Particles
    for (const sl of this.petSlashes) {
      const pct = 1 - sl.life / sl.maxLife;
      ctx.save();
      ctx.translate(sl.x, sl.y);
      if (!sl.facingRight) ctx.scale(-1, 1);
      ctx.globalAlpha = Math.max(0, 1 - pct);
      ctx.strokeStyle = sl.color;
      ctx.lineWidth = 5.5 - pct * 3;
      ctx.beginPath();
      ctx.arc(-6, 0, sl.radius * (0.65 + pct * 0.45), -Math.PI * 0.48, Math.PI * 0.48);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(-6, 0, sl.radius * (0.58 + pct * 0.42), -Math.PI * 0.34, Math.PI * 0.34);
      ctx.stroke();
      ctx.restore();
    }

    for (const sw of this.shockwaves) {
      const pct = 1 - sw.life / sw.maxLife;
      const r = sw.radius + (sw.maxRadius - sw.radius) * pct;
      ctx.strokeStyle = sw.color;
      ctx.globalAlpha = Math.max(0, 1 - pct);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(sw.x, sw.y, r, r * 0.45, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    for (const l of this.lightnings) {
      ctx.strokeStyle = l.color;
      ctx.lineWidth = l.width;
      ctx.globalAlpha = Math.max(0, l.life / l.maxLife);
      ctx.beginPath();
      l.points.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    for (const pt of this.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size * 0.5, pt.y - pt.size * 0.5, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  private drawCourtyardFacilities(ctx: CanvasRenderingContext2D, state: GameState): void {
    // Gold Mine (far left)
    const mx = 42;
    const my = GROUND_Y - 4;
    ctx.fillStyle = '#5c3c24';
    ctx.fillRect(mx - 28, my - 46, 56, 46);
    ctx.fillStyle = '#2d4059';
    ctx.beginPath();
    ctx.moveTo(mx - 36, my - 44);
    ctx.lineTo(mx, my - 72);
    ctx.lineTo(mx + 36, my - 44);
    ctx.closePath();
    ctx.fill();
    // Spinning waterwheel
    ctx.save();
    ctx.translate(mx - 28, my - 22);
    ctx.rotate(this.elapsed * (1.1 + state.goldMineLevel * 0.15));
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 4);
      ctx.beginPath();
      ctx.moveTo(-16, 0);
      ctx.lineTo(16, 0);
      ctx.stroke();
    }
    ctx.restore();

    // Mana Shrine (left-rear)
    const sx = 368;
    const sy = GROUND_Y - 12;
    ctx.fillStyle = '#475569';
    ctx.fillRect(sx - 18, sy - 16, 36, 16);
    const bob = Math.sin(this.elapsed * 2.8) * 5;
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(sx, sy - 54 + bob);
    ctx.lineTo(sx + 11, sy - 36 + bob);
    ctx.lineTo(sx, sy - 20 + bob);
    ctx.lineTo(sx - 11, sy - 36 + bob);
    ctx.closePath();
    ctx.fill();
  }

  private drawCastle(ctx: CanvasRenderingContext2D, state: GameState): void {
    const lv = state.castleLevel;

    // Tier 3: Royal Spire (Lv 6+)
    if (lv >= 6) {
      ctx.fillStyle = '#64748b';
      ctx.fillRect(156, 108, 60, 130);
      ctx.fillStyle = '#1e3a5f';
      ctx.beginPath();
      ctx.moveTo(146, 112);
      ctx.lineTo(186, 42);
      ctx.lineTo(226, 112);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(186, 40, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    // Tier 2: Upper Keep Hall (Lv 3+)
    if (lv >= 3) {
      ctx.fillStyle = '#6d7888';
      ctx.fillRect(132, 186, 108, 125);
      ctx.fillStyle = '#253b59';
      ctx.beginPath();
      ctx.moveTo(122, 190);
      ctx.lineTo(186, 132);
      ctx.lineTo(250, 190);
      ctx.closePath();
      ctx.fill();
      // Glowing arched window
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(186, 232, 11, Math.PI, 0);
      ctx.lineTo(197, 254);
      ctx.lineTo(175, 254);
      ctx.closePath();
      ctx.fill();
    }

    // Tier 1: Main Stone Keep & Outer Bastions
    ctx.fillStyle = '#576272';
    ctx.fillRect(48, 348, 272, GROUND_Y - 348); // Lower curtain wall

    // Stone brick accents
    ctx.fillStyle = '#475161';
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 7; col++) {
        ctx.fillRect(56 + col * 38 + (row % 2) * 14, 360 + row * 24, 28, 14);
      }
    }

    // Left & Right Watchtowers
    [112, 256].forEach((tx) => {
      ctx.fillStyle = '#687385';
      ctx.fillRect(tx - 28, 298, 56, GROUND_Y - 298);
      ctx.fillStyle = '#8591a3';
      ctx.fillRect(tx - 34, 292, 68, 12);
      // Waving Heraldic Banner
      const wave = Math.sin(this.elapsed * 4.5 + tx) * 4;
      ctx.fillStyle = '#b91c1c';
      ctx.beginPath();
      ctx.moveTo(tx - 8, 292);
      ctx.lineTo(tx + 12, 292);
      ctx.lineTo(tx + 10 + wave, 256);
      ctx.lineTo(tx - 8, 264);
      ctx.closePath();
      ctx.fill();
    });

    // Gate Arch & Heavy Timber Gate (Right face of Castle)
    ctx.fillStyle = '#292524';
    ctx.beginPath();
    ctx.arc(294, 444, 26, Math.PI, 0);
    ctx.lineTo(320, GROUND_Y);
    ctx.lineTo(268, GROUND_Y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#784824';
    ctx.fillRect(274, 434, 40, GROUND_Y - 434);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(274, 446, 40, 5);
    ctx.fillRect(274, 466, 40, 5);

    // Battlement Merlons
    ctx.fillStyle = '#8591a3';
    for (let mx = 52; mx <= 306; mx += 26) {
      ctx.fillRect(mx, 336, 16, 14);
    }

    // Flickering Torch
    const torchR = 6 + Math.sin(this.elapsed * 14) * 1.8;
    ctx.fillStyle = 'rgba(251, 146, 60, 0.35)';
    ctx.beginPath();
    ctx.arc(262, 422, torchR * 2.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fb923c';
    ctx.beginPath();
    ctx.arc(262, 422, torchR, 0, Math.PI * 2);
    ctx.fill();

    // Gate Auto-Ballista Mount
    ctx.save();
    ctx.translate(292, 392);
    ctx.rotate(this.gateBallistaAngle);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-10, -4, 26, 8);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(8, -14, 4, 28);
    ctx.restore();
  }

  private drawCuteFace(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    facingRight: boolean,
    eyeColor = '#0f172a',
    cheekColor = 'rgba(251, 113, 133, 0.72)',
    blink = false,
  ): void {
    const dir = facingRight ? 1 : -1;
    // Rosy cheeks
    ctx.fillStyle = cheekColor;
    ctx.beginPath();
    ctx.ellipse(cx - 4.5 + dir * 2, cy + 3.2, 3, 1.9, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 4.5 + dir * 2, cy + 3.2, 3, 1.9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    if (blink) {
      ctx.strokeStyle = eyeColor;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(cx - 3.2 + dir * 2, cy, 2.2, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + 3.2 + dir * 2, cy, 2.2, Math.PI, 0);
      ctx.stroke();
    } else {
      ctx.fillStyle = eyeColor;
      ctx.beginPath();
      ctx.arc(cx - 3.2 + dir * 2, cy, 2.3, 0, Math.PI * 2);
      ctx.arc(cx + 3.2 + dir * 2, cy, 2.3, 0, Math.PI * 2);
      ctx.fill();

      // Sparkle highlights
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx - 3.8 + dir * 2, cy - 0.8, 0.9, 0, Math.PI * 2);
      ctx.arc(cx + 2.6 + dir * 2, cy - 0.8, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }

    // Tiny cute smile / mouth
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(cx + dir * 2, cy + 3.2, 1.8, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }

  private drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  private drawDefenders(ctx: CanvasRenderingContext2D, state: GameState): void {
    state.slots.forEach((slot, idx) => {
      const unlocked = state.castleLevel >= SLOT_UNLOCK_LEVELS[idx];
      if (!unlocked) return;

      const pos = SLOT_POSITIONS[idx];
      const isSelected = this.selectedSlot === idx;

      // Slot platform ring
      ctx.strokeStyle = isSelected ? '#fbbf24' : 'rgba(56, 189, 248, 0.55)';
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.ellipse(pos.x, pos.y + 4, 21, 7.5, 0, 0, Math.PI * 2);
      ctx.stroke();

      if (!slot.unitClass) {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y - 6, 6, 0, Math.PI * 2);
        ctx.fill();
        return;
      }

      const recoil = this.slotAttackAnim[idx] * 3.5;
      const bounce = Math.sin(this.elapsed * 4.5 + idx * 1.3) * 1.8;
      const meta = DEFENDER_CATALOG[slot.unitClass];

      ctx.save();
      ctx.translate(pos.x - recoil, pos.y - 10 + bounce);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      if (slot.unitClass === 'archer') {
        // Cute chibi ranger with oversized round hood & feather
        // Cloak body
        ctx.fillStyle = '#22c55e';
        ctx.strokeStyle = '#14532d';
        ctx.lineWidth = 2;
        this.drawRoundedRect(ctx, -9, -7, 18, 16, 7);
        ctx.fill();
        ctx.stroke();

        // Big round head + hood
        ctx.fillStyle = '#fde68a';
        ctx.beginPath();
        ctx.arc(0, -17, 11.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Hood wrap
        ctx.fillStyle = '#16a34a';
        ctx.beginPath();
        ctx.arc(-1, -18, 12.2, Math.PI * 0.85, Math.PI * 2.05);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Cute feather on hood
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.ellipse(-9, -26, 6, 2.6, -0.55, 0, Math.PI * 2);
        ctx.fill();

        this.drawCuteFace(ctx, 0, -16.5, true);

        // Cute wooden bow
        ctx.strokeStyle = '#92400e';
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.arc(10, -8, 10, -Math.PI * 0.45, Math.PI * 0.45);
        ctx.stroke();
        ctx.strokeStyle = '#fef3c7';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(11, -17);
        ctx.lineTo(11 - recoil * 0.8, -8);
        ctx.lineTo(11, 1);
        ctx.stroke();
      } else if (slot.unitClass === 'pyromancer') {
        // Cute chubby mage with oversized witch hat & star flame staff
        ctx.fillStyle = '#ea580c';
        ctx.strokeStyle = '#7c2d12';
        ctx.lineWidth = 2;
        this.drawRoundedRect(ctx, -10, -8, 20, 17, 8);
        ctx.fill();
        ctx.stroke();

        // Gold scarf
        ctx.fillStyle = '#fbbf24';
        this.drawRoundedRect(ctx, -8, -9, 16, 4.5, 2);
        ctx.fill();

        // Round face
        ctx.fillStyle = '#fde68a';
        ctx.beginPath();
        ctx.arc(0, -17, 10.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Cute floppy wizard hat
        ctx.fillStyle = '#c2410c';
        ctx.beginPath();
        ctx.ellipse(0, -24, 15, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-10, -24);
        ctx.quadraticCurveTo(-2, -41, 7, -37);
        ctx.lineTo(9, -24);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        this.drawCuteFace(ctx, 0, -16.5, true);

        // Staff + glowing bobbing flame
        ctx.strokeStyle = '#92400e';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(12, 8);
        ctx.lineTo(12, -16);
        ctx.stroke();
        const flamePulse = 5.5 + Math.sin(this.elapsed * 9) * 1.2;
        ctx.fillStyle = '#fb923c';
        ctx.beginPath();
        ctx.arc(12, -20, flamePulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(12, -20, flamePulse * 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (slot.unitClass === 'frostmage') {
        // Cute Frost Wizard with ice-blue star hat & snowflake wand
        ctx.fillStyle = '#0284c7';
        ctx.strokeStyle = '#0c4a6e';
        ctx.lineWidth = 2;
        this.drawRoundedRect(ctx, -10, -8, 20, 17, 8);
        ctx.fill();
        ctx.stroke();

        // Fluffy white fur trim
        ctx.fillStyle = '#e0f2fe';
        this.drawRoundedRect(ctx, -9, -9, 18, 4.5, 2);
        ctx.fill();

        ctx.fillStyle = '#fde68a';
        ctx.beginPath();
        ctx.arc(0, -17, 10.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Ice wizard hat
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.ellipse(0, -24, 15, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-10, -24);
        ctx.quadraticCurveTo(0, -42, 6, -37);
        ctx.lineTo(9, -24);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        this.drawCuteFace(ctx, 0, -16.5, true);

        // Ice crystal wand
        ctx.strokeStyle = '#7dd3fc';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(12, 8);
        ctx.lineTo(12, -16);
        ctx.stroke();
        ctx.fillStyle = '#bae6fd';
        ctx.beginPath();
        ctx.moveTo(12, -26);
        ctx.lineTo(17, -20);
        ctx.lineTo(12, -14);
        ctx.lineTo(7, -20);
        ctx.closePath();
        ctx.fill();
      } else if (slot.unitClass === 'paladin') {
        // Cute chibi knight with winged helm & heart crest shield
        ctx.fillStyle = '#60a5fa';
        ctx.strokeStyle = '#1e3a8a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-8, -8);
        ctx.lineTo(-15, 8);
        ctx.lineTo(-5, 9);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#e2e8f0';
        ctx.strokeStyle = '#334155';
        this.drawRoundedRect(ctx, -9, -7, 18, 16, 7);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#f1f5f9';
        ctx.beginPath();
        ctx.arc(0, -18, 11.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.ellipse(-2, -31, 6, 4, -0.25, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fde68a';
        this.drawRoundedRect(ctx, -7, -21, 16, 9, 4);
        ctx.fill();
        this.drawCuteFace(ctx, 1, -16.5, true);

        ctx.fillStyle = '#fbbf24';
        ctx.strokeStyle = '#92400e';
        this.drawRoundedRect(ctx, 7, -8, 10, 14, 4);
        ctx.fill();
        ctx.stroke();
      } else if (slot.unitClass === 'stormmage') {
        // Cute Storm Archmage with purple wizard hat & crackling lightning orb
        ctx.fillStyle = '#6d28d9';
        ctx.strokeStyle = '#2e1065';
        ctx.lineWidth = 2;
        this.drawRoundedRect(ctx, -10, -8, 20, 17, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fde68a';
        ctx.beginPath();
        ctx.arc(0, -17, 10.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Pointed Storm Hat
        ctx.fillStyle = '#7c3aed';
        ctx.beginPath();
        ctx.ellipse(0, -24, 15, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-10, -24);
        ctx.quadraticCurveTo(-4, -43, 8, -38);
        ctx.lineTo(9, -24);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Cute round glasses
        this.drawCuteFace(ctx, 0, -16.5, true);
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(-1.2, -16.5, 3.6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(5.2, -16.5, 3.6, 0, Math.PI * 2);
        ctx.stroke();

        // Floating lightning orb
        const orbPulse = 5 + Math.sin(this.elapsed * 12) * 1.3;
        ctx.fillStyle = '#c4b5fd';
        ctx.beginPath();
        ctx.arc(13, -18, orbPulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(13, -18, orbPulse * 0.45, 0, Math.PI * 2);
        ctx.fill();
      } else if (slot.unitClass === 'summoner') {
        // Cute Spirit Summoner with leafy druid hood & glowing summoning book
        ctx.fillStyle = '#059669';
        ctx.strokeStyle = '#064e3b';
        ctx.lineWidth = 2;
        this.drawRoundedRect(ctx, -10, -8, 20, 17, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fde68a';
        ctx.beginPath();
        ctx.arc(0, -17, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#34d399';
        ctx.beginPath();
        ctx.arc(-1, -18, 11.8, Math.PI * 0.85, Math.PI * 2.05);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#6ee7b7';
        ctx.beginPath();
        ctx.ellipse(-6, -31, 3.2, 6.5, -0.3, 0, Math.PI * 2);
        ctx.ellipse(2, -31, 3.2, 6.5, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        this.drawCuteFace(ctx, 0, -16.5, true);

        const bookBob = Math.sin(this.elapsed * 5 + idx) * 2;
        ctx.fillStyle = '#fef08a';
        ctx.strokeStyle = '#92400e';
        ctx.lineWidth = 1.6;
        this.drawRoundedRect(ctx, 8, -12 + bookBob, 11, 13, 2.5);
        ctx.fill();
        ctx.stroke();
      } else if (slot.unitClass === 'darkknight') {
        // Cute Chibi Dark Knight with crimson scarf, horned helm & huge broadsword
        ctx.fillStyle = '#be123c';
        ctx.strokeStyle = '#4c0519';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-8, -7);
        ctx.lineTo(-16, 9);
        ctx.lineTo(-4, 9);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#0f172a';
        this.drawRoundedRect(ctx, -9, -7, 18, 16, 7);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(0, -18, 11.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Cute red plume + little helm horns
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.ellipse(-2, -31, 7, 3.8, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.moveTo(-8, -24);
        ctx.lineTo(-13, -32);
        ctx.lineTo(-4, -27);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#fde68a';
        this.drawRoundedRect(ctx, -6, -21, 15, 8, 4);
        ctx.fill();
        this.drawCuteFace(ctx, 1, -16.8, true, '#e11d48');

        // Giant cute broadsword
        ctx.fillStyle = '#e2e8f0';
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(11, 6);
        ctx.lineTo(15, -24);
        ctx.lineTo(19, 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(10, 4, 10, 3.5);
      } else if (slot.unitClass === 'lancer') {
        // Cute Chibi Dragon Lancer with winged teal helm & long lance
        ctx.fillStyle = '#0d9488';
        ctx.strokeStyle = '#134e4a';
        ctx.lineWidth = 2;
        this.drawRoundedRect(ctx, -9, -7, 18, 16, 7);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#5eead4';
        ctx.beginPath();
        ctx.arc(0, -18, 11.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Cute dragon ear wings on helm
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.ellipse(-11, -22, 6, 3.2, -0.45, 0, Math.PI * 2);
        ctx.ellipse(9, -22, 5, 3, 0.45, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fde68a';
        this.drawRoundedRect(ctx, -6, -21, 15, 8.5, 4);
        ctx.fill();
        this.drawCuteFace(ctx, 1, -16.5, true);

        // Dragon Lance
        ctx.strokeStyle = '#0f766e';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(5, 8);
        ctx.lineTo(20, -24);
        ctx.stroke();
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.moveTo(23, -29);
        ctx.lineTo(15, -22);
        ctx.lineTo(20, -18);
        ctx.closePath();
        ctx.fill();
      } else if (slot.unitClass === 'zeus') {
        // Cute Chibi God Zeus on fluffy cloud with golden laurel & thunderbolt
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(-6, 8, 6.5, 0, Math.PI * 2);
        ctx.arc(0, 9, 7.5, 0, Math.PI * 2);
        ctx.arc(7, 8, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // White toga & gold sash
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        this.drawRoundedRect(ctx, -10, -8, 20, 16, 8);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-7, -7);
        ctx.lineTo(7, 5);
        ctx.stroke();

        // Fluffy white curls + head + beard
        ctx.fillStyle = '#f1f5f9';
        ctx.beginPath();
        ctx.arc(0, -18, 12.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fde68a';
        ctx.beginPath();
        ctx.arc(0, -17, 10, 0, Math.PI * 2);
        ctx.fill();
        // Cute fluffy white beard
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(1, -11, 7, 0, Math.PI);
        ctx.fill();
        // Golden laurel crown
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.arc(0, -21, 10, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();

        this.drawCuteFace(ctx, 0, -17.5, true);

        // Glowing golden thunderbolt in hand
        ctx.fillStyle = '#fde047';
        ctx.strokeStyle = '#ca8a04';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(14, -24);
        ctx.lineTo(9, -12);
        ctx.lineTo(14, -12);
        ctx.lineTo(10, 1);
        ctx.lineTo(19, -14);
        ctx.lineTo(14, -14);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (slot.unitClass === 'poseidon') {
        // Cute Chibi Sea God Poseidon with aqua wave, blue beard & golden trident
        ctx.fillStyle = '#06b6d4';
        ctx.strokeStyle = '#155e75';
        ctx.lineWidth = 2;
        this.drawRoundedRect(ctx, -10, -8, 20, 17, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fde68a';
        ctx.beginPath();
        ctx.arc(0, -17, 10.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Cute teal sea-beard & golden crown
        ctx.fillStyle = '#22d3ee';
        ctx.beginPath();
        ctx.arc(1, -11, 6.8, 0, Math.PI);
        ctx.fill();
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(-8, -25);
        ctx.lineTo(-6, -32);
        ctx.lineTo(0, -27);
        ctx.lineTo(6, -32);
        ctx.lineTo(8, -25);
        ctx.closePath();
        ctx.fill();

        this.drawCuteFace(ctx, 0, -17.5, true);

        // Golden Trident
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(13, 9);
        ctx.lineTo(13, -24);
        ctx.moveTo(8, -19);
        ctx.lineTo(18, -19);
        ctx.moveTo(8, -19);
        ctx.lineTo(8, -26);
        ctx.moveTo(18, -19);
        ctx.lineTo(18, -26);
        ctx.stroke();
      } else if (slot.unitClass === 'athena') {
        // Cute Chibi Goddess Athena with golden plumed helm, Aegis shield & radiant spear
        ctx.fillStyle = '#fef3c7';
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 2;
        this.drawRoundedRect(ctx, -9, -7, 18, 16, 7);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fde68a';
        ctx.beginPath();
        ctx.arc(0, -17, 10.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Golden Greek crested helm
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(0, -20, 11, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.ellipse(-2, -33, 7, 3.6, -0.2, 0, Math.PI * 2);
        ctx.fill();

        this.drawCuteFace(ctx, 0, -16.5, true);

        // Golden Aegis Shield & Radiant Spear
        ctx.fillStyle = '#fcd34d';
        ctx.strokeStyle = '#92400e';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(9, -2, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(14, 8);
        ctx.lineTo(16, -24);
        ctx.stroke();
      } else {
        // Cute Chibi Sun God Ra with glowing golden sun disk & falcon headdress
        const sunPulse = 14 + Math.sin(this.elapsed * 5) * 1.5;
        ctx.fillStyle = 'rgba(251, 191, 36, 0.28)';
        ctx.beginPath();
        ctx.arc(0, -24, sunPulse + 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(0, -26, 9, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#d97706';
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 2;
        this.drawRoundedRect(ctx, -10, -8, 20, 17, 8);
        ctx.fill();
        ctx.stroke();

        // Golden Egyptian collar
        ctx.fillStyle = '#fde047';
        this.drawRoundedRect(ctx, -9, -9, 18, 5, 2);
        ctx.fill();

        ctx.fillStyle = '#fde68a';
        ctx.beginPath();
        ctx.arc(0, -17, 10.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Cute golden falcon ears
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(-9, -22);
        ctx.lineTo(-13, -31);
        ctx.lineTo(-3, -25);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(9, -22);
        ctx.lineTo(13, -31);
        ctx.lineTo(3, -25);
        ctx.closePath();
        ctx.fill();

        this.drawCuteFace(ctx, 0, -16.5, true);

        // Sun Staff
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(13, 8);
        ctx.lineTo(13, -17);
        ctx.stroke();
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(13, -21, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Level tag
      ctx.fillStyle = meta.color;
      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`Lv.${slot.level}`, recoil, 20);

      ctx.restore();
    });
  }

  private drawSummon(ctx: CanvasRenderingContext2D, s: Summon2D): void {
    const hop = Math.abs(Math.sin(s.phase)) * 8;
    ctx.fillStyle = 'rgba(52, 211, 153, 0.25)';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 3, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(s.x, s.y - 12 - hop);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Cute bouncy mint forest spirit blob with leaf sprout
    ctx.fillStyle = '#6ee7b7';
    ctx.strokeStyle = '#065f46';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 12.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Leaf sprout on head
    ctx.strokeStyle = '#059669';
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(0, -19);
    ctx.stroke();
    ctx.fillStyle = '#34d399';
    ctx.beginPath();
    ctx.ellipse(-4, -20, 4.5, 2.2, -0.4, 0, Math.PI * 2);
    ctx.ellipse(4, -20, 4.5, 2.2, 0.4, 0, Math.PI * 2);
    ctx.fill();

    this.drawCuteFace(ctx, 0, -1, true, '#064e3b', 'rgba(251, 113, 133, 0.78)');
    ctx.restore();
  }

  private drawMenacingFace(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    eyeColor = '#ef4444',
    glowColor = '#fca5a5',
    fangCount = 2,
  ): void {
    // Fierce narrowed eyes (angled downward inward toward left-facing direction)
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy - 2);
    ctx.lineTo(cx - 2, cy + 0.5);
    ctx.lineTo(cx - 6, cy + 2.5);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx + 0.5, cy + 0.5);
    ctx.lineTo(cx + 6.5, cy - 2);
    ctx.lineTo(cx + 4.5, cy + 2.5);
    ctx.closePath();
    ctx.fill();

    // Glowing pupil slits
    ctx.fillStyle = glowColor;
    ctx.beginPath();
    ctx.arc(cx - 5, cy + 0.3, 1.1, 0, Math.PI * 2);
    ctx.arc(cx + 3.5, cy + 0.3, 1.1, 0, Math.PI * 2);
    ctx.fill();

    // Heavy furrowed brow
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 2.1;
    ctx.beginPath();
    ctx.moveTo(cx - 9, cy - 3.5);
    ctx.lineTo(cx - 1.5, cy - 0.5);
    ctx.lineTo(cx + 7.5, cy - 3.5);
    ctx.stroke();

    // Jagged snarl mouth + fangs
    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.roundRect(cx - 6.5, cy + 4.2, 11, 4.2, 1.5);
    ctx.fill();

    ctx.fillStyle = '#f8fafc';
    if (fangCount >= 2) {
      ctx.beginPath();
      ctx.moveTo(cx - 5, cy + 8);
      ctx.lineTo(cx - 3.5, cy + 4);
      ctx.lineTo(cx - 2, cy + 8);
      ctx.moveTo(cx + 0.5, cy + 8);
      ctx.lineTo(cx + 2, cy + 4);
      ctx.lineTo(cx + 3.5, cy + 8);
      ctx.fill();
    }
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, en: Enemy2D): void {
    const bob = en.type === 'wyvern' ? 0 : Math.abs(Math.sin(en.phase)) * 5;
    const tilt = en.type === 'wyvern' ? 0 : Math.sin(en.phase) * 0.05;
    const isFlash = en.hitFlashTimer > 0;
    const isSlowed = en.slowTimer > 0;

    // Ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.44)';
    ctx.beginPath();
    ctx.ellipse(
      en.x,
      en.type === 'wyvern' ? GROUND_Y + 4 : en.y + 3,
      en.radius * 0.92,
      6.5,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    ctx.save();
    ctx.translate(en.x, en.y - bob);
    ctx.rotate(tilt);
    ctx.lineJoin = 'miter';
    ctx.lineCap = 'round';

    if (en.type === 'goblin') {
      // Menacing hunched swamp goblin raider with razor ears, jagged spear & blood-red eyes
      const skinCol = isFlash ? '#ffffff' : isSlowed ? '#38bdf8' : '#4d7c0f';
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 2;

      // Tattered dark cloak/armor body
      ctx.fillStyle = isFlash ? '#ffffff' : '#292524';
      ctx.beginPath();
      ctx.moveTo(-11, -18);
      ctx.lineTo(9, -18);
      ctx.lineTo(13, 0);
      ctx.lineTo(4, -3);
      ctx.lineTo(-2, 1);
      ctx.lineTo(-10, -2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Jagged pointed ears
      ctx.fillStyle = skinCol;
      ctx.beginPath();
      ctx.moveTo(-8, -24);
      ctx.lineTo(-22, -31);
      ctx.lineTo(-10, -19);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(8, -24);
      ctx.lineTo(22, -31);
      ctx.lineTo(10, -19);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Angular hunched goblin skull/head
      ctx.fillStyle = skinCol;
      ctx.beginPath();
      ctx.moveTo(-12, -22);
      ctx.lineTo(-6, -32);
      ctx.lineTo(7, -31);
      ctx.lineTo(12, -21);
      ctx.lineTo(8, -12);
      ctx.lineTo(-10, -12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      this.drawMenacingFace(ctx, -1, -21, '#ef4444', '#fef08a');

      // Jagged rusty spear / cleaver pointing left toward castle
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(6, -6);
      ctx.lineTo(-21, -17);
      ctx.stroke();
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.moveTo(-28, -20);
      ctx.lineTo(-18, -21);
      ctx.lineTo(-19, -13);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (en.type === 'orc') {
      // Hulking brutal orc berserker with spiked iron pauldrons, jagged battle-axe & tusks
      const skinCol = isFlash ? '#ffffff' : isSlowed ? '#38bdf8' : '#3f6212';
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 2.3;

      // Broad muscular armored torso
      ctx.fillStyle = isFlash ? '#ffffff' : '#1c1917';
      ctx.beginPath();
      ctx.moveTo(-17, -28);
      ctx.lineTo(17, -28);
      ctx.lineTo(14, 0);
      ctx.lineTo(-14, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Spiked shoulder pauldrons
      ctx.fillStyle = isFlash ? '#ffffff' : '#475569';
      ctx.beginPath();
      ctx.moveTo(-22, -24);
      ctx.lineTo(-18, -36);
      ctx.lineTo(-9, -28);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(22, -24);
      ctx.lineTo(18, -36);
      ctx.lineTo(9, -28);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Fierce angular head + spiked skull helm
      ctx.fillStyle = skinCol;
      ctx.beginPath();
      ctx.moveTo(-14, -36);
      ctx.lineTo(14, -36);
      ctx.lineTo(12, -20);
      ctx.lineTo(-12, -20);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isFlash ? '#ffffff' : '#334155';
      ctx.beginPath();
      ctx.moveTo(-15, -35);
      ctx.lineTo(-11, -46);
      ctx.lineTo(0, -49);
      ctx.lineTo(11, -46);
      ctx.lineTo(15, -35);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Long sharp ivory horns
      ctx.fillStyle = '#e7e5e4';
      ctx.beginPath();
      ctx.moveTo(-11, -41);
      ctx.lineTo(-22, -55);
      ctx.lineTo(-5, -45);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(11, -41);
      ctx.lineTo(22, -55);
      ctx.lineTo(5, -45);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      this.drawMenacingFace(ctx, -1, -30, '#dc2626', '#fca5a5');

      // Large upward lower jaw tusks
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.moveTo(-9, -21);
      ctx.lineTo(-7, -29);
      ctx.lineTo(-4, -21);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(2, -21);
      ctx.lineTo(4, -29);
      ctx.lineTo(7, -21);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Heavy Notched Battle-Axe
      const axeSwing = Math.sin(en.phase) * 0.25;
      ctx.save();
      ctx.translate(-15, -16);
      ctx.rotate(axeSwing);
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 12);
      ctx.lineTo(-6, -24);
      ctx.stroke();
      ctx.fillStyle = '#64748b';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-6, -24);
      ctx.lineTo(-21, -28);
      ctx.lineTo(-17, -14);
      ctx.lineTo(-5, -15);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else if (en.type === 'golem') {
      // Craggy Obsidian Magma Golem with glowing lava veins, spikes & furnace eyes
      const rockCol = isFlash ? '#ffffff' : isSlowed ? '#38bdf8' : '#1e293b';
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 2.6;

      // Jagged monolith obsidian body
      ctx.fillStyle = rockCol;
      ctx.beginPath();
      ctx.moveTo(-18, 0);
      ctx.lineTo(-26, -30);
      ctx.lineTo(-19, -52);
      ctx.lineTo(-6, -58);
      ctx.lineTo(8, -56);
      ctx.lineTo(22, -48);
      ctx.lineTo(25, -26);
      ctx.lineTo(17, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Jagged shoulder rock spikes
      ctx.beginPath();
      ctx.moveTo(-22, -42);
      ctx.lineTo(-32, -57);
      ctx.lineTo(-12, -50);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(20, -42);
      ctx.lineTo(31, -55);
      ctx.lineTo(11, -50);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Glowing molten magma cracks across torso
      const magmaGlow = isSlowed ? '#38bdf8' : '#f97316';
      ctx.strokeStyle = magmaGlow;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-12, -40);
      ctx.lineTo(-2, -26);
      ctx.lineTo(9, -32);
      ctx.moveTo(-2, -26);
      ctx.lineTo(-5, -9);
      ctx.lineTo(8, -4);
      ctx.stroke();

      // Heavy spiked craggy fists
      const armSwing = Math.sin(en.phase) * 6;
      ctx.fillStyle = rockCol;
      ctx.strokeStyle = '#090d16';
      ctx.beginPath();
      ctx.moveTo(-34, -26 + armSwing);
      ctx.lineTo(-24, -34 + armSwing);
      ctx.lineTo(-20, -10 + armSwing);
      ctx.lineTo(-32, -8 + armSwing);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(22, -34 - armSwing);
      ctx.lineTo(34, -26 - armSwing);
      ctx.lineTo(32, -8 - armSwing);
      ctx.lineTo(20, -10 - armSwing);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Dark visor slit + burning furnace eyes
      ctx.fillStyle = '#090d16';
      ctx.fillRect(-14, -46, 22, 8);
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(-11, -44);
      ctx.lineTo(-4, -42);
      ctx.lineTo(-9, -40);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(5, -44);
      ctx.lineTo(-1, -42);
      ctx.lineTo(3, -40);
      ctx.closePath();
      ctx.fill();
    } else if (en.type === 'wyvern') {
      // Menacing Razor-Winged Abyssal Wyvern with horned skull, barbed tail & crimson glare
      const wingY = Math.sin(en.phase) * 18;
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 2.2;

      // Barbed venomous tail
      ctx.strokeStyle = isFlash ? '#ffffff' : '#4c1d95';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(14, -10);
      ctx.quadraticCurveTo(28, -4, 34, -16);
      ctx.stroke();
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(34, -16);
      ctx.lineTo(42, -21);
      ctx.lineTo(38, -11);
      ctx.closePath();
      ctx.fill();

      // Jagged skeletal bat wing
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 2;
      ctx.fillStyle = isFlash ? '#ffffff' : '#581c87';
      ctx.beginPath();
      ctx.moveTo(-2, -15);
      ctx.lineTo(14, -42 + wingY);
      ctx.lineTo(34, -22 + wingY * 0.7);
      ctx.lineTo(22, -14 + wingY * 0.4);
      ctx.lineTo(16, -20 + wingY * 0.3);
      ctx.lineTo(8, -11);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Angular armored wyvern body & neck
      ctx.fillStyle = isFlash ? '#ffffff' : isSlowed ? '#38bdf8' : '#3b0764';
      ctx.beginPath();
      ctx.moveTo(-22, -14);
      ctx.lineTo(-8, -24);
      ctx.lineTo(16, -17);
      ctx.lineTo(12, -5);
      ctx.lineTo(-14, -4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Swept-back sharp dragon horns
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.moveTo(-12, -21);
      ctx.lineTo(4, -34);
      ctx.lineTo(-4, -19);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Fierce glowing crimson eyes & fanged snout
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(-17, -17);
      ctx.lineTo(-10, -15);
      ctx.lineTo(-14, -13);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(-19, -9);
      ctx.lineTo(-17, -4);
      ctx.lineTo(-15, -9);
      ctx.moveTo(-13, -8);
      ctx.lineTo(-11, -4);
      ctx.lineTo(-9, -8);
      ctx.fill();
    } else {
      // Boss: Terrifying Abyssal Demon Overlord with hellfire aura, giant horns & flaming greatsword
      const plate = isFlash ? '#ffffff' : '#18181b';
      const auraPulse = 44 + Math.sin(this.elapsed * 6) * 5;

      // Dark crimson abyssal aura behind boss
      ctx.fillStyle = 'rgba(220, 38, 38, 0.22)';
      ctx.beginPath();
      ctx.arc(0, -38, auraPulse, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 2.8;

      // Tattered jagged war-cape
      ctx.fillStyle = isFlash ? '#ffffff' : '#7f1d1d';
      ctx.beginPath();
      ctx.moveTo(10, -64);
      ctx.lineTo(44, -8);
      ctx.lineTo(30, 0);
      ctx.lineTo(22, -9);
      ctx.lineTo(10, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Towering angular obsidian armor torso
      ctx.fillStyle = plate;
      ctx.beginPath();
      ctx.moveTo(-24, -62);
      ctx.lineTo(24, -62);
      ctx.lineTo(29, -30);
      ctx.lineTo(19, 0);
      ctx.lineTo(-19, 0);
      ctx.lineTo(-29, -30);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Glowing hellfire core on chest
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(0, -34);
      ctx.lineTo(7, -23);
      ctx.lineTo(0, -12);
      ctx.lineTo(-7, -23);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(0, -23, 3, 0, Math.PI * 2);
      ctx.fill();

      // Spiked Crimson Shoulder Pauldrons
      ctx.fillStyle = isFlash ? '#ffffff' : '#991b1b';
      ctx.beginPath();
      ctx.moveTo(-36, -42);
      ctx.lineTo(-32, -66);
      ctx.lineTo(-14, -56);
      ctx.lineTo(-18, -40);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(36, -42);
      ctx.lineTo(32, -66);
      ctx.lineTo(14, -56);
      ctx.lineTo(18, -40);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Demon Head + Massive Curved Abyssal Horns
      ctx.fillStyle = isFlash ? '#ffffff' : '#27272a';
      ctx.beginPath();
      ctx.moveTo(-16, -64);
      ctx.lineTo(16, -64);
      ctx.lineTo(14, -42);
      ctx.lineTo(-14, -42);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fca5a5';
      ctx.beginPath();
      ctx.moveTo(-14, -60);
      ctx.quadraticCurveTo(-36, -78, -22, -96);
      ctx.quadraticCurveTo(-24, -76, -8, -64);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(14, -60);
      ctx.quadraticCurveTo(36, -78, 22, -96);
      ctx.quadraticCurveTo(24, -76, 8, -64);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Iron Crown Spikes
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(-12, -64);
      ctx.lineTo(-8, -79);
      ctx.lineTo(0, -68);
      ctx.lineTo(8, -79);
      ctx.lineTo(12, -64);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Burning Infernal Eyes & Fanged Maw
      this.drawMenacingFace(ctx, -2, -54, '#f97316', '#fef08a', 3);

      // Giant Flaming Abyssal Greatsword pointing forward
      ctx.save();
      ctx.translate(-26, -24);
      ctx.rotate(Math.sin(en.phase) * 0.14);
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(0, 4);
      ctx.lineTo(-34, -26);
      ctx.lineTo(-26, -32);
      ctx.lineTo(4, -2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fde047';
      ctx.fillRect(-3, -6, 6, 14);
      ctx.restore();
    }

    // Overhead HP Bar
    const barW = en.type === 'boss' ? 72 : 36;
    const barH = en.type === 'boss' ? 6 : 4.5;
    const barY = en.type === 'boss' ? -108 : -en.radius * 2 - 14;
    const pct = Math.max(0, en.hp / en.maxHp);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(-barW / 2 - 1, barY - 1, barW + 2, barH + 2);
    ctx.fillStyle = en.type === 'boss' ? '#f43f5e' : '#ef4444';
    ctx.fillRect(-barW / 2, barY, barW * pct, barH);

    ctx.restore();
  }

  private drawFierceRightFace(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    eyeColor = '#fef08a',
    irisColor = '#ef4444',
    fangCount = 3,
  ): void {
    // Sharp angled fierce eyes looking right
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy - 3);
    ctx.lineTo(cx + 2, cy - 0.5);
    ctx.lineTo(cx - 3, cy + 2);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx + 4, cy - 0.5);
    ctx.lineTo(cx + 10, cy - 3.5);
    ctx.lineTo(cx + 8, cy + 2);
    ctx.closePath();
    ctx.fill();

    // Glowing slit pupils
    ctx.fillStyle = irisColor;
    ctx.beginPath();
    ctx.arc(cx - 1.5, cy, 1.3, 0, Math.PI * 2);
    ctx.arc(cx + 7, cy - 0.2, 1.3, 0, Math.PI * 2);
    ctx.fill();

    // Heavy furrowed brow ridge
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(cx - 6.5, cy - 5);
    ctx.lineTo(cx + 3, cy - 1.5);
    ctx.lineTo(cx + 11, cy - 5);
    ctx.stroke();

    // Snarling dark jaw + sharp fangs
    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.moveTo(cx - 2, cy + 4.5);
    ctx.lineTo(cx + 11, cy + 4);
    ctx.lineTo(cx + 9.5, cy + 9.5);
    ctx.lineTo(cx - 1, cy + 8.5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#f8fafc';
    for (let f = 0; f < fangCount; f++) {
      const fx = cx + 0.5 + f * 3.4;
      ctx.beginPath();
      ctx.moveTo(fx, cy + 4.5);
      ctx.lineTo(fx + 1.4, cy + 9);
      ctx.lineTo(fx + 2.8, cy + 4.5);
      ctx.closePath();
      ctx.fill();
    }
  }

  private drawPetPads(ctx: CanvasRenderingContext2D, state: GameState): void {
    [1, 0].forEach((idx) => {
      const pSlot = state.petSlots[idx];
      if (!pSlot || state.castleLevel < PET_UNLOCK_LEVELS[idx]) return;
      const pos = PET_SLOT_POSITIONS[idx];
      const isSelected = this.selectedPetSlot === idx;

      ctx.strokeStyle = isSelected ? '#fbbf24' : 'rgba(52, 211, 153, 0.5)';
      ctx.lineWidth = isSelected ? 2.6 : 1.6;
      ctx.beginPath();
      ctx.ellipse(pos.x, pos.y + 6, 30, 10, 0, 0, Math.PI * 2);
      ctx.stroke();

      if (!pSlot.petType) {
        ctx.fillStyle = 'rgba(52, 211, 153, 0.28)';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y - 4, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  private drawPets(ctx: CanvasRenderingContext2D, state: GameState, flyingPass: boolean): void {
    // Draw slot 1 before slot 0 (or sort by ground y) for clean 2.5D overlap
    const activeIndices = [1, 0].filter((idx) => {
      const pSlot = state.petSlots[idx];
      if (!pSlot || !pSlot.petType || state.castleLevel < PET_UNLOCK_LEVELS[idx]) return false;
      const isFlying = pSlot.petType === 'dragon' || pSlot.petType === 'phoenix';
      return flyingPass ? isFlying : !isFlying;
    });

    activeIndices.sort((a, b) => this.petRuntime[a].y - this.petRuntime[b].y);

    activeIndices.forEach((idx) => {
      const pSlot = state.petSlots[idx];
      if (!pSlot || !pSlot.petType) return;
      const rt = this.petRuntime[idx];
      const isSelected = this.selectedPetSlot === idx;
      const isFlying = pSlot.petType === 'dragon' || pSlot.petType === 'phoenix';
      const anim = this.petAttackAnim[idx];

      // Dynamic ground shadow directly underneath pet's live position
      const shadowScale = isFlying ? Math.max(0.55, 1 - rt.alt / 260) : 1;
      ctx.fillStyle = isFlying ? 'rgba(2, 6, 23, 0.3)' : 'rgba(2, 6, 23, 0.42)';
      ctx.beginPath();
      ctx.ellipse(rt.x, rt.y + 6, 30 * shadowScale, 10 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.ellipse(rt.x, rt.y + 6, 32 * shadowScale, 10.5 * shadowScale, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      const dir = rt.facingRight ? 1 : -1;
      const lunge = Math.sin(anim * Math.PI) * (isFlying ? 18 : 16) * dir;
      const diveDrop = isFlying ? Math.sin(anim * Math.PI) * 28 : 0;
      const leapUp = !isFlying && rt.lastLeap > 0 ? Math.sin(anim * Math.PI) * 95 : 0;
      const breathe = Math.sin(this.elapsed * 4.5 + idx * 1.9) * 2.5;
      const hoverBob = isFlying ? Math.sin(this.elapsed * 5.2 + idx * 1.5) * 6 : 0;
      const hopStep =
        !isFlying && Math.abs(rt.x - PET_SLOT_POSITIONS[idx].x) > 8 && pSlot.petType !== 'worm'
          ? Math.abs(Math.sin(this.elapsed * 12 + idx)) * 6
          : 0;
      const meta = PET_CATALOG[pSlot.petType];

      const drawX = rt.x + lunge;
      const drawY = rt.y - rt.alt + diveDrop - leapUp - hopStep + hoverBob - 6;

      ctx.save();
      ctx.translate(drawX, drawY);
      if (!rt.facingRight) {
        ctx.scale(-1, 1);
      }
      if (isFlying && anim > 0.05) {
        ctx.rotate(Math.sin(anim * Math.PI) * 0.24);
      }
      ctx.lineJoin = 'miter';
      ctx.lineCap = 'round';

      if (pSlot.petType === 'puppy') {
        // Massive Armored Golden Dire-Wolf!
        const tailSlash = Math.sin(this.elapsed * 10) * 0.25;

        // Spiked muscular tail
        ctx.save();
        ctx.translate(-22, -16);
        ctx.rotate(-0.35 + tailSlash);
        ctx.fillStyle = '#b45309';
        ctx.strokeStyle = '#1c1917';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-18, -14);
        ctx.lineTo(-10, -3);
        ctx.lineTo(-22, -4);
        ctx.lineTo(-8, 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Powerful front & hind legs with iron claws
        ctx.fillStyle = '#92400e';
        ctx.strokeStyle = '#1c1917';
        ctx.lineWidth = 2.4;
        [
          [-18, -8, 9, 14],
          [-7, -6, 8, 13],
          [8, -6, 9, 14],
          [17, -7, 8, 14],
        ].forEach(([lx, ly, lw, lh]) => {
          ctx.fillRect(lx, ly, lw, lh);
          ctx.strokeRect(lx, ly, lw, lh);
        });

        // Muscular armored wolf torso
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.moveTo(-24, -18);
        ctx.lineTo(-8, -28);
        ctx.lineTo(18, -28);
        ctx.lineTo(24, -15);
        ctx.lineTo(18, -4);
        ctx.lineTo(-20, -4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Steel & Gold Shoulder Armor + Back Spikes
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.moveTo(-2, -29);
        ctx.lineTo(20, -30);
        ctx.lineTo(24, -15);
        ctx.lineTo(4, -10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(-12, -28);
        ctx.lineTo(-7, -38);
        ctx.lineTo(-2, -28);
        ctx.moveTo(-2, -29);
        ctx.lineTo(4, -40);
        ctx.lineTo(9, -29);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Fierce angular dire-wolf head & jagged mane
        ctx.save();
        ctx.translate(0, breathe * 0.5);
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(8, -36);
        ctx.lineTo(24, -38);
        ctx.lineTo(34, -27);
        ctx.lineTo(31, -21);
        ctx.lineTo(14, -18);
        ctx.lineTo(6, -24);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Sharp pointed wolf ears
        ctx.fillStyle = '#78350f';
        ctx.beginPath();
        ctx.moveTo(10, -35);
        ctx.lineTo(7, -50);
        ctx.lineTo(17, -37);
        ctx.moveTo(17, -36);
        ctx.lineTo(21, -51);
        ctx.lineTo(25, -36);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        this.drawFierceRightFace(ctx, 20, -29, '#fef08a', '#dc2626', 3);
        ctx.restore();
      } else if (pSlot.petType === 'slimeking') {
        // Towering Armored Abyssal King Slime!
        const squish = 1 + Math.sin(this.elapsed * 5.2) * 0.06;
        ctx.save();
        ctx.scale(squish, 1 / squish);

        // Dark abyssal aura ring
        ctx.fillStyle = 'rgba(14, 165, 233, 0.25)';
        ctx.beginPath();
        ctx.ellipse(0, -16, 30, 26, 0, 0, Math.PI * 2);
        ctx.fill();

        // Sharp ice/crystal dorsal spikes jutting out
        ctx.fillStyle = '#bae6fd';
        ctx.strokeStyle = '#0c4a6e';
        ctx.lineWidth = 2.2;
        [
          [-24, -16, -34, -26, -16, -25],
          [-18, -28, -26, -42, -10, -33],
          [16, -29, 24, -42, 22, -22],
          [22, -15, 34, -22, 24, -7],
        ].forEach(([x1, y1, x2, y2, x3, y3]) => {
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.lineTo(x3, y3);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        });

        // Massive towering slime body
        ctx.fillStyle = '#0284c7';
        ctx.strokeStyle = '#082f49';
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.moveTo(-26, 4);
        ctx.quadraticCurveTo(-28, -32, 0, -36);
        ctx.quadraticCurveTo(28, -32, 26, 4);
        ctx.quadraticCurveTo(0, 9, -26, 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Glowing abyssal core inside
        ctx.fillStyle = 'rgba(56, 189, 248, 0.55)';
        ctx.beginPath();
        ctx.ellipse(0, -16, 18, 15, 0, 0, Math.PI * 2);
        ctx.fill();

        // Heavy Spiked War-Crown
        ctx.fillStyle = '#f59e0b';
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(-15, -34);
        ctx.lineTo(-17, -49);
        ctx.lineTo(-8, -40);
        ctx.lineTo(0, -53);
        ctx.lineTo(8, -40);
        ctx.lineTo(17, -49);
        ctx.lineTo(15, -34);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Crown ruby
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(0, -39, 3.2, 0, Math.PI * 2);
        ctx.fill();

        this.drawFierceRightFace(ctx, 4, -17, '#e0f2fe', '#0284c7', 4);
        ctx.restore();
      } else if (pSlot.petType === 'worm') {
        // Towering Armored Desert Deathworm bursting out of shattered rocks!
        const wiggle = Math.sin(this.elapsed * 6.5) * 3;

        // Cracked stone crater & spikes
        ctx.fillStyle = '#451a03';
        ctx.strokeStyle = '#1c1917';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.ellipse(0, 6, 28, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#57534e';
        [
          [-24, 4, -18, -9, -10, 4],
          [12, 4, 21, -10, 26, 4],
        ].forEach(([x1, y1, x2, y2, x3, y3]) => {
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.lineTo(x3, y3);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        });

        // Massive segmented armored carapace
        const segs = [
          { x: -6, y: -4, rx: 18, ry: 14, col: '#3f6212' },
          { x: -2 + wiggle * 0.4, y: -19, rx: 17, ry: 14, col: '#4d7c0f' },
          { x: 4 + wiggle * 0.8, y: -34, rx: 16.5, ry: 14, col: '#65a30d' },
        ];
        segs.forEach((s) => {
          // Dorsal chitin spine
          ctx.fillStyle = '#1a2e05';
          ctx.beginPath();
          ctx.moveTo(s.x - s.rx + 2, s.y - 4);
          ctx.lineTo(s.x - s.rx - 9, s.y - 12);
          ctx.lineTo(s.x - s.rx + 6, s.y + 4);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = s.col;
          ctx.beginPath();
          ctx.ellipse(s.x, s.y, s.rx, s.ry, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });

        // Monstrous Head + Ringed Fang Maw
        const hx = 10 + wiggle;
        const hy = -47;
        ctx.fillStyle = '#84cc16';
        ctx.beginPath();
        ctx.arc(hx, hy, 17, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Dark armored brow crest
        ctx.fillStyle = '#365314';
        ctx.beginPath();
        ctx.moveTo(hx - 14, hy - 8);
        ctx.lineTo(hx - 4, hy - 22);
        ctx.lineTo(hx + 12, hy - 14);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Gaping toothed maw facing right
        ctx.fillStyle = '#090d16';
        ctx.beginPath();
        ctx.ellipse(hx + 10, hy + 2, 8.5, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fef9c3';
        for (let t = -7; t <= 7; t += 4.5) {
          ctx.beginPath();
          ctx.moveTo(hx + 6, hy + t - 1.5);
          ctx.lineTo(hx + 15, hy + t);
          ctx.lineTo(hx + 6, hy + t + 1.5);
          ctx.closePath();
          ctx.fill();
        }

        // Fierce toxic glowing predator eyes
        ctx.fillStyle = '#bef264';
        ctx.beginPath();
        ctx.moveTo(hx - 2, hy - 10);
        ctx.lineTo(hx + 7, hy - 7);
        ctx.lineTo(hx + 1, hy - 4);
        ctx.closePath();
        ctx.fill();
      } else if (pSlot.petType === 'dragon') {
        // Towering Crimson Elder Fire Dragon!
        const wingFlap = Math.sin(this.elapsed * 11) * 14;
        ctx.strokeStyle = '#1c1917';
        ctx.lineWidth = 2.5;

        // Fiery heat aura
        ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
        ctx.beginPath();
        ctx.ellipse(0, -10, 38, 30, 0, 0, Math.PI * 2);
        ctx.fill();

        // Huge jagged back wing
        ctx.fillStyle = '#7f1d1d';
        ctx.beginPath();
        ctx.moveTo(-4, -12);
        ctx.lineTo(-34, -44 + wingFlap);
        ctx.lineTo(-42, -18 + wingFlap * 0.7);
        ctx.lineTo(-28, -14 + wingFlap * 0.4);
        ctx.lineTo(-22, -2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Spiked dragon tail with blazing flame tip
        ctx.fillStyle = '#b91c1c';
        ctx.beginPath();
        ctx.moveTo(-12, 4);
        ctx.quadraticCurveTo(-34, 16, -40, 2);
        ctx.lineTo(-32, 8);
        ctx.lineTo(-10, 12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fb923c';
        ctx.beginPath();
        ctx.moveTo(-40, 2);
        ctx.lineTo(-48, -6);
        ctx.lineTo(-36, -1);
        ctx.closePath();
        ctx.fill();

        // Muscular armored dragon body + plated belly
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.ellipse(0, -4, 21, 16, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.ellipse(6, 0, 11, 10, -0.2, 0, Math.PI * 2);
        ctx.fill();

        // Front colossal wing with gold claw tip
        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.moveTo(-2, -10);
        ctx.lineTo(-26, -38 - wingFlap * 0.6);
        ctx.lineTo(-36, -12 - wingFlap * 0.4);
        ctx.lineTo(-16, -2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Fierce horned dragon neck & roaring head
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.moveTo(6, -12);
        ctx.lineTo(14, -34);
        ctx.lineTo(34, -30);
        ctx.lineTo(36, -22);
        ctx.lineTo(22, -18);
        ctx.lineTo(16, -4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Giant curved obsidian & gold horns
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.moveTo(14, -34);
        ctx.lineTo(2, -49);
        ctx.lineTo(20, -35);
        ctx.moveTo(20, -34);
        ctx.lineTo(14, -50);
        ctx.lineTo(26, -33);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        this.drawFierceRightFace(ctx, 21, -27, '#fef08a', '#dc2626', 3);
      } else if (pSlot.petType === 'phoenix') {
        // Towering Blazing Solar Great Phoenix!
        const wingFlap = Math.sin(this.elapsed * 13) * 14;
        ctx.strokeStyle = '#7c2d12';
        ctx.lineWidth = 2.4;

        // Solar flare halo
        ctx.fillStyle = 'rgba(251, 146, 60, 0.24)';
        ctx.beginPath();
        ctx.ellipse(0, -10, 40, 32, 0, 0, Math.PI * 2);
        ctx.fill();

        // Long sweeping triple flame tail ribbons
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(-10, -2);
        ctx.quadraticCurveTo(-40, -18 + wingFlap * 0.3, -46, 6);
        ctx.quadraticCurveTo(-30, 12, -10, 6);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(-10, 2);
        ctx.quadraticCurveTo(-36, 12, -42, 24);
        ctx.quadraticCurveTo(-24, 16, -8, 8);
        ctx.closePath();
        ctx.fill();

        // Giant razor-feathered flame wings
        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.moveTo(-2, -10);
        ctx.lineTo(-32, -46 + wingFlap);
        ctx.lineTo(-40, -24 + wingFlap * 0.6);
        ctx.lineTo(-28, -14 + wingFlap * 0.3);
        ctx.lineTo(-20, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(-22, -42 - wingFlap * 0.5);
        ctx.lineTo(-30, -16 - wingFlap * 0.3);
        ctx.lineTo(-10, -2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Powerful golden-armored avian body
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.ellipse(3, -6, 18, 15, -0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Sharp hawk head, blazing crest & hooked predator beak
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(15, -24, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Blazing triple crown crest
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(10, -35);
        ctx.lineTo(-2, -49);
        ctx.lineTo(14, -37);
        ctx.lineTo(14, -50);
        ctx.lineTo(22, -35);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Hooked war-beak
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.moveTo(26, -27);
        ctx.lineTo(38, -22);
        ctx.lineTo(28, -17);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Fierce white-hot eagle eyes
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(14, -28);
        ctx.lineTo(24, -25);
        ctx.lineTo(17, -22);
        ctx.closePath();
        ctx.fill();
      } else {
        // Massive 3-Headed Hellhound Cerberus with Iron Spiked Armor & Hellfire!
        ctx.strokeStyle = '#090d16';
        ctx.lineWidth = 2.6;

        // Hellfire ember aura
        ctx.fillStyle = 'rgba(244, 63, 94, 0.22)';
        ctx.beginPath();
        ctx.ellipse(2, -18, 34, 26, 0, 0, Math.PI * 2);
        ctx.fill();

        // Blazing forked demon tail
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.moveTo(-22, -16);
        ctx.lineTo(-38, -28);
        ctx.lineTo(-30, -16);
        ctx.lineTo(-40, -10);
        ctx.lineTo(-20, -8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Heavy clawed beast legs
        ctx.fillStyle = '#450a0a';
        [
          [-20, -9, 9, 15],
          [-8, -7, 9, 14],
          [8, -7, 9, 14],
          [18, -8, 9, 15],
        ].forEach(([lx, ly, lw, lh]) => {
          ctx.fillRect(lx, ly, lw, lh);
          ctx.strokeRect(lx, ly, lw, lh);
        });

        // Huge muscular obsidian-crimson body
        ctx.fillStyle = '#7f1d1d';
        ctx.beginPath();
        ctx.moveTo(-25, -20);
        ctx.lineTo(-8, -30);
        ctx.lineTo(20, -30);
        ctx.lineTo(26, -15);
        ctx.lineTo(18, -4);
        ctx.lineTo(-22, -4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Iron spiked collar & shoulder plate
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(2, -31, 18, 10);
        ctx.strokeRect(2, -31, 18, 10);
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.moveTo(4, -31);
        ctx.lineTo(8, -40);
        ctx.lineTo(12, -31);
        ctx.moveTo(12, -31);
        ctx.lineTo(16, -40);
        ctx.lineTo(20, -31);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 3 Fierce Snarling Horned Hellhound Heads!
        const heads = [
          { x: 6, y: -42, scale: 0.88, col: '#991b1b' },
          { x: 24, y: -40, scale: 0.88, col: '#991b1b' },
          { x: 16, y: -28, scale: 1.04, col: '#dc2626' },
        ];
        heads.forEach((h) => {
          ctx.save();
          ctx.translate(h.x, h.y);
          ctx.scale(h.scale, h.scale);

          ctx.fillStyle = h.col;
          ctx.beginPath();
          ctx.moveTo(-12, -8);
          ctx.lineTo(8, -11);
          ctx.lineTo(16, -1);
          ctx.lineTo(12, 7);
          ctx.lineTo(-10, 7);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Sharp demon horns/ears
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.moveTo(-10, -8);
          ctx.lineTo(-14, -20);
          ctx.lineTo(-3, -10);
          ctx.moveTo(0, -10);
          ctx.lineTo(4, -21);
          ctx.lineTo(7, -10);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          this.drawFierceRightFace(ctx, 3, -2, '#fde047', '#ef4444', 3);
          ctx.restore();
        });
      }

      // Level tag beneath pet (un-flipped so text always reads left-to-right)
      ctx.save();
      if (!rt.facingRight) {
        ctx.scale(-1, 1);
      }
      ctx.fillStyle = meta.color;
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`Lv.${pSlot.level}`, 0, isFlying ? 42 : 20);
      ctx.restore();

      ctx.restore();
    });
  }

  private drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile2D): void {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);

    if (p.kind === 'arrow') {
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(-12, -1.8, 24, 3.6);
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(8, -4);
      ctx.lineTo(8, 4);
      ctx.closePath();
      ctx.fill();
    } else if (p.kind === 'lance') {
      ctx.fillStyle = '#2dd4bf';
      ctx.fillRect(-18, -2.5, 32, 5);
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(10, -5.5);
      ctx.lineTo(10, 5.5);
      ctx.closePath();
      ctx.fill();
    } else if (p.kind === 'slash') {
      ctx.strokeStyle = '#fb7185';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(-8, 0, 26, -Math.PI * 0.4, Math.PI * 0.4);
      ctx.stroke();
      ctx.strokeStyle = '#ffe4e6';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(-8, 0, 26, -Math.PI * 0.35, Math.PI * 0.35);
      ctx.stroke();
    } else if (p.kind === 'frostshard') {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#bae6fd';
      ctx.beginPath();
      ctx.moveTo(11, 0);
      ctx.lineTo(0, -5);
      ctx.lineTo(-9, 0);
      ctx.lineTo(0, 5);
      ctx.closePath();
      ctx.fill();
    } else if (p.kind === 'tidal') {
      ctx.fillStyle = 'rgba(6, 182, 212, 0.35)';
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ecfeff';
      ctx.beginPath();
      ctx.arc(3, -3, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'divinebeam') {
      ctx.fillStyle = 'rgba(253, 224, 71, 0.45)';
      ctx.fillRect(-16, -4, 34, 8);
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.moveTo(22, 0);
      ctx.lineTo(6, -6);
      ctx.lineTo(6, 6);
      ctx.closePath();
      ctx.fill();
    } else {
      const r = p.kind === 'meteor' ? 16 : p.kind === 'sunflare' ? 14 : 8;
      ctx.fillStyle =
        p.kind === 'sunflare' ? 'rgba(253, 224, 71, 0.4)' : 'rgba(249, 115, 22, 0.35)';
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.75, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle =
        p.kind === 'meteor' ? '#ef4444' : p.kind === 'sunflare' ? '#f59e0b' : '#f97316';
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(2, 0, r * 0.48, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private loop = (now: number): void => {
    if (this.disposed) return;
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTimestamp) / 1000));
    this.lastTimestamp = now;

    this.update(dt);
    this.render();

    this.rafId = requestAnimationFrame(this.loop);
  };

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.resize);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
  }
}
