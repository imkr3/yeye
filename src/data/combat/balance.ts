/**
 * 전투 밸런스 수치는 전부 여기 모아 둔다.
 * 조정할 때 로직 파일을 건드리지 않아도 되도록 시스템과 분리한다.
 * 목표: 일반 전투는 8~12턴, 심층주는 12~18턴 안에 결판난다.
 */

export const PLAYER_BASE = {
  maxHp: 68,
  /** 기초 타격 피해 범위 */
  basicStrike: [9, 13] as [number, number],
  /** 막바지 승부 — 체력이 이 비율 이하일 때만 사용 가능 */
  lastDitchThreshold: 0.3,
  lastDitchSuccessChance: 0.5,
  lastDitchDamage: [26, 38] as [number, number],
  lastDitchRecoil: [8, 14] as [number, number],
  /** 보스에게는 막바지 승부가 즉사로 이어지지 않도록 상한을 둔다 */
  lastDitchBossCap: 34,
};

export const GUARD = {
  /** 방어 시 강공격 피해 감소율 */
  strongReduction: 0.62,
  /** 방어 시 약공격 피해 감소율 — 약공격에는 과하게 이득이 아니게 */
  weakReduction: 0.35,
  /** 표식 폭발에는 방어가 오히려 약하다 */
  detonateReduction: 0.1,
  /** 연속 방어 시 자세가 무너져 감소율이 깎인다 */
  postureLossPerRepeat: 0.28,
  /** 자세는 방어를 쉬면 회복된다 */
  postureRecoveryPerTurn: 1,
};

export const CAUSAL_MARK = {
  /** 연(緣) 인과 표식 — 적의 다음 행동을 지목한다 */
  bonusDamage: [14, 20] as [number, number],
  missDamage: [4, 7] as [number, number],
  stainCost: 4,
};

export const SUNDER = {
  /** 멸(滅) 결손 절단 — 방어를 무시하지만 얼룩과 반동이 붙는다 */
  damage: [16, 23] as [number, number],
  stainCost: 12,
  recoilChance: 0.35,
  recoil: [4, 9] as [number, number],
};

export const OVERFLOW = {
  /** 얼룩 100 도달 시 개인 범람 지속 턴 */
  durationTurns: 2,
  damageMultiplier: 1.45,
  vulnerability: 1.35,
  /** 범람 종료 후 얼룩이 이 값으로 내려간다 (완전 초기화 아님) */
  settleTo: 62,
};

export const ENEMY_SCALING = {
  /** 죽음의 기억 단계가 오를수록 의도 표시가 정확해진다 */
  intentAccuracyByTier: [0, 0.45, 0.75, 1] as const,
};
