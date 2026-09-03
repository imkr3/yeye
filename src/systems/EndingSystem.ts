import type { RegressionState } from "./RegressionSystem";
import { relicModifiers } from "./EffectRegistry";
import { allyCount, hostileCount, isAlly, isHostile, stageFor } from "./AffinitySystem";

/**
 * 엔딩 판정.
 *
 * "착한/나쁜 선택"이 아니라 "누구와 어떤 관계로 끝났는가"의 누적 결과로 갈린다.
 * 호감도 시스템이 들어오면서, 이제 대화 한 마디 한 마디가 여기까지 이어진다.
 */

export type EndingId =
  | "locked-door"
  | "worn-vow"
  | "heart-of-overflow"
  | "unspoken-name"
  | "carried-together"
  | "no-one-left";

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
  "carried-together": {
    id: "carried-together",
    title: "엔딩 E · 함께 진 것",
    summary:
      "혼자 지지 않아도 되는 무게가 있었다. 곁에 남은 사람들이 각자의 몫을 나눠 들었고, " +
      "루프는 끝나지 않았지만 더 이상 당신 혼자만의 것이 아니다.",
  },
  "no-one-left": {
    id: "no-one-left",
    title: "엔딩 F · 아무도 남지 않았다",
    summary:
      "돌아올 때마다 사람들은 조금씩 더 멀어졌다. 마지막 회귀에서 당신을 알아보는 얼굴은 " +
      "하나도 없었다. 문 앞에 선 것은 당신뿐이다.",
  },
};

/** 주요 인물 — 관계 판정의 대상. */
export const CORE_NPCS = ["isra", "riv", "helga", "moren"] as const;

export function resolveEnding(state: RegressionState): EndingResult {
  // 「말하지 않은 이름의 조각」 같은 유물이 판정을 조금 밀어준다.
  const bonus = relicModifiers(state.equippedRelics).endingTrustBonus;
  const trustsAtLeast = (npcId: string, threshold: number) =>
    (state.npcTrust[npcId] ?? 0) + bonus >= threshold;

  const allies = allyCount(state);
  const hostiles = hostileCount(state);

  // 관계가 전부 망가진 쪽이 가장 먼저 걸린다 — 다른 조건을 만족해도 사람이 남지 않았다면
  // 그 결말이 진실에 가깝다.
  if (hostiles >= 2 && allies === 0) return ENDINGS["no-one-left"];

  const trueEndingReady =
    trustsAtLeast("isra", 1) && trustsAtLeast("riv", 1) && state.storyFlags.includes("ally-helga");

  if (trueEndingReady) return ENDINGS["unspoken-name"];

  // 동료가 둘 이상이면, 서약을 어떻게 하든 혼자 끝나지 않는다.
  if (allies >= 2) return ENDINGS["carried-together"];

  if (state.storyFlags.includes("abandon-vow")) return ENDINGS["worn-vow"];
  if (state.storyFlags.includes("embrace-overflow")) return ENDINGS["heart-of-overflow"];
  return ENDINGS["locked-door"];
}

/** 엔딩 화면에 함께 보여줄 관계 요약. */
export function relationshipSummary(state: RegressionState): { npcId: string; stage: string }[] {
  return CORE_NPCS.filter((id) => state.npcTrust[id] !== undefined || isAlly(state, id) || isHostile(state, id)).map(
    (id) => ({ npcId: id, stage: stageFor(state, id) })
  );
}
