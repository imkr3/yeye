import Phaser from "phaser";
import { resolveEnding } from "../systems/EndingSystem";
import { getState, resetState } from "../state/gameState";
import { FIRST_REGION_KEY } from "../data/regions";

/** 엔딩 판정 결과를 보여주는 씬. 설계 문서 10번 섹션의 4개 엔딩. */
export class EndingScene extends Phaser.Scene {
  constructor() {
    super("EndingScene");
  }

  create() {
    this.add.rectangle(480, 300, 960, 600, 0x0e0c09);

    const ending = resolveEnding(getState());

    this.add.text(480, 220, ending.title, {
      fontFamily: "serif",
      fontSize: "28px",
      color: "#e8e1cd",
    }).setOrigin(0.5);

    this.add.text(480, 280, ending.summary, {
      fontFamily: "serif",
      fontSize: "15px",
      color: "#cbbfa5",
      wordWrap: { width: 640 },
      align: "center",
    }).setOrigin(0.5, 0);

    if (getState().storyFlags.includes("met-moren")) {
      this.add.text(480, 350, "— 계단지기 모른만은, 이 결말 바깥에서 여전히 계단을 세고 있다.", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#8c8168",
        wordWrap: { width: 600 },
        align: "center",
      }).setOrigin(0.5, 0);
    }

    const restart = this.add.text(480, 420, "[ 처음부터 다시 ]", {
      fontFamily: "monospace",
      fontSize: "13px",
      color: "#d1616c",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    restart.on("pointerdown", () => {
      resetState();
      this.scene.start("RegionScene", { regionKey: FIRST_REGION_KEY });
    });
  }
}
