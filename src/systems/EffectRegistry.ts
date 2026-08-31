import type { CombatState } from "./CombatSystem";
import { addStain } from "./StainSystem";
import { addWardCharge, removeConsumable, type RegressionState } from "./RegressionSystem";

/**
 * 아이템 효과 레지스트리.
 *
 * 유물은 이벤트를 "구독"하지 않는다. 장착 목록에서 매번 순수 함수로 수정치를 계산해
 * 쓰기만 한다. 그래서 구독 해제를 잊어 두 번 발동하거나, 장착 해제 후에도 효과가
 * 남는 부류의 버그가 구조적으로 생길 수 없다.
 *
 * 소모품은 "사용하는 순간" 한 번만 적용되며, 필드용과 전투용을 나눠 등록한다.
 */

// ---------------------------------------------------------------------------
// 유물 — 장착 목록에서 파생되는 수정치
// ---------------------------------------------------------------------------

export interface RelicModifiers {
  /** 기초 타격에 더해지는 고정 피해 */
  basicStrikeBonus: number;
  /** 방어 감소율에 더해지는 보정 (0.15 = 15%p) */
  guardBonus: number;
  /** 회복량 배율 */
  healingMultiplier: number;
  /** 여진화 보상 배율 */
  coinMultiplier: number;
  /** 상점 가격 할인율 (0.2 = 20% 할인) */
  shopDiscount: number;
  /** 죽음의 기억 최소 단계 — 첫 조우에도 이만큼은 보인다 */
  memoryFloor: number;
  /** 함정 피해 배율 */
  trapDamageMultiplier: number;
  /** 얼룩이 오를 때 얻는 파편 */
  fragmentsOnStain: number;
  /** 전투 시작 시 받는 보호막 */
  startingShield: number;
}

export const NEUTRAL_MODIFIERS: RelicModifiers = {
  basicStrikeBonus: 0,
  guardBonus: 0,
  healingMultiplier: 1,
  coinMultiplier: 1,
  shopDiscount: 0,
  memoryFloor: 0,
  trapDamageMultiplier: 1,
  fragmentsOnStain: 0,
  startingShield: 0,
};

type RelicModifier = (mods: RelicModifiers) => void;

/** 실제 효과가 붙은 유물. 여기 없는 유물은 아직 설명만 있는 상태다. */
const RELIC_EFFECTS: Record<string, { note: string; apply: RelicModifier }> = {
  "worn-leather-gloves": {
    note: "기초 타격 피해 +3",
    apply: (m) => {
      m.basicStrikeBonus += 3;
    },
  },
  "waterproof-boots": {
    note: "함정 피해 25% 감소",
    apply: (m) => {
      m.trapDamageMultiplier *= 0.75;
    },
  },
  "isras-glass-bead": {
    note: "죽음의 기억이 최소 1단계에서 시작",
    apply: (m) => {
      m.memoryFloor = Math.max(m.memoryFloor, 1);
    },
  },
  "rivs-calculator": {
    note: "환로 가격 20% 할인",
    apply: (m) => {
      m.shopDiscount = Math.max(m.shopDiscount, 0.2);
    },
  },
  "frost-rimmed-lens": {
    note: "전투 시작 시 보호막 6",
    apply: (m) => {
      m.startingShield += 6;
    },
  },
  "stained-diary": {
    note: "얼룩이 오를 때마다 파편 +2",
    apply: (m) => {
      m.fragmentsOnStain += 2;
    },
  },
  "helgas-broken-staff-shard": {
    note: "방어 감소율 +12%p",
    apply: (m) => {
      m.guardBonus += 0.12;
    },
  },
  "moss-ring": {
    note: "회복량 40% 증가",
    apply: (m) => {
      m.healingMultiplier *= 1.4;
    },
  },
  "ash-crystal-core": {
    note: "여진화 획득 30% 증가",
    apply: (m) => {
      m.coinMultiplier *= 1.3;
    },
  },
  "stairwell-shadow": {
    note: "죽음의 기억이 항상 최대 단계",
    apply: (m) => {
      m.memoryFloor = 3;
    },
  },
};

export function relicHasEffect(itemId: string): boolean {
  return itemId in RELIC_EFFECTS;
}

export function relicEffectNote(itemId: string): string | null {
  return RELIC_EFFECTS[itemId]?.note ?? null;
}

/** 장착된 유물에서 수정치를 계산한다. 순수 함수라 몇 번을 불러도 결과가 같다. */
export function relicModifiers(equippedRelics: readonly string[]): RelicModifiers {
  const mods: RelicModifiers = { ...NEUTRAL_MODIFIERS };
  // 중복 장착이 들어와도 한 번만 적용한다.
  for (const id of new Set(equippedRelics)) {
    RELIC_EFFECTS[id]?.apply(mods);
  }
  return mods;
}

// ---------------------------------------------------------------------------
// 소모품 — 사용 시 1회 적용
// ---------------------------------------------------------------------------

export interface ConsumableDefinition {
  /** 전투 중 사용 가능 여부 */
  combat?: (state: CombatState, mods: RelicModifiers) => string;
  /** 필드(인벤토리)에서 사용 가능 여부 */
  field?: (state: RegressionState) => RegressionState;
  note: string;
}

const CONSUMABLE_EFFECTS: Record<string, ConsumableDefinition> = {
  "warding-talisman": {
    note: "다음 죽음 페널티를 1회 막는다",
    field: (state) => addWardCharge(state),
  },
  "dried-jerky": {
    note: "체력 14 회복",
    combat: (state, mods) => {
      const healed = Math.round(14 * mods.healingMultiplier);
      state.player.hp = Math.min(state.player.maxHp, state.player.hp + healed);
      return `마른 육포 — 체력 ${healed} 회복.`;
    },
  },
  "half-full-canteen": {
    note: "체력 10 회복, 얼룩 6 감소",
    combat: (state, mods) => {
      const healed = Math.round(10 * mods.healingMultiplier);
      state.player.hp = Math.min(state.player.maxHp, state.player.hp + healed);
      state.player.stain = addStain(state.player.stain, -6);
      return `반쯤 남은 물통 — 체력 ${healed} 회복, 얼룩이 조금 가라앉는다.`;
    },
  },
  "stain-suppressant": {
    note: "얼룩 20 감소",
    combat: (state) => {
      state.player.stain = addStain(state.player.stain, -20);
      return "얼룩 억제 연고 — 번지던 얼룩이 물러난다.";
    },
  },
  "ash-filter-bottle": {
    note: "보호막 14 획득",
    combat: (state) => {
      state.player.shield += 14;
      return "재의 여과병 — 얇은 보호막이 몸을 감싼다.";
    },
  },
  "truth-buoy": {
    note: "이번 전투의 적 의도를 완전히 드러낸다",
    combat: (state) => {
      state.memoryTier = 3;
      return "거짓말 탐지 부표 — 상대의 다음 수가 또렷하게 읽힌다.";
    },
  },
  "overflow-shard": {
    note: "강력한 일격, 얼룩 18 증가",
    combat: (state) => {
      const dealt = Math.round(state.enemy.def.maxHp * 0.22);
      state.enemy.hp = Math.max(0, state.enemy.hp - dealt);
      state.record.damageDealt += dealt;
      state.player.stain = addStain(state.player.stain, 18);
      return `대범람의 파편 — ${dealt}의 피해. 손끝이 저릿하다.`;
    },
  },
  "morens-stair-chart": {
    note: "적 패턴을 전부 드러낸다",
    combat: (state) => {
      state.memoryTier = 3;
      state.enemy.markedPlayer = false;
      return "모른의 계단표 — 다음 박자가 전부 적혀 있다.";
    },
  },
};

export function consumableHasCombatUse(itemId: string): boolean {
  return !!CONSUMABLE_EFFECTS[itemId]?.combat;
}

export function consumableHasFieldUse(itemId: string): boolean {
  return !!CONSUMABLE_EFFECTS[itemId]?.field;
}

export function consumableEffectNote(itemId: string): string | null {
  return CONSUMABLE_EFFECTS[itemId]?.note ?? null;
}

/** 전투 중 사용. 로그 문구를 돌려준다. */
export function applyCombatConsumable(
  state: CombatState,
  itemId: string,
  mods: RelicModifiers
): string {
  const effect = CONSUMABLE_EFFECTS[itemId]?.combat;
  if (!effect) return "";
  return effect(state, mods);
}

/** 필드에서 사용. 아이템 소모까지 함께 처리한다. */
export function applyFieldConsumable(state: RegressionState, itemId: string): RegressionState {
  const effect = CONSUMABLE_EFFECTS[itemId]?.field;
  if (!effect) return state;
  return effect(removeConsumable(state, itemId));
}

/** 실제 효과가 하나라도 붙어 있는 소모품인지. */
export function consumableHasAnyEffect(itemId: string): boolean {
  return itemId in CONSUMABLE_EFFECTS;
}
