import type { RegressionState } from "./RegressionSystem";
import type { PlayerActionId } from "./CombatSystem";

/**
 * 연공(鍊功) — 익혀서 얻는 기술.
 *
 * 처음부터 다 주면 전투가 첫 판에 완성되어 버린다. 그래서 이 게임이 실제로
 * 다루는 것들 — 반복해서 죽어보는 것, 얼룩을 감당해 보는 것, 분기점을 넘는 것 —
 * 을 조건으로 걸어서, 겪은 만큼 늘어나게 한다.
 *
 * 조건은 전부 이미 저장되는 상태에서 읽는다. 새 저장 필드를 만들지 않으므로
 * 예전 세이브로도 그대로 판정된다.
 */

export interface SkillDef {
  id: PlayerActionId;
  name: string;
  description: string;
  /** 잠금 해제 조건 설명 — 아직 못 쓰는 이유를 그대로 보여준다. */
  requirement: string;
  unlocked(state: RegressionState): boolean;
}

export const LEARNED_SKILLS: SkillDef[] = [
  {
    id: "chain-strike",
    name: "연격",
    description: "두 번 나눠 친다. 한 방은 약하지만 보호막과 경감을 각각 통과한다.",
    requirement: "분기점을 한 번 갱신하면 익힌다.",
    unlocked: (s) => s.achievements.length >= 1,
  },
  {
    id: "read-flow",
    name: "흐름 읽기",
    description: "피해는 없다. 대신 상대의 힘을 빼고, 이번 상대의 기억이 한 단계 열린다.",
    requirement: "세 번 회귀하면 익힌다.",
    unlocked: (s) => s.runCount >= 3,
  },
  {
    id: "vein-open",
    name: "혈맥 개방",
    description: "크게 베고 상처를 열어둔다. 얼룩이 크게 번지는 대신 출혈이 이어진다.",
    requirement: "얼룩이 한 번 범람해야 익힌다.",
    unlocked: (s) => s.overflowState.triggeredThisRun || s.stain >= 70,
  },
];

export function unlockedSkills(state: RegressionState): SkillDef[] {
  return LEARNED_SKILLS.filter((sk) => sk.unlocked(state));
}

export function lockedSkills(state: RegressionState): SkillDef[] {
  return LEARNED_SKILLS.filter((sk) => !sk.unlocked(state));
}

export function isSkillUnlocked(state: RegressionState, id: PlayerActionId): boolean {
  const def = LEARNED_SKILLS.find((sk) => sk.id === id);
  return def ? def.unlocked(state) : true;
}
