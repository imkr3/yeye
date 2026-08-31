import type { DialogueTree } from "../../systems/DialogueSystem";

/**
 * 이스라 — 침수 회랑 튜토리얼 NPC의 첫 대화 트리.
 * 설계 문서 09/11번 섹션의 예시 대화를 실제 데이터로 옮긴 것. 전부 새로 쓴 원고.
 */
export const israDialogue: DialogueTree = {
  npcId: "isra",
  crestColor: 0x4c6e5c, // 생(生) 계통
  startNode: "greet",
  nodes: {
    greet: {
      id: "greet",
      speaker: "이스라",
      line: "몇 번째죠, 당신은. 이 회랑에서 죽은 사람 중에.",
      next: "ask-feeling",
    },
    "ask-feeling": {
      id: "ask-feeling",
      speaker: "이스라",
      line: "여기 남은 사람들은 다들 똑같은 표정을 지어요. 당신은 뭐라고 답할래요?",
      freeText: {
        prompt: "이스라에게 할 말을 직접 입력하세요.",
        branches: [
          {
            keywords: ["미안", "사과", "잘못"],
            next: "apology-response",
            trustDelta: 1,
          },
          {
            keywords: ["이유", "진실", "왜", "궁금"],
            next: "curious-response",
            trustDelta: 0,
          },
          {
            keywords: ["상관없", "됐어", "필요없"],
            next: "cold-response",
            trustDelta: -1,
          },
        ],
        fallback: { next: "neutral-response", trustDelta: 0 },
      },
    },
    "apology-response": {
      id: "apology-response",
      speaker: "이스라",
      line: "…사과할 사람이 아직 남아있다는 걸, 오랜만에 느끼네요.",
      next: "hint",
    },
    "curious-response": {
      id: "curious-response",
      speaker: "이스라",
      line: "궁금하다니, 오랜만에 듣는 말이네요. 이 회랑은 원래 이렇지 않았어요.",
      next: "hint",
    },
    "cold-response": {
      id: "cold-response",
      speaker: "이스라",
      line: "…그렇군요. 그럼 서두르세요. 여기, 오래 있을 곳은 아니니까.",
      next: "hint",
    },
    "neutral-response": {
      id: "neutral-response",
      speaker: "이스라",
      line: "말을 고르는군요. 나쁘지 않아요, 그것도.",
      next: "hint",
    },
    hint: {
      id: "hint",
      speaker: "이스라",
      line: "한 가지는 알려줄게요 — 이 회랑은 한 번 겪은 위험을 기억해요. 당신이 아니라, 이 물이.",
      end: true,
    },
  },
};
