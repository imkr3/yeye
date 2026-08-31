import { BACKFLOW_HOUND, GLASS_MITE, PULSE_COUNTER, SUTURED_PILGRIM, type EnemyDef } from "./enemies";

/**
 * 균열 「유리맥의 지하도」
 *
 * 방 구조: 입구 → 일반 방 2개 → 사건/휴식 방 1개 → 심층주.
 * 완전 절차 생성 대신 시드로 후보를 섞어 순서를 정한다. 같은 주기(runSeed) 안에서는
 * 같은 배치가 나와야 "지난번에 배운 것"이 다음 시도에 쓸모가 있다.
 */

export type RiftRoomType = "entrance" | "combat" | "trap" | "event" | "rest" | "boss";

export interface RiftChoice {
  id: string;
  label: string;
  description: string;
  effects: {
    hp?: number;
    stain?: number;
    coins?: number;
    dust?: number;
    fragments?: number;
    /** 다음 방 보상 배율 */
    nextRewardMultiplier?: number;
    /** 이번 주기 페널티 위험 증가 */
    riskUp?: boolean;
    flag?: string;
  };
}

export interface RiftRoomDef {
  id: string;
  type: RiftRoomType;
  title: string;
  /** 방에 들어섰을 때의 묘사. */
  description: string;
  enemy?: EnemyDef;
  /** 함정 방 — 회피 판정에 쓰는 정보. */
  trap?: {
    id: string;
    telegraph: string;
    /** 회피 성공 시 문구 */
    dodgeText: string;
    hitText: string;
    damage: [number, number];
    stainOnHit: number;
  };
  choices?: RiftChoice[];
  coinReward?: [number, number];
}

// --- 함정 2종 -------------------------------------------------------------

const DELAYED_FISSURE: RiftRoomDef = {
  id: "trap-delayed-fissure",
  type: "trap",
  title: "지연 폭발 균열선",
  description:
    "바닥을 가로지르는 가느다란 균열이 희미하게 맥동한다. 밟은 직후가 아니라, 한 박자 늦게 터진다.",
  trap: {
    id: "delayed-fissure",
    telegraph: "균열선이 한 번 밝아졌다가 어두워진다.",
    dodgeText: "박자를 하나 세고 건너뛴다. 등 뒤에서 균열이 터진다.",
    hitText: "성급하게 발을 뗀 순간 균열이 터져 올랐다.",
    damage: [10, 16],
    stainOnHit: 6,
  },
  choices: [
    {
      id: "wait-a-beat",
      label: "한 박자 세고 건넌다",
      description: "터지는 간격을 읽어야 한다. 기억이 있으면 훨씬 쉽다.",
      effects: {},
    },
    {
      id: "rush-through",
      label: "그냥 달려서 통과한다",
      description: "빠르지만 대부분 늦는다.",
      effects: {},
    },
  ],
};

const REWINDING_DEBRIS: RiftRoomDef = {
  id: "trap-rewinding-debris",
  type: "trap",
  title: "되감기는 낙하물",
  description:
    "떨어진 돌더미가 잠시 뒤 거꾸로 천장으로 빨려 올라간다. 그리고 다시 떨어진다. 같은 자리에.",
  trap: {
    id: "rewinding-debris",
    telegraph: "돌 부스러기가 위로 흐르기 시작한다.",
    dodgeText: "낙하 지점 바깥으로 물러난다. 돌더미가 아까 그 자리에 그대로 꽂힌다.",
    hitText: "물러설 곳을 잘못 골랐다. 되감긴 돌더미가 어깨를 찍는다.",
    damage: [12, 18],
    stainOnHit: 4,
  },
  choices: [
    {
      id: "step-aside",
      label: "낙하 지점 바깥으로 비킨다",
      description: "떨어졌던 자리를 기억해야 한다.",
      effects: {},
    },
    {
      id: "shelter-under",
      label: "돌더미 아래로 파고든다",
      description: "빠르지만 되감김이 끝나는 순간이 문제다.",
      effects: {},
    },
  ],
};

// --- 사건 3종 -------------------------------------------------------------

const BROKEN_EXCHANGE: RiftRoomDef = {
  id: "event-broken-exchange",
  type: "event",
  title: "부서진 환로",
  description:
    "균열 안에 있어선 안 될 교환 장치가 반쯤 부서진 채 서 있다. 아직 무언가를 뱉을 힘은 남은 듯하다.",
  choices: [
    {
      id: "pry-open",
      label: "억지로 열어 안을 턴다",
      description: "여진화를 얻지만 손을 베인다.",
      effects: { coins: 34, hp: -8 },
    },
    {
      id: "repair-briefly",
      label: "잠깐 고쳐서 정상 작동시킨다",
      description: "여진 가루를 얻는다. 시간이 걸리는 만큼 얼룩이 번진다.",
      effects: { dust: 2, stain: 8 },
    },
    {
      id: "leave-it",
      label: "건드리지 않고 지나간다",
      description: "아무 일도 일어나지 않는다. 그것도 선택이다.",
      effects: {},
    },
  ],
};

const NAMELESS_ALTAR: RiftRoomDef = {
  id: "event-nameless-altar",
  type: "event",
  title: "이름 없는 제단",
  description:
    "이름이 새겨져야 할 자리가 매끈하게 깎여 있다. 누군가 지운 것이 아니라, 처음부터 비워둔 것처럼 보인다.",
  choices: [
    {
      id: "offer-blood",
      label: "손을 베어 바친다",
      description: "제단이 응답한다. 대가는 몸이 치른다.",
      effects: { hp: -12, fragments: 22, flag: "altar-offered" },
    },
    {
      id: "carve-own-name",
      label: "빈자리에 내 이름을 새긴다",
      description: "무엇에 서명하는지 모르는 채로.",
      effects: { stain: 14, coins: 26, flag: "altar-signed" },
    },
    {
      id: "wipe-clean",
      label: "먼지만 털고 물러난다",
      description: "얼룩이 조금 가라앉는다.",
      effects: { stain: -6 },
    },
  ],
};

const OTHERS_DEATH_RECORD: RiftRoomDef = {
  id: "event-others-death-record",
  type: "event",
  title: "타인의 사망 기록",
  description:
    "벽에 누군가의 마지막 동선이 긁혀 있다. 필체가 급할수록 글자는 정확해진다. 이 사람은 끝까지 세고 있었다.",
  choices: [
    {
      id: "read-carefully",
      label: "끝까지 읽는다",
      description: "다음 방의 정보를 미리 얻는다. 읽는 동안 얼룩이 스민다.",
      effects: { stain: 6, flag: "read-death-record" },
    },
    {
      id: "take-supplies",
      label: "남은 물건만 챙긴다",
      description: "여진화를 얻지만 기록은 읽지 않는다.",
      effects: { coins: 30 },
    },
    {
      id: "erase-record",
      label: "기록을 지워준다",
      description: "아무 이득도 없다. 얼룩이 조금 가라앉는다.",
      effects: { stain: -10, flag: "erased-record" },
    },
  ],
};

// --- 휴식 -----------------------------------------------------------------

const REST_ROOM: RiftRoomDef = {
  id: "rest-glass-hollow",
  type: "rest",
  title: "유리 공동",
  description: "맥이 끊긴 유리 줄기 사이로 바람이 지난다. 잠깐은 아무것도 오지 않는다.",
  choices: [
    {
      id: "mend-body",
      label: "몸을 추스른다",
      description: "체력을 회복한다.",
      effects: { hp: 26 },
    },
    {
      id: "settle-stain",
      label: "얼룩을 가라앉힌다",
      description: "얼룩 수치를 크게 낮춘다.",
      effects: { stain: -22 },
    },
    {
      id: "sharpen-greed",
      label: "더 깊이 들여다본다",
      description: "다음 방 보상이 늘어나지만, 이번 주기의 위험도 함께 오른다.",
      effects: { nextRewardMultiplier: 1.8, riskUp: true, stain: 5 },
    },
  ],
};

// --- 고정 방 -------------------------------------------------------------

const ENTRANCE: RiftRoomDef = {
  id: "entrance",
  type: "entrance",
  title: "유리맥 입구",
  description:
    "지하도 입구에서 찬 공기가 올라온다. 벽을 따라 흐르는 유리질 광맥이 맥박처럼 밝아졌다 어두워진다.",
  choices: [
    { id: "descend", label: "내려간다", description: "돌아설 기회는 여기까지다.", effects: {} },
  ],
};

const BOSS_ROOM: RiftRoomDef = {
  id: "boss-pulse-counter",
  type: "boss",
  title: "최심부 — 셈이 멈추는 곳",
  description: "유리맥이 한 점으로 모인다. 그 앞에 누군가 앉아, 접었다 편 손가락을 세고 있다.",
  enemy: PULSE_COUNTER,
  coinReward: [70, 95],
};

const COMBAT_ROOMS: RiftRoomDef[] = [
  {
    id: "combat-mite-nest",
    type: "combat",
    title: "유리 둥지",
    description: "발밑에서 잘게 부서지는 소리가 난다. 부서진 것들이 움직인다.",
    enemy: GLASS_MITE,
    coinReward: [18, 26],
  },
  {
    id: "combat-pilgrim-hall",
    type: "combat",
    title: "순례자의 통로",
    description: "누군가 여기까지 걸어와서, 여기서부터는 걷는 법을 잊은 것 같다.",
    enemy: SUTURED_PILGRIM,
    coinReward: [24, 34],
  },
  {
    id: "combat-hound-run",
    type: "combat",
    title: "역류 통로",
    description: "지나온 발자국이 지워지지 않는다. 오히려 선명해진다.",
    enemy: BACKFLOW_HOUND,
    coinReward: [22, 32],
  },
];

const HAZARD_ROOMS: RiftRoomDef[] = [DELAYED_FISSURE, REWINDING_DEBRIS];
const EVENT_ROOMS: RiftRoomDef[] = [BROKEN_EXCHANGE, NAMELESS_ALTAR, OTHERS_DEATH_RECORD];

export const GLASSVEIN_UNDERWAY = {
  id: "glassvein-underway",
  name: "유리맥의 지하도",
  sceneryStyle: "glassvein-underway" as const,
  entrance: ENTRANCE,
  boss: BOSS_ROOM,
  combatPool: COMBAT_ROOMS,
  hazardPool: HAZARD_ROOMS,
  eventPool: EVENT_ROOMS,
  rest: REST_ROOM,
};

export const ALL_RIFT_ROOMS: RiftRoomDef[] = [
  ENTRANCE,
  ...COMBAT_ROOMS,
  ...HAZARD_ROOMS,
  ...EVENT_ROOMS,
  REST_ROOM,
  BOSS_ROOM,
];
