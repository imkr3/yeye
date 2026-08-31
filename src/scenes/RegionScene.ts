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
import { drawFieldSilhouette, addIdleBreath } from "../render/silhouettes";

const JUMP_VELOCITY = -420;
const GRAVITY_Y = 900;

/**
 * 지역 하나를 표현하는 재사용 가능한 씬. data/regions.ts의 설정을 읽어
 * 침수 회랑·재의 시장·서리 관측소·끝없는 계단을 전부 이 하나의 클래스로 그린다.
 *
 * 이동 방식은 지역마다 다르다 (movementMode 참고):
 * - sidescroll: 함정·전투처럼 선형으로 통과하는 구간. 좌우 이동 + 점프, 카메라가 따라간다.
 * - topdown: NPC와 되돌아와 상호작용하는 허브/던전 방. 4방향 자유 이동, 카메라 고정.
 */
export class RegionScene extends Phaser.Scene {
  private config!: RegionConfig;
  private player!: Phaser.GameObjects.Container;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private hazardTriggered = false;
  private dialogueOpen = false;
  private facing: 1 | -1 = 1;

  constructor() {
    super("RegionScene");
  }

  init(data: { regionKey: string }) {
    this.config = REGIONS[data.regionKey];
    this.hazardTriggered = false;
    this.dialogueOpen = false;
    this.facing = 1;
  }

  create() {
    const isSidescroll = this.config.movementMode === "sidescroll";
    const worldWidth = isSidescroll ? this.config.worldWidth ?? 2000 : 960;
    const groundY = this.config.groundY ?? 420;

    paintRegionBackground(this, this.config.key as BackgroundStyle, worldWidth);
    this.add.text(24, 16, this.config.title, { fontFamily: "serif", fontSize: "16px", color: "#e8e1cd" }).setScrollFactor(0);

    this.physics.world.setBounds(0, 0, worldWidth, 600);
    this.cameras.main.setBounds(0, 0, worldWidth, 600);

    if (isSidescroll) {
      this.physics.world.gravity.y = GRAVITY_Y;
      // 바닥 — 시각적으로도, 물리적으로도 캐릭터가 서는 기준선.
      this.add.rectangle(worldWidth / 2, groundY + 22, worldWidth, 44, 0x000000, 0.35);
      const ground = this.add.rectangle(worldWidth / 2, groundY + 20, worldWidth, 8, 0x000000, 0);
      this.physics.add.existing(ground, true);
      this.groundCollider = ground;
    }

    this.player = drawFieldSilhouette(
      this,
      this.config.playerStart.x,
      this.config.playerStart.y,
      0xd1616c,
      "dual-ring"
    );
    this.physics.add.existing(this.player);
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    playerBody.setCircle(14, -14, -14);
    if (isSidescroll) {
      playerBody.setCollideWorldBounds(true);
      if (this.groundCollider) this.physics.add.collider(this.player, this.groundCollider);
    }
    this.cursors = this.input.keyboard!.createCursorKeys();

    if (isSidescroll) {
      this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    }

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
        const exitX = isSidescroll ? worldWidth - 40 : 920;
        const exitY = isSidescroll ? groundY : 300;
        const exitZone = this.add.rectangle(exitX, exitY, 40, 200, 0xe08a92, 0.15);
        this.physics.add.existing(exitZone, true);
        this.add.text(exitX, exitY - (isSidescroll ? 120 : 110), "다음 지역", { fontSize: "11px", color: "#cbbfa5" }).setOrigin(0.5);
        this.physics.add.overlap(this.player, exitZone as unknown as Phaser.GameObjects.GameObject, () => {
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
      (npcSilhouette.body as Phaser.Physics.Arcade.Body).setCircle(12, -12, -12);
      addIdleBreath(this, npcSilhouette);
      this.add.text(npc.x, npc.y + 22, npc.label, { fontSize: "11px", color: "#cbbfa5" }).setOrigin(0.5);
      this.physics.add.overlap(this.player, npcSilhouette as unknown as Phaser.GameObjects.GameObject, () => {
        this.openDialogue(npc);
      });
    });

    if (isSidescroll) {
      this.add.text(24, 580, "← → 이동 · ↑ 점프", { fontSize: "11px", color: "#6b6255" }).setScrollFactor(0);
    } else {
      this.add.text(24, 580, "방향키로 이동", { fontSize: "11px", color: "#6b6255" }).setScrollFactor(0);
    }

    gameEvents.emit("regression-updated", getState());
  }

  private groundCollider?: Phaser.GameObjects.Rectangle;

  update(time: number) {
    const isSidescroll = this.config.movementMode === "sidescroll";
    const body = this.player.body as Phaser.Physics.Arcade.Body;

    if (isSidescroll) {
      this.updateSidescroll(body, time);
    } else {
      this.updateTopdown(body, time);
    }
  }

  private updateTopdown(body: Phaser.Physics.Arcade.Body, time: number) {
    const speed = 200;
    body.setVelocity(0);

    if (this.cursors.left?.isDown) body.setVelocityX(-speed);
    else if (this.cursors.right?.isDown) body.setVelocityX(speed);

    if (this.cursors.up?.isDown) body.setVelocityY(-speed);
    else if (this.cursors.down?.isDown) body.setVelocityY(speed);

    this.applyWalkBob(body, time);
  }

  private updateSidescroll(body: Phaser.Physics.Arcade.Body, time: number) {
    const speed = 220;
    body.setVelocityX(0);

    if (this.cursors.left?.isDown) {
      body.setVelocityX(-speed);
      this.facing = -1;
    } else if (this.cursors.right?.isDown) {
      body.setVelocityX(speed);
      this.facing = 1;
    }

    const onGround = body.blocked.down || body.touching.down;
    if (Phaser.Input.Keyboard.JustDown(this.cursors.up!) && onGround) {
      body.setVelocityY(JUMP_VELOCITY);
    }

    const bobScale = onGround ? 1 : 1; // 점프 중엔 걷기 바운스 생략, 착지감은 추후 보강
    this.player.setScale(this.facing * bobScale, 1);
    if (onGround && body.velocity.x !== 0) {
      const bob = Math.sin(time / 80) * 0.05;
      this.player.setScale(this.facing, 1 + bob);
    }
  }

  private applyWalkBob(body: Phaser.Physics.Arcade.Body, time: number) {
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
      (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
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
          (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
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
