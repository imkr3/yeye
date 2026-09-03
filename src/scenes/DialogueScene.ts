import Phaser from "phaser";
import {
  getNode,
  evaluateFreeText,
  type DialogueNode,
  type DialogueTree,
} from "../systems/DialogueSystem";
import { drawCrest } from "../render/silhouettes";
import { getState } from "../state/gameState";

export interface DialogueSceneData {
  tree: DialogueTree;
  onTrustDelta: (npcId: string, delta: number) => void;
  onFlag?: (flag: string) => void;
  /** 말 한마디로 죽는 갈래를 골랐을 때. */
  onLethal?: (reason: string) => void;
  /** 「거짓말 탐지 부표」를 지녔을 때만 참 — 치명적인 갈래에 표식을 붙인다. */
  revealDanger?: boolean;
  onClose: () => void;
}

/**
 * 대화 창.
 *
 * 배치 규칙 (예전에 겹침 문제가 있었던 부분):
 * - 뒤 배경과 상태창이 반투명 패널로 비쳐 보여서 글씨가 지저분했다. 이제 전체 화면
 *   스크림을 깔고 패널을 불투명하게 만든다.
 * - 자유 입력 노드에서 입력창과 [전달] 버튼이 서로 겹쳐 있었다. 이제 대사 높이를
 *   실제로 재서 그 아래로 차례대로 쌓는다 — 대사가 길어져도 겹치지 않는다.
 */

const PANEL = { x: 30, y: 310, w: 900, h: 270 };
const TEXT_X = PANEL.x + 78;
const WRAP = PANEL.w - 78 - 28;
const LINE_Y = PANEL.y + 52;
/** 대사가 짧아도 선택지가 최소 이 아래에는 오도록. */
const CONTENT_MIN_Y = PANEL.y + 118;
const OPTION_STEP = 27;
const TYPE_MS = 22;

export class DialogueScene extends Phaser.Scene {
  private dialogueData!: DialogueSceneData;
  private currentNodeId!: string;
  private speakerText!: Phaser.GameObjects.Text;
  private lineText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private logBtn!: Phaser.GameObjects.Text;
  private exitBtn!: Phaser.GameObjects.Text;
  private optionObjects: Phaser.GameObjects.GameObject[] = [];
  private closed = false;
  private escHandler?: (e: KeyboardEvent) => void;
  private panel!: Phaser.GameObjects.Rectangle;

  // --- 타자 연출 ---
  private typing = false;
  private fullLine = "";
  private typeEvent?: Phaser.Time.TimerEvent;

  // --- 키보드 선택 ---
  private choiceButtons: Phaser.GameObjects.Text[] = [];
  private choiceRunners: (() => void)[] = [];
  private highlight = 0;

  // --- 대화 로그 ---
  private history: { speaker: string; line: string }[] = [];
  private lastLogged = "";
  private logOpen = false;
  private logObjects: Phaser.GameObjects.GameObject[] = [];

  /**
   * 자유 입력창은 Phaser의 DOM 컨테이너를 쓰지 않고 직접 배치한다.
   *
   * Phaser는 DOM 컨테이너를 캔버스의 marginLeft/marginTop을 복사해 맞추는데,
   * 컨테이너가 position:absolute라 캔버스가 레터박스로 가운데 정렬되는 순간
   * 둘이 어긋난다. 실제로 입력창이 제자리보다 한참 아래로 내려가 [전달] 버튼과
   * 겹쳤다. 창 크기가 게임 비율과 정확히 같을 때만 멀쩡해 보여서 놓치기 쉬웠다.
   *
   * 한글 조합(IME) 때문에 진짜 <input>은 반드시 필요하므로, 캔버스 좌표에서
   * 직접 계산해 body에 붙이고 크기 변화마다 다시 맞춘다.
   */
  private inputEl?: HTMLInputElement;
  private inputLayout?: { x: number; y: number; w: number; h: number };
  private repositionInput = () => this.applyInputLayout();

  constructor() {
    super("DialogueScene");
  }

  init(data: DialogueSceneData) {
    this.dialogueData = data;
    this.currentNodeId = data.tree.startNode;
    this.closed = false;
    this.history = [];
    this.lastLogged = "";
    this.logOpen = false;
    this.typing = false;
  }

  create() {
    // 전체 화면 스크림 — 배경과 상태창이 대화 글씨를 뚫고 올라오지 않게 한다.
    this.add.rectangle(480, 300, 960, 600, 0x05040a, 0.74).setDepth(0);

    this.panel = this.add
      .rectangle(PANEL.x + PANEL.w / 2, PANEL.y + PANEL.h / 2, PANEL.w, PANEL.h, 0x0e0c09, 1)
      .setStrokeStyle(1, 0x3a3225)
      .setDepth(1);

    // 문장(紋章) — 패널 안쪽에 여유를 두고 놓는다. 예전에는 왼쪽 모서리에 걸쳐 잘렸다.
    const crestColor = this.dialogueData.tree.crestColor;
    const cx = PANEL.x + 46;
    const cy = PANEL.y + 46;
    const glow = this.add.graphics().setDepth(2);
    glow.fillStyle(crestColor, 0.12);
    glow.fillCircle(cx, cy, 26);
    glow.fillStyle(crestColor, 0.18);
    glow.fillCircle(cx, cy, 18);
    drawCrest(this, cx, cy, 14, crestColor, this.dialogueData.tree.crestShape).setDepth(2);

    this.speakerText = this.add
      .text(TEXT_X, PANEL.y + 28, "", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#d1616c",
        letterSpacing: 2,
      })
      .setDepth(2);

    this.lineText = this.add
      .text(TEXT_X, LINE_Y, "", {
        fontFamily: "serif",
        fontSize: "17px",
        color: "#ece3ce",
        wordWrap: { width: WRAP },
        lineSpacing: 4,
      })
      .setDepth(2);

    // 자유 입력창에 포커스가 있으면 L·Esc 단축키가 입력으로 먹힌다. 그래서 마우스로도
    // 항상 닿을 수 있게 버튼으로 둔다.
    this.exitBtn = this.makeFooterButton(PANEL.x + PANEL.w - 16, "나가기 (Esc)", () =>
      this.closeDialogue()
    );
    this.logBtn = this.makeFooterButton(PANEL.x + PANEL.w - 108, "기록 (L)", () => this.toggleLog());

    this.hintText = this.add
      .text(PANEL.x + 22, PANEL.y + PANEL.h - 20, "", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#6f6880",
      })
      .setDepth(2);

    // 상태창 버튼이 스크림 아래에서 여전히 눌리던 문제 — 대화 중에는 입력을 끈다.
    this.setOverlayInput(false);

    this.escHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (this.logOpen) this.toggleLog();
        else this.closeDialogue();
      }
    };
    window.addEventListener("keydown", this.escHandler);

    this.input.keyboard?.on("keydown", this.onKey, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());

    this.renderNode();
  }

  private makeFooterButton(x: number, label: string, run: () => void) {
    const btn = this.add
      .text(x, PANEL.y + PANEL.h - 22, label, {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#8b8299",
      })
      .setOrigin(1, 0)
      .setDepth(3)
      .setInteractive({ useHandCursor: true });
    btn.on("pointerover", () => btn.setColor("#ffd9a0"));
    btn.on("pointerout", () => btn.setColor("#8b8299"));
    btn.on("pointerdown", run);
    return btn;
  }

  /** 대화 중에는 아래 상태창을 만질 수 없게 한다. */
  private setOverlayInput(enabled: boolean) {
    const overlay = this.scene.get("StatusOverlayScene");
    if (overlay?.input) overlay.input.enabled = enabled;
  }

  private closeDialogue() {
    if (this.closed) return;
    this.closed = true;
    this.dialogueData.onClose();
    this.scene.stop();
  }

  private triggerLethal(reason: string) {
    if (this.closed) return;
    this.closed = true;
    this.dialogueData.onLethal?.(reason);
    this.scene.stop();
  }

  private cleanup() {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.repositionInput);
    window.removeEventListener("resize", this.repositionInput);
    this.removeInput();
    this.setOverlayInput(true);
    // 입력창에 포커스가 남은 채 닫혔을 수 있다 — 키 캡처를 반드시 되돌린다.
    this.input?.keyboard?.enableGlobalCapture();
    this.input?.keyboard?.off("keydown", this.onKey, this);
    if (this.escHandler) {
      window.removeEventListener("keydown", this.escHandler);
      this.escHandler = undefined;
    }
    this.typeEvent?.remove();
    this.clearOptions();
  }

  // --- 키보드 조작 --------------------------------------------------------

  private onKey(event: KeyboardEvent) {
    // 자유 입력창에 타이핑 중이면 단축키로 가로채지 않는다.
    if (document.activeElement instanceof HTMLInputElement) return;
    if (this.closed) return;

    const key = event.key;

    if (key === "l" || key === "L" || key === "ㅣ") {
      this.toggleLog();
      return;
    }
    if (this.logOpen) return;

    if (this.typing) {
      this.finishTyping();
      return;
    }

    if (key >= "1" && key <= "9") {
      const i = Number(key) - 1;
      if (i < this.choiceRunners.length) this.selectChoice(i);
      return;
    }

    if (key === "ArrowDown" || key === "ArrowUp") {
      if (this.choiceRunners.length < 2) return;
      const dir = key === "ArrowDown" ? 1 : -1;
      this.highlight = (this.highlight + dir + this.choiceRunners.length) % this.choiceRunners.length;
      this.paintHighlight();
      return;
    }

    if (key === "Enter" || key === " ") {
      if (this.choiceRunners.length > 0) this.selectChoice(this.highlight);
    }
  }

  private selectChoice(index: number) {
    const run = this.choiceRunners[index];
    if (run) run();
  }

  private paintHighlight() {
    this.choiceButtons.forEach((btn, i) => {
      const base = btn.getData("baseColor") as string;
      const label = btn.getData("baseText") as string;
      const on = i === this.highlight && this.choiceButtons.length > 1;
      btn.setColor(on ? "#ffd9a0" : base);
      btn.setText(on ? `▶ ${label}` : `  ${label}`);
    });
  }

  // --- 타자 연출 ----------------------------------------------------------

  private startTyping(full: string) {
    this.fullLine = full;
    this.typeEvent?.remove();

    if (getState().settings.accessibility.instantText) {
      this.lineText.setText(full);
      this.typing = false;
      return;
    }

    this.typing = true;
    this.lineText.setText("");
    let i = 0;
    this.typeEvent = this.time.addEvent({
      delay: TYPE_MS,
      repeat: full.length - 1,
      callback: () => {
        i += 1;
        this.lineText.setText(full.slice(0, i));
        if (i >= full.length) this.finishTyping();
      },
    });
    this.updateHint();
  }

  /** 연출을 건너뛰고 선택지를 바로 띄운다. */
  private finishTyping() {
    if (!this.typing) return;
    this.typeEvent?.remove();
    this.typing = false;
    this.lineText.setText(this.fullLine);
    this.buildOptions();
  }

  private updateHint() {
    if (this.typing) {
      this.hintText.setText("아무 키나 — 대사 즉시 표시");
      return;
    }
    this.hintText.setText(
      this.choiceRunners.length > 1 ? "1~9 숫자키 · ↑↓ 이동 후 Enter" : ""
    );
  }

  // --- 렌더링 -------------------------------------------------------------

  private clearOptions() {
    this.optionObjects.forEach((o) => o.destroy());
    this.optionObjects = [];
    this.choiceButtons = [];
    this.choiceRunners = [];
    this.removeInput();
  }

  private removeInput() {
    this.inputEl?.remove();
    this.inputEl = undefined;
    this.inputLayout = undefined;
  }

  /** 게임 좌표를 실제 화면 좌표로 옮겨 입력창을 캔버스 위에 정확히 얹는다. */
  private applyInputLayout() {
    const el = this.inputEl;
    const box = this.inputLayout;
    if (!el || !box) return;
    const cv = this.game.canvas.getBoundingClientRect();
    const s = this.scale.displayScale; // 게임 좌표 / 화면 좌표
    el.style.position = "fixed";
    el.style.left = `${cv.left + box.x / s.x}px`;
    el.style.top = `${cv.top + box.y / s.y}px`;
    el.style.width = `${box.w / s.x}px`;
    el.style.height = `${box.h / s.y}px`;
    el.style.fontSize = `${13 / s.y}px`;
  }

  private goTo(nodeId: string) {
    this.currentNodeId = nodeId;
    this.renderNode();
  }

  private renderNode() {
    this.clearOptions();
    const node = getNode(this.dialogueData.tree, this.currentNodeId);
    if (node.flagOnEnter) this.dialogueData.onFlag?.(node.flagOnEnter);

    this.speakerText.setText(node.speaker.toUpperCase());

    if (node.menace) {
      this.panel.setFillStyle(0x160a0c, 1).setStrokeStyle(1, 0x7c1f2b);
      this.speakerText.setColor("#e0707c");
      this.lineText.setColor("#f0d8d8");
    } else {
      this.panel.setFillStyle(0x0e0c09, 1).setStrokeStyle(1, 0x3a3225);
      this.speakerText.setColor("#d1616c");
      this.lineText.setColor("#ece3ce");
    }

    if (this.lastLogged !== node.id) {
      this.history.push({ speaker: node.speaker, line: node.line });
      this.lastLogged = node.id;
    }

    const full = node.freeText ? `${node.line}\n\n${node.freeText.prompt}` : node.line;
    this.startTyping(full);
    if (!this.typing) this.buildOptions();
  }

  /** 대사 아래로 차례차례 쌓는다. 실제 높이를 재기 때문에 겹치지 않는다. */
  private optionTop(): number {
    return Math.max(CONTENT_MIN_Y, this.lineText.y + this.lineText.height + 18);
  }

  private buildOptions() {
    this.clearOptions();
    const node = getNode(this.dialogueData.tree, this.currentNodeId);
    const top = this.optionTop();

    if (node.end) {
      this.addChoice(top, "[ 대화 종료 ]", "#8fbfa4", () => this.closeDialogue());
      this.highlight = 0;
      this.paintHighlight();
      this.updateHint();
      return;
    }

    if (node.choices) {
      node.choices.forEach((choice, i) => {
        const marked = this.dialogueData.revealDanger && choice.lethal;
        this.addChoice(
          top + i * OPTION_STEP,
          `${marked ? "⚠ " : ""}${choice.label}`,
          marked ? "#e0707c" : "#cbbfa5",
          () => {
            if (choice.lethal) return this.triggerLethal(choice.lethal);
            if (choice.trustDelta)
              this.dialogueData.onTrustDelta(this.dialogueData.tree.npcId, choice.trustDelta);
            if (choice.flag) this.dialogueData.onFlag?.(choice.flag);
            this.goTo(choice.next);
          },
          i + 1
        );
      });
      this.highlight = 0;
      this.paintHighlight();
      this.updateHint();
      return;
    }

    if (node.freeText) {
      this.createTextInput(node, top);
      this.updateHint();
      return;
    }

    if (node.next) {
      this.addChoice(top, "계속", "#cbbfa5", () => this.goTo(node.next!));
    } else {
      // 데이터가 잘못돼도 나갈 길은 남긴다.
      this.addChoice(top, "자리를 뜬다", "#8fbfa4", () => this.closeDialogue());
    }
    this.highlight = 0;
    this.paintHighlight();
    this.updateHint();
  }

  private addChoice(y: number, label: string, color: string, run: () => void, num?: number) {
    const prefix = num ? `${num}. ` : "";
    const btn = this.add
      .text(TEXT_X, y, `  ${prefix}${label}`, {
        fontFamily: "serif",
        fontSize: "14px",
        color,
      })
      .setDepth(2)
      .setInteractive({ useHandCursor: true });
    btn.setData("baseColor", color);
    btn.setData("baseText", `${prefix}${label}`);
    btn.on("pointerover", () => {
      this.highlight = this.choiceButtons.indexOf(btn);
      this.paintHighlight();
    });
    btn.on("pointerdown", run);
    this.optionObjects.push(btn);
    this.choiceButtons.push(btn);
    this.choiceRunners.push(run);
    return btn;
  }

  private createTextInput(node: DialogueNode, top: number) {
    const inputEl = document.createElement("input");
    inputEl.type = "text";
    inputEl.placeholder = "직접 대사를 입력하세요…";
    inputEl.maxLength = 80;
    inputEl.style.padding = "6px 10px";
    inputEl.style.background = "#1e1a13";
    inputEl.style.color = "#ece3ce";
    inputEl.style.border = "1px solid #3a3225";
    inputEl.style.fontFamily = "monospace";
    inputEl.style.fontSize = "13px";
    inputEl.style.boxSizing = "border-box";

    document.body.appendChild(inputEl);
    this.inputEl = inputEl;
    this.inputLayout = { x: TEXT_X, y: top, w: WRAP, h: 34 };
    this.applyInputLayout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.repositionInput);
    window.addEventListener("resize", this.repositionInput);

    /*
     * Phaser의 키보드 캡처는 전역이다. 매니저가 window에 리스너를 걸고, 캡처 목록에
     * 있는 키코드면 이벤트 대상이 무엇이든 preventDefault를 부른다 — HTML <input>
     * 안이라도 마찬가지다. 방향키·Shift·Space는 createCursorKeys()가 캡처 목록에
     * 올리므로, 입력 중에만 전역 캡처를 꺼서 정상적으로 타이핑되게 한다.
     */
    const keyboard = this.input.keyboard;
    inputEl.addEventListener("focus", () => keyboard?.disableGlobalCapture());
    inputEl.addEventListener("blur", () => keyboard?.enableGlobalCapture());

    // 입력창 아래로 충분히 내려서 버튼과 겹치지 않게 한다.
    const submitBtn = this.add
      .text(TEXT_X, top + 44, "[ 전달 ]  (Enter)", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#d1616c",
      })
      .setDepth(2)
      .setInteractive({ useHandCursor: true });
    this.optionObjects.push(submitBtn);

    const submit = () => {
      const value = inputEl.value.trim();
      if (!value) {
        // 예전에는 조용히 무시해서 버튼이 고장난 것처럼 보였다.
        submitBtn.setText("[ 전달 ] — 할 말을 입력하세요");
        this.time.delayedCall(1400, () => submitBtn.setText("[ 전달 ]  (Enter)"));
        inputEl.focus();
        return;
      }
      const result = evaluateFreeText(value, node);
      this.history.push({ speaker: "(나)", line: value });
      if (result.lethal) return this.triggerLethal(result.lethal);
      if (result.trustDelta)
        this.dialogueData.onTrustDelta(this.dialogueData.tree.npcId, result.trustDelta);
      if (result.flag) this.dialogueData.onFlag?.(result.flag);
      this.goTo(result.next);
    };

    submitBtn.on("pointerdown", submit);
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });

    this.time.delayedCall(50, () => inputEl.focus());
  }

  // --- 대화 로그 ----------------------------------------------------------

  private toggleLog() {
    this.logOpen = !this.logOpen;
    this.logBtn.setVisible(!this.logOpen);
    this.exitBtn.setVisible(!this.logOpen);
    if (!this.logOpen) {
      this.logObjects.forEach((o) => o.destroy());
      this.logObjects = [];
      return;
    }

    // 전체 화면을 덮는다 — 예전 크기로는 뒤의 대화 패널이 가장자리로 비쳐 보였다.
    const bg = this.add.rectangle(480, 300, 960, 600, 0x07060b, 0.985).setDepth(20);
    const frame = this.add
      .rectangle(480, 300, 900, 540, 0x000000, 0)
      .setDepth(20)
      .setStrokeStyle(1, 0x3a3225);
    const title = this.add
      .text(70, 62, "지나간 대화", { fontFamily: "serif", fontSize: "18px", color: "#cbbfa5" })
      .setDepth(21);
    const close = this.add
      .text(890, 62, "닫기 (L / Esc)", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#8b8299",
      })
      .setOrigin(1, 0)
      .setDepth(21)
      .setInteractive({ useHandCursor: true });
    close.on("pointerdown", () => this.toggleLog());
    this.logObjects.push(bg, frame, title, close);

    if (this.history.length === 0) {
      this.logObjects.push(
        this.add
          .text(70, 96, "아직 지나간 대화가 없습니다.", {
            fontFamily: "serif",
            fontSize: "14px",
            color: "#6f6880",
          })
          .setDepth(21)
      );
      return;
    }

    // 최근 것이 아래로 오도록, 화면에 들어가는 만큼만 보여준다.
    const recent = this.history.slice(-9);
    let y = 96;
    for (const entry of recent) {
      const who = this.add
        .text(70, y, entry.speaker, { fontFamily: "monospace", fontSize: "11px", color: "#d1616c" })
        .setDepth(21);
      const what = this.add
        .text(70, y + 16, entry.line, {
          fontFamily: "serif",
          fontSize: "14px",
          color: "#bdb3a0",
          wordWrap: { width: 800 },
          lineSpacing: 2,
        })
        .setDepth(21);
      this.logObjects.push(who, what);
      y += 16 + what.height + 14;
    }
  }
}
