import type { DialogueTree } from "../../systems/DialogueSystem";

/**
 * 말없는 순례자 — 침수 회랑에 무릎 꿇고 있는 것. 전부 새로 쓴 원고.
 *
 * 설계 의도:
 * - 앞의 둘이 "무엇을 말하는가"와 "몇 번 말하는가"였다면, 이쪽은 "말을 거는가"다.
 *   보통 RPG에서 NPC에게 말을 거는 건 언제나 이득이다. 여기서만 그 습관이 손해다.
 * - 그래서 경고를 아주 두껍게 깔았다. 꿰맨 입, 못 박힌 판자, 물러날 선택지가
 *   항상 첫 줄에 있다. 한 번 말을 걸어도 죽지 않고 경고만 받는다 — 기회는 두 번 준다.
 * - 두 번째로 말을 걸면 자유 입력으로 넘어가고, 거기서는 기본 갈래가 치명적이다.
 *   다만 사과하고 물러나는 말은 살길로 열어뒀다. 알아내면 살고, 우기면 죽는다.
 */

const BROKEN_SILENCE =
  "침묵을 두 번 깼다. 순례자의 실밥이 풀리고, 대신 당신의 입이 닫혔다.";

export const silentPilgrimDialogue: DialogueTree = {
  npcId: "silent-pilgrim",
  crestColor: 0x3d4a7c, // 연(緣) — 맺은 것을 지키는 쪽
  crestShape: "zigzag",
  startNode: "greet",
  nodes: {
    greet: {
      id: "greet",
      speaker: "(당신)",
      line:
        "무릎 꿇은 사람. 고개는 들지 않는다. 입술이 굵은 실로 꿰매져 있다. " +
        "앞에 못 박힌 판자가 하나 세워져 있다.",
      choices: [
        { label: "그냥 지나간다.", next: "pass" },
        { label: "판자를 읽는다.", next: "read-sign" },
        { label: "말을 건다.", next: "spoke-once" },
      ],
    },

    "read-sign": {
      id: "read-sign",
      speaker: "판자",
      line:
        "「말을 걸지 마시오. 대답하려 들 것입니다. 대답하면 실이 풀립니다. " +
        "풀린 실은 반드시 다른 입을 찾습니다.」",
      choices: [
        { label: "지나간다.", next: "pass" },
        { label: "그래도 말을 건다.", next: "spoke-once" },
      ],
    },

    "spoke-once": {
      id: "spoke-once",
      speaker: "말없는 순례자",
      line:
        "고개가 아주 천천히 올라온다. 실밥이 팽팽해진다. " +
        "대답하려는 것이다. 대답하지 못하게 꿰맨 입으로.",
      menace: true,
      choices: [
        { label: "물러난다.", next: "backed-off" },
        { label: "한 번 더 말을 건다.", next: "spoke-twice" },
      ],
    },

    "spoke-twice": {
      id: "spoke-twice",
      speaker: "말없는 순례자",
      line: "실 하나가 끊어졌다. 입이 조금 열린다. 무언가 나오려 한다.",
      menace: true,
      freeText: {
        prompt: "무어라 말하겠습니까.",
        branches: [
          {
            // 물러나겠다는 뜻이 담긴 말만 살길이다.
            keywords: ["미안", "죄송", "실례", "그만", "조용", "아무것도", "됐"],
            next: "apology",
          },
        ],
        fallback: { next: "greet", lethal: BROKEN_SILENCE },
      },
    },

    apology: {
      id: "apology",
      speaker: "(당신)",
      line:
        "말을 삼키고 한 걸음 물러난다. 끊어진 실 끝이 허공에서 잠깐 흔들리다가, " +
        "다시 제자리를 찾아 스스로 꿰맨다. 순례자의 고개가 도로 내려간다.",
      flagOnEnter: "spared-by-silent-pilgrim",
      end: true,
    },

    "backed-off": {
      id: "backed-off",
      speaker: "(당신)",
      line: "한 걸음 물러난다. 실밥이 느슨해지고, 고개가 다시 내려간다.",
      end: true,
    },

    pass: {
      id: "pass",
      speaker: "(당신)",
      line:
        "지나간다. 등 뒤에서 아무 소리도 나지 않는다. " +
        "한참 뒤에야, 그게 얼마나 다행인지 알게 된다.",
      end: true,
    },
  },
};
