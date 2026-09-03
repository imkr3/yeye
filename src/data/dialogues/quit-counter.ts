import type { DialogueTree } from "../../systems/DialogueSystem";

/**
 * 셈을 그만둔 사람 — 한때 「셋을 세는 입」과 계약할 뻔했던 사람. 전부 새로 쓴 원고.
 *
 * 역할: 위험한 상대에 대한 정보를 주는 자리. 다만 공짜로 주지 않고,
 * 플레이어가 무엇을 겪었는지에 따라 다르게 말한다.
 */
export const quitCounterDialogue: DialogueTree = {
  npcId: "quit-counter",
  crestColor: 0xbfa87e,
  crestShape: "zigzag",
  startNode: "greet",
  nodes: {
    greet: {
      id: "greet",
      speaker: "셈을 그만둔 사람",
      line:
        "손가락을 접었다 폈다 하다가, 당신을 보고 멈춘다. " +
        "\"…아, 미안해요. 버릇이라서.\"",
      choices: [
        { label: "\"무엇을 세고 계셨습니까.\"", next: "what-counting", trustDelta: 4 },
        { label: "\"시장에서 비슷한 걸 봤습니다.\"", next: "knows-it", trustDelta: 7 },
        { label: "지나친다.", next: "leave" },
      ],
    },

    "what-counting": {
      id: "what-counting",
      speaker: "셈을 그만둔 사람",
      line:
        "아무것도요. 진짜로 아무것도. 그런데 손이 계속 세요. " +
        "한때 세 번까지 갔거든요. 세 번째에서 멈췄고요.",
      next: "knows-it",
    },

    "knows-it": {
      id: "knows-it",
      speaker: "셈을 그만둔 사람",
      line:
        "그럼 봤겠네요. 앉아 있는 거. …그거하고 얘기할 땐 대답을 세지 마세요. " +
        "세는 건 그쪽이 아니라 저쪽 일이니까.",
      choices: [
        {
          label: "\"어떻게 빠져나오셨습니까.\"",
          next: "how-escaped",
          trustDelta: 6,
          flag: "learned-counting-trick",
        },
        { label: "\"고맙습니다.\"", next: "leave" },
      ],
    },

    "how-escaped": {
      id: "how-escaped",
      speaker: "셈을 그만둔 사람",
      line:
        "되물었어요. \"방금 뭘 세셨습니까?\" 하고. " +
        "물어본 사람하고는 계약이 안 된대요. 규칙이 그렇다더군요. " +
        "…규칙이 있다는 게 제일 무서웠어요.",
      end: true,
    },

    leave: {
      id: "leave",
      speaker: "(당신)",
      line: "돌아선다. 뒤에서 다시 손가락 접는 소리가 난다. 하나, 둘.",
      end: true,
    },
  },
};
