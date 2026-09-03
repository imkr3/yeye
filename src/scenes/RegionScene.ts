import Phaser from "phaser";
import { REGIONS, type RegionConfig, type RegionNpcConfig } from "../data/regions";
import { getState, setState, gameEvents, flushSave, markNearSavePoint } from "../state/gameState";
import {
  applyDeath,
  advanceSavePoint,
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
  addConsumable,
} from "../systems/RegressionSystem";
import type { DialogueSceneData } from "./DialogueScene";
import type { CombatSceneData } from "./CombatScene";
import { RIFT_ENEMIES } from "../data/rifts/enemies";
import { PLAYER_BASE } from "../data/combat/balance";
import { COMPASS_FLAG, relicModifiers, revealsDialogueDanger } from "../systems/EffectRegistry";
import { paintScenery, type SceneryStyle } from "../render/scenery";
import { PLATFORMING } from "../systems/Platforming";
import { adjustAffinity, affinityOf, STAGE_LABEL } from "../systems/AffinitySystem";
import { CONSUMABLE_POOL } from "../data/items/consumables";
import { drawVolumetricCharacter, addIdleFloat } from "../render/volumetric";

// 점프 상수는 Platforming에 모여 있다 — 함정 크기 검증이 같은 값을 쓰기 위해서.
/** 가까이 갔을 때 키를 눌러 실행하는 대상 (NPC·환로·균열 입구). */
interface Interactable {
  x: number;
  y: number;
  radius: number;
  prompt: string;
  run: () => void;
}

const JUMP_VELOCITY = -PLATFORMING.jumpSpeed;
const GRAVITY_Y = PLATFORMING.gravity;

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
  /** 「낡은 나침반」이 켜져 있을 때만 존재하는 화면 고정 바늘. */
  private compass: Phaser.GameObjects.Container | null = null;
  /**
   * 상호작용 대상. 예전에는 겹침(overlap) 콜백이 매 프레임 실행되면서 대화를 열었는데,
   * 대화를 닫아도 플레이어가 여전히 NPC 위에 서 있으므로 다음 프레임에 곧바로 다시
   * 열려서 빠져나올 수 없었다. 이제는 가까이 갔을 때 안내만 띄우고, 실제로 여는 것은
   * 플레이어가 키를 눌렀을 때뿐이다.
   */
  private interactables: Interactable[] = [];
  private interactKey!: Phaser.Input.Keyboard.Key;
  private interactAltKey!: Phaser.Input.Keyboard.Key;
  private promptText!: Phaser.GameObjects.Text;

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
    this.compass = null;
    this.interactables = [];
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
      const ground = this.add.rectangle(
        worldWidth / 2,
        groundY + PLATFORMING.groundColliderOffset,
        worldWidth,
        PLATFORMING.groundColliderThickness,
        0x000000,
        0
      );
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
    playerBody.setCircle(PLATFORMING.playerBodyRadius, -PLATFORMING.playerBodyRadius, -PLATFORMING.playerBodyRadius);
    if (isSidescroll) {
      playerBody.setCollideWorldBounds(true);
      if (this.groundCollider) this.physics.add.collider(this.player, this.groundCollider);
      this.platformColliders.forEach((p) => this.physics.add.collider(this.player, p));
    }
    this.cursors = this.input.keyboard!.createCursorKeys();
    // enableCapture=false — 캡처는 전역이라, 켜두면 대화 입력창에서 'e'와 스페이스가
    // preventDefault되어 아예 타이핑되지 않는다.
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E, false);
    this.interactAltKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE, false);
    this.promptText = this.add
      .text(480, 520, "", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#ece3ce",
        backgroundColor: "#0e0c09cc",
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);

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

    for (const se of this.config.sideExits ?? []) {
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

      this.interactables.push({
        x: re.x,
        y: re.y,
        radius: 64,
        prompt: "균열로 내려간다",
        run: () => {
          if (this.enteringRift) return;
          this.enteringRift = true;
          flushSave();
          this.scene.start("RiftScene", { riftId: re.riftId });
        },
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

      this.interactables.push({
        x: ep.x,
        y: ep.y,
        radius: 62,
        prompt: "환로를 연다",
        run: () => {
          if (this.exchangeOpen) return;
          this.exchangeOpen = true;
          this.scene.pause();
          this.scene.launch("ExchangeScene");
          this.scene.get("ExchangeScene").events.once("shutdown", () => {
            this.exchangeOpen = false;
            this.scene.resume();
          });
        },
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
      addIdleFloat(this, npcSilhouette);
      this.add.text(npc.x, npc.y + 22, npc.label, { fontSize: "11px", color: "#cbbfa5" }).setOrigin(0.5);
      this.interactables.push({
        x: npc.x,
        y: npc.y,
        radius: 58,
        prompt: `${npc.label}에게 말을 건다`,
        run: () => this.openDialogue(npc),
      });
    });

    if (isSidescroll) {
      this.add.text(24, 574, "← → 이동 · ↑ 점프 · E 상호작용", { fontSize: "11px", color: "#8b7f6d" }).setScrollFactor(0).setDepth(100);
    } else {
      this.add.text(24, 574, "방향키로 이동 · E 상호작용", { fontSize: "11px", color: "#8b7f6d" }).setScrollFactor(0).setDepth(100);
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
    if (!this.compass && getState().storyFlags.includes(COMPASS_FLAG)) this.createCompass();

    const isSidescroll = this.config.movementMode === "sidescroll";
    const body = this.player.body as Phaser.Physics.Arcade.Body;

    if (isSidescroll) {
      this.updateSidescroll(body, time);
    } else {
      this.updateTopdown(body, time);
    }

    this.updateCompass();
    this.updateInteractions();
  }

  // --- 상호작용 ------------------------------------------------------------

  /**
   * 가장 가까운 대상만 안내하고, 실행은 키 입력에만 반응한다.
   * JustDown을 쓰므로 키를 누르고 있어도 한 번만 열린다 — 닫자마자 다시 열리던 문제의 핵심.
   */
  private updateInteractions() {
    if (this.dialogueOpen || this.exchangeOpen || this.enteringRift) {
      this.promptText.setVisible(false);
      return;
    }

    let nearest: Interactable | null = null;
    let nearestDist = Infinity;
    for (const it of this.interactables) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, it.x, it.y);
      if (d <= it.radius && d < nearestDist) {
        nearest = it;
        nearestDist = d;
      }
    }
    if (!nearest) {
      this.promptText.setVisible(false);
      return;
    }

    this.promptText.setText(`[E] ${nearest.prompt}`).setVisible(true);

    if (
      Phaser.Input.Keyboard.JustDown(this.interactKey) ||
      Phaser.Input.Keyboard.JustDown(this.interactAltKey)
    ) {
      this.promptText.setVisible(false);
      nearest.run();
    }
  }

  // --- 낡은 나침반 --------------------------------------------------------

  /**
   * 분기점 방향을 가리키는 화면 고정 바늘. 지역을 벗어나면 사라진다 —
   * 소모품 하나가 영구 편의가 되어버리지 않도록.
   */
  private createCompass() {
    const ring = this.add.circle(0, 0, 17, 0x100e14, 0.78).setStrokeStyle(1.5, 0x6ea78c, 0.7);
    const needle = this.add.triangle(0, 0, 0, -12, 4.5, 5, -4.5, 5, 0x8fbfa4);
    const tail = this.add.triangle(0, 0, 0, 12, 3, -4, -3, -4, 0x3a3348);
    const dial = this.add.container(0, 0, [tail, needle]);
    this.compass = this.add
      .container(900, 60, [ring, dial])
      .setScrollFactor(0)
      .setDepth(60);
    this.compass.setData("dial", dial);
    this.add
      .text(900, 84, this.config.savePoint ? "분기점" : "감지 없음", { fontFamily: "monospace", fontSize: "9px", color: "#6ea78c" })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(60);
  }

  private updateCompass() {
    if (!this.compass) return;
    const dial = this.compass.getData("dial") as Phaser.GameObjects.Container;
    const sp = this.config.savePoint;
    if (!sp) {
      // 이 지역에 분기점이 없다 — 바늘이 자리를 못 잡고 계속 돈다.
      // 아무 일도 일어나지 않는 것보다, 없다는 걸 보여주는 편이 낫다.
      dial.rotation += 0.05;
      return;
    }
    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, sp.x, sp.y);
    // 삼각형이 위를 향하도록 그려져 있으므로 90도만큼 되돌린다.
    dial.rotation = Phaser.Math.Angle.RotateTo(dial.rotation, angle + Math.PI / 2, 0.12);
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
    const speed = PLATFORMING.runSpeed * relicModifiers(getState().equippedRelics).moveSpeedMultiplier;
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

  private onDeath(reason?: string) {
    setState(applyDeath(getState()));
    gameEvents.emit("death-flash");
    if (reason) gameEvents.emit("achievement-earned", { label: reason });

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
  /**
   * 호감도를 움직이고, 관계 단계가 바뀌었으면 알린다.
   * 유물의 신뢰 배율은 오르는 쪽에만 걸린다 — 감정을 상하게 한 것까지 완화해 주지는 않는다.
   */
  private applyAffinity(npcId: string, delta: number): string | null {
    const mult = relicModifiers(getState().equippedRelics).trustMultiplier;
    const scaled = delta > 0 ? Math.round(delta * mult) : delta;
    const change = adjustAffinity(getState(), npcId, scaled);
    setState(change.state);

    if (change.locked === "ally") {
      const label = `${npcId} — 동료가 되었다`;
      gameEvents.emit("achievement-earned", { label });
      return label;
    }
    if (change.locked === "hostile") {
      const label = `${npcId} — 적대 관계가 되었다`;
      gameEvents.emit("achievement-earned", { label });
      return label;
    }
    if (change.stageAfter !== change.stageBefore) {
      const label = `관계: ${STAGE_LABEL[change.stageBefore]} → ${STAGE_LABEL[change.stageAfter]}`;
      gameEvents.emit("achievement-earned", { label });
      return label;
    }
    return null;
  }

  private handleDialogueFlag(flag: string) {
    const state = getState();

    if (flag.startsWith("reveal-regression:")) {
      const listener = flag.split(":")[1] ?? "unknown";
      setState(applyVowBacklash(state, listener));
      gameEvents.emit("achievement-earned", { label: "서약 역류 — 기억 하나가 흐려졌다" });
      return;
    }

    // 대화 중 받는 물건 — "gift:아이템id" 형태. 이미 가진 것도 하나 더 쌓인다.
    if (flag.startsWith("gift:")) {
      const itemId = flag.slice("gift:".length);
      const item = CONSUMABLE_POOL.find((c) => c.id === itemId);
      if (!item) return;
      setState(addConsumable(state, itemId));
      gameEvents.emit("achievement-earned", { label: `${item.name}을(를) 받았다` });
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
    // 나침반은 이 지역에서만 유효하다 — 넘어가기 전에 끈다.
    const state = getState();
    if (state.storyFlags.includes(COMPASS_FLAG)) {
      setState({ ...state, storyFlags: state.storyFlags.filter((f) => f !== COMPASS_FLAG) });
    }
    this.scene.start("RegionScene", { regionKey: this.config.nextRegionKey });
  }

  private openDialogue(npc: RegionNpcConfig) {
    if (this.dialogueOpen) return;
    this.dialogueOpen = true;
    this.scene.pause();

    const data: DialogueSceneData = {
      tree: npc.dialogue,
      onTrustDelta: (npcId, delta) => this.applyAffinity(npcId, delta),
      affinity: affinityOf(getState(), npc.id),
      onAffinity: (npcId, delta) => this.applyAffinity(npcId, delta),
      onFlag: (flag) => this.handleDialogueFlag(flag),
      // 「거짓말 탐지 부표」를 지녔다면 위험한 갈래가 표시된다.
      revealDanger: revealsDialogueDanger(getState().inventory.consumables),
      onLethal: (reason) => {
        this.dialogueOpen = false;
        this.scene.resume();
        this.onDeath(reason);
      },
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

    // 안전장치: 어떤 이유로든 onClose를 거치지 않고 대화창이 닫혀도 지역이 멈춘 채로
    // 남지 않게 한다. onClose가 먼저 플래그를 내리므로 이중 실행되지 않는다.
    this.scene.get("DialogueScene").events.once("shutdown", () => {
      if (!this.dialogueOpen) return;
      this.dialogueOpen = false;
      this.scene.resume();
    });
  }
}
