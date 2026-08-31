import Phaser from "phaser";
import type { RegressionState } from "../systems/RegressionSystem";
import { getState, gameEvents } from "../state/gameState";

/**
 * 무한 서약 상태창 오버레이. 설계 문서 01.1 "초기 상태창" 참고.
 * 전역 게임 상태(gameState)의 regression-updated 이벤트를 구독해 갱신한다.
 */
export class StatusOverlayScene extends Phaser.Scene {
  private text!: Phaser.GameObjects.Text;
  private flash!: Phaser.GameObjects.Rectangle;

  constructor() {
    super("StatusOverlayScene");
  }

  create() {
    const panel = this.add.rectangle(0, 0, 260, 600, 0x0e0c09, 0.85).setOrigin(0, 0);
    panel.setPosition(700, 0);

    this.text = this.add.text(716, 20, "", {
      fontFamily: "monospace",
      fontSize: "13px",
      color: "#e8e1cd",
      lineSpacing: 6,
      wordWrap: { width: 224 },
    });

    this.flash = this.add.rectangle(480, 300, 960, 600, 0x7c1f2b, 0).setDepth(100);

    gameEvents.on("regression-updated", (state: RegressionState) => this.render(state));
    gameEvents.on("death-flash", () => this.playDeathFlash());

    this.render(getState());
  }

  private render(state: RegressionState) {
    const penalties = state.accumulatedPenalties.length
      ? state.accumulatedPenalties.map((p) => `- ${p.label}`).join("\n")
      : "없음";

    this.text.setText(
      [
        "[ 무한 서약 · Lv.0 ]",
        `계약자: (이름 없음)`,
        `회귀 횟수: ${state.runCount}`,
        `현재 분기점: ${state.currentSavePoint.label}`,
        "",
        "달성 기록:",
        state.achievements.length ? state.achievements.join(", ") : "없음",
        "",
        "누적 페널티:",
        penalties,
        "",
        "NPC 신뢰:",
        Object.keys(state.npcTrust).length
          ? Object.entries(state.npcTrust).map(([id, v]) => `- ${id}: ${v > 0 ? "+" : ""}${v}`).join("\n")
          : "없음",
        "",
        `파편(POINT): ${state.fragments}`,
      ].join("\n")
    );
  }

  private playDeathFlash() {
    this.flash.setAlpha(0.5);
    this.tweens.add({ targets: this.flash, alpha: 0, duration: 400 });
  }
}
