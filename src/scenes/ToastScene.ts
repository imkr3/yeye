import Phaser from "phaser";
import { gameEvents } from "../state/gameState";

export interface AchievementNotice {
  label: string;
}

/**
 * 달성 기록을 얻을 때마다 화면 위쪽에 잠깐 떴다 사라지는 토스트.
 * 다른 씬은 gameEvents.emit("achievement-earned", { label }) 만 호출하면 된다.
 */
export class ToastScene extends Phaser.Scene {
  private queue: AchievementNotice[] = [];
  private showing = false;

  constructor() {
    super("ToastScene");
  }

  create() {
    gameEvents.on("achievement-earned", (notice: AchievementNotice) => {
      this.queue.push(notice);
      if (!this.showing) this.showNext();
    });
  }

  private showNext() {
    const notice = this.queue.shift();
    if (!notice) {
      this.showing = false;
      return;
    }
    this.showing = true;

    const box = this.add.container(480, -30);
    const bg = this.add.rectangle(0, 0, 340, 44, 0x1e1a13, 0.95).setStrokeStyle(1, 0xa8873a);
    const label = this.add.text(0, 0, `달성 기록 · ${notice.label}`, {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#e8e1cd",
    }).setOrigin(0.5);
    box.add([bg, label]);
    box.setDepth(200);

    this.tweens.add({
      targets: box,
      y: 40,
      duration: 320,
      ease: "Back.Out",
      onComplete: () => {
        this.time.delayedCall(1600, () => {
          this.tweens.add({
            targets: box,
            y: -30,
            alpha: 0,
            duration: 260,
            ease: "Sine.In",
            onComplete: () => {
              box.destroy();
              this.showNext();
            },
          });
        });
      },
    });
  }
}
