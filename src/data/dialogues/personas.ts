/**
 * NPC 성격표 — 자유 입력 판정에 쓰는 인물 설정. 전부 이 프로젝트를 위해 새로 쓴 것.
 *
 * 판정기(오프라인이든 LLM이든)는 이 표를 근거로 "이 사람이 그 말을 어떻게 받아들일까"를
 * 정한다. 핵심은 *상대마다 기준이 다르다*는 것이다 — 정중함이 통하는 사람이 있고,
 * 정중함을 거리두기로 읽는 사람이 있다.
 */

export interface NpcPersona {
  id: string;
  name: string;
  /** 한 줄 인물 요약. */
  summary: string;
  /** 이 인물이 높게 사는 것. */
  values: string[];
  /** 이 인물이 싫어하는 것. */
  dislikes: string[];
  /** 절대 건드리면 안 되는 것 — 닿으면 관계가 크게 상한다. */
  wounds: string[];
  /** 사람이 아닌 상대인지. 참이면 호감도가 아니라 위험도로 다뤄진다. */
  inhuman?: boolean;
}

export const NPC_PERSONAS: Record<string, NpcPersona> = {
  isra: {
    id: "isra",
    name: "이스라",
    summary: "침수 회랑에 남아 죽은 사람들을 세는 사람. 감상적인 위로를 경계한다.",
    values: ["솔직함", "모르면 모른다고 하는 것", "구체적인 질문"],
    dislikes: ["값싼 위로", "다 안다는 태도", "죽음을 가볍게 말하는 것"],
    wounds: ["회랑에서 잃은 사람을 숫자로 취급하는 말"],
  },
  riv: {
    id: "riv",
    name: "리브 칸",
    summary: "재의 시장 장부지기. 셈이 맞는 것을 신뢰의 근거로 삼는다.",
    values: ["명확한 거래", "빚을 인정하는 태도", "실용적인 제안"],
    dislikes: ["막연한 호의", "값을 흐리는 말", "동정"],
    wounds: ["장부를 못 믿겠다는 의심"],
  },
  helga: {
    id: "helga",
    name: "헬가 도른",
    summary: "서리 관측소의 연구자. 결론보다 과정을 따진다.",
    values: ["근거", "반박을 견디는 주장", "실패를 기록하는 태도"],
    dislikes: ["직관에 기댄 단정", "권위에 기댄 말", "감정으로 미는 설득"],
    wounds: ["그의 실험이 사람을 해쳤다는 지적"],
  },
  moren: {
    id: "moren",
    name: "모른",
    summary: "끝없는 계단의 계단지기. 회귀를 알고 있고, 그 얘기를 유일하게 받아준다.",
    values: ["반복을 인정하는 말", "지친 것을 숨기지 않는 태도"],
    dislikes: ["아무 일 없는 척", "계단을 세는 일을 하찮게 보는 말"],
    wounds: ["몇 번째냐고 되묻는 것"],
  },
  "borrowed-face": {
    id: "borrowed-face",
    name: "빌린 얼굴",
    summary: "남의 얼굴을 쓰고 이름을 모으는 것. 사람이 아니다.",
    values: ["이름", "서약", "접촉"],
    dislikes: ["정체를 불리는 것", "이름을 주지 않는 것"],
    wounds: [],
    inhuman: true,
  },
  "silent-pilgrim": {
    id: "silent-pilgrim",
    name: "말없는 순례자",
    summary: "입이 꿰매진 채 무릎 꿇고 있는 것. 대답하려 들면 실이 풀린다.",
    values: ["침묵", "물러서는 말"],
    dislikes: ["계속 말을 거는 것", "대답을 요구하는 것"],
    wounds: [],
    inhuman: true,
  },
  "counting-mouth": {
    id: "counting-mouth",
    name: "셋을 세는 입",
    summary: "사소한 동의를 세 번 모아 계약으로 바꾸는 것.",
    values: ["동의", "긍정"],
    dislikes: ["되묻는 것", "셈을 지적당하는 것"],
    wounds: [],
    inhuman: true,
  },
  "salt-warden": {
    id: "salt-warden",
    name: "소금 관리인",
    summary: "정박지의 소금 창고를 지킨다. 말보다 손을 본다.",
    values: ["직접 돕겠다는 제안", "무겁다고 솔직히 말하는 것", "쓸모"],
    dislikes: ["그냥 달라는 요구", "빈말", "창고에 기대는 것"],
    wounds: ["소금이 하찮다는 말"],
  },
  "quit-counter": {
    id: "quit-counter",
    name: "셈을 그만둔 사람",
    summary: "「셋을 세는 입」과 계약할 뻔했다가 되물어서 빠져나온 사람.",
    values: ["겪은 것을 나누는 태도", "규칙을 궁금해하는 것"],
    dislikes: ["그깟 일로 겁먹었냐는 투", "재촉"],
    wounds: ["세 번째까지 갔던 일을 우습게 말하는 것"],
  },
  "returned-name": {
    id: "returned-name",
    name: "되돌아온 이름",
    summary:
      "경계문 앞에 선 것. 묻지 않고 단정한다 — 이미 답을 알고 확인만 한다. 거짓을 통과시키지 않는다.",
    values: ["인정", "모른다고 말하는 것", "참"],
    dislikes: ["둘러대는 말", "모른 척", "확신 없는 단정"],
    wounds: [],
    inhuman: true,
  },
  "ash-bearer": {
    id: "ash-bearer",
    name: "재를 지고 가는 사람",
    summary: "동생의 유골을 정박지로 옮기는 중. 무섭게 보이지만 해치지 않는다.",
    values: ["묻어봐 주는 것", "서두르지 않는 태도", "애도를 존중하는 말"],
    dislikes: ["위협", "호기심만 앞선 질문"],
    wounds: ["동생을 짐짝처럼 말하는 것"],
  },
};

export function personaOf(npcId: string): NpcPersona | null {
  return NPC_PERSONAS[npcId] ?? null;
}
