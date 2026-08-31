import type { EnemyDef, EnemyAction, ActionKind } from "../data/rifts/enemies";
import { CAUSAL_MARK, GUARD, OVERFLOW, PLAYER_BASE, SUNDER } from "../data/combat/balance";
import { createSystemRng, type Rng } from "./Rng";
import { addStain, stainStatus } from "./StainSystem";
import { NEUTRAL_MODIFIERS, applyCombatConsumable, type RelicModifiers } from "./EffectRegistry";

/**
 * 전투 엔진 — 순수 상태 기계.
 *
 * UI(Scene)는 상태를 그리기만 하고, 규칙은 전부 여기서 계산한다.
 * 모든 무작위는 주입된 Rng를 거치므로 같은 시드로 재현·검증할 수 있다.
 *
 * 설계 기둥:
 * - 방어는 만능이 아니다. 강공격은 크게 줄이지만 연속 사용하면 자세가 무너지고,
 *   표식 폭발 앞에서는 거의 쓸모가 없다.
 * - 계통 기술은 대가를 요구한다. 인과 표식은 예측이 맞아야 이득이고,
 *   결손 절단은 방어를 무시하는 대신 얼룩과 반동을 남긴다.
 * - 죽음의 기억 단계가 적의 의도를 얼마나 정확히 보여줄지 결정한다.
 */

export type PlayerActionId = "basic-strike" | "guard" | "causal-mark" | "sunder" | "last-ditch" | "use-item";

export interface PlayerAction {
  id: PlayerActionId;
  /** 인과 표식으로 지목할 행동 계열. */
  predictKind?: ActionKind;
  /** 사용할 소모품 id. */
  itemId?: string;
}

export interface CombatPlayerState {
  hp: number;
  maxHp: number;
  guarding: boolean;
  consecutiveGuards: number;
  stain: number;
  overflowTurnsLeft: number;
  /** 피해를 먼저 흡수하는 보호막. */
  shield: number;
  /** 이번 턴에 지목해 둔 적 행동 계열. */
  predictedKind: ActionKind | null;
}

export interface CombatEnemyState {
  def: EnemyDef;
  hp: number;
  patternIndex: number;
  phase: 1 | 2;
  /** 적이 플레이어에게 남긴 표식 — 폭발 계열 피해가 증폭된다. */
  markedPlayer: boolean;
  /** 페이즈 2에서 직전 행동을 거꾸로 되풀이할 차례인지. */
  reverseDue: boolean;
  history: string[];
}

export interface CombatState {
  player: CombatPlayerState;
  enemy: CombatEnemyState;
  turn: number;
  log: string[];
  over: boolean;
  result: "win" | "lose" | null;
  /** 이 인카운터의 죽음의 기억 단계 (0~3). */
  memoryTier: number;
  /** 전투 기록 — 보고와 보상 판정에 쓴다. */
  record: {
    itemsUsed: string[];
    damageTaken: number;
    damageDealt: number;
    turns: number;
    overflowTriggered: boolean;
  };
  /** 이번 전투에서 얼룩이 100을 찍었는지 — 종료 후 페널티 후보가 추가된다. */
  overflowResidue: boolean;
  /** 장착 유물에서 파생된 수정치. 전투 중에는 변하지 않는다. */
  modifiers: RelicModifiers;
  /** 얼룩 상승으로 벌어들인 파편 (유물 효과). */
  fragmentsEarned: number;
}

export interface CombatSetup {
  enemy: EnemyDef;
  memoryTier: number;
  playerMaxHp?: number;
  playerHp?: number;
  stain?: number;
  isBoss?: boolean;
  modifiers?: RelicModifiers;
}

export function createCombat(setup: CombatSetup): CombatState {
  const maxHp = setup.playerMaxHp ?? PLAYER_BASE.maxHp;
  const modifiers = setup.modifiers ?? NEUTRAL_MODIFIERS;
  return {
    player: {
      hp: setup.playerHp ?? maxHp,
      maxHp,
      guarding: false,
      consecutiveGuards: 0,
      stain: setup.stain ?? 0,
      overflowTurnsLeft: 0,
      shield: modifiers.startingShield,
      predictedKind: null,
    },
    enemy: {
      def: setup.enemy,
      hp: setup.enemy.maxHp,
      patternIndex: 0,
      phase: 1,
      markedPlayer: false,
      reverseDue: false,
      history: [],
    },
    turn: 1,
    log: [`${setup.enemy.name}와(과) 마주쳤다.`],
    over: false,
    result: null,
    memoryTier: Math.max(0, Math.min(3, Math.max(setup.memoryTier, modifiers.memoryFloor))),
    record: { itemsUsed: [], damageTaken: 0, damageDealt: 0, turns: 0, overflowTriggered: false },
    overflowResidue: false,
    modifiers,
    fragmentsEarned: 0,
  };
}

/** 적이 이번 턴에 할 행동. 페이즈 2에서는 직전 두 행동 중 하나를 거꾸로 되풀이한다. */
export function plannedEnemyAction(state: CombatState, rng?: Rng): EnemyAction {
  const { enemy } = state;
  const pattern = enemy.def.pattern;

  if (enemy.phase === 2 && enemy.reverseDue && enemy.history.length >= 2) {
    const recent = enemy.history.slice(-2);
    const pickIndex = (rng ? rng.int(0, 1) : (state.turn % 2)) as 0 | 1;
    const chosenId = recent[pickIndex];
    const found = pattern.find((a) => a.id === chosenId);
    if (found) return found;
  }
  return pattern[enemy.patternIndex % pattern.length];
}

/**
 * 기억 단계에 따라 다르게 보여주는 적 의도.
 * 0단계는 방향조차 흐릿하고, 3단계에서야 구체적인 대응 정보가 열린다.
 */
export function describeEnemyIntent(state: CombatState): string {
  const action = plannedEnemyAction(state);
  switch (state.memoryTier) {
    case 0:
      return "무언가 준비하고 있다. 아직 읽히지 않는다.";
    case 1:
      return `${action.telegraph}.`;
    case 2:
      return `${action.telegraph}. — ${kindLabel(action.kind)} 계열로 보인다.`;
    default: {
      const range = action.damage[1] > 0 ? ` (${action.damage[0]}~${action.damage[1]})` : "";
      return `${action.label}${range} — ${kindAdvice(action.kind)}`;
    }
  }
}

export function kindLabel(kind: ActionKind): string {
  switch (kind) {
    case "weak":
      return "약공격";
    case "strong":
      return "강공격";
    case "mark":
      return "표식";
    case "detonate":
      return "표식 폭발";
    case "guardbreak":
      return "방어 붕괴";
    case "recover":
      return "회복";
  }
}

function kindAdvice(kind: ActionKind): string {
  switch (kind) {
    case "weak":
      return "방어로 절반 정도는 흘릴 수 있다.";
    case "strong":
      return "방어가 가장 크게 듣는다.";
    case "mark":
      return "지금은 아프지 않다. 다음이 문제다.";
    case "detonate":
      return "방어는 거의 소용없다. 피하거나 먼저 끝내야 한다.";
    case "guardbreak":
      return "방어를 뚫는다. 다른 수를 써라.";
    case "recover":
      return "무방비다. 몰아칠 기회다.";
  }
}

export function canUseLastDitch(state: CombatState): boolean {
  return state.player.hp <= state.player.maxHp * PLAYER_BASE.lastDitchThreshold;
}

function roll(rng: Rng, range: [number, number]): number {
  return rng.int(range[0], range[1]);
}

function pushLog(state: CombatState, line: string) {
  state.log.push(line);
  if (state.log.length > 40) state.log.shift();
}

function dealToEnemy(state: CombatState, amount: number) {
  const stain = stainStatus(state.player.stain);
  const multiplier = state.player.overflowTurnsLeft > 0 ? OVERFLOW.damageMultiplier : stain.damageMultiplier;
  const dealt = Math.max(1, Math.round(amount * multiplier));
  state.enemy.hp = Math.max(0, state.enemy.hp - dealt);
  state.record.damageDealt += dealt;
  return dealt;
}

function dealToPlayer(state: CombatState, rawAmount: number, kind: ActionKind) {
  let amount = rawAmount;

  // 방어 판정 — 계열마다 효율이 다르고, 연속 방어는 자세가 무너진다.
  if (state.player.guarding && kind !== "guardbreak") {
    const base =
      kind === "strong"
        ? GUARD.strongReduction
        : kind === "detonate"
        ? GUARD.detonateReduction
        : GUARD.weakReduction;
    const posturePenalty = Math.max(0, state.player.consecutiveGuards - 1) * GUARD.postureLossPerRepeat;
    const effective = Math.max(0, Math.min(0.9, base + state.modifiers.guardBonus - posturePenalty));
    amount = amount * (1 - effective);
  }

  // 적이 남긴 표식이 있으면 폭발 계열이 증폭된다.
  if (kind === "detonate" && state.enemy.markedPlayer) {
    amount *= 1.5;
    state.enemy.markedPlayer = false;
  }

  const stain = stainStatus(state.player.stain);
  const vulnerability = state.player.overflowTurnsLeft > 0 ? OVERFLOW.vulnerability : stain.vulnerability;
  let final = Math.max(0, Math.round(amount * vulnerability));

  if (state.player.shield > 0 && final > 0) {
    const absorbed = Math.min(state.player.shield, final);
    state.player.shield -= absorbed;
    final -= absorbed;
  }

  state.player.hp = Math.max(0, state.player.hp - final);
  state.record.damageTaken += final;
  return final;
}

function applyStain(state: CombatState, delta: number) {
  const before = state.player.stain;
  state.player.stain = addStain(state.player.stain, delta);
  if (state.player.stain > before) {
    state.fragmentsEarned += state.modifiers.fragmentsOnStain;
  }
  if (state.player.stain >= 100 && state.player.overflowTurnsLeft <= 0) {
    state.player.overflowTurnsLeft = OVERFLOW.durationTurns;
    state.overflowResidue = true;
    state.record.overflowTriggered = true;
    pushLog(state, "얼룩이 넘쳤다 — 개인 범람. 잠깐은 강해진다. 대가는 나중에 온다.");
  }
}

/** 플레이어 행동 한 번 + 이어지는 적 행동까지 한 턴을 처리한다. */
export function takeTurn(
  state: CombatState,
  action: PlayerAction,
  rng: Rng = createSystemRng(),
  itemEffect?: (state: CombatState, itemId: string) => void
): CombatState {
  if (state.over) return state;

  // 불변 유지를 위해 깊은 복사 후 진행한다.
  const next: CombatState = {
    ...state,
    player: { ...state.player },
    enemy: { ...state.enemy, history: [...state.enemy.history] },
    log: [...state.log],
    record: { ...state.record, itemsUsed: [...state.record.itemsUsed] },
  };

  const wasGuarding = next.player.guarding;
  next.player.guarding = false;
  next.player.predictedKind = null;

  const plannedBefore = plannedEnemyAction(next, rng);

  // --- 1. 플레이어 행동 ---
  switch (action.id) {
    case "basic-strike": {
      const dealt = dealToEnemy(next, roll(rng, PLAYER_BASE.basicStrike) + next.modifiers.basicStrikeBonus);
      pushLog(next, `기초 타격 — ${dealt}의 피해.`);
      next.player.consecutiveGuards = 0;
      break;
    }
    case "guard": {
      next.player.guarding = true;
      next.player.consecutiveGuards = wasGuarding ? next.player.consecutiveGuards + 1 : 1;
      pushLog(
        next,
        next.player.consecutiveGuards > 1
          ? `방어 자세 — 연속 ${next.player.consecutiveGuards}회, 자세가 무너지고 있다.`
          : "방어 자세를 잡는다."
      );
      break;
    }
    case "causal-mark": {
      next.player.consecutiveGuards = 0;
      applyStain(next, CAUSAL_MARK.stainCost);
      const predicted = action.predictKind ?? "weak";
      next.player.predictedKind = predicted;
      const hit = plannedBefore.kind === predicted;
      if (hit) {
        const dealt = dealToEnemy(next, roll(rng, CAUSAL_MARK.bonusDamage));
        pushLog(next, `인과 표식 — 예측 적중. ${dealt}의 피해와 함께 다음 흐름이 선명해진다.`);
        // 예측이 맞으면 이번 인카운터에 한해 의도가 더 정확히 보인다.
        next.memoryTier = Math.min(3, next.memoryTier + 1);
      } else {
        const dealt = dealToEnemy(next, roll(rng, CAUSAL_MARK.missDamage));
        pushLog(next, `인과 표식 — 빗나갔다. ${dealt}의 피해에 그친다.`);
      }
      break;
    }
    case "sunder": {
      next.player.consecutiveGuards = 0;
      const dealt = dealToEnemy(next, roll(rng, SUNDER.damage));
      applyStain(next, SUNDER.stainCost);
      pushLog(next, `결손 절단 — 방어를 무시하고 ${dealt}의 피해.`);
      if (rng.chance(SUNDER.recoilChance)) {
        const recoil = roll(rng, SUNDER.recoil);
        next.player.hp = Math.max(0, next.player.hp - recoil);
        next.record.damageTaken += recoil;
        pushLog(next, `반동으로 ${recoil}의 피해를 입었다.`);
      }
      break;
    }
    case "last-ditch": {
      next.player.consecutiveGuards = 0;
      if (!canUseLastDitch(next)) {
        pushLog(next, "아직 막바지가 아니다.");
        break;
      }
      if (rng.chance(PLAYER_BASE.lastDitchSuccessChance)) {
        let amount = roll(rng, PLAYER_BASE.lastDitchDamage);
        if (next.enemy.def.phaseTwoAt !== undefined) {
          amount = Math.min(amount, PLAYER_BASE.lastDitchBossCap);
        }
        const dealt = dealToEnemy(next, amount);
        pushLog(next, `막바지 승부 — 성공. ${dealt}의 치명적인 피해.`);
      } else {
        const recoil = roll(rng, PLAYER_BASE.lastDitchRecoil);
        next.player.hp = Math.max(0, next.player.hp - recoil);
        next.record.damageTaken += recoil;
        pushLog(next, `막바지 승부 — 실패. 반동으로 ${recoil}의 피해.`);
      }
      break;
    }
    case "use-item": {
      next.player.consecutiveGuards = 0;
      if (action.itemId) {
        const line = itemEffect
          ? (itemEffect(next, action.itemId), "")
          : applyCombatConsumable(next, action.itemId, next.modifiers);
        if (line) pushLog(next, line);
        next.record.itemsUsed.push(action.itemId);
      }
      break;
    }
  }

  if (next.enemy.hp <= 0) {
    next.over = true;
    next.result = "win";
    next.record.turns = next.turn;
    pushLog(next, `${next.enemy.def.name}이(가) 무너졌다.`);
    return next;
  }

  // --- 2. 적 행동 ---
  const enemyAction = plannedEnemyAction(next, rng);
  next.enemy.history.push(enemyAction.id);

  if (enemyAction.kind === "mark") {
    next.enemy.markedPlayer = true;
    pushLog(next, `${enemyAction.label} — 몸에 자국이 남았다. 다음이 문제다.`);
  } else if (enemyAction.kind === "recover") {
    const healed = Math.round(next.enemy.def.maxHp * 0.12);
    next.enemy.hp = Math.min(next.enemy.def.maxHp, next.enemy.hp + healed);
    pushLog(next, `${enemyAction.label} — ${healed}만큼 상처를 여몄다.`);
  } else {
    const raw = roll(rng, enemyAction.damage);
    const taken = dealToPlayer(next, raw, enemyAction.kind);
    const guardNote = wasGuarding && next.player.guarding ? "" : "";
    pushLog(next, `${enemyAction.label} — ${taken}의 피해를 입었다.${guardNote}`);
  }

  // 페이즈 2 전환과 역순 규칙 갱신
  const phaseTwoAt = next.enemy.def.phaseTwoAt;
  if (phaseTwoAt !== undefined && next.enemy.phase === 1 && next.enemy.hp <= next.enemy.def.maxHp * phaseTwoAt) {
    next.enemy.phase = 2;
    pushLog(next, `${next.enemy.def.name}의 셈이 흐트러진다 — 지나간 박자를 거꾸로 되짚기 시작했다.`);
  }
  if (next.enemy.phase === 2) {
    // 한 턴 걸러 한 번씩 직전 두 행동 중 하나를 되풀이한다.
    next.enemy.reverseDue = !next.enemy.reverseDue;
    if (!next.enemy.reverseDue) next.enemy.patternIndex += 1;
  } else {
    next.enemy.patternIndex += 1;
  }

  // --- 3. 턴 마무리 ---
  if (next.player.overflowTurnsLeft > 0) {
    next.player.overflowTurnsLeft -= 1;
    if (next.player.overflowTurnsLeft === 0) {
      next.player.stain = OVERFLOW.settleTo;
      pushLog(next, "범람이 잦아든다. 몸에 남은 얼룩은 쉽게 지워지지 않는다.");
    }
  }
  if (!next.player.guarding) {
    next.player.consecutiveGuards = Math.max(0, next.player.consecutiveGuards - GUARD.postureRecoveryPerTurn);
  }

  next.turn += 1;
  next.record.turns = next.turn;

  if (next.player.hp <= 0) {
    next.over = true;
    next.result = "lose";
    pushLog(next, "쓰러졌다. 여기까지 온 사실만은 남는다.");
  }

  return next;
}
