import Phaser from "phaser";
import type { EnemyDef } from "../data/rifts/enemies";
import {
  createCombat,
  takeTurn,
  canUseLastDitch,
  describeEnemyIntent,
  type CombatState,
  type PlayerAction,
} from "../systems/CombatSystem";
import { consumableHasCombatUse, relicModifiers } from "../systems/EffectRegistry";
import { CONSUMABLE_POOL } from "../data/items/consumables";
import { stainStatus } from "../systems/StainSystem";
import { createRng } from "../systems/Rng";
import { getState } from "../state/gameState";
import { drawCreature, creatureFormFor, drawVolumetricCharacter } from "../render/volumetric";
import { lerpColor, shade } from "../render/colors";

export interface CombatOutcome {
  result: "win" | "lose";
  playerHp: number;
  stain: number;
  turns: number;
  itemsUsed: string[];
  overflowResidue: boolean;
  fragmentsEarned: number;
}

export interface CombatSceneData {
  encounterId: string;
  enemy: EnemyDef;
  memoryTier: number;
  playerHp: number;
  playerMaxHp: number;
  stain: number;
  /** 가방에 든 소모품 — 전투 중 쓸 수 있는 것만 목록에 뜬다. */
  carriedItems: string[];
  accentColor?: number;
  onResult: (outcome: CombatOutcome) => void;
}

type MenuMode = "root" | "mark" | "item" | "over";

const ACCENT = 0xd1616c;
const PANEL = 0x0d0b12;

export class CombatScene extends Phaser.Scene {
  private combatData!: CombatSceneData;
  private combat!: CombatState;
  private mode: MenuMode = "root";
  private rng = createRng("combat");

  private enemyFigure!: Phaser.GameObjects.Container;
  private playerFigure!: Phaser.GameObjects.Container;
  private enemyBar!: Phaser.GameObjects.Graphics;
  private playerBar!: Phaser.GameObjects.Graphics;
  private intentText!: Phaser.GameObjects.Text;
  private memoryText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  private menuNodes: Phaser.GameObjects.GameObject[] = [];
  private keyHandler?: (event: KeyboardEvent) => void;

  constructor() {
    super("CombatScene");
  }

  init(data: CombatSceneData) {
    this.combatData = data;
    this.mode = "root";
    this.rng = createRng(`${getState().runSeed}:${data.encounterId}:${getState().runCount}`);
    this.combat = createCombat({
      enemy: data.enemy,
      memoryTier: data.memoryTier,
      playerHp: data.playerHp,
      playerMaxHp: data.playerMaxHp,
      stain: data.stain,
      modifiers: relicModifiers(getState().equippedRelics),
    });
  }

  create() {
    this.paintBackdrop();

    const accent = this.combatData.accentColor ?? ACCENT;

    this.enemyFigure = drawCreature(
      this,
      640,
      210,
      creatureFormFor(this.combatData.enemy.id),
      accent,
      this.combatData.enemy.phaseTwoAt !== undefined ? 62 : 46
    );
    this.tweens.add({
      targets: this.enemyFigure,
      y: 202,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });

    this.playerFigure = drawVolumetricCharacter(this, 190, 372, {
      accent: 0xd1616c,
      cloth: 0x2a2119,
      crest: "dual-ring",
      scale: 24,
    });

    this.paintFrames();
    this.enemyBar = this.add.graphics().setDepth(6);
    this.playerBar = this.add.graphics().setDepth(6);

    this.intentText = this.add
      .text(352, 118, "", {
        fontFamily: "serif",
        fontSize: "15px",
        color: "#f0e6d0",
        wordWrap: { width: 560 },
      })
      .setDepth(7);

    this.memoryText = this.add
      .text(352, 92, "", { fontFamily: "monospace", fontSize: "11px", color: "#8fbfa4" })
      .setDepth(7);

    this.logText = this.add
      .text(352, 300, "", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#bdb2a0",
        lineSpacing: 5,
        wordWrap: { width: 560 },
      })
      .setDepth(7);

    this.installKeyboard();
    this.render();

    this.events.once("shutdown", () => this.teardown());
    this.events.once("destroy", () => this.teardown());
  }

  // --- 배경과 프레임 -------------------------------------------------------

  private paintBackdrop() {
    const bg = this.add.graphics().setDepth(-10);
    bg.fillGradientStyle(0x0a0812, 0x0a0812, 0x1c1526, 0x1c1526, 1);
    bg.fillRect(0, 0, 960, 600);

    // 뒤쪽에서 번지는 대치 조명
    const glow = this.add.graphics().setDepth(-9);
    for (let i = 7; i >= 1; i--) {
      glow.fillStyle(0x4a2a44, 0.035 * i * 0.6);
      glow.fillEllipse(640, 220, 120 * i, 80 * i);
    }

    // 바닥면 — 원근 그라디언트와 반사
    const floor = this.add.graphics().setDepth(-8);
    floor.fillGradientStyle(0x241b2e, 0x241b2e, 0x0b0810, 0x0b0810, 1);
    floor.fillRect(0, 400, 960, 200);
    floor.fillStyle(0xa98cf0, 0.06);
    floor.fillEllipse(640, 410, 420, 60);
    floor.fillStyle(0xd1616c, 0.05);
    floor.fillEllipse(190, 452, 260, 44);

    // 떠다니는 재
    for (let i = 0; i < 26; i++) {
      const x = Phaser.Math.Between(0, 960);
      const y = Phaser.Math.Between(60, 560);
      const dot = this.add.circle(x, y, Phaser.Math.Between(1, 2), 0xc9b0ff, 0.22).setDepth(-7);
      this.tweens.add({
        targets: dot,
        y: y - Phaser.Math.Between(30, 70),
        alpha: 0,
        duration: Phaser.Math.Between(3000, 6000),
        delay: Phaser.Math.Between(0, 2500),
        repeat: -1,
        onRepeat: () => {
          dot.y = y;
          dot.setAlpha(0.22);
        },
      });
    }
  }

  private paintFrames() {
    const panel = this.add.graphics().setDepth(5);
    // 상단 적 정보 패널
    this.roundedPanel(panel, 340, 40, 590, 108);
    // 로그 패널
    this.roundedPanel(panel, 340, 288, 590, 190);
    // 좌측 플레이어 패널
    this.roundedPanel(panel, 24, 402, 292, 150);
    // 하단 행동 패널
    this.roundedPanel(panel, 340, 492, 590, 86);

    this.add
      .text(352, 52, this.combatData.enemy.name, {
        fontFamily: "serif",
        fontSize: "19px",
        color: "#f3e7c8",
      })
      .setDepth(7);

    this.add
      .text(352, 268, "전투 기록", { fontFamily: "monospace", fontSize: "10px", color: "#6b6255" })
      .setDepth(7);

    this.add
      .text(36, 412, "노아", { fontFamily: "serif", fontSize: "15px", color: "#f0e6d0" })
      .setDepth(7);
  }

  private roundedPanel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
    g.fillStyle(PANEL, 0.82);
    g.fillRoundedRect(x, y, w, h, 6);
    g.lineStyle(1, 0x3a3348, 0.9);
    g.strokeRoundedRect(x, y, w, h, 6);
    // 위쪽 하이라이트로 패널에 두께감을 준다
    g.fillStyle(0xffffff, 0.05);
    g.fillRoundedRect(x + 1, y + 1, w - 2, 3, 2);
  }

  /** 광택이 있는 게이지 바. */
  private gauge(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    ratio: number,
    color: number,
    segments = 0
  ) {
    g.fillStyle(0x000000, 0.55);
    g.fillRoundedRect(x, y, w, h, h / 2);
    const filled = Math.max(0, Math.min(1, ratio)) * (w - 4);
    if (filled > 1) {
      g.fillGradientStyle(lerpColor(color, 0xffffff, 0.45), color, color, shade(color, -0.35), 1);
      g.fillRoundedRect(x + 2, y + 2, filled, h - 4, (h - 4) / 2);
      g.fillStyle(0xffffff, 0.18);
      g.fillRoundedRect(x + 3, y + 3, Math.max(0, filled - 2), (h - 4) * 0.38, (h - 4) / 3);
    }
    if (segments > 0) {
      g.lineStyle(1, 0x000000, 0.4);
      for (let i = 1; i < segments; i++) {
        const sx = x + 2 + ((w - 4) * i) / segments;
        g.beginPath();
        g.moveTo(sx, y + 2);
        g.lineTo(sx, y + h - 2);
        g.strokePath();
      }
    }
    g.lineStyle(1, 0x000000, 0.7);
    g.strokeRoundedRect(x, y, w, h, h / 2);
  }

  // --- 렌더 ---------------------------------------------------------------

  private render() {
    const c = this.combat;

    this.enemyBar.clear();
    this.gauge(this.enemyBar, 352, 74, 500, 14, c.enemy.hp / c.enemy.def.maxHp, 0xa8455a, 10);
    this.enemyBar.fillStyle(0xf0e6d0, 0.85);

    const phaseLabel = c.enemy.def.phaseTwoAt !== undefined ? `  ·  ${c.enemy.phase}페이즈` : "";
    const hpLabel = `${c.enemy.hp} / ${c.enemy.def.maxHp}${phaseLabel}`;
    this.setOrCreateText("enemyHp", 862, 74, hpLabel, {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#e0c8cc",
    }).setOrigin(1, 0);

    this.playerBar.clear();
    this.gauge(this.playerBar, 36, 436, 268, 15, c.player.hp / c.player.maxHp, 0x6ea78c, 0);
    const stain = stainStatus(c.player.stain);
    this.gauge(this.playerBar, 36, 470, 268, 11, c.player.stain / 100, stain.color, 0);
    if (c.player.shield > 0) {
      this.gauge(this.playerBar, 36, 486, 268, 7, Math.min(1, c.player.shield / 20), 0x8fc4e8, 0);
    }

    this.setOrCreateText(
      "playerHp",
      36,
      454,
      `체력 ${c.player.hp}/${c.player.maxHp}${c.player.shield > 0 ? `  보호막 ${c.player.shield}` : ""}`,
      { fontFamily: "monospace", fontSize: "11px", color: "#a8c9ba" }
    );
    this.setOrCreateText("stainLabel", 36, 498, `얼룩 ${Math.round(c.player.stain)} — ${stain.label}`, {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#" + stain.color.toString(16).padStart(6, "0"),
    });

    const guardNote =
      c.player.consecutiveGuards > 1 ? `  ·  자세 흐트러짐 ${c.player.consecutiveGuards}` : "";
    this.setOrCreateText("turnLabel", 36, 516, `${c.turn}턴${guardNote}`, {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#6b6255",
    });

    this.memoryText.setText(`죽음의 기억 ${c.memoryTier}/3`);
    this.intentText.setText(c.over ? "" : describeEnemyIntent(c));
    this.logText.setText(c.log.slice(-9).join("\n"));

    this.renderMenu();
  }

  private textCache = new Map<string, Phaser.GameObjects.Text>();

  private setOrCreateText(
    key: string,
    x: number,
    y: number,
    value: string,
    style: Phaser.Types.GameObjects.Text.TextStyle
  ): Phaser.GameObjects.Text {
    const existing = this.textCache.get(key);
    if (existing) {
      existing.setText(value).setStyle(style);
      return existing;
    }
    const created = this.add.text(x, y, value, style).setDepth(7);
    this.textCache.set(key, created);
    return created;
  }

  // --- 메뉴 ---------------------------------------------------------------

  private renderMenu() {
    this.menuNodes.forEach((n) => n.destroy());
    this.menuNodes = [];

    if (this.combat.over) {
      this.renderOutcome();
      return;
    }

    if (this.mode === "mark") {
      this.renderChoices("어느 계열을 지목할까", [
        { label: "약공격", act: () => this.act({ id: "causal-mark", predictKind: "weak" }) },
        { label: "강공격", act: () => this.act({ id: "causal-mark", predictKind: "strong" }) },
        { label: "표식·폭발", act: () => this.act({ id: "causal-mark", predictKind: "detonate" }) },
        { label: "돌아가기", act: () => this.setMode("root") },
      ]);
      return;
    }

    if (this.mode === "item") {
      const usable = this.usableItems();
      const options = usable.map((item) => ({
        label: item.name,
        act: () => this.act({ id: "use-item", itemId: item.id }),
      }));
      options.push({ label: "돌아가기", act: () => this.setMode("root") });
      this.renderChoices(usable.length ? "무엇을 쓸까" : "쓸 수 있는 것이 없다", options);
      return;
    }

    const lastDitchReady = canUseLastDitch(this.combat);
    this.renderChoices("행동을 고르세요", [
      { label: "기초 타격", act: () => this.act({ id: "basic-strike" }) },
      { label: "방어", act: () => this.act({ id: "guard" }) },
      { label: "인과 표식", act: () => this.setMode("mark") },
      { label: "결손 절단", act: () => this.act({ id: "sunder" }) },
      {
        label: "막바지 승부",
        act: () => this.act({ id: "last-ditch" }),
        disabled: !lastDitchReady,
        note: lastDitchReady ? undefined : "체력 30% 이하에서",
      },
      { label: "아이템", act: () => this.setMode("item") },
    ]);
  }

  private renderChoices(
    title: string,
    options: { label: string; act: () => void; disabled?: boolean; note?: string }[]
  ) {
    const header = this.add
      .text(352, 500, title, { fontFamily: "monospace", fontSize: "10px", color: "#6b6255" })
      .setDepth(8);
    this.menuNodes.push(header);

    options.forEach((opt, i) => {
      const x = 352 + (i % 3) * 196;
      const y = 518 + Math.floor(i / 3) * 26;
      const color = opt.disabled ? "#4a4137" : "#e8dcc4";
      const node = this.add
        .text(x, y, `[${i + 1}] ${opt.label}${opt.note ? ` (${opt.note})` : ""}`, {
          fontFamily: "serif",
          fontSize: "14px",
          color,
        })
        .setDepth(8);
      if (!opt.disabled) {
        node.setInteractive({ useHandCursor: true });
        node.on("pointerdown", opt.act);
        node.on("pointerover", () => node.setColor("#ffd9a0"));
        node.on("pointerout", () => node.setColor(color));
      }
      this.menuNodes.push(node);
    });

    this.currentOptions = options;
  }

  private currentOptions: { label: string; act: () => void; disabled?: boolean }[] = [];

  private renderOutcome() {
    const won = this.combat.result === "win";
    const overlay = this.add.graphics().setDepth(30);
    overlay.fillStyle(0x000000, 0.72);
    overlay.fillRect(0, 0, 960, 600);
    this.menuNodes.push(overlay);

    const title = this.add
      .text(480, 232, won ? "적을 물리쳤다" : "쓰러졌다", {
        fontFamily: "serif",
        fontSize: "30px",
        color: won ? "#f3e7c8" : "#d1616c",
      })
      .setOrigin(0.5)
      .setDepth(31);
    this.menuNodes.push(title);

    const r = this.combat.record;
    const lines = [
      `${r.turns}턴  ·  가한 피해 ${r.damageDealt}  ·  받은 피해 ${r.damageTaken}`,
      r.itemsUsed.length ? `사용한 아이템: ${r.itemsUsed.length}개` : "아이템을 쓰지 않았다",
      this.combat.overflowResidue ? "얼룩이 넘쳤다 — 범람의 잔재가 남는다" : "",
      won ? "" : `죽음의 기억: ${this.combatData.enemy.memoryHints[Math.min(2, this.combat.memoryTier)]}`,
    ].filter(Boolean);

    const detail = this.add
      .text(480, 286, lines.join("\n"), {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#bdb2a0",
        align: "center",
        lineSpacing: 6,
      })
      .setOrigin(0.5, 0)
      .setDepth(31);
    this.menuNodes.push(detail);

    const cont = this.add
      .text(480, 400, "[ Enter ] 계속", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#8fbfa4",
      })
      .setOrigin(0.5)
      .setDepth(31)
      .setInteractive({ useHandCursor: true });
    cont.on("pointerdown", () => this.finish());
    this.menuNodes.push(cont);

    this.mode = "over";
    this.currentOptions = [];
  }

  // --- 입력 ---------------------------------------------------------------

  private installKeyboard() {
    this.keyHandler = (event: KeyboardEvent) => {
      if (!this.scene.isActive()) return;
      if (this.mode === "over") {
        if (event.key === "Enter" || event.key === " ") this.finish();
        return;
      }
      if (event.key === "Escape" && this.mode !== "root") {
        this.setMode("root");
        return;
      }
      const index = Number(event.key) - 1;
      if (Number.isInteger(index) && index >= 0 && index < this.currentOptions.length) {
        const opt = this.currentOptions[index];
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
    this.textCache.clear();
  }

  private setMode(mode: MenuMode) {
    this.mode = mode;
    this.renderMenu();
  }

  private usableItems() {
    const owned = this.combatData.carriedItems.filter(
      (id) => consumableHasCombatUse(id) && !this.combat.record.itemsUsed.includes(id)
    );
    return [...new Set(owned)]
      .map((id) => CONSUMABLE_POOL.find((c) => c.id === id))
      .filter((c): c is (typeof CONSUMABLE_POOL)[number] => !!c)
      .slice(0, 4);
  }

  private act(action: PlayerAction) {
    if (this.combat.over) return;
    const before = { enemyHp: this.combat.enemy.hp, playerHp: this.combat.player.hp };
    this.combat = takeTurn(this.combat, action, this.rng);
    this.mode = "root";

    const enemyDelta = before.enemyHp - this.combat.enemy.hp;
    const playerDelta = before.playerHp - this.combat.player.hp;
    if (enemyDelta > 0) this.hitFeedback(this.enemyFigure, 640, 150, enemyDelta, "#ffd9a0");
    if (playerDelta > 0) this.hitFeedback(this.playerFigure, 190, 320, playerDelta, "#f08a94");

    this.render();
  }

  private hitFeedback(
    figure: Phaser.GameObjects.Container,
    x: number,
    y: number,
    amount: number,
    color: string
  ) {
    const reduceShake = getState().settings.accessibility.reduceShake;
    if (!reduceShake) {
      this.tweens.add({
        targets: figure,
        x: figure.x + 6,
        duration: 55,
        yoyo: true,
        repeat: 2,
        ease: "Sine.InOut",
      });
    }
    const label = this.add
      .text(x + Phaser.Math.Between(-18, 18), y, `-${amount}`, {
        fontFamily: "monospace",
        fontSize: "20px",
        color,
      })
      .setOrigin(0.5)
      .setDepth(20)
      .setShadow(0, 2, "#000000", 6, false, true);
    this.tweens.add({
      targets: label,
      y: y - 46,
      alpha: 0,
      duration: 760,
      ease: "Cubic.Out",
      onComplete: () => label.destroy(),
    });
  }

  private finish() {
    const outcome: CombatOutcome = {
      result: this.combat.result ?? "lose",
      playerHp: this.combat.player.hp,
      stain: this.combat.player.stain,
      turns: this.combat.record.turns,
      itemsUsed: this.combat.record.itemsUsed,
      overflowResidue: this.combat.overflowResidue,
      fragmentsEarned: this.combat.fragmentsEarned,
    };
    this.teardown();
    this.combatData.onResult(outcome);
    this.scene.stop();
  }
}
