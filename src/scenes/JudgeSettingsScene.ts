import Phaser from "phaser";
import { CanvasDomInput } from "../render/domInput";
import {
  JUDGE_MODELS,
  judgeIsLive,
  loadJudgeSettings,
  saveJudgeSettings,
  type JudgeSettings,
} from "../systems/dialogue";

/**
 * 대화 판정기 설정.
 *
 * 이 게임은 서버가 없는 정적 사이트라, 언어모델을 부르려면 키가 브라우저 안에
 * 있어야 한다. 그래서 저장소에는 어떤 키도 넣지 않고, 플레이어가 직접 자기 키를
 * 넣게 한다. 그 선택에 따르는 위험은 화면에서 그대로 알린다 — 숨기고 켜게 하는
 * 것보다 알고 켜게 하는 편이 낫다.
 */
export class JudgeSettingsScene extends Phaser.Scene {
  private nodes: Phaser.GameObjects.GameObject[] = [];
  private settings!: JudgeSettings;
  private keyInput?: CanvasDomInput;
  private proxyInput?: CanvasDomInput;
  private notice = "";
  private keyHandler?: (e: KeyboardEvent) => void;

  constructor() {
    super("JudgeSettingsScene");
  }

  create() {
    this.settings = loadJudgeSettings();
    this.notice = "";

    const bg = this.add.graphics();
    bg.fillGradientStyle(0x08070d, 0x08070d, 0x171224, 0x171224, 1);
    bg.fillRect(0, 0, 960, 600);

    this.keyInput = new CanvasDomInput(this, {
      x: 60,
      y: 236,
      w: 600,
      placeholder: "sk-ant-...  (내 API 키 — 이 브라우저에만 저장됩니다)",
      password: true,
      value: this.settings.apiKey,
      maxLength: 200,
      onEnter: () => this.persist(),
    });
    this.proxyInput = new CanvasDomInput(this, {
      x: 60,
      y: 320,
      w: 600,
      placeholder: "https://내-프록시-주소/  (선택 — 키 대신 이쪽을 쓰면 더 안전)",
      value: this.settings.proxyUrl,
      maxLength: 300,
      onEnter: () => this.persist(),
    });

    this.keyHandler = (e: KeyboardEvent) => {
      if (!this.scene.isActive()) return;
      if (document.activeElement instanceof HTMLInputElement) return;
      if (e.key === "Escape") this.close();
      if (e.key === "1") this.toggleMode();
      if (e.key === "2") this.cycleModel();
    };
    window.addEventListener("keydown", this.keyHandler);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
    this.render();
  }

  private teardown() {
    this.keyInput?.destroy();
    this.proxyInput?.destroy();
    this.keyInput = undefined;
    this.proxyInput = undefined;
    if (this.keyHandler) {
      window.removeEventListener("keydown", this.keyHandler);
      this.keyHandler = undefined;
    }
  }

  private persist() {
    this.settings = {
      ...this.settings,
      apiKey: this.keyInput?.value.trim() ?? "",
      proxyUrl: this.proxyInput?.value.trim() ?? "",
    };
    saveJudgeSettings(this.settings);
    this.notice = judgeIsLive(this.settings)
      ? "저장했습니다. 이제 자유 입력을 AI가 판정합니다."
      : "저장했습니다. 키나 프록시가 없어 규칙 판정으로 돕니다.";
    this.render();
  }

  private toggleMode() {
    this.settings = { ...this.settings, mode: this.settings.mode === "claude" ? "offline" : "claude" };
    saveJudgeSettings(this.settings);
    this.render();
  }

  private cycleModel() {
    const i = JUDGE_MODELS.findIndex((m) => m.id === this.settings.model);
    const next = JUDGE_MODELS[(i + 1) % JUDGE_MODELS.length];
    this.settings = { ...this.settings, model: next.id };
    saveJudgeSettings(this.settings);
    this.render();
  }

  private close() {
    this.persist();
    this.scene.stop();
  }

  private label(x: number, y: number, text: string, style: Phaser.Types.GameObjects.Text.TextStyle) {
    const t = this.add.text(x, y, text, style);
    this.nodes.push(t);
    return t;
  }

  private render() {
    this.nodes.forEach((n) => n.destroy());
    this.nodes = [];

    this.label(60, 40, "AI 대화 판정", { fontFamily: "serif", fontSize: "26px", color: "#e6dcff" });
    this.label(
      60,
      76,
      "자유 입력 대사를 언어모델이 읽고, 이 인물이 어떻게 받아들일지 판정합니다.",
      { fontFamily: "monospace", fontSize: "11px", color: "#a49bb5" }
    );

    const live = judgeIsLive(this.settings);
    const on = this.settings.mode === "claude";

    // 모드
    const modePanel = this.add.graphics();
    modePanel.fillStyle(0x0d0b14, 0.85);
    modePanel.fillRoundedRect(60, 108, 840, 50, 6);
    modePanel.lineStyle(1, on ? 0x6ea78c : 0x3a3348, 0.9);
    modePanel.strokeRoundedRect(60, 108, 840, 50, 6);
    if (on) {
      modePanel.fillStyle(0x6ea78c, 0.9);
      modePanel.fillRoundedRect(60, 108, 4, 50, 2);
    }
    this.nodes.push(modePanel);
    const modeLabel = this.label(84, 122, "[1] 판정 방식", {
      fontFamily: "serif",
      fontSize: "16px",
      color: "#e8dcc4",
    });
    this.label(
      84,
      142,
      on
        ? live
          ? "AI 판정 — 켜져 있고, 호출할 수 있습니다."
          : "AI 판정 — 켜져 있지만 키/프록시가 없어 규칙 판정으로 돕니다."
        : "규칙 판정 — 키워드로 판정합니다. 인터넷도 키도 필요 없습니다.",
      { fontFamily: "monospace", fontSize: "10.5px", color: live && on ? "#8fbfa4" : "#7a7189" }
    );
    modeLabel.setInteractive({ useHandCursor: true });
    modeLabel.on("pointerdown", () => this.toggleMode());

    // 모델
    const model = JUDGE_MODELS.find((m) => m.id === this.settings.model) ?? JUDGE_MODELS[0];
    const modelLabel = this.label(84, 176, `[2] 모델  ${model.label}`, {
      fontFamily: "serif",
      fontSize: "15px",
      color: "#cbbfa5",
    });
    modelLabel.setInteractive({ useHandCursor: true });
    modelLabel.on("pointerdown", () => this.cycleModel());

    this.label(60, 214, "내 API 키", { fontFamily: "monospace", fontSize: "11px", color: "#a49bb5" });
    this.label(60, 298, "프록시 주소 (선택)", {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#a49bb5",
    });

    const save = this.label(700, 236, "[ 저장 ]", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#d1616c",
    });
    save.setInteractive({ useHandCursor: true });
    save.on("pointerdown", () => this.persist());

    const clear = this.label(700, 320, "[ 키 지우기 ]", {
      fontFamily: "monospace",
      fontSize: "13px",
      color: "#8b8299",
    });
    clear.setInteractive({ useHandCursor: true });
    clear.on("pointerdown", () => {
      if (this.keyInput) this.keyInput.el.value = "";
      if (this.proxyInput) this.proxyInput.el.value = "";
      this.persist();
    });

    // 위험 고지 — 켜기 전에 알아야 하는 것.
    const warnPanel = this.add.graphics();
    warnPanel.fillStyle(0x160a0c, 0.9);
    warnPanel.fillRoundedRect(60, 372, 840, 116, 6);
    warnPanel.lineStyle(1, 0x7c1f2b, 0.9);
    warnPanel.strokeRoundedRect(60, 372, 840, 116, 6);
    this.nodes.push(warnPanel);
    this.label(
      80,
      386,
      [
        "알아두실 것",
        "· 키는 이 브라우저에만 저장되고 게임 세이브와는 분리됩니다. 저장소에는 어떤 키도 들어 있지 않습니다.",
        "· 그래도 브라우저에 키를 두는 것은 안전하지 않습니다 — 확장 프로그램 등이 읽어갈 수 있습니다.",
        "· 호출 비용은 키 주인에게 청구됩니다. 공용 PC에서는 쓰지 마시고, 끝나면 키를 지우세요.",
        "· 더 안전한 방법은 키를 서버에 두고 프록시 주소만 넣는 것입니다.",
      ].join("\n"),
      { fontFamily: "monospace", fontSize: "10.5px", color: "#e0b8bc", lineSpacing: 5 }
    );

    if (this.notice) {
      this.label(60, 500, this.notice, {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#8fbfa4",
      });
    }

    const close = this.label(480, 546, "[ Esc ] 저장하고 돌아가기", {
      fontFamily: "monospace",
      fontSize: "13px",
      color: "#8fbfa4",
    }).setOrigin(0.5);
    close.setInteractive({ useHandCursor: true });
    close.on("pointerdown", () => this.close());
  }
}
