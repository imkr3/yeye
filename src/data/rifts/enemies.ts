/**
 * 균열 적 정의.
 *
 * 적의 행동은 고정 순환 패턴이다 — 무작위가 아니라 "읽을 수 있어야" 죽음의 기억이
 * 의미를 가진다. 기억 단계가 오를수록 이 패턴이 UI에 더 정확히 드러난다.
 */

export type ActionKind = "weak" | "strong" | "mark" | "detonate" | "guardbreak" | "recover";

export interface EnemyAction {
  id: string;
  label: string;
  /** 행동 직전에 보이는 예비동작 묘사. */
  telegraph: string;
  kind: ActionKind;
  damage: [number, number];
}

export interface EnemyDef {
  id: string;
  name: string;
  maxHp: number;
  /** 순환 패턴. 배열 끝에 도달하면 처음으로 돌아간다. */
  pattern: EnemyAction[];
  /** 기억 단계 1·2·3에서 각각 공개되는 정보. */
  memoryHints: [string, string, string];
  flavor: string;
  /** 보스 전용 — 2페이즈 진입 체력 비율. */
  phaseTwoAt?: number;
}

export const GLASS_MITE: EnemyDef = {
  id: "glass-mite",
  name: "유리진드기",
  maxHp: 34,
  flavor: "깨진 유리 조각이 스스로 기어다니는 것처럼 보인다.",
  pattern: [
    { id: "skitter", label: "긁어내기", telegraph: "다리를 잘게 떤다", kind: "weak", damage: [4, 7] },
    { id: "swarm", label: "무리 짓기", telegraph: "여러 조각이 한 덩어리로 뭉친다", kind: "weak", damage: [5, 8] },
    { id: "shard-burst", label: "파편 폭사", telegraph: "몸통이 팽팽하게 부푼다", kind: "strong", damage: [12, 17] },
  ],
  memoryHints: [
    "세 번째 행동이 유독 아팠다.",
    "긁기 두 번 다음에 파편이 터진다.",
    "부푸는 순간에 방어하면 대부분 흘려낼 수 있다.",
  ],
};

export const SUTURED_PILGRIM: EnemyDef = {
  id: "sutured-pilgrim",
  name: "봉합된 순례자",
  maxHp: 52,
  flavor: "누군가 서둘러 꿰맨 자국이 온몸에 남아 있다. 아직 걷고 있다.",
  pattern: [
    { id: "unseam", label: "봉합 풀기", telegraph: "실밥이 툭 끊어진다", kind: "guardbreak", damage: [7, 10] },
    { id: "toll", label: "무거운 순례", telegraph: "발을 끌며 다가온다", kind: "weak", damage: [5, 9] },
    { id: "collapse", label: "무너지는 무게", telegraph: "몸 전체가 앞으로 기운다", kind: "strong", damage: [14, 19] },
    { id: "restitch", label: "다시 꿰매기", telegraph: "상처를 손으로 여민다", kind: "recover", damage: [0, 0] },
  ],
  memoryHints: [
    "가끔 스스로 상처를 여미는 순간이 있었다.",
    "봉합을 풀면 방어가 통하지 않는다. 그 다음은 느린 발걸음이다.",
    "다시 꿰매는 턴은 무방비다. 그때 몰아치면 회복을 지울 수 있다.",
  ],
};

export const BACKFLOW_HOUND: EnemyDef = {
  id: "backflow-hound",
  name: "역류 사냥개",
  maxHp: 44,
  flavor: "지나간 자리를 거꾸로 되짚으며 냄새를 맡는다.",
  pattern: [
    { id: "scent", label: "표식 남기기", telegraph: "허공에 코를 박고 자국을 새긴다", kind: "mark", damage: [0, 0] },
    { id: "circle", label: "에두르기", telegraph: "반원을 그리며 돈다", kind: "weak", damage: [6, 9] },
    { id: "backlash", label: "역류 물기", telegraph: "새긴 자국이 붉게 달아오른다", kind: "detonate", damage: [15, 21] },
  ],
  memoryHints: [
    "표식이 남은 뒤에 크게 당했다.",
    "표식 → 에두르기 → 역류 물기 순서다.",
    "역류 물기에는 방어가 거의 소용없다. 표식이 남은 턴에 끝내거나 피해야 한다.",
  ],
};

/** 심층주 — 유리맥의 지하도 최심부. */
export const PULSE_COUNTER: EnemyDef = {
  id: "pulse-counter",
  name: "맥동을 세는 자",
  maxHp: 138,
  phaseTwoAt: 0.45,
  flavor: "무엇을 세는지는 알 수 없지만, 당신의 박동에 맞춰 손가락을 접는다.",
  pattern: [
    { id: "count-mark", label: "박동 표식", telegraph: "손가락 하나를 접는다", kind: "mark", damage: [0, 0] },
    { id: "count-tap", label: "셈 두드리기", telegraph: "손끝으로 허공을 두드린다", kind: "weak", damage: [7, 11] },
    { id: "count-burst", label: "표식 파열", telegraph: "접힌 손가락이 펴진다", kind: "detonate", damage: [17, 24] },
    { id: "count-toll", label: "마지막 셈", telegraph: "양손을 크게 벌린다", kind: "strong", damage: [19, 26] },
  ],
  memoryHints: [
    "손가락을 접은 다음에 무언가 터졌다.",
    "표식 → 두드림 → 파열 → 큰 셈 순서로 돈다.",
    "체력이 절반 아래로 떨어지면 직전 두 행동 중 하나를 거꾸로 되풀이한다.",
  ],
};

export const RIFT_ENEMIES: Record<string, EnemyDef> = {
  [GLASS_MITE.id]: GLASS_MITE,
  [SUTURED_PILGRIM.id]: SUTURED_PILGRIM,
  [BACKFLOW_HOUND.id]: BACKFLOW_HOUND,
  [PULSE_COUNTER.id]: PULSE_COUNTER,
};

/** 끝없는 계단에 원래 있던 인카운터 — 새 전투 시스템으로 옮겨온 정의. */
export const STAIRWELL_WRECKAGE: EnemyDef = {
  id: "stairwell-wreckage",
  name: "무너진 잔해",
  maxHp: 40,
  flavor: "무너진 계단참이 아직 무너지는 중이다.",
  pattern: [
    { id: "slip", label: "가벼운 붕괴", telegraph: "돌 부스러기가 흘러내린다", kind: "weak", damage: [5, 9] },
    { id: "cave-in", label: "무너지는 일격", telegraph: "잔해 더미가 부풀어 오른다", kind: "strong", damage: [16, 24] },
  ],
  memoryHints: [
    "두 번째 공격이 훨씬 아팠다.",
    "가벼운 붕괴와 무너지는 일격이 번갈아 온다.",
    "부풀어 오르는 턴에 방어하면 대부분 흘려낼 수 있다.",
  ],
};

RIFT_ENEMIES[STAIRWELL_WRECKAGE.id] = STAIRWELL_WRECKAGE;
