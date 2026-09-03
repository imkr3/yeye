import { evaluateFreeText } from "../DialogueSystem";
import { TONE_AFFINITY, type DialogueJudge, type JudgeContext, type JudgeVerdict, type Tone } from "./JudgeTypes";

/**
 * 오프라인 판정기 — 언어모델 없이 동작하는 기본값.
 *
 * 노드에 적힌 키워드로 갈래를 정하고, 인물의 가치관표와 대조해 어조를 어림한다.
 * 정교하지는 않지만 네트워크도 API 키도 필요 없고, 결과가 항상 재현된다.
 * 배포된 공개 빌드는 이 판정기로 돈다.
 */

function countHits(text: string, words: string[]): number {
  return words.filter((w) => text.includes(w.toLowerCase())).length;
}

/** 인물이 중시하는 것/싫어하는 것과 대조해 어조를 어림한다. */
function guessTone(ctx: JudgeContext): Tone {
  const text = ctx.playerLine.toLowerCase();
  const p = ctx.persona;
  if (!p) return "neutral";

  if (countHits(text, p.wounds) > 0) return "forbidden";

  const good = countHits(text, p.values);
  const bad = countHits(text, p.dislikes);

  // 아주 짧은 대답은 성의가 없다고 읽힌다 — 상대가 사람일 때만.
  if (!p.inhuman && ctx.playerLine.trim().length <= 2) return "cold";

  if (good > bad) return "warm";
  if (bad > good) return "cold";
  return "neutral";
}

export class KeywordJudge implements DialogueJudge {
  readonly id = "keyword" as const;

  async judge(ctx: JudgeContext): Promise<JudgeVerdict> {
    const outcome = evaluateFreeText(ctx.playerLine, ctx.node);
    const tone: Tone = outcome.lethal ? "forbidden" : guessTone(ctx);

    // 노드가 직접 지정한 신뢰 변화가 있으면 그것을 우선한다 — 작가가 정한 값이다.
    const affinityDelta = outcome.trustDelta ?? TONE_AFFINITY[tone];

    return {
      next: outcome.next,
      affinityDelta,
      tone,
      reason: outcome.lethal ? "해서는 안 될 말을 했다." : "",
      lethal: outcome.lethal,
      source: "keyword",
    };
  }
}
