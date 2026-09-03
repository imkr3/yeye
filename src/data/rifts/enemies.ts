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


// === 2차 적 배치 ===========================================================
// 설계 원칙: 체력·피해량만 다른 적은 만들지 않는다. 적마다 "읽는 법"이 달라야
// 죽음의 기억이 의미를 가진다.

/** 회복형 — 화력을 아끼면 영영 못 죽인다. */
export const SALT_WEEPER: EnemyDef = {
  id: "salt-weeper",
  name: "소금 우는 것",
  maxHp: 58,
  flavor: "울음이 멎을 때마다 상처가 소금으로 메워진다.",
  pattern: [
    { id: "brine-lash", label: "소금 채찍", telegraph: "젖은 팔을 뒤로 젖힌다", kind: "weak", damage: [6, 9] },
    { id: "weep", label: "울음", telegraph: "몸이 잘게 떨리며 하얗게 굳는다", kind: "recover", damage: [0, 0] },
    { id: "crust-slam", label: "소금 껍질 내리치기", telegraph: "굳은 팔을 높이 든다", kind: "strong", damage: [13, 18] },
  ],
  memoryHints: [
    "분명 깎았는데 다시 멀쩡해져 있었다.",
    "두 번째 박자에 스스로를 메운다.",
    "울기 전에 몰아쳐야 한다 — 아끼면 원점이다.",
  ],
};

/** 방어 응징형 — 계속 막고만 있으면 더 크게 맞는다. */
export const THRESHOLD_BITER: EnemyDef = {
  id: "threshold-biter",
  name: "문턱을 무는 것",
  maxHp: 46,
  flavor: "문지방에 이빨 자국이 잔뜩 남아 있다. 안으로는 들어오지 않는다.",
  pattern: [
    { id: "gnaw", label: "갉기", telegraph: "턱을 낮게 문다", kind: "weak", damage: [5, 8] },
    { id: "pry", label: "비틀어 열기", telegraph: "이빨을 방패 틈에 건다", kind: "guardbreak", damage: [11, 15] },
    { id: "gnaw2", label: "갉기", telegraph: "턱을 낮게 문다", kind: "weak", damage: [5, 8] },
    { id: "hinge-snap", label: "경첩 부수기", telegraph: "온몸으로 문턱을 짓누른다", kind: "guardbreak", damage: [15, 20] },
  ],
  memoryHints: [
    "막고 있을 때 오히려 더 아팠다.",
    "두 번에 한 번은 방어를 무시하고 들어온다.",
    "갉기에는 막고, 이빨을 거는 순간에는 피해야 한다.",
  ],
};

/** 표식-폭발 조합형 — 표식을 지우지 않으면 한 방에 무너진다. */
export const TWICE_TURNING_NEEDLE: EnemyDef = {
  id: "twice-turning-needle",
  name: "두 번 도는 바늘",
  maxHp: 52,
  flavor: "시계 바늘 하나가 같은 자리를 두 번 지난다.",
  pattern: [
    { id: "prick", label: "찌르기", telegraph: "바늘 끝이 당신을 향한다", kind: "weak", damage: [4, 7] },
    { id: "pin", label: "고정", telegraph: "바늘이 당신 그림자에 꽂힌다", kind: "mark", damage: [0, 0] },
    { id: "second-turn", label: "두 번째 회전", telegraph: "꽂힌 자리가 붉게 돈다", kind: "detonate", damage: [14, 19] },
  ],
  memoryHints: [
    "그림자에 뭔가 꽂힌 뒤부터 아팠다.",
    "고정된 다음 턴의 폭발이 배로 들어온다.",
    "표식이 붙으면 지우거나 막아야 한다 — 그냥 맞으면 절반이 날아간다.",
  ],
};

/** 얼룩 누적형 — 오래 끌면 범람으로 스스로 무너진다. */
export const STAIN_MIDWIFE: EnemyDef = {
  id: "stain-midwife",
  name: "얼룩 산파",
  maxHp: 64,
  flavor: "무언가를 받아내는 자세로 웅크리고 있다. 받아낼 것은 당신 쪽에서 나온다.",
  pattern: [
    { id: "smear", label: "문지르기", telegraph: "손바닥을 펼쳐 다가온다", kind: "weak", damage: [5, 8] },
    { id: "coax", label: "번지게 하기", telegraph: "당신의 얼룩진 자리를 짚는다", kind: "mark", damage: [3, 6] },
    { id: "smear2", label: "문지르기", telegraph: "손바닥을 펼쳐 다가온다", kind: "weak", damage: [5, 8] },
    { id: "deliver", label: "받아내기", telegraph: "두 손을 모아 그릇처럼 만든다", kind: "detonate", damage: [12, 16] },
  ],
  memoryHints: [
    "맞을수록 몸이 무거워졌다.",
    "이 상대와 오래 끌면 얼룩이 걷잡을 수 없이 번진다.",
    "짧게 끝내야 한다. 억제 연고를 아끼지 말 것.",
  ],
};

/** 저속 고화력형 — 한 방이 치명적이라 방어 타이밍이 전부다. */
export const ANCHORAGE_DROWNED: EnemyDef = {
  id: "anchorage-drowned",
  name: "정박지의 익사자",
  maxHp: 70,
  flavor: "물을 잔뜩 먹은 채로 아직 걷는다. 서두르는 법이 없다.",
  pattern: [
    { id: "drag", label: "끌어당기기", telegraph: "젖은 손이 발목을 더듬는다", kind: "weak", damage: [6, 10] },
    { id: "hold-under", label: "물속에 누르기", telegraph: "숨을 크게 들이켠다", kind: "strong", damage: [20, 27] },
    { id: "drift", label: "떠오르기", telegraph: "몸이 잠깐 위로 뜬다", kind: "recover", damage: [0, 0] },
  ],
  memoryHints: [
    "한 번 크게 맞고 거의 끝날 뻔했다.",
    "숨을 들이켜는 턴이 진짜다.",
    "들이켜는 순간만 막으면 나머지는 견딜 만하다.",
  ],
};

/** 2번째 균열의 심층주 — 페이즈 2에서 박자가 어긋난다. */
export const MISCOUNT: EnemyDef = {
  id: "miscount",
  name: "셈이 틀린 것",
  maxHp: 132,
  phaseTwoAt: 0.5,
  flavor: "무엇을 세고 있었는지 스스로도 잊은 채, 아직 세고 있다.",
  pattern: [
    { id: "tally", label: "헤아리기", telegraph: "손가락을 하나씩 접는다", kind: "weak", damage: [7, 11] },
    { id: "miscount-mark", label: "잘못 센 자리", telegraph: "당신을 가리키며 숫자를 건너뛴다", kind: "mark", damage: [0, 0] },
    { id: "carry-over", label: "받아올림", telegraph: "접었던 손가락이 전부 펴진다", kind: "detonate", damage: [17, 23] },
    { id: "recount", label: "다시 세기", telegraph: "처음부터 세기 시작한다", kind: "recover", damage: [0, 0] },
    { id: "wrong-sum", label: "틀린 합", telegraph: "숫자가 맞지 않는다는 듯 고개를 젓는다", kind: "guardbreak", damage: [16, 21] },
  ],
  memoryHints: [
    "숫자를 건너뛴 다음이 위험했다.",
    "다시 세기 시작하면 체력을 되찾는다 — 그 전에 몰아쳐야 한다.",
    "절반 아래로 내려가면 세던 순서가 어긋난다. 예고를 믿지 말 것.",
  ],
};

export const RIFT_ENEMIES: Record<string, EnemyDef> = {
  [GLASS_MITE.id]: GLASS_MITE,
  [SUTURED_PILGRIM.id]: SUTURED_PILGRIM,
  [BACKFLOW_HOUND.id]: BACKFLOW_HOUND,
  [PULSE_COUNTER.id]: PULSE_COUNTER,
  [SALT_WEEPER.id]: SALT_WEEPER,
  [THRESHOLD_BITER.id]: THRESHOLD_BITER,
  [TWICE_TURNING_NEEDLE.id]: TWICE_TURNING_NEEDLE,
  [STAIN_MIDWIFE.id]: STAIN_MIDWIFE,
  [ANCHORAGE_DROWNED.id]: ANCHORAGE_DROWNED,
  [MISCOUNT.id]: MISCOUNT,
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
