import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  allowedBranches,
  TONE_AFFINITY,
  type DialogueJudge,
  type JudgeContext,
  type JudgeVerdict,
  type Tone,
} from "./JudgeTypes";
import type { JudgeSettings } from "./JudgeSettings";

/**
 * 언어모델 판정기.
 *
 * 하는 일은 딱 하나다 — 플레이어가 자유롭게 쓴 말을, 이 인물이 어떻게 받아들일지
 * 판단해서 (1) 어느 갈래로 갈지 (2) 호감도가 얼마나 움직일지를 정한다.
 *
 * 설계상 지킨 것:
 * - 모델은 *노드가 미리 정의해 둔 갈래 중에서만* 고를 수 있다. 이야기 구조를
 *   모델이 즉석에서 지어내지 못하게 해서, 작가가 쓴 분기 밖으로 새지 않는다.
 * - 치명적인 갈래인지는 모델이 아니라 데이터가 정한다. 모델이 고른 갈래에
 *   lethal이 붙어 있으면 죽는 것이고, 모델이 마음대로 죽일 수는 없다.
 * - 실패하면(키 없음·네트워크·시간 초과·형식 오류) 조용히 오프라인 판정으로 넘긴다.
 *   대화가 멈추는 것보다 덜 정교하게라도 진행되는 편이 낫다.
 */

const TONES = ["warm", "neutral", "cold", "hostile", "forbidden"] as const;

const TIMEOUT_MS = 20000;

export class ClaudeJudge implements DialogueJudge {
  readonly id = "claude" as const;

  constructor(
    private settings: JudgeSettings,
    /** 실패했을 때 대신 판정할 판정기. */
    private fallback: DialogueJudge
  ) {}

  async judge(ctx: JudgeContext): Promise<JudgeVerdict> {
    const branches = allowedBranches(ctx.node);
    if (branches.length === 0) return this.fallback.judge(ctx);

    try {
      const verdict = await this.ask(ctx, branches);
      if (verdict) return verdict;
    } catch {
      /* 아래에서 오프라인 판정으로 넘어간다. */
    }
    return this.fallback.judge(ctx);
  }

  private client(): Anthropic {
    const { apiKey, proxyUrl } = this.settings;
    return new Anthropic({
      apiKey: apiKey.trim() || "unused-when-proxied",
      ...(proxyUrl.trim() ? { baseURL: proxyUrl.trim() } : {}),
      // 브라우저에서 도는 게임이다. 키는 플레이어 본인 것이고 그 사람 브라우저에만 있다.
      dangerouslyAllowBrowser: true,
      timeout: TIMEOUT_MS,
      maxRetries: 1,
    });
  }

  private async ask(
    ctx: JudgeContext,
    branches: ReturnType<typeof allowedBranches>
  ): Promise<JudgeVerdict | null> {
    const ids = branches.map((b) => b.next);
    // 갈래 id를 enum으로 못박아, 모델이 없는 노드를 지어내지 못하게 한다.
    const Schema = z.object({
      branch: z.enum(ids as [string, ...string[]]),
      tone: z.enum(TONES),
      affinity_delta: z
        .number()
        .describe("-20에서 +12 사이. 상대가 이 말을 어떻게 받아들였는지."),
      reason: z.string().describe("한국어 한 문장. 왜 그렇게 판단했는지."),
    });

    const p = ctx.persona;
    const persona = p
      ? [
          `이름: ${p.name}`,
          `설명: ${p.summary}`,
          `높게 사는 것: ${p.values.join(", ") || "없음"}`,
          `싫어하는 것: ${p.dislikes.join(", ") || "없음"}`,
          `건드리면 안 되는 것: ${p.wounds.join(", ") || "없음"}`,
          p.inhuman ? "사람이 아니다. 호의를 베풀지 않으며, 원하는 것만 노린다." : "",
        ]
          .filter(Boolean)
          .join("\n")
      : "정보 없음";

    const options = branches
      .map((b, i) => {
        const hint = b.keywords.length ? `이런 취지의 말: ${b.keywords.join(", ")}` : "그 밖의 모든 말";
        return `${i + 1}. id="${b.next}" — ${hint}`;
      })
      .join("\n");

    const recent = ctx.history
      .slice(-6)
      .map((h) => `${h.speaker}: ${h.line}`)
      .join("\n");

    const client = this.client();
    const response = await client.messages.parse({
      model: this.settings.model,
      max_tokens: 2000,
      output_config: {
        format: zodOutputFormat(Schema),
        effort: "low",
      },
      system:
        "당신은 한국어 서사 게임의 대화 판정자다. 플레이어가 자유롭게 입력한 말을 읽고, " +
        "이 인물이 그 말을 어떻게 받아들일지 판단한다.\n" +
        "규칙:\n" +
        "- 반드시 주어진 갈래 id 중 하나만 고른다. 새 id를 지어내지 않는다.\n" +
        "- 정중함이 항상 정답은 아니다. 인물이 무엇을 중시하는지에 따라 판단한다.\n" +
        "- '건드리면 안 되는 것'에 닿았다면 tone은 forbidden이다.\n" +
        "- affinity_delta는 warm이면 +4~+12, neutral이면 -1~+2, cold면 -2~-6, " +
        "hostile이면 -7~-14, forbidden이면 -15~-20 범위로 준다.\n" +
        "- reason은 한국어 한 문장으로 짧게 쓴다.",
      messages: [
        {
          role: "user",
          content:
            `[인물]\n${persona}\n\n` +
            `[현재 호감도] ${ctx.affinity} (-100 적대 ~ +100 동료)\n\n` +
            `[직전 대화]\n${recent || "(없음)"}\n\n` +
            `[인물이 방금 한 말]\n${ctx.node.line}\n\n` +
            `[고를 수 있는 갈래]\n${options}\n\n` +
            `[플레이어가 한 말]\n${ctx.playerLine}`,
        },
      ],
    });

    const out = response.parsed_output;
    if (!out) return null;

    const chosen = branches.find((b) => b.next === out.branch);
    if (!chosen) return null;

    const tone = out.tone as Tone;
    // 모델이 범위를 벗어난 값을 주더라도 게임 밸런스가 깨지지 않도록 가둔다.
    const raw = Number.isFinite(out.affinity_delta) ? out.affinity_delta : TONE_AFFINITY[tone];
    const delta = Math.max(-20, Math.min(12, Math.round(raw)));

    return {
      next: chosen.next,
      affinityDelta: delta,
      tone,
      reason: out.reason?.trim() ?? "",
      // 죽고 사는 것은 데이터가 정한다. 모델은 갈래만 고를 뿐이다.
      lethal: chosen.lethal,
      source: "claude",
    };
  }
}
