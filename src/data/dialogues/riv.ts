import type { DialogueTree } from "../../systems/DialogueSystem";

/**
 * 리브 칸 — 재의 시장 정보 브로커의 대화 트리. 전부 새로 쓴 원고.
 * 자유 입력 하나로 "정직/회피"가 갈리고, 그 결과가 신뢰도와 스토리 플래그에 남는다.
 */
export const rivDialogue: DialogueTree = {
  npcId: "riv",
  crestColor: 0x3d4a7c, // 연(緣) 계통
  crestShape: "diamond",
  startNode: "greet",
  nodes: {
    greet: {
      id: "greet",
      speaker: "리브 칸",
      line: "여진화 없이 여긴 온 거예요? 그럼 대신 뭘 들고 왔죠.",
      next: "ask-purpose",
    },
    "ask-purpose": {
      id: "ask-purpose",
      speaker: "리브 칸",
      line: "됐고, 하나만 답해요. 여기 온 진짜 이유가 뭐예요?",
      freeText: {
        prompt: "리브 칸에게 진짜 이유를 직접 입력하세요.",
        branches: [
          {
            keywords: ["진실", "사실", "솔직", "정보"],
            next: "honest-response",
            trustDelta: 1,
            flag: "riv-honest",
          },
          {
            keywords: ["비밀", "말못", "몰라도"],
            next: "evasive-response",
            trustDelta: -1,
          },
        ],
        fallback: { next: "neutral-response", trustDelta: 0 },
      },
    },
    "honest-response": {
      id: "honest-response",
      speaker: "리브 칸",
      line: "…드물게 보네요, 여기서 그런 표정 짓는 사람. 조금은 믿어보죠.",
      next: "offer",
    },
    "evasive-response": {
      id: "evasive-response",
      speaker: "리브 칸",
      line: "숨기고 싶은 게 있나 보네요. 그럼 나도 값을 더 부를게요.",
      next: "offer",
    },
    "neutral-response": {
      id: "neutral-response",
      speaker: "리브 칸",
      line: "말을 아끼는 편이군요. 나쁘진 않아요, 그것도 정보니까.",
      next: "offer",
    },
    offer: {
      id: "offer",
      speaker: "리브 칸",
      line: "서리 관측소로 가려는 거면, 하나만 알아두세요 — 거긴 말로 안 되는 사람이 있어요.",
      choices: [
        { label: "고맙다고 답하고 떠난다", next: "end-thanks", trustDelta: 1 },
        { label: "말없이 돌아선다", next: "end-silent" },
      ],
    },
    "end-thanks": {
      id: "end-thanks",
      speaker: "리브 칸",
      line: "…다음에 또 봐요, 계약자님.",
      end: true,
    },
    "end-silent": {
      id: "end-silent",
      speaker: "리브 칸",
      line: "그래요, 마음 내키면 다시 와요.",
      end: true,
    },
  },
};
