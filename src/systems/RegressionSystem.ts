import { newRunSeed, createSystemRng, type Rng } from "./Rng";

export const SAVE_VERSION = 2;

/**
 * 무한 서약 — 회귀 시스템
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

  // --- v0.4에서 추가된 필드 ---
  /** 저장 스키마 버전. 마이그레이션 판단에 쓴다. */
  saveVersion: number;
  /** 현재 회귀 주기 식별자. 심층주 격파나 새 분기점에서 갱신된다. */
  cycleId: number;
  /** 이번 주기의 시드 — 같은 주기에서는 방 순서가 같아 학습이 가능하다. */
  runSeed: string;
  /** 인카운터별 죽음의 기억 단계 (0~3). 죽을수록 더 많은 정보가 열린다. */
  deathMemoryByEncounter: Record<string, number>;
  /** 얼룩 0~100. */
  stain: number;
  /** 개인 범람 진행 상태. 남은 턴이 0보다 크면 범람 중. */
  overflowState: { active: boolean; turnsLeft: number; triggeredThisRun: boolean };
  /** 여진화 — 한 주기 안에서 쓰는 세계 내 화폐. */
  aftershockCoins: number;
  /** 여진 가루 — 중복 유물을 환원해 얻는 계통 편향 재료. */
  aftershockDust: number;
  /** 가챠 천장 카운터. */
  gachaPity: { sinceHighRarity: number };
  /** 최근 뽑기 기록 (표시·검증용, 최대 50개). */
  gachaHistory: { itemId: string; rarity: string; kind: "consumable" | "relic" }[];
  /** 회귀해도 유지되는 가방 칸 수. */
  carriedItemSlots: number;
  /** 가방에 넣어둔 소모품 id 목록. 분기점에서만 교체 가능. */
  carriedItemIds: string[];
  /** 접근성·연출 설정. */
  settings: {
    accessibility: {
      reduceShake: boolean;
      reduceFlash: boolean;
      reduceParticles: boolean;
      instantText: boolean;
    };
  };
}

export const DEFAULT_CARRIED_SLOTS = 3;

export const RELIC_SLOT_LIMIT = 2;

/**
 * 슬롯을 늘려주는 유물. EffectRegistry를 참조하면 순환 의존이 되므로,
 * 슬롯 규칙만은 상태 계층에서 직접 안다.
 */
export const SLOT_BONUS_RELICS: Record<string, number> = {
  "double-vow-seal": 1,
};

export function effectiveRelicSlots(equipped: readonly string[]): number {
  return (
    RELIC_SLOT_LIMIT +
    [...new Set(equipped)].reduce((sum, id) => sum + (SLOT_BONUS_RELICS[id] ?? 0), 0)
  );
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
    npcTrust: {},
    storyFlags: [],
    inventory: { consumables: [], relics: [] },
    equippedRelics: [],
    wardCharges: 0,
    collectedPickups: [],
    saveVersion: SAVE_VERSION,
    cycleId: 1,
    runSeed: newRunSeed(),
    deathMemoryByEncounter: {},
    stain: 0,
    overflowState: { active: false, turnsLeft: 0, triggeredThisRun: false },
    aftershockCoins: 60,
    aftershockDust: 0,
    gachaPity: { sinceHighRarity: 0 },
    gachaHistory: [],
    carriedItemSlots: DEFAULT_CARRIED_SLOTS,
    carriedItemIds: [],
    settings: {
      accessibility: {
        reduceShake: false,
        reduceFlash: false,
        reduceParticles: false,
        instantText: false,
      },
    },
  };
}

/** 인카운터에서 패배할 때마다 기억 단계가 1씩 오른다 (상한 3). */
export function advanceDeathMemory(state: RegressionState, encounterId: string): RegressionState {
  const current = state.deathMemoryByEncounter[encounterId] ?? 0;
  if (current >= 3) return state;
  return {
    ...state,
    deathMemoryByEncounter: { ...state.deathMemoryByEncounter, [encounterId]: current + 1 },
  };
}

export function deathMemoryTier(state: RegressionState, encounterId: string): number {
  return Math.min(3, Math.max(0, state.deathMemoryByEncounter[encounterId] ?? 0));
}

/** 새 회귀 주기로 넘어간다 — 시드를 갱신해 방 배치가 다시 섞이게 한다. */
export function beginNewCycle(state: RegressionState): RegressionState {
  return {
    ...state,
    cycleId: state.cycleId + 1,
    runSeed: newRunSeed(),
    overflowState: { active: false, turnsLeft: 0, triggeredThisRun: false },
  };
}

/** 여진화·여진 가루 증감. 음수 잔액이 되지 않게 막는다. */
export function addCoins(state: RegressionState, delta: number): RegressionState {
  return { ...state, aftershockCoins: Math.max(0, state.aftershockCoins + delta) };
}

export function addDust(state: RegressionState, delta: number): RegressionState {
  return { ...state, aftershockDust: Math.max(0, state.aftershockDust + delta) };
}

export function setStain(state: RegressionState, value: number): RegressionState {
  return { ...state, stain: Math.max(0, Math.min(100, value)) };
}

/** 가방에 소모품을 넣는다. 칸이 가득 찼거나 보유하지 않은 아이템이면 무시. */
export function setCarriedItems(state: RegressionState, itemIds: string[]): RegressionState {
  const owned = [...state.inventory.consumables];
  const accepted: string[] = [];
  for (const id of itemIds) {
    if (accepted.length >= state.carriedItemSlots) break;
    const idx = owned.indexOf(id);
    if (idx === -1) continue;
    owned.splice(idx, 1);
    accepted.push(id);
  }
  return { ...state, carriedItemIds: accepted };
}

/**
 * 서약 역류 — 회귀 사실을 발설했을 때의 대가.
 * 즉사 함정이 아니라, 잃는 것이 분명하되 되돌릴 길이 있는 상태로 만든다.
 * 여기서는 가장 최근에 얻은 기억 하나가 흐려지고, 들은 상대가 경계하게 된다.
 */
export function applyVowBacklash(state: RegressionState, listenerId: string): RegressionState {
  const memories = Object.entries(state.deathMemoryByEncounter);
  const nextMemory = { ...state.deathMemoryByEncounter };
  if (memories.length > 0) {
    // 가장 높은 단계의 기억 하나를 한 단계 잃는다.
    const [worstId] = memories.sort((a, b) => b[1] - a[1])[0];
    const lowered = Math.max(0, (nextMemory[worstId] ?? 0) - 1);
    if (lowered === 0) delete nextMemory[worstId];
    else nextMemory[worstId] = lowered;
  }

  return {
    ...state,
    deathMemoryByEncounter: nextMemory,
    npcTrust: { ...state.npcTrust, [listenerId]: (state.npcTrust[listenerId] ?? 0) - 2 },
    storyFlags: state.storyFlags.includes("vow-backlash")
      ? state.storyFlags
      : [...state.storyFlags, "vow-backlash"],
  };
}

/** 역류를 가라앉힌다 — 규칙 바깥에 있는 자만이 해줄 수 있다. */
export function clearVowBacklash(state: RegressionState): RegressionState {
  return {
    ...state,
    storyFlags: state.storyFlags.filter((f) => f !== "vow-backlash"),
  };
}

export function hasVowBacklash(state: RegressionState): boolean {
  return state.storyFlags.includes("vow-backlash");
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
  // 슬롯을 늘려주는 유물이면, 그 유물 자신이 들어갈 자리는 기본 한도로 판단한다.
  const limit = effectiveRelicSlots([...state.equippedRelics, itemId]);
  if (state.equippedRelics.length >= limit) return state;
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
export function applyDeath(state: RegressionState, rng: Rng = createSystemRng()): RegressionState {
  if (state.wardCharges > 0) {
    return {
      ...state,
      runCount: state.runCount + 1,
      wardCharges: state.wardCharges - 1,
    };
  }

  // 이 프로젝트의 다른 무작위는 전부 주입된 Rng를 쓴다. 여기만 Math.random을 직접
  // 부르고 있어서 죽음 결과만 재현이 안 됐다.
  const penalty = rng.pick(PENALTY_POOL);
  return {
    ...state,
    runCount: state.runCount + 1,
    accumulatedPenalties: [...state.accumulatedPenalties, penalty],
    // carriedItems는 유지, 그 외 진행 상태는 세이브 포인트 시점으로 되돌아간다는 전제.
  };
}

/**
 * 누적 페널티 정화.
 *
 * 페널티는 죽을 때마다 하나씩 붙고 스스로 사라지지 않는다. 환로에서 여진화를 치러
 * 덜어낼 수 있게 하되, 값은 쌓인 개수에 따라 올라간다 — 죽음이 공짜가 되지 않도록.
 */
export const PENALTY_PURGE = { base: 50, step: 35 };

/** 페널티가 count개 쌓여 있을 때, 하나를 지우는 값. */
export function penaltyPurgeCost(count: number): number {
  if (count <= 0) return 0;
  return PENALTY_PURGE.base + PENALTY_PURGE.step * (count - 1);
}

/** 전부 지우는 값 — 하나씩 지울 때의 합계와 같다. 묶음 할인은 없다. */
export function purgeAllCost(count: number): number {
  let total = 0;
  for (let n = count; n >= 1; n--) total += penaltyPurgeCost(n);
  return total;
}

/** 가장 오래된 페널티 하나를 지운다. 값은 호출부가 이미 치렀다고 본다. */
export function purgeOnePenalty(state: RegressionState): RegressionState {
  if (state.accumulatedPenalties.length === 0) return state;
  return { ...state, accumulatedPenalties: state.accumulatedPenalties.slice(1) };
}

export function purgeAllPenalties(state: RegressionState): RegressionState {
  if (state.accumulatedPenalties.length === 0) return state;
  return { ...state, accumulatedPenalties: [] };
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
