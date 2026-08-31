import Phaser from "phaser";
import {
  applyDeath,
  advanceSavePoint,
  createInitialRegressionState,
  grantAchievement,
  type RegressionState,
  type SavePoint,
} from "../systems/RegressionSystem";

/**
 * 침수 회랑 (1단계 버티컬 슬라이스 지역) — 임시 프로토타입 씬.
 * 실제 타일맵/스프라이트 없이 도형으로 구성해 회귀 루프 자체를 먼저 검증한다.
 */
export class FieldScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Arc;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private regression!: RegressionState;
  private startPoint: SavePoint = { id: "sp-0", sceneKey: "FieldScene", x: 100, y: 300, label: "회랑 입구" };
  private hazardTriggered = false;

  constructor() {
    super("FieldScene");
  }

  create() {
    this.regression = createInitialRegressionState(this.startPoint);

    // 바닥
    this.add.rectangle(480, 300, 960, 600, 0x14211c);

    // 세이브 포인트(분기점) 표시 — 닿으면 갱신
    const savePointZone = this.add.circle(700, 300, 24, 0x2b4a3c, 0.6);
    this.add.text(700, 260, "분기점", { fontSize: "12px", color: "#8fbfa4" }).setOrigin(0.5);

    // 위험 지형(함정) — 닿으면 사망 → 회귀
    const hazard = this.add.rectangle(450, 300, 40, 400, 0x7c1f2b, 0.5);
    this.add.text(450, 90, "함정 (닿으면 회귀)", { fontSize: "12px", color: "#d1616c" }).setOrigin(0.5);

    // 플레이어
    this.player = this.add.circle(this.startPoint.x, this.startPoint.y, 14, 0xe08a92);
    this.physics.add.existing(this.player);

    this.cursors = this.input.keyboard!.createCursorKeys();

    this.physics.add.overlap(this.player, hazard as unknown as Phaser.GameObjects.GameObject, () => {
      if (this.hazardTriggered) return;
      this.hazardTriggered = true;
      this.onDeath();
    });

    this.physics.add.overlap(this.player, savePointZone as unknown as Phaser.GameObjects.GameObject, () => {
      this.onReachSavePoint();
    });

    this.events.emit("regression-updated", this.regression);
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
    this.regression = applyDeath(this.regression);
    this.events.emit("regression-updated", this.regression);
    this.events.emit("death-flash");

    this.time.delayedCall(400, () => {
      this.player.setPosition(this.regression.currentSavePoint.x, this.regression.currentSavePoint.y);
      this.hazardTriggered = false;
    });
  }

  private onReachSavePoint() {
    const nextPoint: SavePoint = { id: "sp-1", sceneKey: "FieldScene", x: 700, y: 300, label: "회랑 안쪽 분기점" };
    if (this.regression.currentSavePoint.id === nextPoint.id) return;

    this.regression = advanceSavePoint(this.regression, nextPoint);
    this.regression = grantAchievement(this.regression, "reach-first-branch", 30);
    this.events.emit("regression-updated", this.regression);
  }
}
