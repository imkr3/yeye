import Phaser from "phaser";
import {
  useBasicStrike,
  useLastDitchGamble,
  canUseLastDitchGamble,
  enemyMoveAtTurn,
  resolveEnemyMove,
} from "../systems/CombatSystem";

export interface CombatSceneData {
  encounterId: string;
  enemyName: string;
  enemyMaxHp: number;
  /** 죽음의 기억 — 과거에 이 인카운터에서 죽어본 적 있으면 다음 공격을 미리 보여준다. */
  hasMemory: boolean;
  onResult: (result: "win" | "lose") => void;
}

const PLAYER_MAX_HP = 60;

export class CombatScene extends Phaser.Scene {
  private combatData!: CombatSceneData;
  private playerHp = PLAYER_MAX_HP;
  private enemyHp = 0;
  private turn = 0;
  private logText!: Phaser.GameObjects.Text;
  private hpText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private buttons: Phaser.GameObjects.Text[] = [];
  private resolved = false;

  constructor() {
    super("CombatScene");
  }

  init(data: CombatSceneData) {
    this.combatData = data;
    this.playerHp = PLAYER_MAX_HP;
    this.enemyHp = data.enemyMaxHp;
    this.turn = 0;
    this.resolved = false;
  }

  create() {
    this.add.rectangle(480, 300, 960, 600, 0x0e0c09, 0.95);
    this.add.text(480, 60, `전투 — ${this.combatData.enemyName}`, {
      fontFamily: "serif",
      fontSize: "22px",
      color: "#e8e1cd",
    }).setOrigin(0.5);

    this.hpText = this.add.text(480, 110, "", {
      fontFamily: "monospace",
      fontSize: "13px",
      color: "#cbbfa5",
      align: "center",
    }).setOrigin(0.5);

    this.hintText = this.add.text(480, 150, "", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#6ea78c",
      align: "center",
      wordWrap: { width: 640 },
    }).setOrigin(0.5);

    this.logText = this.add.text(480, 200, "전투가 시작됐다.", {
      fontFamily: "serif",
      fontSize: "14px",
      color: "#e8e1cd",
      align: "center",
      wordWrap: { width: 700 },
    }).setOrigin(0.5, 0);

    this.renderButtons();
    this.renderStatus();
  }

  private renderStatus() {
    this.hpText.setText(`나: ${Math.max(0, this.playerHp)} / ${PLAYER_MAX_HP}    ${this.combatData.enemyName}: ${Math.max(0, this.enemyHp)} / ${this.combatData.enemyMaxHp}`);

    if (this.combatData.hasMemory && this.playerHp > 0 && this.enemyHp > 0) {
      const nextMove = enemyMoveAtTurn(this.turn);
      this.hintText.setText(`[ 죽음의 기억 ] 다음 공격 예측: ${nextMove.label} (${nextMove.telegraph})`);
    } else {
      this.hintText.setText("");
    }
  }

  private renderButtons() {
    this.buttons.forEach((b) => b.destroy());
    this.buttons = [];

    const basicBtn = this.add.text(320, 480, "▸ 기초 타격", {
      fontFamily: "serif",
      fontSize: "16px",
      color: "#cbbfa5",
    }).setInteractive({ useHandCursor: true });
    basicBtn.on("pointerdown", () => this.playerTurn(useBasicStrike()));
    this.buttons.push(basicBtn);

    const canGamble = canUseLastDitchGamble(this.playerHp, PLAYER_MAX_HP);
    const gambleBtn = this.add.text(320, 510, "▸ 막바지 승부", {
      fontFamily: "serif",
      fontSize: "16px",
      color: canGamble ? "#d1616c" : "#4a4137",
    });
    if (canGamble) {
      gambleBtn.setInteractive({ useHandCursor: true });
      gambleBtn.on("pointerdown", () => this.playerTurn(useLastDitchGamble()));
    }
    this.buttons.push(gambleBtn);

    if (!canGamble) {
      const note = this.add.text(320, 535, "(체력이 30% 이하일 때만 사용 가능)", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#4a4137",
      });
      this.buttons.push(note);
    }
  }

  private playerTurn(outcome: ReturnType<typeof useBasicStrike>) {
    if (this.resolved) return;
    this.enemyHp -= outcome.damageToEnemy;
    this.playerHp -= outcome.damageToSelf;
    this.logText.setText(outcome.log);

    if (this.enemyHp <= 0) {
      this.finish("win");
      return;
    }

    this.time.delayedCall(500, () => this.enemyTurn());
  }

  private enemyTurn() {
    if (this.resolved) return;
    const move = enemyMoveAtTurn(this.turn);
    const outcome = resolveEnemyMove(move);
    this.playerHp -= outcome.damageToSelf;
    this.turn += 1;
    this.logText.setText(outcome.log);
    this.renderStatus();
    this.renderButtons();

    if (this.playerHp <= 0) {
      this.finish("lose");
    }
  }

  private finish(result: "win" | "lose") {
    this.resolved = true;
    this.buttons.forEach((b) => b.destroy());
    this.buttons = [];

    this.logText.setText(result === "win" ? "적을 물리쳤다." : "쓰러졌다…");

    const closeBtn = this.add.text(480, 480, "[ 계속 ]", {
      fontFamily: "monospace",
      fontSize: "13px",
      color: "#8fbfa4",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    closeBtn.on("pointerdown", () => {
      this.combatData.onResult(result);
      this.scene.stop();
    });
  }
}
