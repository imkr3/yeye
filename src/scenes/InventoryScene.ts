import Phaser from "phaser";
import { getState, setState } from "../state/gameState";
import { CONSUMABLE_POOL } from "../data/items/consumables";
import { RELIC_POOL } from "../data/items/relics";
import { RARITY_COLOR, type Rarity } from "../systems/GachaSystem";
import { equipRelic, unequipRelic, RELIC_SLOT_LIMIT } from "../systems/RegressionSystem";

const RARITY_ORDER: Rarity[] = ["SSR", "SR", "R", "UC", "C"];

/** 뽑은 소모품/유물을 등급순으로 훑어보고, 유물은 진열대에 장착/해제할 수 있는 창. */
export class InventoryScene extends Phaser.Scene {
  private relicColumnX = 720;

  constructor() {
    super("InventoryScene");
  }

  create() {
    this.add.rectangle(480, 300, 960, 600, 0x0e0c09, 0.96);
    this.add.text(480, 40, "인벤토리", { fontFamily: "serif", fontSize: "22px", color: "#e8e1cd" }).setOrigin(0.5);

    this.renderConsumables();
    this.renderRelics();

    const closeBtn = this.add.text(480, 560, "[ 닫기 ]", {
      fontFamily: "monospace",
      fontSize: "13px",
      color: "#8fbfa4",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on("pointerdown", () => this.scene.stop());
  }

  private renderConsumables() {
    const x = 240;
    this.add.text(x, 80, "소모품", { fontFamily: "serif", fontSize: "16px", color: "#cbbfa5" }).setOrigin(0.5);

    const owned = getState().inventory.consumables;
    if (owned.length === 0) {
      this.add.text(x, 120, "아직 아무것도 없습니다.", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#4a4137",
      }).setOrigin(0.5);
      return;
    }

    const counts = new Map<string, number>();
    owned.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
    const rows = [...counts.entries()]
      .map(([id, count]) => ({ item: CONSUMABLE_POOL.find((p) => p.id === id), count }))
      .filter((r): r is { item: (typeof CONSUMABLE_POOL)[number]; count: number } => !!r.item)
      .sort((a, b) => RARITY_ORDER.indexOf(a.item.rarity) - RARITY_ORDER.indexOf(b.item.rarity));

    rows.forEach((row, i) => {
      const y = 115 + i * 22;
      this.add.circle(x - 100, y, 4, RARITY_COLOR[row.item.rarity]);
      this.add.text(x - 88, y, `${row.item.name} ${row.count > 1 ? `×${row.count}` : ""}`, {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#cbbfa5",
      }).setOrigin(0, 0.5);
    });
  }

  private renderRelics() {
    const x = this.relicColumnX;
    this.add.text(x, 80, "유물", { fontFamily: "serif", fontSize: "16px", color: "#cbbfa5" }).setOrigin(0.5);

    const state = getState();
    this.add.text(x, 100, `진열대 ${state.equippedRelics.length}/${RELIC_SLOT_LIMIT}`, {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#a8873a",
    }).setOrigin(0.5);

    const ownedUnique = [...new Set(state.inventory.relics)];
    if (ownedUnique.length === 0) {
      this.add.text(x, 140, "아직 아무것도 없습니다.", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#4a4137",
      }).setOrigin(0.5);
      return;
    }

    const rows = ownedUnique
      .map((id) => RELIC_POOL.find((p) => p.id === id))
      .filter((r): r is (typeof RELIC_POOL)[number] => !!r)
      .sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));

    rows.forEach((item, i) => {
      const y = 135 + i * 24;
      const equipped = getState().equippedRelics.includes(item.id);

      this.add.circle(x - 130, y, 4, RARITY_COLOR[item.rarity]);
      this.add.text(x - 118, y, item.name, {
        fontFamily: "monospace",
        fontSize: "12px",
        color: equipped ? "#e8e1cd" : "#cbbfa5",
      }).setOrigin(0, 0.5);

      const toggle = this.add.text(x + 110, y, equipped ? "[해제]" : "[장착]", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: equipped ? "#d1616c" : "#6ea78c",
      }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });

      toggle.on("pointerdown", () => {
        const current = getState();
        const next = equipped ? unequipRelic(current, item.id) : equipRelic(current, item.id);
        setState(next);
        this.scene.restart();
      });
    });
  }
}
