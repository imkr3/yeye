import Phaser from "phaser";
import {
  getNode,
  evaluateFreeText,
  type DialogueTree,
} from "../systems/DialogueSystem";
import { drawCrest } from "../render/silhouettes";

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
 * 대화 창 UI. 선택지 버튼과, 신뢰가 걸린 순간엔 실제 텍스트 입력 필드를 띄운다.
 * 입력 필드는 Phaser DOM 엘리먼트 플러그인을 사용한다 (main.ts에서 dom.createContainer 활성화 필요).
 */
export class DialogueScene extends Phaser.Scene {
  private dialogueData!: DialogueSceneData;
  private currentNodeId!: string;
  private speakerText!: Phaser.GameObjects.Text;
  private lineText!: Phaser.GameObjects.Text;
  private optionObjects: Phaser.GameObjects.GameObject[] = [];
  private closed = false;
  private escHandler?: (e: KeyboardEvent) => void;
  private panel!: Phaser.GameObjects.Rectangle;

  constructor() {
    super("DialogueScene");
  }

  init(data: DialogueSceneData) {
    this.dialogueData = data;
    this.currentNodeId = data.tree.startNode;
    this.closed = false;
  }

  create() {
    this.panel = this.add
      .rectangle(480, 460, 860, 220, 0x0e0c09, 0.92)
      .setStrokeStyle(1, 0x3a3225);

    // 문장(紋章) — 필드 실루엣과 같은 모양을 재사용해 일관성을 유지한다. 은은한 후광을 뒤에 깐다.
    const crestColor = this.dialogueData.tree.crestColor;
    const glow = this.add.graphics();
    glow.fillStyle(crestColor, 0.12);
    glow.fillCircle(56, 386, 26);
    glow.fillStyle(crestColor, 0.18);
    glow.fillCircle(56, 386, 18);
    drawCrest(this, 56, 386, 14, crestColor, this.dialogueData.tree.crestShape);

    this.speakerText = this.add.text(80, 380, "", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#d1616c",
      letterSpacing: 2,
    });
    this.lineText = this.add.text(80, 405, "", {
      fontFamily: "serif",
      fontSize: "17px",
      color: "#ece3ce",
      wordWrap: { width: 800 },
    });

    this.add
      .text(860, 560, "Esc — 대화에서 빠져나오기", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#6f6880",
      })
      .setOrigin(1, 0);

    // Esc는 항상 열려 있는 비상구다. 예전에는 어떤 노드가 버튼을 하나도 그리지 않으면
    // 대화 창에서 영영 빠져나올 수 없었다.
    this.escHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") this.closeDialogue();
    };
    window.addEventListener("keydown", this.escHandler);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());

    this.renderNode();
  }

  /** 한 번만 실행되도록 막아둔다 — 버튼과 Esc가 동시에 닫으려 할 수 있다. */
  private closeDialogue() {
    if (this.closed) return;
    this.closed = true;
    this.dialogueData.onClose();
    this.scene.stop();
  }

  private cleanup() {
    if (this.escHandler) {
      window.removeEventListener("keydown", this.escHandler);
      this.escHandler = undefined;
    }
    this.clearOptions();
  }

  private clearOptions() {
    this.optionObjects.forEach((o) => o.destroy());
    this.optionObjects = [];
  }

  /** 치명적인 갈래를 골랐을 때 — 대화를 닫지 않고 그대로 죽음으로 넘긴다. */
  private triggerLethal(reason: string) {
    if (this.closed) return;
    this.closed = true;
    this.dialogueData.onLethal?.(reason);
    this.scene.stop();
  }

  private renderNode() {
    this.clearOptions();
    const node = getNode(this.dialogueData.tree, this.currentNodeId);
    this.speakerText.setText(node.speaker.toUpperCase());
    this.lineText.setText(node.line);

    // 가면이 벗겨진 노드에서는 창 자체가 달라진다. 무엇이 위험한지는 말해주지 않는다.
    if (node.menace) {
      this.panel.setFillStyle(0x160a0c, 0.94).setStrokeStyle(1, 0x7c1f2b);
      this.speakerText.setColor("#e0707c");
      this.lineText.setColor("#f0d8d8");
    } else {
      this.panel.setFillStyle(0x0e0c09, 0.92).setStrokeStyle(1, 0x3a3225);
      this.speakerText.setColor("#d1616c");
      this.lineText.setColor("#ece3ce");
    }

    if (node.end) {
      const closeBtn = this.add.text(80, 560, "[ 대화 종료 ]", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#8fbfa4",
      }).setInteractive({ useHandCursor: true });
      closeBtn.on("pointerdown", () => this.closeDialogue());
      this.optionObjects.push(closeBtn);
      return;
    }

    if (node.choices) {
      node.choices.forEach((choice, i) => {
        // 부표를 지녔을 때만 위험 표식이 보인다. 없으면 겉보기로는 구분되지 않는다.
        const marked = this.dialogueData.revealDanger && choice.lethal;
        const btn = this.add.text(80, 460 + i * 26, `${marked ? "⚠" : "▸"} ${choice.label}`, {
          fontFamily: "serif",
          fontSize: "14px",
          color: marked ? "#e0707c" : "#cbbfa5",
        }).setInteractive({ useHandCursor: true });
        btn.on("pointerdown", () => {
          if (choice.lethal) {
            this.triggerLethal(choice.lethal);
            return;
          }
          if (choice.trustDelta) this.dialogueData.onTrustDelta(this.dialogueData.tree.npcId, choice.trustDelta);
          if (choice.flag) this.dialogueData.onFlag?.(choice.flag);
          this.currentNodeId = choice.next;
          this.renderNode();
        });
        this.optionObjects.push(btn);
      });
      return;
    }

    if (node.freeText) {
      this.lineText.setText(node.line + "\n\n" + node.freeText.prompt);
      this.createTextInput(node);
      return;
    }

    // 어떤 분기에도 걸리지 않는 노드 — 데이터가 잘못됐더라도 나갈 길은 남겨둔다.
    if (!node.next) {
      const bailBtn = this.add.text(80, 460, "▸ 자리를 뜬다", {
        fontFamily: "serif",
        fontSize: "14px",
        color: "#8fbfa4",
      }).setInteractive({ useHandCursor: true });
      bailBtn.on("pointerdown", () => this.closeDialogue());
      this.optionObjects.push(bailBtn);
      return;
    }

    if (node.next) {
      const nextBtn = this.add.text(80, 460, "▸ 계속", {
        fontFamily: "serif",
        fontSize: "14px",
        color: "#cbbfa5",
      }).setInteractive({ useHandCursor: true });
      nextBtn.on("pointerdown", () => {
        this.currentNodeId = node.next!;
        this.renderNode();
      });
      this.optionObjects.push(nextBtn);
    }
  }

  private createTextInput(node: ReturnType<typeof getNode>) {
    const inputEl = document.createElement("input");
    inputEl.type = "text";
    inputEl.placeholder = "직접 대사를 입력하세요…";
    inputEl.maxLength = 80;
    inputEl.style.width = "560px";
    inputEl.style.padding = "8px 10px";
    inputEl.style.background = "#1e1a13";
    inputEl.style.color = "#ece3ce";
    inputEl.style.border = "1px solid #3a3225";
    inputEl.style.fontFamily = "monospace";
    inputEl.style.fontSize = "13px";

    const dom = this.add.dom(80, 500, inputEl).setOrigin(0, 0);
    this.optionObjects.push(dom);

    const submitBtn = this.add.text(80, 530, "[ 전달 ]", {
      fontFamily: "monospace",
      fontSize: "13px",
      color: "#d1616c",
    }).setInteractive({ useHandCursor: true });
    this.optionObjects.push(submitBtn);

    const submit = () => {
      const value = inputEl.value.trim();
      if (!value) return;
      const result = evaluateFreeText(value, node);
      if (result.lethal) {
        this.triggerLethal(result.lethal);
        return;
      }
      if (result.trustDelta) this.dialogueData.onTrustDelta(this.dialogueData.tree.npcId, result.trustDelta);
      if (result.flag) this.dialogueData.onFlag?.(result.flag);
      this.currentNodeId = result.next;
      this.renderNode();
    };

    submitBtn.on("pointerdown", submit);
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });

    this.time.delayedCall(50, () => inputEl.focus());
  }
}
