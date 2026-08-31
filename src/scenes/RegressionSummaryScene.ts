import Phaser from "phaser";
import { getState } from "../state/gameState";
import { CONSUMABLE_POOL } from "../data/items/consumables";
import { stainStatus } from "../systems/StainSystem";
import { drawVolumetricCharacter } from "../render/volumetric";
import { lerpColor } from "../render/colors";

export interface RegressionSummaryData {
  outcome: "died" | "cleared";
  /** 직접 사인 또는 돌파 사유. */
  cause: string;
  /** 이번 시도에서 새로 알게 된 것. */
  learned: string;
  /** 액막이 부적이 페널티를 대신 막았는지. */
  wardUsed?: boolean;
  returnScene: string;
  returnData?: Record<string, unknown>;
}

/**
 * 회귀 요약 — 죽은 직후 한 화면에서 "무엇이 남고 무엇이 사라지는지"를 전부 보여준다.
 * 재도전까지의 입력은 키 하나면 충분해야 한다.
 */
export class RegressionSummaryScene extends Phaser.Scene {
  private summaryData!: RegressionSummaryData;
  private keyHandler?: (event: KeyboardEvent) => void;

  constructor() {
    super("RegressionSummaryScene");
  }

  init(data: RegressionSummaryData) {
    this.summaryData = data;
  }

  create() {
    const died = this.summaryData.outcome === "died";
    const state = getState();
    const accent = died ? 0xd1616c : 0x8fbfa4;

    // 배경 — 가라앉는 듯한 수직 그라디언트와 잔광
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x07060b, 0x07060b, 0x191322, 0x191322, 1);
    bg.fillRect(0, 0, 960, 600);
    for (let i = 8; i >= 1; i--) {
      bg.fillStyle(accent, 0.012 * i);
      bg.fillEllipse(480, 300, 160 * i, 90 * i);
    }

    drawVolumetricCharacter(this, 480, 236, {
      accent,
      cloth: 0x201a16,
      crest: "dual-ring",
      scale: 30,
    }).setAlpha(died ? 0.5 : 0.95);

    this.add
      .text(480, 78, died ? "회귀" : "돌파", {
        fontFamily: "serif",
        fontSize: "38px",
        color: died ? "#d1616c" : "#a8e0c4",
      })
      .setOrigin(0.5)
      .setShadow(0, 3, "#000000", 10, false, true);

    this.add
      .text(480, 120, this.summaryData.cause, {
        fontFamily: "serif",
        fontSize: "16px",
        color: "#c9c0da",
      })
      .setOrigin(0.5);

    // --- 요약 카드 4장 ---
    const cards: { title: string; body: string; tint: number }[] = [
      {
        title: "이번에 알게 된 것",
        body: this.summaryData.learned,
        tint: 0x6ea78c,
      },
      {
        title: died ? (this.summaryData.wardUsed ? "부적이 대신 막았다" : "붙는 페널티") : "얻은 것",
        body: died
          ? this.summaryData.wardUsed
            ? "액막이 부적 1회를 소모해 이번 페널티를 막았다."
            : this.latestPenalty()
          : "심층주를 넘어 새 주기가 열렸다. 지하도 배치가 다시 섞인다.",
        tint: died ? 0xd1616c : 0xa8873a,
      },
      {
        title: "가방에 남는 것",
        body: this.carriedSummary(),
        tint: 0xa8873a,
      },
      {
        title: "주기 재화",
        body: `여진화 ${state.aftershockCoins}  ·  여진 가루 ${state.aftershockDust}\n얼룩 ${Math.round(
          state.stain
        )} (${stainStatus(state.stain).label}) — 회귀해도 남는다`,
        tint: 0xa98cf0,
      },
    ];

    cards.forEach((card, i) => {
      const x = 60 + (i % 2) * 448;
      const y = 316 + Math.floor(i / 2) * 106;
      this.card(x, y, 400, 92, card.title, card.body, card.tint);
    });

    const cont = this.add
      .text(480, 546, "[ Enter ] 계속", {
        fontFamily: "monospace",
        fontSize: "15px",
        color: "#e8dcc4",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    cont.on("pointerdown", () => this.continue());
    this.tweens.add({ targets: cont, alpha: 0.45, duration: 1100, yoyo: true, repeat: -1 });

    this.keyHandler = (event: KeyboardEvent) => {
      if (!this.scene.isActive()) return;
      if (event.key === "Enter" || event.key === " " || event.key === "1") this.continue();
    };
    window.addEventListener("keydown", this.keyHandler);

    this.events.once("shutdown", () => this.teardown());
    this.events.once("destroy", () => this.teardown());
  }

  private card(x: number, y: number, w: number, h: number, title: string, body: string, tint: number) {
    const g = this.add.graphics();
    g.fillStyle(0x0d0b12, 0.86);
    g.fillRoundedRect(x, y, w, h, 6);
    g.lineStyle(1, tint, 0.55);
    g.strokeRoundedRect(x, y, w, h, 6);
    // 왼쪽 색 띠 — 카드 성격을 색만이 아니라 형태로도 구분
    g.fillStyle(tint, 0.85);
    g.fillRoundedRect(x, y, 4, h, 2);
    g.fillStyle(0xffffff, 0.04);
    g.fillRoundedRect(x + 1, y + 1, w - 2, 3, 2);

    this.add.text(x + 18, y + 12, title, {
      fontFamily: "monospace",
      fontSize: "10.5px",
      color: "#" + lerpColor(tint, 0xffffff, 0.35).toString(16).padStart(6, "0"),
    });
    this.add.text(x + 18, y + 32, body, {
      fontFamily: "serif",
      fontSize: "13px",
      color: "#cdc4d8",
      wordWrap: { width: w - 36 },
      lineSpacing: 5,
    });
  }

  private latestPenalty(): string {
    const penalties = getState().accumulatedPenalties;
    const last = penalties[penalties.length - 1];
    if (!last) return "이번에는 아무것도 붙지 않았다.";
    return `${last.label} — ${last.description}`;
  }

  private carriedSummary(): string {
    const ids = getState().carriedItemIds;
    if (ids.length === 0) return "가방이 비어 있다. 분기점에서 챙겨둘 수 있다.";
    const names = ids
      .map((id) => CONSUMABLE_POOL.find((c) => c.id === id)?.name ?? id)
      .join(", ");
    return `${names} — 회귀해도 그대로 남는다.`;
  }

  private continue() {
    this.teardown();
    this.scene.start(this.summaryData.returnScene, this.summaryData.returnData ?? {});
  }

  private teardown() {
    if (this.keyHandler) {
      window.removeEventListener("keydown", this.keyHandler);
      this.keyHandler = undefined;
    }
  }
}
