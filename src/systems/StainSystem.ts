/**
 * 얼룩(Stain) — 마나 게이지가 아니라 "강한 선택의 후유증"이다.
 *
 * 0~100. 임계치 40 / 70 / 100에서 단계가 오르고, UI 색·대사·전투 효과가 함께 변한다.
 * 100에 닿으면 즉사가 아니라 '개인 범람' 상태로 들어가 2턴 동안 강해지지만,
 * 전투가 끝나면 무거운 회귀 페널티 후보가 하나 추가된다.
 */

export type StainTier = 0 | 1 | 2 | 3;

export interface StainStatus {
  value: number;
  tier: StainTier;
  label: string;
  description: string;
  color: number;
  /** 이 단계에서 붙는 피해 배율 — 강해지지만 대가가 따른다. */
  damageMultiplier: number;
  /** 이 단계에서 받는 피해 배율. */
  vulnerability: number;
}

export const STAIN_MAX = 100;
export const STAIN_THRESHOLDS = [40, 70, 100] as const;

export function stainTier(value: number): StainTier {
  if (value >= STAIN_THRESHOLDS[2]) return 3;
  if (value >= STAIN_THRESHOLDS[1]) return 2;
  if (value >= STAIN_THRESHOLDS[0]) return 1;
  return 0;
}

const TIER_INFO: Record<StainTier, Omit<StainStatus, "value" | "tier">> = {
  0: {
    label: "잠잠함",
    description: "아직은 당신의 것이다.",
    color: 0x6ea78c,
    damageMultiplier: 1,
    vulnerability: 1,
  },
  1: {
    label: "번짐",
    description: "손끝이 자꾸 남의 것처럼 움직인다.",
    color: 0xa8873a,
    damageMultiplier: 1.08,
    vulnerability: 1.05,
  },
  2: {
    label: "들끓음",
    description: "무언가가 당신의 이름을 대신 부르기 시작했다.",
    color: 0xd1616c,
    damageMultiplier: 1.18,
    vulnerability: 1.15,
  },
  3: {
    label: "범람",
    description: "잠깐은 강해진다. 그 대가는 나중에 온다.",
    color: 0xf05a6a,
    damageMultiplier: 1.45,
    vulnerability: 1.35,
  },
};

export function stainStatus(value: number): StainStatus {
  const clamped = Math.max(0, Math.min(STAIN_MAX, value));
  const tier = stainTier(clamped);
  return { value: clamped, tier, ...TIER_INFO[tier] };
}

export function addStain(value: number, delta: number): number {
  return Math.max(0, Math.min(STAIN_MAX, value + delta));
}

/** 휴식·아이템·대화로 얼룩을 가라앉힌다. 완전 초기화는 쉽게 허용하지 않는다. */
export function soothStain(value: number, amount: number): number {
  return Math.max(0, value - amount);
}

/** 개인 범람이 끝난 뒤 남는 무거운 페널티 후보. */
export const OVERFLOW_PENALTY = {
  id: "overflow-residue",
  label: "범람의 잔재",
  description: "얼룩이 넘친 흔적. 다음 루트 동안 얼룩이 더 빨리 쌓인다.",
} as const;
