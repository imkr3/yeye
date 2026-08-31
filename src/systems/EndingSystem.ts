import type { RegressionState } from "./RegressionSystem";
import { relicModifiers } from "./EffectRegistry";

/**
 * 엔딩 판정 — 설계 문서 10번 섹션의 분기 흐름을 그대로 코드로 옮긴 것.
 * "착한/나쁜 선택"이 아니라 "누구를 신뢰했는가"의 누적 결과로 갈리게 한다.
 */

export type EndingId = "locked-door" | "worn-vow" | "heart-of-overflow" | "unspoken-name";

export interface EndingResult {
  id: EndingId;
  title: string;
  summary: string;
}

const ENDINGS: Record<EndingId, EndingResult> = {
  "locked-door": {
    id: "locked-door",
    title: "엔딩 A · 잠긴 문",
    summary: "뚜렷한 선택 없이 흘러갔다. 루프는 끝나지 않고, 문은 여전히 잠겨 있다.",
  },
  "worn-vow": {
    id: "worn-vow",
    title: "엔딩 B · 닳은 서약",
    summary: "회귀의 힘을 스스로 내려놓았다. 유한하지만, 온전히 당신의 시간이 남았다.",
  },
  "heart-of-overflow": {
    id: "heart-of-overflow",
    title: "엔딩 C · 범람의 중심",
    summary: "대가를 가리지 않고 힘을 받아들였다. 더는 예전의 당신이 아니다.",
  },
  "unspoken-name": {
    id: "unspoken-name",
    title: "엔딩 D · 말하지 않은 이름",
    summary: "세 사람 모두의 신뢰를 얻고, 대범람의 진짜 이름과 마주했다.",
  },
};

export function resolveEnding(state: RegressionState): EndingResult {
  // 「말하지 않은 이름의 조각」 같은 유물이 판정을 조금 밀어준다.
  const bonus = relicModifiers(state.equippedRelics).endingTrustBonus;
  const trustsAtLeast = (npcId: string, threshold: number) =>
    (state.npcTrust[npcId] ?? 0) + bonus >= threshold;

  const trueEndingReady =
    trustsAtLeast("isra", 1) && trustsAtLeast("riv", 1) && state.storyFlags.includes("ally-helga");

  if (trueEndingReady) return ENDINGS["unspoken-name"];
  if (state.storyFlags.includes("abandon-vow")) return ENDINGS["worn-vow"];
  if (state.storyFlags.includes("embrace-overflow")) return ENDINGS["heart-of-overflow"];
  return ENDINGS["locked-door"];
}
