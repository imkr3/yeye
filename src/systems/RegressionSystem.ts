/**
 * 무한 서약 — 회귀 시스템 (1단계 버티컬 슬라이스용 최소 구현)
 *
 * 설계 문서 01번 섹션(회귀 시스템) 참고.
 * - 세이브 포인트는 "분기점"에서만 갱신된다.
 * - 죽으면 최근 분기점으로 되돌아가되, 죽음 페널티는 영구 누적된다.
 * - 가방(carriedItems)에 넣은 아이템만 회귀 후에도 유지된다.
 */

export interface DeathPenalty {
  id: string;
  label: string;
  description: string;
  /** 전투/판정에 적용할 배율. 1보다 작을수록 불리해진다. */
  accuracyMultiplier?: number;
  /** 특정 행동을 봉인할 때 사용하는 태그. */
  disables?: string[];
}

export interface SavePoint {
  id: string;
  sceneKey: string;
  x: number;
  y: number;
  label: string;
}

export interface RegressionState {
  currentSavePoint: SavePoint;
  runCount: number;
  accumulatedPenalties: DeathPenalty[];
  carriedItems: string[];
  achievements: string[];
  titles: string[];
  fragments: number; // 파편(POINT)
  /** NPC별 신뢰도. 대화 시스템(11번 섹션)이 갱신한다. */
  npcTrust: Record<string, number>;
  /** 엔딩 판정에 쓰이는 스토리 플래그 (예: "ally-helga", "abandon-vow" 등) */
  storyFlags: string[];
  /** 가챠로 뽑은 소모품/유물 id 목록. 소모품은 중복 보유 가능, 유물은 진열대 슬롯 제한이 따로 있다. */
  inventory: { consumables: string[]; relics: string[] };
  /** 진열대에 장착한 유물 id. 설계 문서 1.7 — 초반 슬롯은 2칸으로 제한한다. */
  equippedRelics: string[];
  /** 액막이 부적 등으로 얻은 "다음 죽음 페널티 방지" 횟수. */
  wardCharges: number;
  /** 필드에서 주운 파편 픽업 id 목록 — 한 번 주우면 다시 못 줍는다. */
  collectedPickups: string[];
}

export const RELIC_SLOT_LIMIT = 2;

// 죽음 페널티 예시 풀 — 설계 문서 1.3의 "경미" 등급 예시.
// 전투 불능급으로 세지 않고, 불편하고 성가신 방향으로만 설계한다.
const PENALTY_POOL: DeathPenalty[] = [
  {
    id: "trembling-hand",
    label: "손 떨림",
    description: "루트 종료까지 명중 판정이 소폭 감소한다.",
    accuracyMultiplier: 0.92,
  },
  {
    id: "ringing-ears",
    label: "이명",
    description: "루트 종료까지 위험 경고음을 늦게 인지한다.",
  },
  {
    id: "night-blind",
    label: "야간 시야 상실",
    description: "3~5회 루트 동안 어두운 지역에서 시야가 크게 줄어든다.",
    disables: ["night-vision"],
  },
];

export function createInitialRegressionState(startPoint: SavePoint): RegressionState {
  return {
    currentSavePoint: startPoint,
    runCount: 0,
    accumulatedPenalties: [],
    carriedItems: [],
    achievements: [],
    titles: [],
    fragments: 0,
    npcTrust: {},
    storyFlags: [],
    inventory: { consumables: [], relics: [] },
    equippedRelics: [],
    wardCharges: 0,
    collectedPickups: [],
  };
}

/** 필드 픽업을 주웠을 때 호출. 이미 주운 픽업이면 아무 일도 일어나지 않는다. */
export function collectPickup(state: RegressionState, pickupId: string, fragmentReward: number): RegressionState {
  if (state.collectedPickups.includes(pickupId)) return state;
  return {
    ...state,
    collectedPickups: [...state.collectedPickups, pickupId],
    fragments: state.fragments + fragmentReward,
  };
}

/** 인벤토리에서 소모품 하나를 제거한다 (사용 시 호출). 없으면 아무 일도 일어나지 않는다. */
export function removeConsumable(state: RegressionState, itemId: string): RegressionState {
  const idx = state.inventory.consumables.indexOf(itemId);
  if (idx === -1) return state;
  const next = [...state.inventory.consumables];
  next.splice(idx, 1);
  return { ...state, inventory: { ...state.inventory, consumables: next } };
}

/** 액막이 부적 사용 시 호출 — 다음 죽음 페널티를 방지할 횟수를 1 더한다. */
export function addWardCharge(state: RegressionState): RegressionState {
  return { ...state, wardCharges: state.wardCharges + 1 };
}

/** 유물을 진열대에 장착한다. 슬롯이 가득 찼거나 이미 장착 중이면 아무 일도 일어나지 않는다. */
export function equipRelic(state: RegressionState, itemId: string): RegressionState {
  if (state.equippedRelics.includes(itemId)) return state;
  if (state.equippedRelics.length >= RELIC_SLOT_LIMIT) return state;
  if (!state.inventory.relics.includes(itemId)) return state;
  return { ...state, equippedRelics: [...state.equippedRelics, itemId] };
}

export function unequipRelic(state: RegressionState, itemId: string): RegressionState {
  return { ...state, equippedRelics: state.equippedRelics.filter((id) => id !== itemId) };
}

/** 가챠로 소모품을 얻었을 때 인벤토리에 추가한다. */
export function addConsumable(state: RegressionState, itemId: string): RegressionState {
  return {
    ...state,
    inventory: { ...state.inventory, consumables: [...state.inventory.consumables, itemId] },
  };
}

/** 가챠로 유물을 얻었을 때 인벤토리에 추가한다. */
export function addRelic(state: RegressionState, itemId: string): RegressionState {
  return {
    ...state,
    inventory: { ...state.inventory, relics: [...state.inventory.relics, itemId] },
  };
}

/** 대화 시스템이 신뢰도를 갱신할 때 사용. */
export function adjustTrust(state: RegressionState, npcId: string, delta: number): RegressionState {
  if (!delta) return state;
  const current = state.npcTrust[npcId] ?? 0;
  return {
    ...state,
    npcTrust: { ...state.npcTrust, [npcId]: current + delta },
  };
}

export function addStoryFlag(state: RegressionState, flag: string): RegressionState {
  if (state.storyFlags.includes(flag)) return state;
  return { ...state, storyFlags: [...state.storyFlags, flag] };
}

/**
 * 죽음 발생 시 호출. 세이브 포인트로 되돌리고 페널티 하나를 누적시킨다.
 * 액막이 부적으로 얻은 wardCharges가 있으면, 이번 죽음의 페널티만 막고 하나를 소모한다.
 */
export function applyDeath(state: RegressionState): RegressionState {
  if (state.wardCharges > 0) {
    return {
      ...state,
      runCount: state.runCount + 1,
      wardCharges: state.wardCharges - 1,
    };
  }

  const penalty = PENALTY_POOL[Math.floor(Math.random() * PENALTY_POOL.length)];
  return {
    ...state,
    runCount: state.runCount + 1,
    accumulatedPenalties: [...state.accumulatedPenalties, penalty],
    // carriedItems는 유지, 그 외 진행 상태는 세이브 포인트 시점으로 되돌아간다는 전제.
  };
}

/** 새 분기점 도달 시 호출. 이전 세이브 포인트는 더 이상 되돌아갈 수 없게 갱신된다. */
export function advanceSavePoint(state: RegressionState, next: SavePoint): RegressionState {
  return { ...state, currentSavePoint: next };
}

export function grantAchievement(state: RegressionState, achievementId: string, fragmentReward: number): RegressionState {
  if (state.achievements.includes(achievementId)) return state;
  return {
    ...state,
    achievements: [...state.achievements, achievementId],
    fragments: state.fragments + fragmentReward,
  };
}
