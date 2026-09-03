import type { DialogueTree } from "../../systems/DialogueSystem";

/**
 * 되돌아온 이름 — 경계문 앞에 서 있는 것. 전부 새로 쓴 원고.
 *
 * 네 번째 죽는 방식: **거짓말하면 죽는다.**
 * - 「빌린 얼굴」은 진실(이름)을 주면 죽었다. 이쪽은 정반대다.
 * - 이 존재는 이미 답을 알고 있고, 확인만 한다. 둘러대거나 모른 척하면 그 자리에서 끝난다.
 * - 그래서 앞의 상대들에게서 배운 습관("이름을 주지 마라", "적당히 넘겨라")이
 *   여기서는 그대로 함정이 된다. 배운 것을 언제 버려야 하는지가 이 상대의 시험이다.
 * - 단서: 이 존재는 묻지 않는다. 전부 단정해서 말한다 — 이미 아는 것을 확인하는 말투다.
 */

const LIE_DEATH =
  "이미 알고 있는 것에 거짓을 얹었다. 경계문은 어긋난 이름을 통과시키지 않는다.";
const SILENCE_DEATH =
  "끝내 아무것도 인정하지 않았다. 인정하지 않은 것은 지나갈 수 없다.";

export const returnedNameDialogue: DialogueTree = {
  npcId: "returned-name",
  crestColor: 0xb85a66,
  crestShape: "dual-ring",
  startNode: "greet",
  nodes: {
    greet: {
      id: "greet",
      speaker: "되돌아온 이름",
      line:
        "문 앞에 선 것이 고개를 든다. 얼굴이랄 것이 없는데도 " +
        "당신을 정확히 보고 있다는 느낌이 든다.",
      next: "states",
    },

    states: {
      id: "states",
      speaker: "되돌아온 이름",
      line:
        "너는 여기 처음이 아니다. 나는 묻지 않는다. 이미 세었다.",
      menace: true,
      choices: [
        {
          label: "\"…맞습니다. 처음이 아닙니다.\"",
          next: "admits",
          trustDelta: 6,
        },
        {
          label: "\"처음입니다.\"",
          next: "greet",
          lethal: LIE_DEATH,
        },
        {
          label: "\"무슨 말인지 모르겠습니다.\"",
          next: "greet",
          lethal: LIE_DEATH,
        },
        { label: "대답하지 않는다.", next: "silence" },
      ],
    },

    silence: {
      id: "silence",
      speaker: "되돌아온 이름",
      line:
        "침묵도 답이다. 다만 지나갈 수 있는 답은 아니다. 한 번 더 묻지 않겠다.",
      menace: true,
      choices: [
        { label: "\"…맞습니다. 여러 번 왔습니다.\"", next: "admits", trustDelta: 4 },
        { label: "끝까지 말하지 않는다.", next: "greet", lethal: SILENCE_DEATH },
        { label: "물러난다.", next: "backed-off" },
      ],
    },

    admits: {
      id: "admits",
      speaker: "되돌아온 이름",
      line:
        "좋다. 어긋나지 않았다. …다른 것들은 너에게 이름을 주지 말라 했겠지. " +
        "그것들은 이름을 훔치려 했으니까. 나는 훔치지 않는다. 대조할 뿐이다.",
      menace: true,
      next: "asks-count",
    },

    "asks-count": {
      id: "asks-count",
      speaker: "되돌아온 이름",
      line: "몇 번이었는지 말해라. 틀린 수를 말하면 그것도 거짓이다.",
      menace: true,
      freeText: {
        prompt: "무어라 답하겠습니까. (정확히 모르면 모른다고 하는 편이 낫습니다)",
        branches: [
          {
            // 모른다고 인정하는 것은 거짓이 아니다.
            keywords: ["모르", "세지 않", "안 세", "기억 안", "잊었", "많이", "여러"],
            next: "accepts-unknown",
            trustDelta: 8,
            flag: "passed-the-boundary-name",
          },
          {
            // 단정적으로 숫자를 말하는 것은 위험하다 — 이 존재는 실제 수를 안다.
            keywords: ["한 번", "1번", "두 번", "2번", "세 번", "3번", "처음"],
            next: "greet",
            lethal: LIE_DEATH,
          },
        ],
        fallback: { next: "accepts-unknown", trustDelta: 3 },
      },
    },

    "accepts-unknown": {
      id: "accepts-unknown",
      speaker: "되돌아온 이름",
      line:
        "모른다는 것은 참이다. 참은 지나갈 수 있다. " +
        "…문은 열려 있었다. 처음부터. 막고 있던 것은 나뿐이다.",
      next: "steps-aside",
    },

    "steps-aside": {
      id: "steps-aside",
      speaker: "(당신)",
      line:
        "그것이 옆으로 비켜선다. 지나가는 동안 아무 말도 하지 않는다. " +
        "뒤를 돌아봤을 때, 서 있던 자리에는 아무것도 없다.",
      end: true,
    },

    "backed-off": {
      id: "backed-off",
      speaker: "(당신)",
      line: "물러난다. 그것은 따라오지 않는다. 문은 여전히 그 뒤에 있다.",
      end: true,
    },
  },
};
