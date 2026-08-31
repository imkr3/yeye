import Phaser from "phaser";
import {
  BIAS_MULTIPLIER,
  DUPLICATE_DUST,
  PITY_THRESHOLD,
  PRICES,
  canAfford,
  priceFor,
  pullFive,
  pullOnce,
  rarityOdds,
  type PullKind,
  type PullResult,
} from "../systems/EconomySystem";
import { SCHOOL_COLOR, SCHOOL_LABEL, schoolOf, type School } from "../data/economy/schools";
import { RARITY_COLOR } from "../systems/GachaSystem";
import { addCoins } from "../systems/RegressionSystem";
import { getState, setState } from "../state/gameState";
import { createRng } from "../systems/Rng";
import { lerpColor, shade } from "../render/colors";

/**
 * 환로 — 균열 부산물을 불확실한 가능성으로 바꾸는 교환소.
 *
 * 실제 결제는 없다. 확률·천장·중복 규칙을 화면에서 그대로 확인할 수 있고,
 * 여진 가루로는 원하는 물건을 확정 구매하는 대신 계통 방향만 좁힐 수 있다.
 */
export class ExchangeScene extends Phaser.Scene {
  private kind: PullKind = "relic";
  private bias: School | null = null;
  private results: PullResult[] = [];
  private message = "";
  private nodes: Phaser.GameObjects.GameObject[] = [];
  private options: { label: string; act: () => void; disabled?: boolean }[] = [];
  private keyHandler?: (event: KeyboardEvent) => void;
  private showRules = false;

  constructor() {
    super("ExchangeScene");
  }

  init() {
    this.results = [];
    this.message = "";
    this.showRules = false;
    this.bias = null;
    this.kind = "relic";
  }

  create() {
    this.paintBackdrop();
    this.installKeyboard();
    this.render();
    this.events.once("shutdown", () => this.teardown());
    this.events.once("destroy", () => this.teardown());
  }

  private paintBackdrop() {
    const bg = this.add.graphics().setDepth(-5);
    bg.fillGradientStyle(0x0a0810, 0x0a0810, 0x1d1526, 0x1d1526, 1);
    bg.fillRect(0, 0, 960, 600);
    for (let i = 7; i >= 1; i--) {
      bg.fillStyle(0xa98cf0, 0.016 * i);
      bg.fillEllipse(480, 250, 150 * i, 70 * i);
    }
    // 교환대 상판
    bg.fillGradientStyle(0x3a2c1c, 0x2a1f14, 0x14100b, 0x0b0806, 1);
    bg.fillRect(0, 470, 960, 130);
    bg.fillStyle(0xd8a24a, 0.12);
    bg.fillRect(0, 470, 960, 2);
  }

  private clearNodes() {
    this.nodes.forEach((n) => n.destroy());
    this.nodes = [];
  }

  private panel(x: number, y: number, w: number, h: number, tint = 0x40306a) {
    const g = this.add.graphics().setDepth(5);
    g.fillStyle(0x0c0a12, 0.88);
    g.fillRoundedRect(x, y, w, h, 7);
    g.lineStyle(1, tint, 0.85);
    g.strokeRoundedRect(x, y, w, h, 7);
    g.fillStyle(0xffffff, 0.05);
    g.fillRoundedRect(x + 1, y + 1, w - 2, 3, 2);
    this.nodes.push(g);
  }

  private render() {
    this.clearNodes();
    const state = getState();

    this.add
      .text(40, 34, "환로", { fontFamily: "serif", fontSize: "26px", color: "#e6dcff" })
      .setDepth(6);
    this.nodes.push(this.children.list[this.children.list.length - 1] as Phaser.GameObjects.GameObject);

    const balance = this.add
      .text(
        40,
        70,
        `여진화 ${state.aftershockCoins}    여진 가루 ${state.aftershockDust}    천장까지 ${Math.max(
          0,
          PITY_THRESHOLD - state.gachaPity.sinceHighRarity
        )}회`,
        { fontFamily: "monospace", fontSize: "12px", color: "#c9c0da" }
      )
      .setDepth(6);
    this.nodes.push(balance);

    if (this.showRules) {
      this.renderRules();
    } else {
      this.renderResults();
    }

    this.renderMenu();
  }

  private renderRules() {
    this.panel(40, 100, 880, 350);
    const odds = rarityOdds(this.bias);
    const lines = [
      "확률 (등급별 합산)",
      ...odds.map((o) => `  ${o.rarity.padEnd(4)} ${o.percent.toFixed(1)}%`),
      "",
      `천장  ${PITY_THRESHOLD}회 연속으로 SR 이상이 나오지 않으면, 다음 결과는 SR 이상으로 보정됩니다.`,
      "      (SSR을 보장하지는 않습니다.)",
      "",
      "중복  이미 가진 유물이 나오면 자동으로 여진 가루로 환원됩니다.",
      `      ${Object.entries(DUPLICATE_DUST)
        .map(([r, d]) => `${r} → ${d}`)
        .join("   ")}`,
      "",
      `계통 편향  여진 가루 ${PRICES.biasCost}개로 한 계통의 가중치를 ${BIAS_MULTIPLIER}배로 올립니다.`,
      "      원하는 물건을 확정으로 사는 기능은 없습니다.",
      "",
      "이 교환소는 플레이로 얻은 재화만 받습니다. 실제 결제 수단은 없습니다.",
    ];
    const text = this.add
      .text(64, 122, lines.join("\n"), {
        fontFamily: "monospace",
        fontSize: "12.5px",
        color: "#c9c0da",
        lineSpacing: 6,
      })
      .setDepth(6);
    this.nodes.push(text);
  }

  private renderResults() {
    this.panel(40, 100, 880, 350);

    if (this.results.length === 0) {
      const hint = this.add
        .text(
          480,
          262,
          this.message ||
            "무엇을 뽑을지 고르세요.\n결과는 한 화면에서 비교할 수 있습니다.",
          {
            fontFamily: "serif",
            fontSize: "15px",
            color: "#8b8299",
            align: "center",
            lineSpacing: 8,
          }
        )
        .setOrigin(0.5)
        .setDepth(6);
      this.nodes.push(hint);
      return;
    }

    const count = this.results.length;
    const cardW = count > 1 ? 160 : 300;
    const gap = count > 1 ? 12 : 0;
    const totalW = count * cardW + (count - 1) * gap;
    const startX = 480 - totalW / 2;

    this.results.forEach((res, i) => {
      this.resultCard(startX + i * (cardW + gap), 132, cardW, 250, res, i);
    });

    if (this.message) {
      const msg = this.add
        .text(480, 410, this.message, {
          fontFamily: "monospace",
          fontSize: "12px",
          color: "#8fbfa4",
          align: "center",
        })
        .setOrigin(0.5)
        .setDepth(6);
      this.nodes.push(msg);
    }
  }

  private resultCard(x: number, y: number, w: number, h: number, res: PullResult, index: number) {
    const color = RARITY_COLOR[res.rarity];
    const school = schoolOf(res.item.id);

    const g = this.add.graphics().setDepth(6);
    g.fillGradientStyle(shade(color, -0.72), shade(color, -0.82), 0x0b0910, 0x0b0910, 1);
    g.fillRoundedRect(x, y, w, h, 6);
    g.lineStyle(2, color, 0.9);
    g.strokeRoundedRect(x, y, w, h, 6);
    // 등급이 높을수록 테두리 안쪽에 광채를 더한다
    if (res.rarity === "SR" || res.rarity === "SSR") {
      for (let i = 3; i >= 1; i--) {
        g.lineStyle(i * 2.5, color, 0.06 * i);
        g.strokeRoundedRect(x - i, y - i, w + i * 2, h + i * 2, 6 + i);
      }
    }
    // 계통 표시 — 색만이 아니라 형태로도 구분되게 좌상단에 마름모를 둔다
    g.fillStyle(SCHOOL_COLOR[school], 1);
    g.beginPath();
    g.moveTo(x + 16, y + 12);
    g.lineTo(x + 24, y + 20);
    g.lineTo(x + 16, y + 28);
    g.lineTo(x + 8, y + 20);
    g.closePath();
    g.fillPath();
    this.nodes.push(g);

    const rarityLabel = this.add
      .text(x + 32, y + 13, res.rarity, {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#" + lerpColor(color, 0xffffff, 0.5).toString(16).padStart(6, "0"),
      })
      .setDepth(7);
    this.nodes.push(rarityLabel);

    const schoolLabel = this.add
      .text(x + w - 12, y + 13, SCHOOL_LABEL[school], {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#8b8299",
      })
      .setOrigin(1, 0)
      .setDepth(7);
    this.nodes.push(schoolLabel);

    const name = this.add
      .text(x + 12, y + 44, res.item.name, {
        fontFamily: "serif",
        fontSize: w > 200 ? "20px" : "15px",
        color: "#f0e6d0",
        wordWrap: { width: w - 24 },
      })
      .setDepth(7);
    this.nodes.push(name);

    const detail =
      "trait" in res.item ? res.item.trait : (res.item as { effect: string }).effect;
    const body = this.add
      .text(x + 12, y + 96, detail, {
        fontFamily: "monospace",
        fontSize: "10.5px",
        color: "#b8aec6",
        wordWrap: { width: w - 24 },
        lineSpacing: 4,
      })
      .setDepth(7);
    this.nodes.push(body);

    const notes: string[] = [];
    if (res.duplicate) notes.push(`중복 → 여진 가루 +${res.dustGained}`);
    if (res.pityApplied) notes.push("천장 보정");
    if (notes.length) {
      const note = this.add
        .text(x + 12, y + h - 26, notes.join(" · "), {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#d8a24a",
        })
        .setDepth(7);
      this.nodes.push(note);
    }

    // 등장 연출 — 짧고, 섬광 줄이기 설정을 존중한다
    if (!getState().settings.accessibility.reduceFlash) {
      const targets = [g, rarityLabel, schoolLabel, name, body];
      targets.forEach((t) => t.setAlpha(0));
      this.tweens.add({
        targets,
        alpha: 1,
        duration: 180,
        delay: index * 90,
      });
    }
  }

  private renderMenu() {
    const state = getState();
    const singlePrice = priceFor(PRICES.singlePull, state);
    const fivePrice = priceFor(PRICES.fivePull, state);

    const opts: { label: string; act: () => void; disabled?: boolean }[] = [
      {
        label: `${this.kind === "relic" ? "유물" : "소모품"} 단일 뽑기 (여진화 ${singlePrice})`,
        act: () => this.doPull(1, singlePrice),
        disabled: !canAfford(state, singlePrice),
      },
      {
        label: `${this.kind === "relic" ? "유물" : "소모품"} 5연속 (여진화 ${fivePrice})`,
        act: () => this.doPull(5, fivePrice),
        disabled: !canAfford(state, fivePrice),
      },
      {
        label: `대상 전환 → ${this.kind === "relic" ? "소모품" : "유물"}`,
        act: () => {
          this.kind = this.kind === "relic" ? "consumable" : "relic";
          this.results = [];
          this.message = "";
          this.render();
        },
      },
      {
        label: this.bias
          ? `계통 편향: ${SCHOOL_LABEL[this.bias]} (해제)`
          : `계통 편향 걸기 (여진 가루 ${PRICES.biasCost})`,
        act: () => this.toggleBias(),
        disabled: !this.bias && state.aftershockDust < PRICES.biasCost,
      },
      {
        label: this.showRules ? "결과 화면으로" : "확률·천장·중복 규칙 보기",
        act: () => {
          this.showRules = !this.showRules;
          this.render();
        },
      },
      { label: "나가기", act: () => this.scene.stop() },
    ];

    this.options = opts;
    this.panel(40, 464, 880, 116, 0xd8a24a);

    opts.forEach((opt, i) => {
      const x = 60 + (i % 3) * 292;
      const y = 486 + Math.floor(i / 3) * 30;
      const color = opt.disabled ? "#4a4137" : "#e8dcc4";
      const node = this.add
        .text(x, y, `[${i + 1}] ${opt.label}`, {
          fontFamily: "serif",
          fontSize: "14px",
          color,
        })
        .setDepth(7);
      if (!opt.disabled) {
        node.setInteractive({ useHandCursor: true });
        node.on("pointerdown", opt.act);
        node.on("pointerover", () => node.setColor("#ffd9a0"));
        node.on("pointerout", () => node.setColor(color));
      }
      this.nodes.push(node);
    });
  }

  private toggleBias() {
    const state = getState();
    if (this.bias) {
      this.bias = null;
      this.message = "계통 편향을 해제했다.";
      this.render();
      return;
    }
    if (state.aftershockDust < PRICES.biasCost) return;

    // 순환식으로 계통을 고른다 — 별도 서브메뉴 없이 키 하나로 돌린다.
    const order: School[] = ["life", "ruin", "bond", "sanctity"];
    const rng = createRng(`${state.runSeed}:bias:${state.gachaHistory.length}`);
    this.bias = order[rng.int(0, order.length - 1)];
    setState({ ...state, aftershockDust: state.aftershockDust - PRICES.biasCost });
    this.message = `${SCHOOL_LABEL[this.bias]} 쪽으로 흐름이 기울었다. 확정은 아니다.`;
    this.render();
  }

  private doPull(count: 1 | 5, price: number) {
    const state = getState();
    if (!canAfford(state, price)) return;

    const rng = createRng(`${state.runSeed}:pull:${state.gachaHistory.length}:${count}`);
    const paid = addCoins(state, -price);

    if (count === 1) {
      const { result, state: next } = pullOnce(paid, this.kind, rng, this.bias);
      setState(next);
      this.results = [result];
    } else {
      const { results, state: next } = pullFive(paid, this.kind, rng, this.bias);
      setState(next);
      this.results = results;
    }

    const dust = this.results.reduce((sum, r) => sum + r.dustGained, 0);
    this.message = dust > 0 ? `중복 환원으로 여진 가루 ${dust}개를 얻었다.` : "";
    this.render();
  }

  private installKeyboard() {
    this.keyHandler = (event: KeyboardEvent) => {
      if (!this.scene.isActive()) return;
      if (event.key === "Escape") {
        this.scene.stop();
        return;
      }
      const index = Number(event.key) - 1;
      if (Number.isInteger(index) && index >= 0 && index < this.options.length) {
        const opt = this.options[index];
        if (!opt.disabled) opt.act();
      }
    };
    window.addEventListener("keydown", this.keyHandler);
  }

  private teardown() {
    if (this.keyHandler) {
      window.removeEventListener("keydown", this.keyHandler);
      this.keyHandler = undefined;
    }
  }
}
