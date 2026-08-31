import Phaser from "phaser";
import { CONSUMABLE_POOL } from "../data/items/consumables";
import { RELIC_POOL } from "../data/items/relics";
import {
  pullConsumable,
  pullRelic,
  CONSUMABLE_PULL_COST,
  RELIC_PULL_COST,
  RARITY_COLOR,
} from "../systems/GachaSystem";
import { getState, setState } from "../state/gameState";
import { addConsumable, addRelic } from "../systems/RegressionSystem";

/**
 * 상점 — 구세계 쇼핑몰 대신 이 프로젝트 세계관에 맞춘 "여진 상점".
 * 파편(POINT)을 소모해 소모품/유물을 뽑는다. 설계 문서 1.7 참고.
 */
export class GachaScene extends Phaser.Scene {
  private resultText!: Phaser.GameObjects.Text;
  private fragmentText!: Phaser.GameObjects.Text;
  private cardBg!: Phaser.GameObjects.Rectangle;

  constructor() {
    super("GachaScene");
  }

  create() {
    this.add.rectangle(480, 300, 960, 600, 0x0e0c09, 0.96);
    this.add.text(480, 60, "여진 상점", { fontFamily: "serif", fontSize: "24px", color: "#e8e1cd" }).setOrigin(0.5);

    this.fragmentText = this.add.text(480, 100, "", {
      fontFamily: "monospace",
      fontSize: "13px",
      color: "#a8873a",
    }).setOrigin(0.5);

    this.cardBg = this.add.rectangle(480, 260, 420, 140, 0x1e1a13, 0.95).setStrokeStyle(1, 0x3a3225);
    this.resultText = this.add.text(480, 260, "뽑기 결과가 여기 표시됩니다.", {
      fontFamily: "serif",
      fontSize: "14px",
      color: "#cbbfa5",
      align: "center",
      wordWrap: { width: 380 },
    }).setOrigin(0.5);

    const consumableBtn = this.add.text(300, 380, `▸ 소모품 뽑기 (${CONSUMABLE_PULL_COST}pt)`, {
      fontFamily: "serif",
      fontSize: "15px",
      color: "#cbbfa5",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    consumableBtn.on("pointerdown", () => this.doPull("consumable"));

    const relicBtn = this.add.text(660, 380, `▸ 유물 뽑기 (${RELIC_PULL_COST}pt)`, {
      fontFamily: "serif",
      fontSize: "15px",
      color: "#cbbfa5",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    relicBtn.on("pointerdown", () => this.doPull("relic"));

    const closeBtn = this.add.text(480, 460, "[ 닫기 ]", {
      fontFamily: "monospace",
      fontSize: "13px",
      color: "#8fbfa4",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on("pointerdown", () => this.scene.stop());

    this.renderFragments();
  }

  private renderFragments() {
    this.fragmentText.setText(`보유 파편: ${getState().fragments}pt`);
  }

  private doPull(kind: "consumable" | "relic") {
    const cost = kind === "consumable" ? CONSUMABLE_PULL_COST : RELIC_PULL_COST;
    if (getState().fragments < cost) {
      this.resultText.setText("파편이 부족합니다.");
      return;
    }

    let state = getState();
    state = { ...state, fragments: state.fragments - cost };

    if (kind === "consumable") {
      const item = pullConsumable(CONSUMABLE_POOL);
      state = addConsumable(state, item.id);
      setState(state);
      this.showResult(item.name, item.rarity, item.flavor, item.effect);
    } else {
      const item = pullRelic(RELIC_POOL);
      state = addRelic(state, item.id);
      setState(state);
      this.showResult(item.name, item.rarity, item.flavor, item.trait);
    }
    this.renderFragments();
  }

  private showResult(name: string, rarity: keyof typeof RARITY_COLOR, flavor: string, effect: string) {
    this.cardBg.setStrokeStyle(2, RARITY_COLOR[rarity]);
    this.resultText.setText(`[ ${rarity} ] ${name}\n\n${flavor}\n\n${effect}`);
    this.cardBg.setScale(0.9);
    this.tweens.add({ targets: this.cardBg, scale: 1, duration: 220, ease: "Back.Out" });
  }
}
