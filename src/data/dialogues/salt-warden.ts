import type { DialogueTree } from "../../systems/DialogueSystem";

/**
 * 소금 관리인 — 정박지의 소금 창고를 지키는 사람. 전부 새로 쓴 원고.
 *
 * 동료가 될 수 있는 인물이다. 호감도를 올리는 길이 "친절하게 굴기"가 아니라
 * "쓸모를 증명하기"인 쪽으로 짰다 — 이 사람은 말보다 손을 본다.
 */
export const saltWardenDialogue: DialogueTree = {
  npcId: "salt-warden",
  crestColor: 0x6fa8b8,
  crestShape: "diamond",
  startNode: "greet",
  nodes: {
    greet: {
      id: "greet",
      speaker: "소금 관리인",
      line: "손. 보여줘요. …굳은살이 없네. 여기서 뭘 하려고?",
      choices: [
        { label: "\"일을 돕겠습니다. 뭘 하면 됩니까.\"", next: "offer-work", trustDelta: 8 },
        { label: "\"소금이 왜 필요합니까?\"", next: "why-salt", trustDelta: 3 },
        { label: "\"지나가는 길입니다.\"", next: "passing", trustDelta: -2 },
      ],
    },

    "why-salt": {
      id: "why-salt",
      speaker: "소금 관리인",
      line:
        "얼룩은 물을 타고 번져요. 소금은 물을 뺏고요. 그게 전부예요. " +
        "복잡한 이치를 기대했다면 미안하네요.",
      choices: [
        { label: "\"그럼 저도 나르겠습니다.\"", next: "offer-work", trustDelta: 8 },
        { label: "\"조금 나눠주실 수 있습니까.\"", next: "ask-share", trustDelta: -3 },
        { label: "\"고맙습니다.\" 물러난다.", next: "leave" },
      ],
    },

    "offer-work": {
      id: "offer-work",
      speaker: "소금 관리인",
      line:
        "…진심이네. 좋아요, 저 자루 끝을 잡아요. 무거우면 무겁다고 말하고. " +
        "허리 나가면 나만 손해예요.",
      next: "worked",
    },

    worked: {
      id: "worked",
      speaker: "소금 관리인",
      line:
        "됐어요. 한 시간이면 될 걸 반으로 줄였네. " +
        "…아래로 내려갈 거죠? 그럴 것 같더라. 그럼 이건 가져가요.",
      flagOnEnter: "gift:river-salt-packet",
      choices: [
        {
          label: "\"같이 내려가 주실 수 있습니까.\"",
          next: "join-request",
          trustDelta: 12,
        },
        { label: "\"고맙습니다.\"", next: "thanks", trustDelta: 5 },
      ],
    },

    "join-request": {
      id: "join-request",
      speaker: "소금 관리인",
      line:
        "…나는 창고를 못 비워요. 대신 소리 지르면 들리는 데까지는 따라가죠. " +
        "그 정도는 해줄 수 있어요.",
      next: "thanks",
    },

    thanks: {
      id: "thanks",
      speaker: "소금 관리인",
      line: "가서 죽지 말고. 죽으면 자루는 누가 잡아요.",
      end: true,
    },

    "ask-share": {
      id: "ask-share",
      speaker: "소금 관리인",
      line: "그냥요? …여기 오는 사람 전부가 그렇게 말해요. 창고가 남아나겠어요?",
      choices: [
        { label: "\"그럼 일을 돕겠습니다.\"", next: "offer-work", trustDelta: 8 },
        { label: "\"알겠습니다.\" 물러난다.", next: "leave" },
      ],
    },

    passing: {
      id: "passing",
      speaker: "소금 관리인",
      line: "그럼 지나가요. 소금 자루에 기대지만 말고.",
      end: true,
    },

    leave: {
      id: "leave",
      speaker: "(당신)",
      line: "돌아선다. 등 뒤에서 자루 끄는 소리가 다시 시작된다.",
      end: true,
    },
  },
};
