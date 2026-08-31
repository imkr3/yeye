import Phaser from "phaser";
import {
  advanceRoom,
  buildRiftRun,
  currentRoom,
  damageRun,
  healRun,
  riftProgress,
  type RiftRun,
} from "../systems/RiftSystem";
import type { RiftChoice, RiftRoomDef } from "../data/rifts/glassvein";
import { getState, setState, gameEvents, flushSave } from "../state/gameState";
import {
  addCoins,
  addDust,
  addStoryFlag,
  advanceDeathMemory,
  applyDeath,
  beginNewCycle,
  deathMemoryTier,
  grantAchievement,
  setStain,
} from "../systems/RegressionSystem";
import { relicModifiers } from "../systems/EffectRegistry";
import { addStain, stainStatus } from "../systems/StainSystem";
import { createRng } from "../systems/Rng";
import { PLAYER_BASE } from "../data/combat/balance";
import type { CombatSceneData } from "./CombatScene";
import { paintScenery } from "../render/scenery";
import { drawVolumetricCharacter } from "../render/volumetric";
import { lerpColor, shade } from "../render/colors";

/**
 * 균열 탐사 화면.
 *
 * 방 하나를 한 화면에 보여주고, 선택으로 넘어간다. 전투는 CombatScene에 위임한다.
 * 같은 회귀 주기 안에서는 방 배치가 고정이라, 지난 시도에서 배운 것이 그대로 쓸모가 있다.
 */
export class RiftScene extends Phaser.Scene {
  private run!: RiftRun;
  private nodes: Phaser.GameObjects.GameObject[] = [];
  private options: { label: string; act: () => void; disabled?: boolean }[] = [];
  private keyHandler?: (event: KeyboardEvent) => void;
  private busy = false;

  constructor() {
    super("RiftScene");
  }

  init() {
    const state = getState();
    this.run = buildRiftRun(state.runSeed, PLAYER_BASE.maxHp);
    this.busy = false;
  }

  create() {
    paintScenery(this, "glassvein-underway", 960, 430);

    drawVolumetricCharacter(this, 150, 400, {
      accent: 0xd1616c,
      cloth: 0x2a2119,
      crest: "dual-ring",
      scale: 22,
    }).setDepth(4);

    this.installKeyboard();
    this.renderRoom();

    this.events.once("shutdown", () => this.teardown());
    this.events.once("destroy", () => this.teardown());
  }

  // --- 렌더 ---------------------------------------------------------------

  private clearNodes() {
    this.nodes.forEach((n) => n.destroy());
    this.nodes = [];
  }

  private panel(x: number, y: number, w: number, h: number) {
    const g = this.add.graphics().setDepth(30);
    g.fillStyle(0x0b0913, 0.86);
    g.fillRoundedRect(x, y, w, h, 7);
    g.lineStyle(1, 0x40306a, 0.9);
    g.strokeRoundedRect(x, y, w, h, 7);
    g.fillStyle(0xffffff, 0.05);
    g.fillRoundedRect(x + 1, y + 1, w - 2, 3, 2);
    this.nodes.push(g);
    return g;
  }

  private renderRoom() {
    this.clearNodes();
    const room = currentRoom(this.run);
    const state = getState();

    this.renderStatusBar(state.aftershockCoins, state.aftershockDust, state.stain);
    this.renderProgress();

    this.panel(300, 150, 620, 210);
    const heading = this.add
      .text(322, 168, room.title, { fontFamily: "serif", fontSize: "22px", color: "#e6dcff" })
      .setDepth(31);
    this.nodes.push(heading);

    const roomKindLabel = this.add
      .text(322, 196, this.roomKindText(room), {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#a98cf0",
      })
      .setDepth(31);
    this.nodes.push(roomKindLabel);

    const desc = this.add
      .text(322, 218, room.description, {
        fontFamily: "serif",
        fontSize: "14px",
        color: "#c9c0da",
        wordWrap: { width: 576 },
        lineSpacing: 6,
      })
      .setDepth(31);
    this.nodes.push(desc);

    // 함정 방에서는 기억 단계에 따라 힌트가 열린다.
    if (room.trap) {
      const tier = deathMemoryTier(state, room.trap.id);
      const hint =
        tier === 0
          ? "이 함정은 처음이다. 무엇이 어떻게 오는지 모른다."
          : tier === 1
          ? `기억: ${room.trap.telegraph}`
          : `기억: ${room.trap.telegraph} 박자를 세면 피할 수 있었다.`;
      const hintText = this.add
        .text(322, 322, hint, { fontFamily: "monospace", fontSize: "11px", color: "#8fbfa4" })
        .setDepth(31);
      this.nodes.push(hintText);
    }

    this.renderRoomOptions(room);
  }

  private roomKindText(room: RiftRoomDef): string {
    switch (room.type) {
      case "entrance":
        return "입구";
      case "combat":
        return `전투 — ${room.enemy?.name ?? ""}`;
      case "trap":
        return "함정";
      case "event":
        return "사건";
      case "rest":
        return "휴식";
      case "boss":
        return `심층주 — ${room.enemy?.name ?? ""}`;
    }
  }

  private renderStatusBar(coins: number, dust: number, stain: number) {
    this.panel(24, 24, 260, 110);
    const status = stainStatus(stain);

    const hpRatio = this.run.hp / this.run.maxHp;
    const g = this.add.graphics().setDepth(31);
    g.fillStyle(0x000000, 0.55);
    g.fillRoundedRect(40, 58, 228, 13, 6);
    g.fillGradientStyle(lerpColor(0x6ea78c, 0xffffff, 0.4), 0x6ea78c, 0x6ea78c, shade(0x6ea78c, -0.4), 1);
    g.fillRoundedRect(42, 60, Math.max(0, 224 * hpRatio), 9, 4);
    g.fillStyle(0x000000, 0.55);
    g.fillRoundedRect(40, 78, 228, 9, 4);
    g.fillGradientStyle(status.color, status.color, shade(status.color, -0.4), shade(status.color, -0.4), 1);
    g.fillRoundedRect(42, 80, Math.max(0, 224 * (stain / 100)), 5, 3);
    this.nodes.push(g);

    const label = this.add
      .text(
        40,
        36,
        `유리맥의 지하도\n체력 ${this.run.hp}/${this.run.maxHp}   얼룩 ${Math.round(stain)} (${status.label})\n여진화 ${coins}   여진 가루 ${dust}`,
        { fontFamily: "monospace", fontSize: "11px", color: "#c9c0da", lineSpacing: 8 }
      )
      .setDepth(31);
    this.nodes.push(label);
  }

  private renderProgress() {
    const g = this.add.graphics().setDepth(31);
    const total = this.run.rooms.length;
    for (let i = 0; i < total; i++) {
      const x = 320 + i * 26;
      const done = i < this.run.index;
      const here = i === this.run.index;
      g.fillStyle(here ? 0xa98cf0 : done ? 0x4a3d6a : 0x241d33, 1);
      g.fillCircle(x, 118, here ? 7 : 5);
      if (here) {
        g.lineStyle(1.5, 0xd8c8ff, 0.8);
        g.strokeCircle(x, 118, 11);
      }
    }
    this.nodes.push(g);

    const pct = this.add
      .text(320 + total * 26 + 16, 112, `${Math.round(riftProgress(this.run) * 100)}%`, {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#6b6255",
      })
      .setDepth(31);
    this.nodes.push(pct);
  }

  private renderRoomOptions(room: RiftRoomDef) {
    const opts: { label: string; act: () => void; disabled?: boolean }[] = [];

    if (room.type === "combat" || room.type === "boss") {
      opts.push({ label: "맞선다", act: () => this.startCombat(room) });
      if (room.type === "combat") {
        opts.push({ label: "돌아서 지나간다 (체력 8)", act: () => this.sneakPast() });
      }
    } else if (room.trap) {
      (room.choices ?? []).forEach((choice) => {
        opts.push({ label: choice.label, act: () => this.resolveTrap(room, choice) });
      });
    } else {
      (room.choices ?? []).forEach((choice) => {
        opts.push({ label: choice.label, act: () => this.resolveChoice(room, choice) });
      });
    }

    opts.push({ label: "균열에서 나간다", act: () => this.leaveRift() });
    this.options = opts;

    this.panel(300, 376, 620, 150);
    const header = this.add
      .text(322, 388, "선택", { fontFamily: "monospace", fontSize: "10px", color: "#6b6255" })
      .setDepth(31);
    this.nodes.push(header);

    opts.forEach((opt, i) => {
      const node = this.add
        .text(322, 410 + i * 25, `[${i + 1}] ${opt.label}`, {
          fontFamily: "serif",
          fontSize: "15px",
          color: opt.disabled ? "#4a4137" : "#e8dcc4",
          wordWrap: { width: 570 },
        })
        .setDepth(31);
      if (!opt.disabled) {
        node.setInteractive({ useHandCursor: true });
        node.on("pointerdown", opt.act);
        node.on("pointerover", () => node.setColor("#ffd9a0"));
        node.on("pointerout", () => node.setColor("#e8dcc4"));
      }
      this.nodes.push(node);
    });

    // 선택지 설명 — 사건/휴식 방에서만
    if (room.choices && room.type !== "trap" && room.type !== "entrance") {
      const notes = room.choices.map((c) => `· ${c.label}: ${c.description}`).join("\n");
      const noteText = this.add
        .text(322, 410 + opts.length * 25 + 6, notes, {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#7a7189",
          lineSpacing: 4,
          wordWrap: { width: 570 },
        })
        .setDepth(31);
      this.nodes.push(noteText);
    }
  }

  // --- 방 처리 ------------------------------------------------------------

  private toast(message: string) {
    gameEvents.emit("achievement-earned", { label: message });
  }

  private resolveChoice(room: RiftRoomDef, choice: RiftChoice) {
    if (this.busy) return;
    const mods = relicModifiers(getState().equippedRelics);
    let state = getState();
    const e = choice.effects;

    if (e.hp) {
      const amount = e.hp > 0 ? Math.round(e.hp * mods.healingMultiplier) : e.hp;
      this.run = amount > 0 ? healRun(this.run, amount) : damageRun(this.run, -amount);
    }
    if (e.stain) state = setStain(state, addStain(state.stain, e.stain));
    if (e.coins) state = addCoins(state, Math.round(e.coins * mods.coinMultiplier * this.run.nextRewardMultiplier));
    if (e.dust) state = addDust(state, e.dust);
    if (e.fragments) state = { ...state, fragments: state.fragments + e.fragments };
    if (e.flag) state = addStoryFlag(state, e.flag);
    setState(state);

    if (e.nextRewardMultiplier) this.run = { ...this.run, nextRewardMultiplier: e.nextRewardMultiplier };
    if (e.riskUp) this.run = { ...this.run, riskUp: true };

    if (this.run.hp <= 0) {
      this.onRiftDeath(room.title);
      return;
    }

    this.run = advanceRoom(this.run);
    this.renderRoom();
  }

  private resolveTrap(room: RiftRoomDef, choice: RiftChoice) {
    if (this.busy || !room.trap) return;
    const trap = room.trap;
    const state = getState();
    const tier = deathMemoryTier(state, trap.id);
    const rng = createRng(`${state.runSeed}:${trap.id}:${state.runCount}`);

    // 첫 번째 선택지가 "제대로 된 대응"이다. 기억이 있으면 확실히 성공하고,
    // 없으면 반반이다 — 죽어봐야 아는 것이 이 게임의 핵심이다.
    const isCorrectChoice = (room.choices ?? [])[0]?.id === choice.id;
    const dodged = isCorrectChoice && (tier >= 1 || rng.chance(0.5));

    if (dodged) {
      this.showResolution(trap.dodgeText, () => {
        this.run = advanceRoom(this.run);
        this.renderRoom();
      });
      return;
    }

    const mods = relicModifiers(state.equippedRelics);
    const damage = Math.round(rng.int(trap.damage[0], trap.damage[1]) * mods.trapDamageMultiplier);
    this.run = damageRun(this.run, damage);
    setState(setStain(state, addStain(state.stain, trap.stainOnHit)));

    this.showResolution(`${trap.hitText} (피해 ${damage})`, () => {
      if (this.run.hp <= 0) {
        // 함정으로 죽으면 그 함정에 대한 기억이 열린다.
        setState(advanceDeathMemory(getState(), trap.id));
        this.onRiftDeath(room.title);
        return;
      }
      setState(advanceDeathMemory(getState(), trap.id));
      this.run = advanceRoom(this.run);
      this.renderRoom();
    });
  }

  private showResolution(text: string, next: () => void) {
    this.busy = true;
    this.clearNodes();
    this.panel(220, 220, 520, 170);
    const body = this.add
      .text(244, 250, text, {
        fontFamily: "serif",
        fontSize: "16px",
        color: "#e6dcff",
        wordWrap: { width: 472 },
        lineSpacing: 7,
      })
      .setDepth(31);
    this.nodes.push(body);

    const cont = this.add
      .text(244, 350, "[1] 계속", { fontFamily: "monospace", fontSize: "13px", color: "#8fbfa4" })
      .setDepth(31)
      .setInteractive({ useHandCursor: true });
    cont.on("pointerdown", () => {
      this.busy = false;
      next();
    });
    this.nodes.push(cont);

    this.options = [
      {
        label: "계속",
        act: () => {
          this.busy = false;
          next();
        },
      },
    ];
  }

  private sneakPast() {
    this.run = damageRun(this.run, 8);
    if (this.run.hp <= 0) {
      this.onRiftDeath("돌아가려던 길");
      return;
    }
    this.run = advanceRoom(this.run);
    this.renderRoom();
  }

  private startCombat(room: RiftRoomDef) {
    if (!room.enemy) return;
    const state = getState();
    const isBoss = room.type === "boss";

    const data: CombatSceneData = {
      encounterId: room.enemy.id,
      enemy: room.enemy,
      memoryTier: deathMemoryTier(state, room.enemy.id),
      playerHp: this.run.hp,
      playerMaxHp: this.run.maxHp,
      stain: state.stain,
      carriedItems: state.carriedItemIds,
      accentColor: isBoss ? 0xa98cf0 : 0xc98c5a,
      onResult: (outcome) => {
        this.scene.resume();
        this.run = { ...this.run, hp: outcome.playerHp };

        let next = setStain(getState(), outcome.stain);
        if (outcome.fragmentsEarned > 0) next = { ...next, fragments: next.fragments + outcome.fragmentsEarned };
        // 전투에서 쓴 소모품은 가방에서 사라진다.
        if (outcome.itemsUsed.length > 0) {
          const remaining = [...next.carriedItemIds];
          outcome.itemsUsed.forEach((id) => {
            const idx = remaining.indexOf(id);
            if (idx !== -1) remaining.splice(idx, 1);
          });
          next = { ...next, carriedItemIds: remaining };
        }

        if (outcome.result === "win") {
          const mods = relicModifiers(next.equippedRelics);
          const rng = createRng(`${next.runSeed}:reward:${room.id}`);
          const range = room.coinReward ?? [12, 20];
          const coins = Math.round(rng.int(range[0], range[1]) * mods.coinMultiplier * this.run.nextRewardMultiplier);
          next = addCoins(next, coins);
          next = grantAchievement(next, `defeat-${room.enemy!.id}`, isBoss ? 60 : 20);

          if (isBoss) {
            next = addDust(next, 3);
            next = addStoryFlag(next, "cleared-glassvein");
            next = beginNewCycle(next); // 심층주 격파 → 새 주기, 배치가 다시 섞인다
          }
          setState(next);
          this.toast(isBoss ? "심층주 격파 — 여진화와 가루를 얻었다" : `여진화 +${coins}`);

          if (isBoss) {
            this.completeRift();
            return;
          }
          this.run = advanceRoom(this.run);
          this.renderRoom();
        } else {
          next = advanceDeathMemory(next, room.enemy!.id);
          setState(next);
          this.onRiftDeath(room.enemy!.name);
        }
      },
    };

    this.scene.pause();
    this.scene.launch("CombatScene", data);
  }

  // --- 종료 ---------------------------------------------------------------

  private completeRift() {
    flushSave();
    this.teardown();
    this.scene.start("RegressionSummaryScene", {
      outcome: "cleared",
      cause: "맥동을 세는 자를 넘어섰다",
      learned: "셈은 멈췄다. 다음 주기에는 지하도의 배치가 달라진다.",
      returnScene: "RegionScene",
      returnData: { regionKey: "ash-market" },
    });
  }

  private onRiftDeath(cause: string) {
    const before = getState();
    const wardUsed = before.wardCharges > 0;
    const next = applyDeath(before);
    setState(next);
    flushSave();

    this.teardown();
    this.scene.start("RegressionSummaryScene", {
      outcome: "died",
      cause,
      learned:
        "이번에 본 것은 다음 시도에 남는다. 같은 주기라면 방 배치도 그대로다.",
      wardUsed,
      returnScene: "RegionScene",
      returnData: { regionKey: "ash-market" },
    });
  }

  private leaveRift() {
    flushSave();
    this.teardown();
    this.scene.start("RegionScene", { regionKey: "ash-market" });
  }

  // --- 입력 ---------------------------------------------------------------

  private installKeyboard() {
    this.keyHandler = (event: KeyboardEvent) => {
      if (!this.scene.isActive()) return;
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
