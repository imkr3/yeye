import Phaser from "phaser";
import { getState, setState, isNearSavePoint } from "../state/gameState";
import { CONSUMABLE_POOL } from "../data/items/consumables";
import { RELIC_POOL } from "../data/items/relics";
import { RARITY_COLOR, type Rarity } from "../systems/GachaSystem";
import { equipRelic, unequipRelic, RELIC_SLOT_LIMIT, setCarriedItems } from "../systems/RegressionSystem";
import {
  applyFieldConsumable,
  consumableEffectNote,
  consumableHasCombatUse,
  consumableHasFieldUse,
  fieldUseMessage,
  relicEffectNote,
} from "../systems/EffectRegistry";
import { SCHOOL_COLOR, SCHOOL_LABEL, schoolOf } from "../data/economy/schools";
import { lerpColor } from "../render/colors";

const RARITY_ORDER: Rarity[] = ["SSR", "SR", "R", "UC", "C"];

/**
 * 인벤토리 — 소모품 사용, 회귀 가방 구성, 유물 진열대 장착을 한 화면에서 처리한다.
 * 가방은 분기점에서만 바꿀 수 있다. 균열에 들어간 뒤에는 가져온 것으로만 버텨야 한다.
 */
export class InventoryScene extends Phaser.Scene {
  private nodes: Phaser.GameObjects.GameObject[] = [];
  private keyHandler?: (event: KeyboardEvent) => void;
  private notice = "";

  constructor() {
    super("InventoryScene");
  }

  init() {
    this.notice = "";
  }

  create() {
    const bg = this.add.graphics().setDepth(-1);
    bg.fillGradientStyle(0x0a0810, 0x0a0810, 0x191322, 0x191322, 1);
    bg.fillRect(0, 0, 960, 600);

    this.render();

    this.keyHandler = (event: KeyboardEvent) => {
      if (!this.scene.isActive()) return;
      if (event.key === "Escape") this.scene.stop();
    };
    window.addEventListener("keydown", this.keyHandler);
    this.events.once("shutdown", () => this.teardown());
    this.events.once("destroy", () => this.teardown());
  }

  private teardown() {
    if (this.keyHandler) {
      window.removeEventListener("keydown", this.keyHandler);
      this.keyHandler = undefined;
    }
  }

  private clearNodes() {
    this.nodes.forEach((n) => n.destroy());
    this.nodes = [];
  }

  private panel(x: number, y: number, w: number, h: number, tint = 0x3a3348) {
    const g = this.add.graphics();
    g.fillStyle(0x0c0a12, 0.86);
    g.fillRoundedRect(x, y, w, h, 7);
    g.lineStyle(1, tint, 0.85);
    g.strokeRoundedRect(x, y, w, h, 7);
    g.fillStyle(0xffffff, 0.05);
    g.fillRoundedRect(x + 1, y + 1, w - 2, 3, 2);
    this.nodes.push(g);
  }

  private label(x: number, y: number, text: string, style: Phaser.Types.GameObjects.Text.TextStyle) {
    const node = this.add.text(x, y, text, style);
    this.nodes.push(node);
    return node;
  }

  private button(x: number, y: number, text: string, color: string, act: () => void) {
    const node = this.add
      .text(x, y, text, { fontFamily: "monospace", fontSize: "11px", color })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    node.on("pointerdown", act);
    node.on("pointerover", () => node.setColor("#ffd9a0"));
    node.on("pointerout", () => node.setColor(color));
    this.nodes.push(node);
    return node;
  }

  /** 등급 점 + 계통 마름모 — 색만이 아니라 형태로도 구분되게 한다. */
  private itemMark(x: number, y: number, rarity: Rarity, itemId: string) {
    const g = this.add.graphics();
    g.fillStyle(RARITY_COLOR[rarity], 1);
    g.fillCircle(x, y, 4);
    const school = schoolOf(itemId);
    if (school !== "none") {
      g.fillStyle(SCHOOL_COLOR[school], 1);
      g.beginPath();
      g.moveTo(x + 11, y - 4);
      g.lineTo(x + 15, y);
      g.lineTo(x + 11, y + 4);
      g.lineTo(x + 7, y);
      g.closePath();
      g.fillPath();
    }
    this.nodes.push(g);
  }

  private render() {
    this.clearNodes();
    const state = getState();

    this.label(40, 28, "인벤토리", { fontFamily: "serif", fontSize: "24px", color: "#e6dcff" });
    this.label(
      40,
      62,
      `파편 ${state.fragments}    여진화 ${state.aftershockCoins}    여진 가루 ${state.aftershockDust}` +
        (state.wardCharges > 0 ? `    액막이 ${state.wardCharges}회` : ""),
      { fontFamily: "monospace", fontSize: "11px", color: "#a49bb5" }
    );

    this.renderConsumables();
    this.renderBag();
    this.renderRelics();

    if (this.notice) {
      this.label(480, 566, this.notice, {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#8fbfa4",
      }).setOrigin(0.5);
    }

    const close = this.add
      .text(920, 28, "[Esc] 닫기", { fontFamily: "monospace", fontSize: "12px", color: "#8fbfa4" })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    close.on("pointerdown", () => this.scene.stop());
    this.nodes.push(close);
  }

  // --- 소모품 -------------------------------------------------------------

  private renderConsumables() {
    this.panel(30, 92, 440, 268);
    this.label(46, 104, "소모품", { fontFamily: "serif", fontSize: "16px", color: "#cbbfa5" });

    const owned = getState().inventory.consumables;
    if (owned.length === 0) {
      this.label(46, 134, "아직 아무것도 없습니다.", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#4a4137",
      });
      return;
    }

    const counts = new Map<string, number>();
    owned.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));

    const rows = [...counts.entries()]
      .map(([id, count]) => ({ item: CONSUMABLE_POOL.find((p) => p.id === id), count }))
      .filter((r): r is { item: (typeof CONSUMABLE_POOL)[number]; count: number } => !!r.item)
      .sort((a, b) => RARITY_ORDER.indexOf(a.item.rarity) - RARITY_ORDER.indexOf(b.item.rarity))
      .slice(0, 9);

    rows.forEach((row, i) => {
      const y = 138 + i * 24;
      this.itemMark(56, y, row.item.rarity, row.item.id);
      this.label(78, y - 7, `${row.item.name}${row.count > 1 ? ` ×${row.count}` : ""}`, {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#cbbfa5",
      });

      const note = consumableEffectNote(row.item.id);
      if (note) {
        this.label(78, y + 5, note, { fontFamily: "monospace", fontSize: "9px", color: "#6f6880" });
      }

      let bx = 456;
      if (consumableHasFieldUse(row.item.id)) {
        this.button(bx, y, "[사용]", "#d1616c", () => {
          // 문구는 상태가 바뀌기 전 값으로 계산한다 (예: 나침반이 가리키는 분기점 이름).
          const report = fieldUseMessage(getState(), row.item.id);
          setState(applyFieldConsumable(getState(), row.item.id));
          this.notice = report ?? `${row.item.name}을(를) 사용했다.`;
          this.render();
        });
        bx -= 46;
      }
      if (consumableHasCombatUse(row.item.id)) {
        this.button(bx, y, "[가방]", "#6ea78c", () => this.addToBag(row.item.id));
      }
    });
  }

  // --- 회귀 가방 ----------------------------------------------------------

  private renderBag() {
    const state = getState();
    const editable = isNearSavePoint();
    this.panel(30, 372, 440, 176, editable ? 0x6ea78c : 0x3a3348);

    this.label(46, 384, `회귀 가방  ${state.carriedItemIds.length}/${state.carriedItemSlots}`, {
      fontFamily: "serif",
      fontSize: "16px",
      color: "#cbbfa5",
    });
    this.label(
      46,
      406,
      editable
        ? "분기점에 서 있다 — 지금은 교체할 수 있다."
        : "분기점에서만 교체할 수 있다. 여기 넣은 것만 회귀 후에도 남는다.",
      { fontFamily: "monospace", fontSize: "10px", color: editable ? "#8fbfa4" : "#6f6880" }
    );

    for (let i = 0; i < state.carriedItemSlots; i++) {
      const y = 432 + i * 32;
      const id = state.carriedItemIds[i];
      const item = id ? CONSUMABLE_POOL.find((c) => c.id === id) : undefined;

      const g = this.add.graphics();
      g.lineStyle(1, item ? 0xa8873a : 0x3a3348, 0.9);
      g.strokeRoundedRect(46, y - 2, 408, 28, 4);
      if (item) {
        g.fillStyle(0xa8873a, 0.08);
        g.fillRoundedRect(46, y - 2, 408, 28, 4);
      }
      this.nodes.push(g);

      if (item) {
        this.itemMark(66, y + 12, item.rarity, item.id);
        this.label(88, y + 4, item.name, {
          fontFamily: "monospace",
          fontSize: "12px",
          color: "#e8dcc4",
        });
        if (editable) {
          this.button(444, y + 12, "[빼기]", "#d1616c", () => this.removeFromBag(i));
        }
      } else {
        this.label(66, y + 4, `${i + 1}번 칸 — 비어 있음`, {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#4a4137",
        });
      }
    }
  }

  private addToBag(itemId: string) {
    if (!isNearSavePoint()) {
      this.notice = "가방은 분기점에서만 바꿀 수 있다.";
      this.render();
      return;
    }
    const state = getState();
    if (state.carriedItemIds.length >= state.carriedItemSlots) {
      this.notice = "가방이 가득 찼다.";
      this.render();
      return;
    }
    setState(setCarriedItems(state, [...state.carriedItemIds, itemId]));
    this.notice = "가방에 넣었다. 회귀해도 남는다.";
    this.render();
  }

  private removeFromBag(index: number) {
    if (!isNearSavePoint()) return;
    const state = getState();
    const next = [...state.carriedItemIds];
    next.splice(index, 1);
    setState(setCarriedItems(state, next));
    this.notice = "가방에서 뺐다.";
    this.render();
  }

  // --- 유물 ---------------------------------------------------------------

  private renderRelics() {
    const state = getState();
    this.panel(490, 92, 440, 456);

    this.label(506, 104, "유물", { fontFamily: "serif", fontSize: "16px", color: "#cbbfa5" });
    this.label(506, 126, `진열대 ${state.equippedRelics.length}/${RELIC_SLOT_LIMIT}`, {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#a8873a",
    });

    const ownedUnique = [...new Set(state.inventory.relics)];
    if (ownedUnique.length === 0) {
      this.label(506, 156, "아직 아무것도 없습니다.", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#4a4137",
      });
      return;
    }

    const rows = ownedUnique
      .map((id) => RELIC_POOL.find((p) => p.id === id))
      .filter((r): r is (typeof RELIC_POOL)[number] => !!r)
      .sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity))
      .slice(0, 12);

    rows.forEach((item, i) => {
      const y = 158 + i * 32;
      const equipped = state.equippedRelics.includes(item.id);

      if (equipped) {
        const g = this.add.graphics();
        g.fillStyle(0xa8873a, 0.1);
        g.fillRoundedRect(500, y - 8, 420, 28, 4);
        g.fillStyle(0xa8873a, 0.85);
        g.fillRoundedRect(500, y - 8, 3, 28, 2);
        this.nodes.push(g);
      }

      this.itemMark(520, y + 4, item.rarity, item.id);
      this.label(542, y - 4, item.name, {
        fontFamily: "monospace",
        fontSize: "12px",
        color: equipped ? "#f0e6d0" : "#cbbfa5",
      });

      const note = relicEffectNote(item.id);
      this.label(542, y + 9, note ?? `${SCHOOL_LABEL[schoolOf(item.id)]} · 효과 미연결`, {
        fontFamily: "monospace",
        fontSize: "9px",
        color: note
          ? "#" + lerpColor(0x6ea78c, 0xffffff, 0.2).toString(16).padStart(6, "0")
          : "#5c5568",
      });

      this.button(912, y + 4, equipped ? "[해제]" : "[장착]", equipped ? "#d1616c" : "#6ea78c", () => {
        const current = getState();
        const updated = equipped ? unequipRelic(current, item.id) : equipRelic(current, item.id);
        if (!equipped && updated.equippedRelics.length === current.equippedRelics.length) {
          this.notice = "진열대가 가득 찼다. 하나를 먼저 해제해야 한다.";
        } else {
          this.notice = equipped ? "진열대에서 내렸다." : "진열대에 걸었다.";
        }
        setState(updated);
        this.render();
      });
    });
  }
}
