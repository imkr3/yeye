import Phaser from "phaser";
import { getState } from "../state/gameState";
import { CONSUMABLE_POOL } from "../data/items/consumables";
import { RELIC_POOL } from "../data/items/relics";
import { RARITY_COLOR, type Rarity } from "../systems/GachaSystem";

const RARITY_ORDER: Rarity[] = ["SSR", "SR", "R", "UC", "C"];

/** 뽑은 소모품/유물을 등급순으로 훑어보는 인벤토리 창. */
export class InventoryScene extends Phaser.Scene {
  constructor() {
    super("InventoryScene");
  }

  create() {
    this.add.rectangle(480, 300, 960, 600, 0x0e0c09, 0.96);
    this.add.text(480, 40, "인벤토리", { fontFamily: "serif", fontSize: "22px", color: "#e8e1cd" }).setOrigin(0.5);

    const state = getState();

    this.renderColumn(240, "소모품", state.inventory.consumables, CONSUMABLE_POOL);
    this.renderColumn(720, "유물", state.inventory.relics, RELIC_POOL);

    const closeBtn = this.add.text(480, 560, "[ 닫기 ]", {
      fontFamily: "monospace",
      fontSize: "13px",
      color: "#8fbfa4",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on("pointerdown", () => this.scene.stop());
  }

  private renderColumn(
    x: number,
    title: string,
    ownedIds: string[],
    pool: { id: string; name: string; rarity: Rarity }[]
  ) {
    this.add.text(x, 80, title, { fontFamily: "serif", fontSize: "16px", color: "#cbbfa5" }).setOrigin(0.5);

    if (ownedIds.length === 0) {
      this.add.text(x, 120, "아직 아무것도 없습니다.", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#4a4137",
      }).setOrigin(0.5);
      return;
    }

    // id별 개수 집계
    const counts = new Map<string, number>();
    ownedIds.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));

    const rows: { name: string; rarity: Rarity; count: number }[] = [];
    for (const [id, count] of counts) {
      const item = pool.find((p) => p.id === id);
      if (item) rows.push({ name: item.name, rarity: item.rarity, count });
    }
    rows.sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));

    rows.forEach((row, i) => {
      const y = 115 + i * 22;
      this.add.circle(x - 100, y, 4, RARITY_COLOR[row.rarity]);
      this.add.text(x - 88, y, `${row.name} ${row.count > 1 ? `×${row.count}` : ""}`, {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#cbbfa5",
      }).setOrigin(0, 0.5);
    });
  }
}
