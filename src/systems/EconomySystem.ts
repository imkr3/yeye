import { CONSUMABLE_POOL } from "../data/items/consumables";
import { RELIC_POOL } from "../data/items/relics";
import { RARITY_WEIGHT, type ConsumableItem, type Rarity, type RelicItem } from "./GachaSystem";
import { schoolOf, type School } from "../data/economy/schools";
import { MARKET_TIPOFF_FLAG, TIPOFF_DISCOUNT, relicModifiers } from "./EffectRegistry";
import {
  addConsumable,
  addDust,
  addRelic,
  type RegressionState,
} from "./RegressionSystem";
import type { Rng } from "./Rng";

/**
 * 환로 경제.
 *
 * 원칙:
 * - 실제 결제, 유료 확률 상품, 광고 보상은 존재하지 않는다. 재화는 전부 플레이로 얻는다.
 * - 확률·천장·중복 규칙은 전부 이 파일에 명시하고 UI에서 그대로 보여준다.
 * - 원하는 물건을 즉시 확정 구매하게 하지 않는다. 대신 여진 가루로 "가능성의 방향"만
 *   좁힐 수 있게 한다 — 통제 가능한 불확실성.
 */

export const PRICES = {
  singlePull: 40,
  fivePull: 180, // 5회분(200)보다 저렴하게
  /** 계통 편향 한 번에 드는 여진 가루 */
  biasCost: 2,
};

/** 중복 유물을 환원해 받는 여진 가루 (등급별). */
export const DUPLICATE_DUST: Record<Rarity, number> = {
  C: 1,
  UC: 1,
  R: 2,
  SR: 3,
  SSR: 5,
};

/** 천장: 이만큼 뽑는 동안 SR 이상이 하나도 없으면 다음 결과를 SR 이상으로 올린다. */
export const PITY_THRESHOLD = 9;

/** 계통 편향이 걸렸을 때 해당 계통에 곱해지는 가중치. */
export const BIAS_MULTIPLIER = 2.2;

export type PullKind = "consumable" | "relic";

export interface PullResult {
  kind: PullKind;
  item: ConsumableItem | RelicItem;
  rarity: Rarity;
  /** 이미 가진 유물이라 자동 환원된 경우. */
  duplicate: boolean;
  dustGained: number;
  /** 천장 보정으로 등급이 올라간 결과인지. */
  pityApplied: boolean;
}

function isHighRarity(rarity: Rarity): boolean {
  return rarity === "SR" || rarity === "SSR";
}

/** 계통 편향을 반영한 가중 추첨. */
function weightedPick<T extends { id: string; rarity: Rarity }>(
  pool: readonly T[],
  rng: Rng,
  bias: School | null,
  onlyHighRarity: boolean
): T {
  const candidates = onlyHighRarity ? pool.filter((i) => isHighRarity(i.rarity)) : pool;
  const usable = candidates.length > 0 ? candidates : pool;

  const weights = usable.map((item) => {
    let w = RARITY_WEIGHT[item.rarity];
    if (bias && schoolOf(item.id) === bias) w *= BIAS_MULTIPLIER;
    return w;
  });
  const total = weights.reduce((sum, w) => sum + w, 0);

  let roll = rng.next() * total;
  for (let i = 0; i < usable.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return usable[i];
  }
  return usable[usable.length - 1];
}

/** 뽑기 한 번. 상태를 직접 바꾸지 않고 결과와 다음 상태를 함께 돌려준다. */
export function pullOnce(
  state: RegressionState,
  kind: PullKind,
  rng: Rng,
  bias: School | null = null
): { result: PullResult; state: RegressionState } {
  const threshold = Math.max(
    3,
    PITY_THRESHOLD - relicModifiers(state.equippedRelics).pityReduction
  );
  const pityDue = state.gachaPity.sinceHighRarity >= threshold;

  const item =
    kind === "consumable"
      ? weightedPick(CONSUMABLE_POOL, rng, bias, pityDue)
      : weightedPick(RELIC_POOL, rng, bias, pityDue);

  let next = state;
  let duplicate = false;
  let dustGained = 0;

  if (kind === "relic") {
    // 이미 가진 유물은 자동으로 여진 가루로 환원된다.
    duplicate = state.inventory.relics.includes(item.id);
    if (duplicate) {
      dustGained = Math.round(
        DUPLICATE_DUST[item.rarity] * relicModifiers(state.equippedRelics).dustMultiplier
      );
      next = addDust(next, dustGained);
    } else {
      next = addRelic(next, item.id);
    }
  } else {
    next = addConsumable(next, item.id);
  }

  next = {
    ...next,
    gachaPity: {
      sinceHighRarity: isHighRarity(item.rarity) ? 0 : next.gachaPity.sinceHighRarity + 1,
    },
    gachaHistory: [...next.gachaHistory, { itemId: item.id, rarity: item.rarity, kind }].slice(-50),
  };

  return {
    result: { kind, item, rarity: item.rarity, duplicate, dustGained, pityApplied: pityDue },
    state: next,
  };
}

/** 5연속 뽑기 — 결과를 한 번에 비교할 수 있게 배열로 돌려준다. */
export function pullFive(
  state: RegressionState,
  kind: PullKind,
  rng: Rng,
  bias: School | null = null
): { results: PullResult[]; state: RegressionState } {
  let working = state;
  const results: PullResult[] = [];
  for (let i = 0; i < 5; i++) {
    const step = pullOnce(working, kind, rng, bias);
    results.push(step.result);
    working = step.state;
  }
  return { results, state: working };
}

/** 유물 가격 — 장착한 유물의 할인이 반영된다. */
export function priceFor(base: number, state: RegressionState): number {
  // 유물 할인과 시세표 할인은 곱해서 겹친다 — 더해서 공짜가 되는 일은 없도록.
  const discount = relicModifiers(state.equippedRelics).shopDiscount;
  const tipoff = state.storyFlags.includes(MARKET_TIPOFF_FLAG) ? TIPOFF_DISCOUNT : 0;
  return Math.max(1, Math.round(base * (1 - discount) * (1 - tipoff)));
}

/** 구매가 성사되면 시세표는 한 번 쓰고 사라진다. */
export function consumeMarketTipoff(state: RegressionState): RegressionState {
  if (!state.storyFlags.includes(MARKET_TIPOFF_FLAG)) return state;
  return { ...state, storyFlags: state.storyFlags.filter((f) => f !== MARKET_TIPOFF_FLAG) };
}

export function canAfford(state: RegressionState, price: number): boolean {
  return state.aftershockCoins >= price;
}

/** UI에 그대로 노출할 확률표. */
export function rarityOdds(bias: School | null = null): { rarity: Rarity; percent: number }[] {
  const pool = [...CONSUMABLE_POOL, ...RELIC_POOL];
  const totals = new Map<Rarity, number>();
  let grand = 0;
  for (const item of pool) {
    let w = RARITY_WEIGHT[item.rarity];
    if (bias && schoolOf(item.id) === bias) w *= BIAS_MULTIPLIER;
    totals.set(item.rarity, (totals.get(item.rarity) ?? 0) + w);
    grand += w;
  }
  const order: Rarity[] = ["SSR", "SR", "R", "UC", "C"];
  return order.map((rarity) => ({
    rarity,
    percent: grand > 0 ? ((totals.get(rarity) ?? 0) / grand) * 100 : 0,
  }));
}
