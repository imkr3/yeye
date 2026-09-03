/**
 * 호감도(친밀도) 시스템.
 *
 * 기존 npcTrust는 단순 정수였고 엔딩 판정에서만 쓰였다. 이제 그 숫자를 관계의
 * 축으로 삼아, 대화 한 마디가 실제로 관계 단계를 바꾸고 그 단계가 결말과
 * 전투·상점·대사에까지 이어지도록 한다.
 *
 * 설계 원칙:
 * - "착한 선택 = 호감도 상승"이 아니다. 상대가 무엇을 중요하게 여기는지에 따라
 *   같은 말도 다르게 받아들여진다 (npcValues 참고).
 * - 동료가 되거나 적대하는 건 한 번의 선택이 아니라 누적의 결과다.
 * - 양 극단은 잠긴다(lock). 한 번 동료가 되면 사소한 실수로 깨지지 않고,
 *   한 번 적대하면 말 몇 마디로 되돌릴 수 없다 — 되돌리려면 큰 대가가 든다.
 */

import type { RegressionState } from "./RegressionSystem";

export type AffinityStage = "hostile" | "wary" | "neutral" | "friendly" | "ally";

export const AFFINITY_MIN = -100;
export const AFFINITY_MAX = 100;

/** 단계 경계값 — 이 값 "이상"이면 해당 단계. */
export const STAGE_THRESHOLDS: { stage: AffinityStage; min: number }[] = [
  { stage: "ally", min: 60 },
  { stage: "friendly", min: 25 },
  { stage: "neutral", min: -24 },
  { stage: "wary", min: -59 },
  { stage: "hostile", min: AFFINITY_MIN },
];

export const STAGE_LABEL: Record<AffinityStage, string> = {
  hostile: "적대",
  wary: "경계",
  neutral: "중립",
  friendly: "우호",
  ally: "동료",
};

export const STAGE_COLOR: Record<AffinityStage, number> = {
  hostile: 0x7c1f2b,
  wary: 0x8c6a3a,
  neutral: 0x8c8168,
  friendly: 0x4c6e5c,
  ally: 0xa8873a,
};

/** 동료/적대가 확정되는 지점. 여기 닿으면 플래그로 굳는다. */
export const ALLY_LOCK = 75;
export const HOSTILE_LOCK = -75;

export function allyFlag(npcId: string) {
  return `ally:${npcId}`;
}
export function hostileFlag(npcId: string) {
  return `hostile:${npcId}`;
}

export function stageOf(value: number): AffinityStage {
  for (const t of STAGE_THRESHOLDS) {
    if (value >= t.min) return t.stage;
  }
  return "hostile";
}

export function affinityOf(state: RegressionState, npcId: string): number {
  return state.npcTrust[npcId] ?? 0;
}

export function stageFor(state: RegressionState, npcId: string): AffinityStage {
  // 확정된 관계는 숫자보다 우선한다.
  if (state.storyFlags.includes(allyFlag(npcId))) return "ally";
  if (state.storyFlags.includes(hostileFlag(npcId))) return "hostile";
  return stageOf(affinityOf(state, npcId));
}

export function isAlly(state: RegressionState, npcId: string): boolean {
  return stageFor(state, npcId) === "ally";
}

export function isHostile(state: RegressionState, npcId: string): boolean {
  return stageFor(state, npcId) === "hostile";
}

export function clampAffinity(value: number): number {
  return Math.max(AFFINITY_MIN, Math.min(AFFINITY_MAX, value));
}

export interface AffinityChange {
  state: RegressionState;
  before: number;
  after: number;
  stageBefore: AffinityStage;
  stageAfter: AffinityStage;
  /** 이번 변화로 관계가 굳었는지 (동료/적대 확정). */
  locked: "ally" | "hostile" | null;
}

/**
 * 호감도를 움직인다. 단계가 바뀌었는지, 관계가 굳었는지까지 함께 돌려준다 —
 * UI가 "무엇이 달라졌는지"를 플레이어에게 보여줄 수 있어야 하기 때문이다.
 */
export function adjustAffinity(
  state: RegressionState,
  npcId: string,
  delta: number
): AffinityChange {
  const before = affinityOf(state, npcId);
  const stageBefore = stageFor(state, npcId);

  // 이미 굳은 관계는 반대 방향으로 잘 움직이지 않는다.
  const lockedAlly = state.storyFlags.includes(allyFlag(npcId));
  const lockedHostile = state.storyFlags.includes(hostileFlag(npcId));
  let effective = delta;
  if (lockedAlly && delta < 0) effective = Math.round(delta * 0.4);
  if (lockedHostile && delta > 0) effective = Math.round(delta * 0.4);

  const after = clampAffinity(before + effective);
  let flags = state.storyFlags;
  let locked: "ally" | "hostile" | null = null;

  if (after >= ALLY_LOCK && !lockedAlly) {
    flags = [...flags.filter((f) => f !== hostileFlag(npcId)), allyFlag(npcId)];
    locked = "ally";
  } else if (after <= HOSTILE_LOCK && !lockedHostile) {
    flags = [...flags.filter((f) => f !== allyFlag(npcId)), hostileFlag(npcId)];
    locked = "hostile";
  }

  const next: RegressionState = {
    ...state,
    npcTrust: { ...state.npcTrust, [npcId]: after },
    storyFlags: flags,
  };

  return {
    state: next,
    before,
    after,
    stageBefore,
    stageAfter: stageFor(next, npcId),
    locked,
  };
}

/** 동료가 된 NPC 수 — 엔딩과 일부 판정에 쓰인다. */
export function allyCount(state: RegressionState): number {
  return state.storyFlags.filter((f) => f.startsWith("ally:")).length;
}

export function hostileCount(state: RegressionState): number {
  return state.storyFlags.filter((f) => f.startsWith("hostile:")).length;
}
