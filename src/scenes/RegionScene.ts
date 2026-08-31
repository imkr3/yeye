import Phaser from "phaser";
import { REGIONS, type RegionConfig, type RegionNpcConfig } from "../data/regions";
import { getState, setState, gameEvents, flushSave, markNearSavePoint } from "../state/gameState";
import {
  applyDeath,
  advanceSavePoint,
  adjustTrust,
  addStoryFlag,
  grantAchievement,
  collectPickup,
  advanceDeathMemory,
  deathMemoryTier,
  setStain,
  addCoins,
  applyVowBacklash,
  clearVowBacklash,
  hasVowBacklash,
} from "../systems/RegressionSystem";
import type { DialogueSceneData } from "./DialogueScene";
import type { CombatSceneData } from "./CombatScene";
import { RIFT_ENEMIES } from "../data/rifts/enemies";
import { PLAYER_BASE } from "../data/combat/balance";
import { relicModifiers } from "../systems/EffectRegistry";
import { paintScenery, type SceneryStyle } from "../render/scenery";
import { drawVolumetricCharacter, addIdleFloat } from "../render/volumetric";

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
  private enteringRift = false;
  private exchangeOpen = false;

  constructor() {
    super("RegionScene");
  }

  init(data: { regionKey: string }) {
    this.config = REGIONS[data.regionKey];
    this.hazardTriggered = false;
    this.dialogueOpen = false;
    this.facing = 1;
    this.enteringRift = false;
    this.exchangeOpen = false;
  }

  create() {
    const isSidescroll = this.config.movementMode === "sidescroll";
    const worldWidth = isSidescroll ? this.config.worldWidth ?? 2000 : 960;
    const groundY = this.config.groundY ?? 420;

    const sceneryGroundY = isSidescroll ? groundY : 150;
    paintScenery(this, this.config.key as SceneryStyle, worldWidth, sceneryGroundY);
    this.add
      .text(24, 16, this.config.title, { fontFamily: "serif", fontSize: "17px", color: "#f0e6d0" })
      .setScrollFactor(0)
      .setDepth(100)
      .setShadow(0, 2, "#000000", 6, false, true);

    this.physics.world.setBounds(0, 0, worldWidth, 600);
    this.cameras.main.setBounds(0, 0, worldWidth, 600);

    if (isSidescroll) {
      this.physics.world.gravity.y = GRAVITY_Y;
      // 바닥 충돌체 — 시각적 바닥은 paintScenery가 그린다.
      const ground = this.add.rectangle(worldWidth / 2, groundY + 20, worldWidth, 8, 0x000000, 0);
      this.physics.add.existing(ground, true);
      this.groundCollider = ground;

      this.platformColliders = (this.config.platforms ?? []).map((p) => {
        const slab = this.add.graphics().setDepth(1);
        slab.fillGradientStyle(0x6b5f47, 0x574c39, 0x2a241b, 0x1d1913, 1);
        slab.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h + 6);
        slab.fillStyle(0x8fbfa4, 0.35);
        slab.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, 2);
        slab.fillStyle(0x000000, 0.28);
        slab.fillEllipse(p.x, p.y + p.h / 2 + 10, p.w * 1.1, 12);
        const platform = this.add.rectangle(p.x, p.y, p.w, p.h, 0x000000, 0);
        this.physics.add.existing(platform, true);
        return platform;
      });
    }

    this.player = drawVolumetricCharacter(this, this.config.playerStart.x, this.config.playerStart.y, {
      accent: 0xd1616c,
      cloth: 0x2a2119,
      crest: "dual-ring",
      scale: 15,
    });
    this.player.setDepth(4);
    this.physics.add.existing(this.player);
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    playerBody.setCircle(14, -14, -14);
    if (isSidescroll) {
      playerBody.setCollideWorldBounds(true);
      if (this.groundCollider) this.physics.add.collider(this.player, this.groundCollider);
      this.platformColliders.forEach((p) => this.physics.add.collider(this.player, p));
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
        markNearSavePoint();
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

    if (this.config.riftEntrance) {
      const re = this.config.riftEntrance;
      // 균열 입구 — 바닥에 뚫린 빛나는 틈
      const portal = this.add.graphics().setDepth(2);
      for (let i = 6; i >= 1; i--) {
        portal.fillStyle(0xa98cf0, 0.05 * i);
        portal.fillEllipse(re.x, re.y, 34 * i, 12 * i);
      }
      portal.fillGradientStyle(0xd8c8ff, 0xa98cf0, 0x40306a, 0x140f26, 1);
      portal.fillEllipse(re.x, re.y, 96, 34);
      portal.fillStyle(0x07060d, 0.92);
      portal.fillEllipse(re.x, re.y + 2, 74, 24);
      this.tweens.add({ targets: portal, alpha: 0.72, duration: 1600, yoyo: true, repeat: -1 });

      this.add
        .text(re.x, re.y - 44, re.label, { fontSize: "11px", color: "#c9b0ff" })
        .setOrigin(0.5)
        .setDepth(6);

      const zone = this.add.rectangle(re.x, re.y, 96, 40, 0x000000, 0);
      this.physics.add.existing(zone, true);
      this.physics.add.overlap(this.player, zone as unknown as Phaser.GameObjects.GameObject, () => {
        if (this.enteringRift) return;
        this.enteringRift = true;
        flushSave();
        this.scene.start("RiftScene");
      });
    }

    if (this.config.exchangePost) {
      const ep = this.config.exchangePost;
      // 환로 — 반쯤 묻힌 교환 장치
      const post = this.add.graphics().setDepth(2);
      for (let i = 5; i >= 1; i--) {
        post.fillStyle(0xd8a24a, 0.05 * i);
        post.fillCircle(ep.x, ep.y, 14 * i);
      }
      post.fillGradientStyle(0x6b5533, 0x4a3a22, 0x281e12, 0x160f09, 1);
      post.fillRoundedRect(ep.x - 26, ep.y - 34, 52, 68, 5);
      post.fillStyle(0xffe7a8, 0.9);
      post.fillCircle(ep.x, ep.y - 10, 7);
      post.fillStyle(0x000000, 0.35);
      post.fillEllipse(ep.x, ep.y + 40, 70, 14);
      this.tweens.add({ targets: post, alpha: 0.8, duration: 1500, yoyo: true, repeat: -1 });

      this.add
        .text(ep.x, ep.y - 54, ep.label, { fontSize: "11px", color: "#e0b264" })
        .setOrigin(0.5)
        .setDepth(6);

      const zone = this.add.rectangle(ep.x, ep.y, 70, 80, 0x000000, 0);
      this.physics.add.existing(zone, true);
      this.physics.add.overlap(this.player, zone as unknown as Phaser.GameObjects.GameObject, () => {
        if (this.exchangeOpen) return;
        this.exchangeOpen = true;
        this.scene.pause();
        this.scene.launch("ExchangeScene");
        this.scene.get("ExchangeScene").events.once("shutdown", () => {
          this.exchangeOpen = false;
          this.scene.resume();
        });
      });
    }

    this.config.npcs.forEach((npc) => {
      const npcSilhouette = drawVolumetricCharacter(this, npc.x, npc.y, {
        accent: npc.color,
        cloth: 0x231e19,
        crest: npc.shape,
        scale: 14,
      });
      npcSilhouette.setDepth(3);
      this.physics.add.existing(npcSilhouette, true);
      (npcSilhouette.body as Phaser.Physics.Arcade.Body).setCircle(12, -12, -12);
      addIdleFloat(this, npcSilhouette);
      this.add.text(npc.x, npc.y + 22, npc.label, { fontSize: "11px", color: "#cbbfa5" }).setOrigin(0.5);
      this.physics.add.overlap(this.player, npcSilhouette as unknown as Phaser.GameObjects.GameObject, () => {
        this.openDialogue(npc);
      });
    });

    if (isSidescroll) {
      this.add.text(24, 574, "← → 이동 · ↑ 점프", { fontSize: "11px", color: "#8b7f6d" }).setScrollFactor(0).setDepth(100);
    } else {
      this.add.text(24, 574, "방향키로 이동", { fontSize: "11px", color: "#8b7f6d" }).setScrollFactor(0).setDepth(100);
    }

    // 픽업 — 플레이어가 만들어진 뒤에 배치해야 overlap 대상이 유효하다.
    (this.config.pickups ?? []).forEach((pickup) => {
      if (getState().collectedPickups.includes(pickup.id)) return; // 이미 주웠으면 다시 안 뜬다

      const icon = this.add.container(pickup.x, pickup.y).setDepth(5);
      const glow = this.add.graphics();
      for (let i = 4; i >= 1; i--) {
        glow.fillStyle(0xd8a24a, 0.09 * i);
        glow.fillCircle(0, 0, 5 + i * 3.4);
      }
      const shard = this.add.graphics();
      shard.fillGradientStyle(0xffe7a8, 0xd8a24a, 0xa8783a, 0x6b4a1e, 1);
      shard.beginPath();
      shard.moveTo(0, -8);
      shard.lineTo(5.5, 0);
      shard.lineTo(0, 8);
      shard.lineTo(-5.5, 0);
      shard.closePath();
      shard.fillPath();
      icon.add([glow, shard]);

      this.tweens.add({ targets: icon, y: pickup.y - 7, duration: 900, yoyo: true, repeat: -1, ease: "Sine.InOut" });
      this.tweens.add({ targets: shard, scaleX: 0.35, duration: 1400, yoyo: true, repeat: -1, ease: "Sine.InOut" });

      this.physics.add.existing(icon, true);
      (icon.body as Phaser.Physics.Arcade.StaticBody).setCircle(14, -14, -14);
      this.physics.add.overlap(this.player, icon as unknown as Phaser.GameObjects.GameObject, () => {
        setState(collectPickup(getState(), pickup.id, pickup.fragmentReward));
        gameEvents.emit("achievement-earned", { label: `파편 +${pickup.fragmentReward}` });
        icon.destroy();
      });
    });

    gameEvents.emit("regression-updated", getState());
  }

  private groundCollider?: Phaser.GameObjects.Rectangle;
  private platformColliders: Phaser.GameObjects.Rectangle[] = [];

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
    const speed = 200 * relicModifiers(getState().equippedRelics).moveSpeedMultiplier;
    body.setVelocity(0);

    if (this.cursors.left?.isDown) body.setVelocityX(-speed);
    else if (this.cursors.right?.isDown) body.setVelocityX(speed);

    if (this.cursors.up?.isDown) body.setVelocityY(-speed);
    else if (this.cursors.down?.isDown) body.setVelocityY(speed);

    this.applyWalkBob(body, time);
  }

  private updateSidescroll(body: Phaser.Physics.Arcade.Body, time: number) {
    const speed = 220 * relicModifiers(getState().equippedRelics).moveSpeedMultiplier;
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
    const bonus = relicModifiers(next.equippedRelics).savePointFragmentBonus;
    next = grantAchievement(next, achievementId, 30 + bonus);
    setState(next);
    if (isNew) gameEvents.emit("achievement-earned", { label: sp.label });
  }

  private openCombat(combat: { encounterId: string; enemyName: string; enemyMaxHp: number }) {
    const enemyDef = RIFT_ENEMIES[combat.encounterId];
    if (!enemyDef) {
      // 정의가 없는 인카운터는 즉사 함정으로 처리해 진행이 막히지 않게 한다.
      this.onDeath();
      return;
    }

    this.scene.pause();
    const state = getState();

    const data: CombatSceneData = {
      encounterId: combat.encounterId,
      enemy: enemyDef,
      memoryTier: deathMemoryTier(state, combat.encounterId),
      playerHp: PLAYER_BASE.maxHp,
      playerMaxHp: PLAYER_BASE.maxHp,
      stain: state.stain,
      carriedItems: state.carriedItemIds,
      onResult: (outcome) => {
        let next = setStain(getState(), outcome.stain);
        if (outcome.fragmentsEarned > 0) {
          next = { ...next, fragments: next.fragments + outcome.fragmentsEarned };
        }

        if (outcome.result === "win") {
          const achievementId = `defeat-${combat.encounterId}`;
          const isNew = !next.achievements.includes(achievementId);
          next = grantAchievement(next, achievementId, 20);
          next = addCoins(next, Math.round(24 * relicModifiers(next.equippedRelics).coinMultiplier));
          setState(next);
          if (isNew) gameEvents.emit("achievement-earned", { label: `${enemyDef.name} 격파` });
        } else {
          next = applyDeath(next);
          next = advanceDeathMemory(next, combat.encounterId);
          next = addStoryFlag(next, `seen-${combat.encounterId}`);
          setState(next);
        }

        this.scene.resume();
        this.hazardTriggered = false;

        if (outcome.result === "lose") {
          const sp = getState().currentSavePoint;
          this.player.setPosition(sp.x, sp.y);
          (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
        }
      },
    };
    this.scene.launch("CombatScene", data);
  }

  /**
   * 대화가 남기는 플래그 처리. 대부분은 그대로 기록하지만,
   * 서약 역류처럼 상태를 크게 건드리는 것은 여기서 따로 해석한다.
   */
  private handleDialogueFlag(flag: string) {
    const state = getState();

    if (flag.startsWith("reveal-regression:")) {
      const listener = flag.split(":")[1] ?? "unknown";
      setState(applyVowBacklash(state, listener));
      gameEvents.emit("achievement-earned", { label: "서약 역류 — 기억 하나가 흐려졌다" });
      return;
    }

    if (flag === "soothe-backlash") {
      if (!hasVowBacklash(state)) return;
      setState(clearVowBacklash(state));
      gameEvents.emit("achievement-earned", { label: "역류가 가라앉았다" });
      return;
    }

    setState(addStoryFlag(state, flag));
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
      onTrustDelta: (npcId, delta) => {
        // 「침묵의 인장 조각」 같은 유물이 신뢰 획득을 키운다. 감소는 그대로 둔다.
        const mult = relicModifiers(getState().equippedRelics).trustMultiplier;
        const scaled = delta > 0 ? Math.round(delta * mult) : delta;
        setState(adjustTrust(getState(), npcId, scaled));
      },
      onFlag: (flag) => this.handleDialogueFlag(flag),
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
