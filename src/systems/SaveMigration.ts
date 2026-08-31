import {
  SAVE_VERSION,
  DEFAULT_CARRIED_SLOTS,
  effectiveRelicSlots,
  createInitialRegressionState,
  type RegressionState,
  type SavePoint,
} from "./RegressionSystem";
import { newRunSeed } from "./Rng";
import { CONSUMABLE_POOL } from "../data/items/consumables";
import { RELIC_POOL } from "../data/items/relics";

/**
 * 저장 데이터 마이그레이션과 유효성 검사.
 *
 * 원칙:
 * - 구버전 저장이 들어와도 절대 크래시하지 않는다. 모르는 필드는 기본값으로 채운다.
 * - 저장 직전과 로드 직후 모두 정규화를 거쳐, 존재하지 않는 아이템 ID·음수 재화·
 *   슬롯 초과·중복 장착 같은 상태가 게임에 들어오지 못하게 한다.
 */

const DEFAULT_SAVE_POINT: SavePoint = {
  id: "sp-0",
  sceneKey: "RegionScene",
  x: 100,
  y: 420,
  label: "회랑 입구",
};

const VALID_CONSUMABLES = new Set(CONSUMABLE_POOL.map((i) => i.id));
const VALID_RELICS = new Set(RELIC_POOL.map((i) => i.id));

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function strArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/**
 * 어떤 모양이 들어와도 현재 스키마의 온전한 상태로 만든다.
 * 구버전(saveVersion 없음 = v1)도 이 경로 하나로 흡수된다.
 */
export function normalizeState(raw: unknown): RegressionState {
  const base = createInitialRegressionState(DEFAULT_SAVE_POINT);
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;

  const savePointRaw = (r.currentSavePoint ?? {}) as Record<string, unknown>;
  const currentSavePoint: SavePoint = {
    id: typeof savePointRaw.id === "string" ? savePointRaw.id : base.currentSavePoint.id,
    sceneKey: typeof savePointRaw.sceneKey === "string" ? savePointRaw.sceneKey : "RegionScene",
    x: num(savePointRaw.x, base.currentSavePoint.x),
    y: num(savePointRaw.y, base.currentSavePoint.y),
    label: typeof savePointRaw.label === "string" ? savePointRaw.label : base.currentSavePoint.label,
  };

  const inventoryRaw = (r.inventory ?? {}) as Record<string, unknown>;
  const consumables = strArray(inventoryRaw.consumables).filter((id) => VALID_CONSUMABLES.has(id));
  const relics = strArray(inventoryRaw.relics).filter((id) => VALID_RELICS.has(id));

  // 장착 유물: 보유 중이며 중복이 없고 슬롯 한도를 넘지 않아야 한다.
  const equippedCandidates = [...new Set(strArray(r.equippedRelics))].filter((id) => relics.includes(id));
  const equippedRelics = equippedCandidates.slice(0, effectiveRelicSlots(equippedCandidates));

  const carriedSlots = Math.max(1, Math.min(8, Math.round(num(r.carriedItemSlots, DEFAULT_CARRIED_SLOTS))));
  const carriedItemIds = strArray(r.carriedItemIds)
    .filter((id) => VALID_CONSUMABLES.has(id))
    .slice(0, carriedSlots);

  // 기억 단계는 0~3으로 잘라낸다.
  const memoryRaw = (r.deathMemoryByEncounter ?? {}) as Record<string, unknown>;
  const deathMemoryByEncounter: Record<string, number> = {};
  for (const [key, value] of Object.entries(memoryRaw)) {
    const tier = Math.round(num(value, 0));
    if (tier > 0) deathMemoryByEncounter[key] = Math.max(0, Math.min(3, tier));
  }

  const trustRaw = (r.npcTrust ?? {}) as Record<string, unknown>;
  const npcTrust: Record<string, number> = {};
  for (const [key, value] of Object.entries(trustRaw)) {
    npcTrust[key] = Math.round(num(value, 0));
  }

  const overflowRaw = (r.overflowState ?? {}) as Record<string, unknown>;
  const accessibilityRaw = (((r.settings ?? {}) as Record<string, unknown>).accessibility ?? {}) as Record<
    string,
    unknown
  >;

  const penalties = Array.isArray(r.accumulatedPenalties)
    ? (r.accumulatedPenalties as unknown[]).filter(
        (p): p is RegressionState["accumulatedPenalties"][number] =>
          !!p && typeof p === "object" && typeof (p as { id?: unknown }).id === "string"
      )
    : [];

  const history = Array.isArray(r.gachaHistory)
    ? (r.gachaHistory as unknown[])
        .filter((h): h is RegressionState["gachaHistory"][number] => {
          if (!h || typeof h !== "object") return false;
          const entry = h as Record<string, unknown>;
          return typeof entry.itemId === "string" && typeof entry.rarity === "string";
        })
        .slice(-50)
    : [];

  return {
    currentSavePoint,
    runCount: Math.max(0, Math.round(num(r.runCount, 0))),
    accumulatedPenalties: penalties,
    carriedItems: strArray(r.carriedItems),
    achievements: [...new Set(strArray(r.achievements))],
    titles: [...new Set(strArray(r.titles))],
    fragments: Math.max(0, Math.round(num(r.fragments, 0))),
    npcTrust,
    storyFlags: [...new Set(strArray(r.storyFlags))],
    inventory: { consumables, relics },
    equippedRelics,
    wardCharges: Math.max(0, Math.round(num(r.wardCharges, 0))),
    collectedPickups: [...new Set(strArray(r.collectedPickups))],
    saveVersion: SAVE_VERSION,
    cycleId: Math.max(1, Math.round(num(r.cycleId, 1))),
    runSeed: typeof r.runSeed === "string" && r.runSeed.length > 0 ? r.runSeed : newRunSeed(),
    deathMemoryByEncounter,
    stain: Math.max(0, Math.min(100, num(r.stain, 0))),
    overflowState: {
      active: bool(overflowRaw.active, false),
      turnsLeft: Math.max(0, Math.round(num(overflowRaw.turnsLeft, 0))),
      triggeredThisRun: bool(overflowRaw.triggeredThisRun, false),
    },
    aftershockCoins: Math.max(0, Math.round(num(r.aftershockCoins, 0))),
    aftershockDust: Math.max(0, Math.round(num(r.aftershockDust, 0))),
    gachaPity: {
      sinceHighRarity: Math.max(0, Math.round(num((r.gachaPity as Record<string, unknown>)?.sinceHighRarity, 0))),
    },
    gachaHistory: history,
    carriedItemSlots: carriedSlots,
    carriedItemIds,
    settings: {
      accessibility: {
        reduceShake: bool(accessibilityRaw.reduceShake, false),
        reduceFlash: bool(accessibilityRaw.reduceFlash, false),
        reduceParticles: bool(accessibilityRaw.reduceParticles, false),
        instantText: bool(accessibilityRaw.instantText, false),
      },
    },
  };
}

/** 저장 문자열을 상태로 되돌린다. 깨진 데이터면 null. */
export function parseSave(json: string): RegressionState | null {
  try {
    return normalizeState(JSON.parse(json));
  } catch {
    return null;
  }
}
