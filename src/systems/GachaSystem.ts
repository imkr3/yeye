/**
 * 가챠 시스템 — 설계 문서 1.7 "상점 · 강화 · 진열대" 참고.
 * 소모품(조커류)과 유물(진열대류) 두 축으로 나뉘며, 등급이 높을수록 확률이 낮다.
 * 풀은 data/items/*.ts에 계속 추가해나간다 — 이 파일은 뽑기 로직만 담당한다.
 */

export type Rarity = "C" | "UC" | "R" | "SR" | "SSR";

export interface ConsumableItem {
  id: string;
  name: string;
  rarity: Rarity;
  /** 짧은 세계관 플레이버 텍스트. */
  flavor: string;
  /** 효과 설명 (지금은 텍스트만 — 실제 효과 로직은 필요해질 때 연결). */
  effect: string;
}

export interface RelicItem {
  id: string;
  name: string;
  rarity: Rarity;
  flavor: string;
  /** 진열대에 걸었을 때 얻는 영구 특성 설명. */
  trait: string;
}

export const RARITY_WEIGHT: Record<Rarity, number> = {
  C: 45,
  UC: 28,
  R: 16,
  SR: 8,
  SSR: 3,
};

export const RARITY_COLOR: Record<Rarity, number> = {
  C: 0x8c8168,
  UC: 0x6ea78c,
  R: 0x3d4a7c,
  SR: 0xa8873a,
  SSR: 0xd1616c,
};

function weightedPick<T extends { rarity: Rarity }>(pool: T[]): T {
  const totalWeight = pool.reduce((sum, item) => sum + RARITY_WEIGHT[item.rarity], 0);
  let roll = Math.random() * totalWeight;
  for (const item of pool) {
    roll -= RARITY_WEIGHT[item.rarity];
    if (roll <= 0) return item;
  }
  return pool[pool.length - 1];
}

export function pullConsumable(pool: ConsumableItem[]): ConsumableItem {
  return weightedPick(pool);
}

export function pullRelic(pool: RelicItem[]): RelicItem {
  return weightedPick(pool);
}

export const CONSUMABLE_PULL_COST = 5;
export const RELIC_PULL_COST = 20;
