import type { DialogueTree } from "../../systems/DialogueSystem";

/**
 * 재를 지고 가는 사람 — 끝없는 계단을 올라가는 사람. 전부 새로 쓴 원고.
 *
 * 설계 의도 (중요):
 * - 이 사람은 절대 플레이어를 죽이지 않는다. 치명적인 갈래가 하나도 없다.
 * - 하지만 처음에는 「빌린 얼굴」보다 더 무섭게 보이도록 짰다. 얼굴을 싸맸고,
 *   자루에서 재가 흐르고, menace 노드도 있다.
 * - 이유: 위험한 상대만 계속 늘리면 플레이어는 "수상하면 도망"이라는 한 가지
 *   답을 배우고, 그 순간 이 시스템은 죽는다. 무서운 것과 해로운 것이 다르다는
 *   반례가 최소 하나는 있어야 경계 자체가 의미를 갖는다.
 * - 무례하게 굴어도 죽지 않는다. 다만 이 사람은 조용히 떠나고, 얻을 수 있었던
 *   것을 잃는다. 벌은 죽음이 아니라 놓침이다.
 * - 다정하게 대하면 「여진 방울 목걸이」를 받는다.
 */

export const ashBearerDialogue: DialogueTree = {
  npcId: "ash-bearer",
  crestColor: 0x4c6e5c, // 생(生) — 겉모습과 반대되는 쪽에 두었다
  crestShape: "leaf",
  startNode: "greet",
  nodes: {
    greet: {
      id: "greet",
      speaker: "(당신)",
      line:
        "계단 중턱에 사람이 서 있다. 얼굴을 천으로 전부 감았고, " +
        "등에 진 자루의 이음매에서 잿빛 가루가 조금씩 새어 나와 발자국을 덮는다.",
      menace: true,
      choices: [
        { label: "\"…거기 누굽니까.\"", next: "who" },
        { label: "무기에 손을 얹는다.", next: "hostile" },
        { label: "지나친다.", next: "passed-by" },
      ],
    },

    who: {
      id: "who",
      speaker: "재를 지고 가는 사람",
      line:
        "…아. 놀라셨죠. 얼굴은 미안해요. 재가 눈에 들어가면 한참을 못 뜨거든요.",
      next: "explain",
    },

    explain: {
      id: "explain",
      speaker: "재를 지고 가는 사람",
      line:
        "동생을 지고 가는 중이에요. 정박지까지. " +
        "거기 물이 아직 흐른다길래. 흐르는 데다 놓아주고 싶어서요.",
      choices: [
        {
          label: "\"먼 길이군요. 같이 좀 들어드릴까요.\"",
          next: "kindness",
          trustDelta: 1,
        },
        { label: "\"계단은 끝이 없다고들 하던데요.\"", next: "endless" },
        { label: "\"실례했습니다.\" 물러난다.", next: "polite-exit" },
      ],
    },

    endless: {
      id: "endless",
      speaker: "재를 지고 가는 사람",
      line:
        "그렇대요. 그래도 올라가는 동안은 아직 안 놓아준 거니까. " +
        "…끝이 없는 편이 나은 날도 있어요.",
      choices: [
        { label: "\"같이 좀 들어드리죠.\"", next: "kindness", trustDelta: 1 },
        { label: "고개를 끄덕이고 지나간다.", next: "polite-exit" },
      ],
    },

    kindness: {
      id: "kindness",
      speaker: "재를 지고 가는 사람",
      line:
        "…괜찮아요. 이건 제가 져야 하는 거라서. " +
        "대신 이거 가져가세요. 동생이 늘 목에 걸고 다니던 건데, 재랑 같이 태우긴 아까워서.",
      flagOnEnter: "gift:ash-bead-necklace",
      next: "farewell",
    },

    farewell: {
      id: "farewell",
      speaker: "재를 지고 가는 사람",
      line:
        "빛나는 게 어두운 데서 도움이 될 거예요. …고맙습니다. 물어봐 줘서.",
      end: true,
    },

    hostile: {
      id: "hostile",
      speaker: "재를 지고 가는 사람",
      line:
        "손을 아주 천천히 들어 보인다. 빈손이다. " +
        "\"…지나가실 거면 지나가세요. 저는 위로 갑니다.\"",
      next: "walks-away",
    },

    "walks-away": {
      id: "walks-away",
      speaker: "(당신)",
      line:
        "그 사람은 당신을 비켜 계단을 오른다. 자루에서 새어 나온 재가 " +
        "당신 발치까지 흘러왔다가, 곧 바람에 흩어진다. 아무 일도 일어나지 않았다.",
      end: true,
    },

    "polite-exit": {
      id: "polite-exit",
      speaker: "(당신)",
      line: "길을 비켜준다. 발소리가 위로 멀어진다. 한참 동안 계속 들린다.",
      end: true,
    },

    "passed-by": {
      id: "passed-by",
      speaker: "(당신)",
      line:
        "지나친다. 스쳐 지날 때, 천 아래에서 아주 작게 우는 소리가 들린 것도 같았다.",
      end: true,
    },
  },
};
