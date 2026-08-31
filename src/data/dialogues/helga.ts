import type { DialogueTree } from "../../systems/DialogueSystem";

/**
 * 헬가 도른 — 서리 관측소, 첫 강적이자 최종 분기 NPC. 전부 새로 쓴 원고.
 * 설득/제압 분기 이후, 서약을 어떻게 할 것인지 최종 선택으로 이어진다.
 * 여기서 세워지는 스토리 플래그가 EndingSystem의 엔딩 판정 재료가 된다.
 */
export const helgaDialogue: DialogueTree = {
  npcId: "helga",
  crestColor: 0xa8873a, // 성(聖) 계통
  crestShape: "triangle",
  startNode: "greet",
  nodes: {
    greet: {
      id: "greet",
      speaker: "헬가 도른",
      line: "당신도 결국 예측 가능한 변수 중 하나로 끝나겠죠. 아니라면, 증명해보세요.",
      next: "confront",
    },
    confront: {
      id: "confront",
      speaker: "헬가 도른",
      line: "어떻게 증명할 건가요?",
      choices: [
        { label: "설득한다 — 당신의 모델은 틀렸다", next: "persuade-path", flag: "confront-persuade" },
        { label: "제압한다 — 말이 아니라 결과로 보여준다", next: "defeat-path", flag: "confront-defeat" },
      ],
    },
    "persuade-path": {
      id: "persuade-path",
      speaker: "헬가 도른",
      line: "말해보세요. 내 모델의 어디가, 왜 틀렸다는 거죠?",
      freeText: {
        prompt: "헬가의 예측 모델이 왜 틀렸는지 직접 입력하세요.",
        branches: [
          {
            keywords: ["변수", "예외", "우연", "변칙"],
            next: "persuade-success",
            trustDelta: 2,
            flag: "ally-helga",
          },
          {
            keywords: ["틀렸", "실패", "오류", "한계"],
            next: "persuade-partial",
            trustDelta: 1,
          },
        ],
        fallback: { next: "persuade-fail", trustDelta: -1 },
      },
    },
    "persuade-success": {
      id: "persuade-success",
      speaker: "헬가 도른",
      line: "…실험 오차라 부르기엔, 당신은 꽤 여러 번 그랬군요. 좋아요, 곁에 둬볼게요.",
      next: "final-choice",
    },
    "persuade-partial": {
      id: "persuade-partial",
      speaker: "헬가 도른",
      line: "반박치고는 얕지만, 아예 틀린 말은 아니네요.",
      next: "final-choice",
    },
    "persuade-fail": {
      id: "persuade-fail",
      speaker: "헬가 도른",
      line: "증명이 아니라 변명이군요. 실망이에요.",
      next: "final-choice",
    },
    "defeat-path": {
      id: "defeat-path",
      speaker: "헬가 도른",
      line: "결과로 증명한다, 라. 좋아요, 해보죠.",
      next: "defeat-result",
    },
    "defeat-result": {
      id: "defeat-result",
      speaker: "헬가 도른",
      line: "…예상보다 오래 버텼네요. 인정할게요, 이번만은.",
      next: "final-choice",
    },
    "final-choice": {
      id: "final-choice",
      speaker: "헬가 도른",
      line: "이제 묻죠. 당신은 그 회귀를, 계속 짊어질 건가요?",
      choices: [
        { label: "서약을 스스로 놓아버린다", next: "ending-worn-vow", flag: "abandon-vow" },
        { label: "이 힘을 온전히 받아들인다 — 대가가 무엇이든", next: "ending-overflow", flag: "embrace-overflow" },
        { label: "아직은 답할 수 없다", next: "ending-open" },
      ],
    },
    "ending-worn-vow": {
      id: "ending-worn-vow",
      speaker: "헬가 도른",
      line: "…그것도 답이겠죠. 무겁게 산 만큼, 가볍게 놓아도 돼요.",
      end: true,
    },
    "ending-overflow": {
      id: "ending-overflow",
      speaker: "헬가 도른",
      line: "돌이킬 수 없을 텐데. …마음대로 하세요.",
      end: true,
    },
    "ending-open": {
      id: "ending-open",
      speaker: "헬가 도른",
      line: "그럼 됐어요. '아직은'이라는 말도, 나쁘지 않네요.",
      end: true,
    },
  },
};
