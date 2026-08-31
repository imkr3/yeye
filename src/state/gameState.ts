import Phaser from "phaser";
import { createInitialRegressionState, type RegressionState, type SavePoint } from "../systems/RegressionSystem";
import { normalizeState, parseSave } from "../systems/SaveMigration";

/**
 * 씬을 넘나들며 공유되는 전역 게임 상태 + 저장/로드.
 *
 * RegionScene이 여러 지역에 재사용되므로, 회귀 상태는 씬 인스턴스가 아니라
 * 여기 모듈 레벨에 둬서 지역 전환 시에도 유지된다.
 * 상태가 바뀔 때마다 정규화를 거쳐 localStorage에 기록하며,
 * 저장이 불가능한 환경(사생활 보호 모드 등)에서도 게임이 계속 돌아가야 한다.
 */

const SAVE_KEY = "unbroken-vow:save";

const INITIAL_SAVE_POINT: SavePoint = {
  id: "sp-0",
  sceneKey: "RegionScene",
  x: 80,
  y: 420,
  label: "회랑 입구",
};

export const gameEvents = new Phaser.Events.EventEmitter();

let state: RegressionState = loadFromStorage() ?? createInitialRegressionState(INITIAL_SAVE_POINT);
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function loadFromStorage(): RegressionState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return parseSave(raw);
  } catch {
    return null; // 저장소 접근 자체가 막힌 환경 — 새 게임으로 시작한다.
  }
}

function writeToStorage(next: RegressionState) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(next));
  } catch {
    /* 저장 실패는 플레이를 막지 않는다. */
  }
}

/** 잦은 상태 변경마다 직렬화하지 않도록 살짝 미룬다. */
function scheduleSave() {
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    writeToStorage(state);
  }, 250);
}

/**
 * 분기점 근처에 서 있는지 — 가방 교체를 분기점에서만 허용하기 위한 일시 상태.
 * 겹침 판정은 매 프레임 갱신되므로, 마지막 갱신 시각이 최근이면 근처로 본다.
 */
let lastSavePointTouch = 0;

export function markNearSavePoint() {
  lastSavePointTouch = Date.now();
}

export function isNearSavePoint(): boolean {
  return Date.now() - lastSavePointTouch < 400;
}

export function getState(): RegressionState {
  return state;
}

export function setState(next: RegressionState) {
  state = normalizeState(next);
  gameEvents.emit("regression-updated", state);
  scheduleSave();
}

/** 즉시 저장 — 씬 전환처럼 유실이 아까운 시점에 호출한다. */
export function flushSave() {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  writeToStorage(state);
}

export function resetState() {
  setState(createInitialRegressionState(INITIAL_SAVE_POINT));
  flushSave();
}

/** 저장 데이터를 지우고 완전히 새로 시작한다. */
export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* 무시 */
  }
  resetState();
}
