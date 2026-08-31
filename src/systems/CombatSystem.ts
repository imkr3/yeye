/**
 * 전투 시스템 — 1단계 버티컬 슬라이스용 최소 구현.
 * 설계 문서 02번 섹션 참고: 시작 스킬은 "기초 타격"과 "막바지 승부" 둘뿐이고,
 * 강함의 원천은 스탯이 아니라 "이미 죽어봐서 아는 정보"다.
 */

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export interface SkillOutcome {
  damageToEnemy: number;
  damageToSelf: number;
  log: string;
}

/** 기초 타격 — 무기 종류를 가리지 않는 평범한 근접 공격. 언제나 사용 가능. */
export function useBasicStrike(): SkillOutcome {
  const damage = randInt(8, 14);
  return { damageToEnemy: damage, damageToSelf: 0, log: `기초 타격 — ${damage}의 피해를 입혔다.` };
}

/**
 * 막바지 승부 — 체력이 낮을 때만 쓸 수 있는 하이리스크 스킬.
 * 성공하면 크게 뒤집지만, 실패하면 반동 피해를 입는다.
 */
export function canUseLastDitchGamble(hp: number, maxHp: number): boolean {
  return hp <= maxHp * 0.3;
}

export function useLastDitchGamble(): SkillOutcome {
  const success = Math.random() < 0.5;
  if (success) {
    const damage = randInt(30, 45);
    return { damageToEnemy: damage, damageToSelf: 0, log: `막바지 승부 — 성공! ${damage}의 치명적인 피해.` };
  }
  const selfDamage = randInt(10, 18);
  return { damageToEnemy: 0, damageToSelf: selfDamage, log: `막바지 승부 — 실패. 반동으로 ${selfDamage}의 피해를 입었다.` };
}

export type EnemyMoveId = "weak" | "strong";

export interface EnemyMove {
  id: EnemyMoveId;
  label: string;
  telegraph: string;
  damageRange: [number, number];
}

/**
 * 적의 공격 패턴 — 약공격/강공격이 번갈아 나온다.
 * "죽음의 기억"이 있으면 이 패턴을 미리 보여줘 정보 우위를 체감시킨다.
 */
export const ENEMY_PATTERN: EnemyMove[] = [
  { id: "weak", label: "약한 일격", telegraph: "잔해 더미가 가볍게 흔들린다", damageRange: [5, 9] },
  { id: "strong", label: "무너지는 일격", telegraph: "잔해 더미가 무너질 듯 부풀어 오른다", damageRange: [16, 24] },
];

export function enemyMoveAtTurn(turn: number): EnemyMove {
  return ENEMY_PATTERN[turn % ENEMY_PATTERN.length];
}

export function resolveEnemyMove(move: EnemyMove): SkillOutcome {
  const damage = randInt(move.damageRange[0], move.damageRange[1]);
  return { damageToEnemy: 0, damageToSelf: damage, log: `${move.label} — ${damage}의 피해를 입었다.` };
}
