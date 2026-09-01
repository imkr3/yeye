import type { DialogueTree } from "../../systems/DialogueSystem";

/**
 * 셋을 세는 입 — 재의 시장 구석에 앉은 것. 전부 새로 쓴 원고.
 *
 * 설계 의도:
 * - 「빌린 얼굴」이 "무엇을 말하면 죽는가"였다면, 이쪽은 "몇 번 말했는가"다.
 *   한 마디 한 마디는 전부 안전하다. 세 번 연속 동의하는 순간에만 죽는다.
 * - 그래서 단서를 문장 안에 그대로 박아뒀다. 이 존재는 동의를 받을 때마다
 *   "하나", "둘" 하고 소리 내어 센다. 읽고 있으면 반드시 보인다.
 * - 한 번이라도 거절하거나 되물으면 셈이 끊기고 상대는 흥미를 잃는다.
 *   빠져나오는 데 지식이 필요하지 않다 — 주의력만 있으면 된다.
 * - 묻는 내용은 전부 하찮다. "하찮은 것에 동의를 모으는 상대"라는 점이
 *   두 번째 단서다.
 */

const SEALED =
  "세 번 그렇다고 했다. 세 번이면 계약이다. 무엇에 동의했는지는 끝내 듣지 못했다.";

export const countingMouthDialogue: DialogueTree = {
  npcId: "counting-mouth",
  crestColor: 0xa8873a, // 성(聖) — 계약을 다루는 것들의 색을 빌렸다
  crestShape: "triangle",
  startNode: "greet",
  nodes: {
    greet: {
      id: "greet",
      speaker: "셋을 세는 입",
      line:
        "앉으세요. 서 있으면 다리가 아프죠. …아프죠?",
      choices: [
        { label: "\"아프죠.\"", next: "one" },
        { label: "\"괜찮습니다.\"", next: "refused" },
        { label: "\"무엇을 파는 겁니까.\"", next: "what-sold" },
        { label: "자리를 뜬다.", next: "leave" },
      ],
    },

    "what-sold": {
      id: "what-sold",
      speaker: "셋을 세는 입",
      line:
        "파는 건 없어요. 사는 쪽이에요. 아주 사소한 것만. …사소한 건 괜찮잖아요?",
      choices: [
        { label: "\"괜찮죠.\"", next: "one" },
        { label: "\"사소한 것도 값은 값입니다.\"", next: "refused" },
        { label: "자리를 뜬다.", next: "leave" },
      ],
    },

    one: {
      id: "one",
      speaker: "셋을 세는 입",
      line:
        "하나. …여긴 재가 참 많이 날리죠. 숨쉬기 나쁘고. 그렇죠?",
      choices: [
        { label: "\"그렇죠.\"", next: "two" },
        { label: "\"방금 뭘 세셨습니까.\"", next: "caught" },
        { label: "\"글쎄요.\"", next: "refused" },
      ],
    },

    two: {
      id: "two",
      speaker: "셋을 세는 입",
      line:
        "둘. …그리고 당신은 여기 오래 있을 사람이 아니에요. 곧 갈 거고. 맞죠?",
      menace: true,
      choices: [
        { label: "\"맞습니다.\"", next: "greet", lethal: SEALED },
        { label: "\"셋을 세고 있군요.\"", next: "caught" },
        { label: "\"아닙니다.\"", next: "refused" },
        { label: "대답하지 않고 일어선다.", next: "leave" },
      ],
    },

    caught: {
      id: "caught",
      speaker: "셋을 세는 입",
      line:
        "…세고 있었죠. 늘 세요. 대부분은 끝까지 안 물어봐요. " +
        "물어본 사람하고는 계약이 안 돼요. 규칙이 그래요.",
      menace: true,
      choices: [
        {
          label: "\"무슨 계약입니까.\"",
          next: "explains",
          flag: "saw-through-counting-mouth",
        },
        { label: "자리를 뜬다.", next: "leave" },
      ],
    },

    explains: {
      id: "explains",
      speaker: "셋을 세는 입",
      line:
        "세 번 그렇다고 하면 그렇다고 한 거예요. 무엇에? 그건 안 정해뒀어요. " +
        "나중에 정하죠. 그게 좋은 계약이에요 — 한쪽한테만.",
      next: "loses-interest",
    },

    refused: {
      id: "refused",
      speaker: "셋을 세는 입",
      line: "…아. 그럼 처음부터. 아니, 됐어요. 오늘은 셈이 잘 안 붙는 날이네요.",
      next: "loses-interest",
    },

    "loses-interest": {
      id: "loses-interest",
      speaker: "(당신)",
      line:
        "입이 다물린다. 그 뒤로는 무슨 말을 걸어도 셈을 다시 시작하지 않는다. " +
        "재가 그 위로 천천히 쌓인다.",
      end: true,
    },

    leave: {
      id: "leave",
      speaker: "(당신)",
      line: "등을 돌린다. 뒤에서 \"하나\" 하는 소리가 한 번 더 들렸지만, 돌아보지 않는다.",
      end: true,
    },
  },
};
