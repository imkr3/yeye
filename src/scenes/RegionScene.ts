import Phaser from "phaser";
import { REGIONS, type RegionConfig, type RegionNpcConfig } from "../data/regions";
import { getState, setState, gameEvents } from "../state/gameState";
import {
  applyDeath,
  advanceSavePoint,
  adjustTrust,
  addStoryFlag,
  grantAchievement,
} from "../systems/RegressionSystem";
import type { DialogueSceneData } from "./DialogueScene";
import type { CombatSceneData } from "./CombatScene";
import { paintRegionBackground, type BackgroundStyle } from "../render/backgrounds";
import { drawFieldSilhouette } from "../render/silhouettes";

/**
 * 지역 하나를 표현하는 재사용 가능한 씬. data/regions.ts의 설정을 읽어
 * 침수 회랑·재의 시장·서리 관측소를 전부 이 하나의 클래스로 그린다.
 */
export class RegionScene extends Phaser.Scene {
  private config!: RegionConfig;
  private player!: Phaser.GameObjects.Container;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private hazardTriggered = false;
  private dialogueOpen = false;
  private exitZone?: Phaser.GameObjects.Rectangle;

  constructor() {
    super("RegionScene");
  }

  init(data: { regionKey: string }) {
    this.config = REGIONS[data.regionKey];
    this.hazardTriggered = false;
    this.dialogueOpen = false;
  }

  create() {
    paintRegionBackground(this, this.config.key as BackgroundStyle);
    this.add.text(24, 16, this.config.title, { fontFamily: "serif", fontSize: "16px", color: "#e8e1cd" });

    this.player = drawFieldSilhouette(
      this,
      this.config.playerStart.x,
      this.config.playerStart.y,
      0xd1616c,
      "dual-ring"
    );
    this.physics.add.existing(this.player);
    (this.player.body as Phaser.Physics.Arcade.Body).setCircle(14, -14, -20);
    this.cursors = this.input.keyboard!.createCursorKeys();

    if (this.config.hazard) {
      const h = this.config.hazard;
      const hazardObj = this.add.rectangle(h.x, h.y, h.w, h.h, 0x7c1f2b, 0.5);
      this.physics.add.existing(hazardObj, true);
      this.add.text(h.x, h.y - h.h / 2 - 18, h.label, { fontSize: "12px", color: "#d1616c" }).setOrigin(0.5);
      this.physics.add.overlap(this.player, hazardObj as unknown as Phaser.GameObjects.GameObject, () => {
        if (this.hazardTriggered) return;
        this.hazardTriggered = true;
        if (h.combat) this.openCombat(h.combat);
        else this.onDeath();
      });
    }

    if (this.config.savePoint) {
      const sp = this.config.savePoint;
      const spObj = this.add.circle(sp.x, sp.y, 24, 0x2b4a3c, 0.6);
      this.physics.add.existing(spObj, true);
      this.add.text(sp.x, sp.y - 40, "분기점", { fontSize: "12px", color: "#8fbfa4" }).setOrigin(0.5);
      this.physics.add.overlap(this.player, spObj as unknown as Phaser.GameObjects.GameObject, () => {
        this.onReachSavePoint();
      });

      if (this.config.nextRegionKey) {
        this.exitZone = this.add.rectangle(920, 300, 40, 200, 0xe08a92, 0.15);
        this.physics.add.existing(this.exitZone, true);
        this.add.text(920, 190, "다음 지역", { fontSize: "11px", color: "#cbbfa5" }).setOrigin(0.5);
        this.physics.add.overlap(this.player, this.exitZone as unknown as Phaser.GameObjects.GameObject, () => {
          this.tryAdvanceRegion();
        });
      }
    }

    if (this.config.sideExit) {
      const se = this.config.sideExit;
      const sideExitObj = this.add.rectangle(se.x, se.y, 160, 30, 0x8fbfa4, 0.15);
      this.physics.add.existing(sideExitObj, true);
      this.add.text(se.x, se.y - 20, se.label, { fontSize: "11px", color: "#8fbfa4" }).setOrigin(0.5);
      this.physics.add.overlap(this.player, sideExitObj as unknown as Phaser.GameObjects.GameObject, () => {
        this.scene.start("RegionScene", { regionKey: se.toRegionKey });
      });
    }

    this.config.npcs.forEach((npc) => {
      const npcSilhouette = drawFieldSilhouette(this, npc.x, npc.y, npc.color, npc.shape, 12);
      this.physics.add.existing(npcSilhouette, true);
      (npcSilhouette.body as Phaser.Physics.Arcade.Body).setCircle(12, -12, -17);
      this.add.text(npc.x, npc.y + 22, npc.label, { fontSize: "11px", color: "#cbbfa5" }).setOrigin(0.5);
      this.physics.add.overlap(this.player, npcSilhouette as unknown as Phaser.GameObjects.GameObject, () => {
        this.openDialogue(npc);
      });
    });

    gameEvents.emit("regression-updated", getState());
  }

  update(time: number) {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const speed = 200;
    body.setVelocity(0);

    if (this.cursors.left?.isDown) body.setVelocityX(-speed);
    else if (this.cursors.right?.isDown) body.setVelocityX(speed);

    if (this.cursors.up?.isDown) body.setVelocityY(-speed);
    else if (this.cursors.down?.isDown) body.setVelocityY(speed);

    const moving = body.velocity.x !== 0 || body.velocity.y !== 0;
    if (moving) {
      const bob = Math.sin(time / 80) * 0.05;
      this.player.setScale(1, 1 + bob);
    } else {
      this.player.setScale(1, 1);
    }
  }

  private onDeath() {
    setState(applyDeath(getState()));
    gameEvents.emit("death-flash");

    this.time.delayedCall(400, () => {
      const sp = getState().currentSavePoint;
      this.player.setPosition(sp.x, sp.y);
      this.hazardTriggered = false;
    });
  }

  private onReachSavePoint() {
    const sp = this.config.savePoint!;
    if (getState().currentSavePoint.id === sp.id) return;

    let next = advanceSavePoint(getState(), {
      id: sp.id,
      sceneKey: "RegionScene",
      x: sp.x,
      y: sp.y,
      label: sp.label,
    });
    const achievementId = `reach-${this.config.key}-branch`;
    const isNew = !next.achievements.includes(achievementId);
    next = grantAchievement(next, achievementId, 30);
    setState(next);
    if (isNew) gameEvents.emit("achievement-earned", { label: sp.label });
  }

  private openCombat(combat: { encounterId: string; enemyName: string; enemyMaxHp: number }) {
    this.scene.pause();
    const hasMemory = getState().storyFlags.includes(`seen-${combat.encounterId}`);

    const data: CombatSceneData = {
      encounterId: combat.encounterId,
      enemyName: combat.enemyName,
      enemyMaxHp: combat.enemyMaxHp,
      hasMemory,
      onResult: (result) => {
        if (result === "win") {
          const achievementId = `defeat-${combat.encounterId}`;
          const isNew = !getState().achievements.includes(achievementId);
          setState(grantAchievement(getState(), achievementId, 20));
          if (isNew) gameEvents.emit("achievement-earned", { label: `${combat.enemyName} 격파` });
        } else {
          let next = applyDeath(getState());
          next = addStoryFlag(next, `seen-${combat.encounterId}`);
          setState(next);
        }
        this.scene.resume();
        this.hazardTriggered = false;

        if (result === "lose") {
          const sp = getState().currentSavePoint;
          this.player.setPosition(sp.x, sp.y);
        }
      },
    };
    this.scene.launch("CombatScene", data);
  }

  private tryAdvanceRegion() {
    const sp = this.config.savePoint;
    if (!sp || getState().currentSavePoint.id !== sp.id) return; // 분기점 갱신 전엔 못 넘어간다
    if (!this.config.nextRegionKey) return;
    this.scene.start("RegionScene", { regionKey: this.config.nextRegionKey });
  }

  private openDialogue(npc: RegionNpcConfig) {
    if (this.dialogueOpen) return;
    this.dialogueOpen = true;
    this.scene.pause();

    const data: DialogueSceneData = {
      tree: npc.dialogue,
      onTrustDelta: (npcId, delta) => setState(adjustTrust(getState(), npcId, delta)),
      onFlag: (flag) => setState(addStoryFlag(getState(), flag)),
      onClose: () => {
        this.dialogueOpen = false;
        this.scene.resume();
        if (!this.config.nextRegionKey) {
          // 다음 지역이 없는 곳(서리 관측소)의 대화가 끝나면 엔딩으로 이어진다.
          this.scene.start("EndingScene");
        }
      },
    };
    this.scene.launch("DialogueScene", data);
  }
}
