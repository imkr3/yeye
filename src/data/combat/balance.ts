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
  /*
   * 방어는 한 턴을 통째로 쓴다. 그래서 감소율이 낮으면 "막는 게 손해"가 되어
   * 조심스럽게 두는 쪽이 오히려 지는 함정이 된다. 시뮬레이터에서 실제로
   * 심층주 상대 승률이 28%(안 막음) → 1%(막음)로 뒤집혔다.
   * 강공격 한 방을 막는 것이 그 한 턴 값을 하도록 올렸다.
   */
  /** 방어 시 강공격 피해 감소율 */
  strongReduction: 0.8,
  /** 방어 시 약공격 피해 감소율 — 약공격에는 과하게 이득이 아니게 */
  weakReduction: 0.45,
  /**
   * 표식 폭발에는 방어가 약하다 — 다만 0.1은 "막을 수 없다"에 가까워서,
   * 표식을 막으라는 기억 힌트와 어긋났다. 강공격(0.8)보다는 확실히 나쁘되
   * 한 턴을 쓸 값은 하도록 올렸다.
   */
  detonateReduction: 0.35,
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

/** 연격 — 한 방이 약한 대신 두 번 들어간다. 보호막·경감을 두 번 뚫는다. */
export const CHAIN_STRIKE = {
  hits: 2,
  damage: [5, 9] as [number, number],
  stainCost: 2,
};

/** 흐름 읽기 — 피해는 없지만 적을 약화시키고 의도를 드러낸다. */
export const READ_FLOW = {
  weakenTurns: 3,
  /** 약화 중 적 피해에 곱해지는 값. */
  weakenMultiplier: 0.7,
};

/** 혈맥 개방 — 큰 피해와 출혈, 대신 얼룩이 크게 번진다. */
export const VEIN_OPEN = {
  damage: [16, 24] as [number, number],
  stainCost: 18,
  bleedTurns: 3,
  bleedPerTurn: 5,
};
