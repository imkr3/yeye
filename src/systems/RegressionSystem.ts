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
}

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
  };
}

/** 죽음 발생 시 호출. 세이브 포인트로 되돌리고 페널티 하나를 누적시킨다. */
export function applyDeath(state: RegressionState): RegressionState {
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
