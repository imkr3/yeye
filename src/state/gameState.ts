import Phaser from "phaser";
import { createInitialRegressionState, type RegressionState, type SavePoint } from "../systems/RegressionSystem";

/**
 * 씬을 넘나들며 공유되는 전역 게임 상태.
 * RegionScene이 여러 지역에 재사용되므로, 회귀 상태를 씬 인스턴스가 아니라
 * 여기 모듈 레벨에 둬서 지역 전환 시에도 유지되게 한다.
 */

const INITIAL_SAVE_POINT: SavePoint = {
  id: "sp-0",
  sceneKey: "RegionScene",
  x: 100,
  y: 300,
  label: "회랑 입구",
};

export const gameEvents = new Phaser.Events.EventEmitter();

let state: RegressionState = createInitialRegressionState(INITIAL_SAVE_POINT);

export function getState(): RegressionState {
  return state;
}

export function setState(next: RegressionState) {
  state = next;
  gameEvents.emit("regression-updated", state);
}

export function resetState() {
  setState(createInitialRegressionState(INITIAL_SAVE_POINT));
}
