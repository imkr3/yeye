import type { DialogueNode } from "../DialogueSystem";
import type { NpcPersona } from "../../data/dialogues/personas";

/**
 * 자유 입력 판정기 인터페이스.
 *
 * 예전에는 키워드 매칭 하나뿐이었다. 이제 판정을 인터페이스 뒤로 숨겨서,
 * 오프라인 판정과 실제 언어모델 판정을 같은 자리에 끼울 수 있게 한다.
 * 게임 로직은 어느 쪽이 붙었는지 알 필요가 없다.
 */

export interface JudgeContext {
  /** 플레이어가 실제로 입력한 말. */
  playerLine: string;
  node: DialogueNode;
  persona: NpcPersona | null;
  /** 판정 시점의 호감도. */
  affinity: number;
  /** 최근 대화 몇 줄 — 맥락 판단용. */
  history: { speaker: string; line: string }[];
}

export type Tone = "warm" | "neutral" | "cold" | "hostile" | "forbidden";

export interface JudgeVerdict {
  /** 이동할 노드 id. 반드시 노드가 허용한 갈래 중 하나여야 한다. */
  next: string;
  /** 호감도 변화량. */
  affinityDelta: number;
  tone: Tone;
  /** 대화 기록에 남길 짧은 판정 근거. */
  reason: string;
  /** 값이 있으면 그 자리에서 죽는다. */
  lethal?: string;
  /** 어느 판정기가 냈는지 — UI에 표시해 플레이어가 구분할 수 있게 한다. */
  source: "keyword" | "claude";
}

export interface DialogueJudge {
  readonly id: "keyword" | "claude";
  judge(ctx: JudgeContext): Promise<JudgeVerdict>;
}

/** 노드가 허용하는 이동 지점 목록 — 판정기가 여기서만 고를 수 있다. */
export function allowedBranches(node: DialogueNode): {
  next: string;
  keywords: string[];
  lethal?: string;
}[] {
  if (!node.freeText) return [];
  const out = node.freeText.branches.map((b) => ({
    next: b.next,
    keywords: b.keywords,
    lethal: b.lethal,
  }));
  out.push({
    next: node.freeText.fallback.next,
    keywords: [],
    lethal: node.freeText.fallback.lethal,
  });
  return out;
}

export const TONE_AFFINITY: Record<Tone, number> = {
  warm: 6,
  neutral: 1,
  cold: -3,
  hostile: -9,
  forbidden: -20,
};
