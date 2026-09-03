import { KeywordJudge } from "./KeywordJudge";
import { ClaudeJudge } from "./ClaudeJudge";
import { judgeIsLive, loadJudgeSettings } from "./JudgeSettings";
import type { DialogueJudge } from "./JudgeTypes";

export * from "./JudgeTypes";
export * from "./JudgeSettings";
export { KeywordJudge } from "./KeywordJudge";
export { ClaudeJudge } from "./ClaudeJudge";

/**
 * 지금 설정에 맞는 판정기를 만든다.
 * 언어모델을 쓸 수 없는 상태면 조용히 오프라인 판정으로 떨어진다.
 */
export function createJudge(): DialogueJudge {
  const offline = new KeywordJudge();
  const settings = loadJudgeSettings();
  if (!judgeIsLive(settings)) return offline;
  return new ClaudeJudge(settings, offline);
}
