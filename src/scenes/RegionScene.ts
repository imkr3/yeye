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

/**
 * 지역 하나를 표현하는 재사용 가능한 씬. data/regions.ts의 설정을 읽어
 * 침수 회랑·재의 시장·서리 관측소를 전부 이 하나의 클래스로 그린다.
 */
export class RegionScene extends Phaser.Scene {
  private config!: RegionConfig;
  private player!: Phaser.GameObjects.Arc;
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
    this.add.rectangle(480, 300, 960, 600, this.config.backgroundColor);
    this.add.text(24, 16, this.config.title, { fontFamily: "serif", fontSize: "16px", color: "#e8e1cd" });

    this.player = this.add.circle(this.config.playerStart.x, this.config.playerStart.y, 14, 0xe08a92);
    this.physics.add.existing(this.player);
    this.cursors = this.input.keyboard!.createCursorKeys();

    if (this.config.hazard) {
      const h = this.config.hazard;
      const hazardObj = this.add.rectangle(h.x, h.y, h.w, h.h, 0x7c1f2b, 0.5);
      this.physics.add.existing(hazardObj, true);
      this.add.text(h.x, h.y - h.h / 2 - 18, h.label, { fontSize: "12px", color: "#d1616c" }).setOrigin(0.5);
      this.physics.add.overlap(this.player, hazardObj as unknown as Phaser.GameObjects.GameObject, () => {
        if (this.hazardTriggered) return;
        this.hazardTriggered = true;
        this.onDeath();
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
      const npcObj = this.add.circle(npc.x, npc.y, 12, npc.color);
      this.add.text(npc.x, npc.y + 20, npc.label, { fontSize: "11px", color: "#cbbfa5" }).setOrigin(0.5);
      this.physics.add.existing(npcObj, true);
      this.physics.add.overlap(this.player, npcObj as unknown as Phaser.GameObjects.GameObject, () => {
        this.openDialogue(npc);
      });
    });

    gameEvents.emit("regression-updated", getState());
  }

  update() {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const speed = 200;
    body.setVelocity(0);

    if (this.cursors.left?.isDown) body.setVelocityX(-speed);
    else if (this.cursors.right?.isDown) body.setVelocityX(speed);

    if (this.cursors.up?.isDown) body.setVelocityY(-speed);
    else if (this.cursors.down?.isDown) body.setVelocityY(speed);
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
    next = grantAchievement(next, `reach-${this.config.key}-branch`, 30);
    setState(next);
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
