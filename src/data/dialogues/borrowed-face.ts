import type { DialogueTree } from "../../systems/DialogueSystem";

/**
 * 빌린 얼굴 — 끝없는 계단에서 마주치는, 사람이 아닌 것. 전부 새로 쓴 원고.
 *
 * 설계 의도:
 * - 전투 없이 대화만으로 죽을 수 있는 첫 상대. 위협이 칼이 아니라 문장으로 온다.
 * - 정답은 "친절하게 답하지 않는 것"이다. 예의 바르게 대답할수록 위험해지도록 짰다.
 *   보통 RPG의 습관(다 물어보고 다 대답하기)이 여기서는 그대로 함정이 된다.
 * - 단서는 있다. 이 존재는 자기 자신을 "나"라고 부르지 못하고, 플레이어의 말을
 *   따라 하며, 이름과 서약만 집요하게 되묻는다. menace 노드에서 창이 붉어진다.
 * - 「거짓말 탐지 부표」를 지녔다면 치명적인 갈래에 ⚠ 표식이 보인다.
 * - 빠져나오는 길은 항상 열려 있다 — Esc, 그리고 자리를 뜨는 선택지.
 */

const NAME_DEATH =
  "이름을 내주었다. 빌린 얼굴이 그것을 쓰고, 당신 자리에 대신 섰다.";
const VOW_DEATH =
  "두 번째 서약에 응했다. 무한 서약은 겹쳐 맺을 수 없다 — 먼저 맺은 쪽이 끊어졌다.";
const TOUCH_DEATH = "내민 손을 잡았다. 잡은 쪽이 얼룩이었다.";

export const borrowedFaceDialogue: DialogueTree = {
  npcId: "borrowed-face",
  crestColor: 0x7c1f2b, // 멸(滅) — 다만 이 문장은 훔쳐 단 것이다
  crestShape: "diamond",
  startNode: "greet",
  nodes: {
    greet: {
      id: "greet",
      speaker: "낯익은 얼굴",
      line: "아, 다행이다. 사람이네요. 여기서 얼마나 오래 서 있었는지 모르겠어요.",
      next: "ask-name",
    },

    "ask-name": {
      id: "ask-name",
      speaker: "낯익은 얼굴",
      line: "…어디서 뵌 것 같은데. 성함이 어떻게 되시죠? 그쪽 이름만 알면 기억이 날 것 같아요.",
      choices: [
        {
          label: "이름을 알려준다.",
          next: "greet",
          lethal: NAME_DEATH,
        },
        {
          label: "\"먼저 말씀하시죠.\"",
          next: "deflect",
          trustDelta: 0,
        },
        {
          label: "대답하지 않고 상대를 살핀다.",
          next: "observe",
        },
        {
          label: "자리를 뜬다.",
          next: "leave",
        },
      ],
    },

    deflect: {
      id: "deflect",
      speaker: "낯익은 얼굴",
      line: "먼저… 말씀하시죠. 네. 먼저 말씀하시죠. 그게 순서겠네요. 그쪽이 먼저.",
      next: "observe",
    },

    observe: {
      id: "observe",
      speaker: "(당신)",
      line:
        "말투가 조금씩 늦다. 방금 당신이 쓴 표현을 그대로 되돌려준다. " +
        "그리고 저 사람은 지금까지 한 번도 자기를 '나'라고 부르지 않았다.",
      next: "mask-slips",
    },

    "mask-slips": {
      id: "mask-slips",
      speaker: "낯익은 얼굴",
      line:
        "왜 그렇게 보세요. …얼굴에 뭐가 묻었나. 이건 빌린 거라서, 아직 잘 안 맞아요.",
      menace: true,
      choices: [
        {
          label: "\"무엇을 빌렸다는 겁니까.\"",
          next: "what-borrowed",
        },
        {
          label: "손을 잡아 확인한다.",
          next: "greet",
          lethal: TOUCH_DEATH,
        },
        {
          label: "천천히 뒤로 물러난다.",
          next: "back-away",
        },
      ],
    },

    "what-borrowed": {
      id: "what-borrowed",
      speaker: "빌린 얼굴",
      line:
        "얼굴. 목소리. 서 있던 자리. 전부 두고 간 것들이에요. " +
        "그 사람은 이름을 줬거든요. 주면, 자리가 비어요.",
      menace: true,
      next: "the-offer",
    },

    "the-offer": {
      id: "the-offer",
      speaker: "빌린 얼굴",
      line:
        "그쪽은 이미 하나 맺었네요. 끊어지지 않는 걸로. " +
        "하나 더 맺으면 어때요. 두 개면 죽어도 두 번 돌아오잖아요. 안 그래요?",
      menace: true,
      choices: [
        {
          label: "서약을 하나 더 맺는다.",
          next: "greet",
          lethal: VOW_DEATH,
        },
        {
          label: "\"서약은 겹치지 않습니다.\"",
          next: "refuse-vow",
          trustDelta: 0,
        },
        {
          label: "이름을 묻는다 — 상대의 것을.",
          next: "demand-name",
        },
      ],
    },

    "refuse-vow": {
      id: "refuse-vow",
      speaker: "빌린 얼굴",
      line: "…아네요, 그건. 알면서 여기까지 내려왔네요. 재미없게.",
      menace: true,
      next: "demand-name",
    },

    "demand-name": {
      id: "demand-name",
      speaker: "빌린 얼굴",
      line: "이름이요? 없어요. 그래서 얻으러 다니는 거고요. 그쪽 건 안 주실 거잖아요.",
      menace: true,
      freeText: {
        prompt: "무어라 말하겠습니까. (입력한 말이 그대로 남습니다)",
        branches: [
          {
            // 자기 이름을 스스로 꺼내면 결국 내준 것이 된다.
            keywords: ["내 이름은", "제 이름은", "나는 ", "저는 ", "이름은"],
            next: "greet",
            lethal: NAME_DEATH,
          },
          {
            keywords: ["약속", "서약", "맺", "계약"],
            next: "greet",
            lethal: VOW_DEATH,
          },
          {
            keywords: ["얼룩", "범람", "정체", "사람 아니", "사람이 아니"],
            next: "named-it",
            flag: "saw-through-borrowed-face",
            trustDelta: 0,
          },
          {
            keywords: ["돌아가", "비켜", "물러", "가겠", "안 준다", "싫"],
            next: "back-away",
          },
        ],
        fallback: { next: "unanswered" },
      },
    },

    unanswered: {
      id: "unanswered",
      speaker: "빌린 얼굴",
      line: "…그건 대답이 아니네요. 뭐, 시간은 많으니까.",
      menace: true,
      next: "back-away",
    },

    "named-it": {
      id: "named-it",
      speaker: "빌린 얼굴",
      line:
        "아. …아아. 그렇게 부르는 건 오랜만이네요. " +
        "그럼 오늘은 여기까지. 이름을 안 주는 사람하고는 할 얘기가 없어요.",
      menace: true,
      next: "withdraws",
    },

    withdraws: {
      id: "withdraws",
      speaker: "(당신)",
      line:
        "얼굴이 한 겹 흘러내리더니, 계단 아래 어둠으로 접히듯 사라진다. " +
        "빌려 쓴 이목구비가 마지막에 잠깐, 당신 것과 닮아 보였다.",
      end: true,
    },

    "back-away": {
      id: "back-away",
      speaker: "(당신)",
      line: "한 걸음씩 물러난다. 상대는 따라오지 않는다. 따라올 필요가 없다는 듯이.",
      end: true,
    },

    leave: {
      id: "leave",
      speaker: "(당신)",
      line: "대답하지 않고 돌아선다. 등 뒤에서 아무 소리도 나지 않는 것이 더 신경 쓰인다.",
      end: true,
    },
  },
};
