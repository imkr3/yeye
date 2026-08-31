/**
 * 주입 가능한 난수 생성기.
 *
 * Math.random()을 여기저기서 직접 부르면 같은 시드로 재현이 안 되고 테스트도 어렵다.
 * 모든 무작위 판정(방 순서, 가챠, 전투 변동)은 이 인터페이스를 통해서만 이뤄진다.
 */

export interface Rng {
  /** 0 이상 1 미만 */
  next(): number;
  /** min 이상 max 이하 정수 */
  int(min: number, max: number): number;
  /** 0~1 확률 판정 */
  chance(probability: number): boolean;
  pick<T>(items: readonly T[]): T;
  /** 원본을 건드리지 않고 섞은 새 배열 */
  shuffle<T>(items: readonly T[]): T[];
}

/** 문자열 시드를 32비트 정수로 접는다. */
export function hashSeed(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32 — 짧고 빠르며 시드 재현이 확실한 PRNG. */
export function createRng(seed: number | string): Rng {
  let state = (typeof seed === "string" ? hashSeed(seed) : seed) >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const rng: Rng = {
    next,
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    chance: (probability) => next() < probability,
    pick: (items) => items[Math.floor(next() * items.length)],
    shuffle: (items) => {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
  return rng;
}

/** 시드를 고정하지 않는 일반 플레이용 기본 생성기. */
export function createSystemRng(): Rng {
  return createRng(Math.floor(Math.random() * 0xffffffff));
}

/** 새 회귀 주기에 쓸 시드 문자열. */
export function newRunSeed(): string {
  return Math.floor(Math.random() * 0xffffffff).toString(36);
}
