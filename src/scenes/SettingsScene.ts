import Phaser from "phaser";
import { getState, setState } from "../state/gameState";

type ToggleKey = "reduceShake" | "reduceFlash" | "reduceParticles" | "instantText";

/**
 * 설정 — 접근성과 연출 강도.
 *
 * 실제로 동작하는 항목만 둔다. 이 게임에는 아직 소리가 없으므로 음량 조절은
 * 만들지 않았다. 있지도 않은 기능을 켜고 끄게 하는 것이 더 나쁜 접근성이다.
 */
export class SettingsScene extends Phaser.Scene {
  private nodes: Phaser.GameObjects.GameObject[] = [];
  private keyHandler?: (event: KeyboardEvent) => void;
  private options: { label: string; act: () => void }[] = [];

  constructor() {
    super("SettingsScene");
  }

  create() {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x08070d, 0x08070d, 0x171224, 0x171224, 1);
    bg.fillRect(0, 0, 960, 600);

    this.render();

    this.keyHandler = (event: KeyboardEvent) => {
      if (!this.scene.isActive()) return;
      if (event.key === "Escape") {
        this.scene.stop();
        return;
      }
      const index = Number(event.key) - 1;
      if (Number.isInteger(index) && index >= 0 && index < this.options.length) {
        this.options[index].act();
      }
    };
    window.addEventListener("keydown", this.keyHandler);
    this.events.once("shutdown", () => this.teardown());
    this.events.once("destroy", () => this.teardown());
  }

  private teardown() {
    if (this.keyHandler) {
      window.removeEventListener("keydown", this.keyHandler);
      this.keyHandler = undefined;
    }
  }

  private toggle(key: ToggleKey) {
    const state = getState();
    setState({
      ...state,
      settings: {
        ...state.settings,
        accessibility: {
          ...state.settings.accessibility,
          [key]: !state.settings.accessibility[key],
        },
      },
    });
    this.render();
  }

  private openJudgeSettings() {
    this.scene.launch("JudgeSettingsScene");
    this.scene.get("JudgeSettingsScene").events.once("shutdown", () => {
      this.scene.wake();
      this.render();
    });
    this.scene.sleep();
  }

  private render() {
    this.nodes.forEach((n) => n.destroy());
    this.nodes = [];

    const a = getState().settings.accessibility;

    const title = this.add.text(60, 50, "설정", {
      fontFamily: "serif",
      fontSize: "26px",
      color: "#e6dcff",
    });
    this.nodes.push(title);

    const rows: { key: ToggleKey; label: string; detail: string }[] = [
      { key: "reduceShake", label: "화면 흔들림 끄기", detail: "피격 시 화면이 흔들리지 않습니다." },
      { key: "reduceFlash", label: "섬광 줄이기", detail: "뽑기 결과의 번쩍임과 등장 연출을 생략합니다." },
      { key: "reduceParticles", label: "파티클 줄이기", detail: "떠다니는 입자 수를 크게 줄입니다." },
      { key: "instantText", label: "텍스트 즉시 표시", detail: "대사를 한 번에 전부 보여줍니다." },
    ];

    this.options = rows.map((row) => ({ label: row.label, act: () => this.toggle(row.key) }));

    rows.forEach((row, i) => {
      const y = 120 + i * 66;
      const on = a[row.key];

      const panel = this.add.graphics();
      panel.fillStyle(0x0d0b14, 0.85);
      panel.fillRoundedRect(60, y, 840, 54, 6);
      panel.lineStyle(1, on ? 0x6ea78c : 0x3a3348, 0.9);
      panel.strokeRoundedRect(60, y, 840, 54, 6);
      // 켜짐 여부를 색만이 아니라 왼쪽 띠의 유무로도 표시한다
      if (on) {
        panel.fillStyle(0x6ea78c, 0.9);
        panel.fillRoundedRect(60, y, 4, 54, 2);
      }
      this.nodes.push(panel);

      const label = this.add.text(84, y + 12, `[${i + 1}] ${row.label}`, {
        fontFamily: "serif",
        fontSize: "16px",
        color: "#e8dcc4",
      });
      const detail = this.add.text(84, y + 33, row.detail, {
        fontFamily: "monospace",
        fontSize: "10.5px",
        color: "#7a7189",
      });
      const stateLabel = this.add
        .text(876, y + 20, on ? "[ 켜짐 ]" : "[ 꺼짐 ]", {
          fontFamily: "monospace",
          fontSize: "13px",
          color: on ? "#8fbfa4" : "#5c5568",
        })
        .setOrigin(1, 0);

      [label, detail, stateLabel].forEach((n) => {
        this.nodes.push(n);
        n.setInteractive({ useHandCursor: true });
        n.on("pointerdown", () => this.toggle(row.key));
      });
    });

    const keyGuide = this.add.text(
      60,
      404,
      [
        "키 안내",
        "  이동      ← → ↑ ↓        점프(횡스크롤 구간)  ↑",
        "  선택      숫자 키 1~6     취소·닫기            Esc",
        "  진행      Enter / Space",
        "",
        "모든 화면은 마우스 없이 키보드만으로 조작할 수 있습니다.",
      ].join("\n"),
      { fontFamily: "monospace", fontSize: "12px", color: "#a49bb5", lineSpacing: 7 }
    );
    this.nodes.push(keyGuide);

    const judgeBtn = this.add
      .text(60, 512, "[ 5 ] AI 대화 판정 설정 →", {
        fontFamily: "serif",
        fontSize: "15px",
        color: "#c9b0ff",
      })
      .setInteractive({ useHandCursor: true });
    judgeBtn.on("pointerdown", () => this.openJudgeSettings());
    this.nodes.push(judgeBtn);
    this.options.push({ label: "AI 대화 판정 설정", act: () => this.openJudgeSettings() });

    const close = this.add
      .text(480, 560, "[ Esc ] 돌아가기", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#8fbfa4",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    close.on("pointerdown", () => this.scene.stop());
    this.nodes.push(close);
  }
}
