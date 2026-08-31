import type { DialogueTree } from "../../systems/DialogueSystem";

/**
 * 모른 — 끝없는 계단의 계단지기. 전부 새로 쓴 원고.
 * 세계관 규칙상 회귀를 발설하면 페널티가 발동하지만, 모른은 그 규칙 바깥에
 * 있는 듯한 존재로 설계해 — 플레이어가 처음으로 "그 이야기"를 마음 놓고
 * 꺼낼 수 있는 자리로 기능한다.
 */
export const morenDialogue: DialogueTree = {
  npcId: "moren",
  crestColor: 0x8c8168, // 계통 불명 — 중립 회색
  crestShape: "zigzag",
  startNode: "greet",
  nodes: {
    greet: {
      id: "greet",
      speaker: "모른",
      line: "몇 번째죠, 당신. …아니, 그건 여기서는 묻지 않기로 했죠.",
      next: "explain-role",
    },
    "explain-role": {
      id: "explain-role",
      speaker: "모른",
      line: "나는 이 계단을 세요. 오르는 사람도, 내려가는 사람도, 몇 번째로 지나가는지도.",
      freeText: {
        prompt: "모른에게 묻고 싶은 것을 직접 입력하세요.",
        branches: [
          {
            keywords: ["회귀", "되풀이", "몇번째", "돌아", "반복"],
            next: "acknowledge-loop",
            trustDelta: 1,
            flag: "met-moren",
          },
          {
            keywords: ["계단", "여기", "정체", "당신"],
            next: "about-stairs",
            flag: "met-moren",
          },
        ],
        fallback: { next: "neutral-moren", flag: "met-moren" },
      },
    },
    "acknowledge-loop": {
      id: "acknowledge-loop",
      speaker: "모른",
      line: "말해도 괜찮아요, 나한테는. 나는 그 규칙 바깥에 있거든요 — 아마도.",
      next: "farewell",
    },
    "about-stairs": {
      id: "about-stairs",
      speaker: "모른",
      line: "이 계단엔 끝이 없어요. 다만 그게 꼭 나쁜 것만은 아니죠 — 잃어버린 걸 다시 주울 기회이기도 하니까.",
      next: "farewell",
    },
    "neutral-moren": {
      id: "neutral-moren",
      speaker: "모른",
      line: "말하지 않아도 돼요. 그것도 답이니까요.",
      next: "farewell",
    },
    farewell: {
      id: "farewell",
      speaker: "모른",
      line: "더 물을 게 없다면, 돌아가도 좋아요.",
      choices: [{ label: "돌아간다", next: "end-moren" }],
    },
    "end-moren": {
      id: "end-moren",
      speaker: "모른",
      line: "다시 오르든, 다시 내려가든 — 난 여기서 세고 있을게요.",
      end: true,
    },
  },
};
