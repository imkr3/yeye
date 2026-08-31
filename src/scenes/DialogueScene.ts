import Phaser from "phaser";
import {
  getNode,
  evaluateFreeText,
  type DialogueTree,
} from "../systems/DialogueSystem";

export interface DialogueSceneData {
  tree: DialogueTree;
  onTrustDelta: (npcId: string, delta: number) => void;
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

  constructor() {
    super("DialogueScene");
  }

  init(data: DialogueSceneData) {
    this.dialogueData = data;
    this.currentNodeId = data.tree.startNode;
  }

  create() {
    this.add.rectangle(480, 460, 860, 220, 0x0e0c09, 0.92).setStrokeStyle(1, 0x3a3225);
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

    this.renderNode();
  }

  private clearOptions() {
    this.optionObjects.forEach((o) => o.destroy());
    this.optionObjects = [];
  }

  private renderNode() {
    this.clearOptions();
    const node = getNode(this.dialogueData.tree, this.currentNodeId);
    this.speakerText.setText(node.speaker.toUpperCase());
    this.lineText.setText(node.line);

    if (node.end) {
      const closeBtn = this.add.text(80, 560, "[ 대화 종료 ]", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#8fbfa4",
      }).setInteractive({ useHandCursor: true });
      closeBtn.on("pointerdown", () => {
        this.dialogueData.onClose();
        this.scene.stop();
      });
      this.optionObjects.push(closeBtn);
      return;
    }

    if (node.choices) {
      node.choices.forEach((choice, i) => {
        const btn = this.add.text(80, 460 + i * 26, `▸ ${choice.label}`, {
          fontFamily: "serif",
          fontSize: "14px",
          color: "#cbbfa5",
        }).setInteractive({ useHandCursor: true });
        btn.on("pointerdown", () => {
          if (choice.trustDelta) this.dialogueData.onTrustDelta(this.dialogueData.tree.npcId, choice.trustDelta);
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
      if (result.trustDelta) this.dialogueData.onTrustDelta(this.dialogueData.tree.npcId, result.trustDelta);
      this.currentNodeId = result.next;
      this.renderNode();
    };

    submitBtn.on("pointerdown", submit);
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });

    this.time.delayedCall(50, () => inputEl.focus());
  }

  shutdown() {
    this.optionObjects.forEach((o) => o.destroy());
  }
}
