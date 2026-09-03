import {
  ANCHORAGE_DROWNED,
  MISCOUNT,
  SALT_WEEPER,
  STAIN_MIDWIFE,
  THRESHOLD_BITER,
  TWICE_TURNING_NEEDLE,
} from "./enemies";
import type { RiftRoomDef } from "./glassvein";

/**
 * 균열 「잠긴 정박지」 — 두 번째 던전.
 *
 * 유리맥의 지하도가 "깨지고 날카로운" 곳이라면, 이쪽은 "차오르고 무거운" 곳이다.
 * 같은 구조를 반복하지 않기 위해 성격을 반대로 잡았다:
 * - 유리맥의 함정은 순간적이고 폭발한다. 여기 함정은 서서히 차오른다.
 * - 여기 적들은 회복하거나 방어를 응징하거나 얼룩을 쌓는다 — 오래 끄는 쪽이 불리하다.
 * - 사건 방은 "무엇을 두고 갈 것인가"를 묻는다. 얻는 대신 잃는 선택이 기본이다.
 */

const ENTRANCE: RiftRoomDef = {
  id: "anchorage-entrance",
  type: "entrance",
  title: "잠긴 정박지 · 입구",
  description:
    "계단이 물속으로 이어진다. 수면 아래에서 밧줄 끝이 흔들리는데, 배는 어디에도 없다. " +
    "숨을 참을 필요는 없다 — 여기 물은 폐로 들어오지 않는다. 대신 다른 것이 들어온다.",
};

const COMBAT_ROOMS: RiftRoomDef[] = [
  {
    id: "anchorage-weeper",
    type: "combat",
    title: "소금이 굳는 방",
    description: "벽마다 하얗게 굳은 자국이 층층이 쌓여 있다. 그 앞에 웅크린 것이 울고 있다.",
    enemy: SALT_WEEPER,
    coinReward: [22, 34],
  },
  {
    id: "anchorage-biter",
    type: "combat",
    title: "문턱만 남은 방",
    description: "문은 없고 문턱만 남았다. 그 위에 이빨 자국이 촘촘하다.",
    enemy: THRESHOLD_BITER,
    coinReward: [20, 30],
  },
  {
    id: "anchorage-needle",
    type: "combat",
    title: "멈춘 시계의 방",
    description: "벽시계 하나가 같은 자리를 두 번씩 지난다. 바늘이 당신 그림자를 스친다.",
    enemy: TWICE_TURNING_NEEDLE,
    coinReward: [24, 36],
  },
  {
    id: "anchorage-midwife",
    type: "combat",
    title: "받아내는 방",
    description: "바닥에 얕은 그릇 모양 홈이 파여 있다. 그 가운데 무언가 웅크려 손을 벌리고 있다.",
    enemy: STAIN_MIDWIFE,
    coinReward: [26, 38],
  },
  {
    id: "anchorage-drowned-room",
    type: "combat",
    title: "허리까지 찬 방",
    description: "물이 허리까지 차 있다. 그 안에서 무언가 아주 천천히 이쪽으로 걸어온다.",
    enemy: ANCHORAGE_DROWNED,
    coinReward: [28, 42],
  },
];

const HAZARD_ROOMS: RiftRoomDef[] = [
  {
    id: "anchorage-rising-water",
    type: "trap",
    title: "차오르는 방",
    description:
      "들어서자마자 문이 잠기고 물이 차오르기 시작한다. 반대편 손잡이까지 가는 동안 " +
      "수면이 어디까지 오를지가 문제다.",
    trap: {
      id: "rising-water",
      telegraph: "발목, 무릎, 허리. 차오르는 속도가 일정하지 않다.",
      dodgeText: "물이 가슴에 닿기 전에 손잡이를 돌렸다.",
      hitText: "숨을 쉬려는 순간 물이 먼저 들어왔다.",
      damage: [12, 18],
      stainOnHit: 14,
    },
  },
  {
    id: "anchorage-anchor-chain",
    type: "trap",
    title: "닻줄이 감기는 통로",
    description:
      "천장에서 늘어진 닻줄들이 아주 느리게 감겨 올라간다. 발이 걸리면 함께 올라간다.",
    trap: {
      id: "anchor-chain",
      telegraph: "줄이 팽팽해지기 직전에 아주 짧게 늘어진다.",
      dodgeText: "늘어지는 박자에 맞춰 줄 사이를 빠져나왔다.",
      hitText: "발목이 감겨 천장까지 끌려 올라갔다가 떨어졌다.",
      damage: [14, 20],
      stainOnHit: 8,
    },
  },
];

const EVENT_ROOMS: RiftRoomDef[] = [
  {
    id: "anchorage-left-behind",
    type: "event",
    title: "두고 간 것들",
    description:
      "물 위로 짐이 잔뜩 떠 있다. 여기까지 온 사람들이 더 가기 위해 버린 것들이다. " +
      "쓸 만한 것도 섞여 있지만, 건지려면 팔을 깊이 넣어야 한다.",
    choices: [
      {
        id: "reach-deep",
        label: "깊이 손을 넣는다",
        description: "여진화를 건지지만 얼룩이 팔을 타고 올라온다.",
        effects: { coins: 55, stain: 16 },
      },
      {
        id: "take-floating",
        label: "떠 있는 것만 줍는다",
        description: "적지만 안전하다.",
        effects: { coins: 18 },
      },
      {
        id: "leave-own",
        label: "내 것을 하나 두고 간다",
        description: "짐을 덜면 다음 방이 수월해진다.",
        effects: { hp: 14, nextRewardMultiplier: 1.4 },
      },
    ],
  },
  {
    id: "anchorage-tideline",
    type: "event",
    title: "물때 자국",
    description:
      "벽에 물이 닿았던 높이가 여러 겹 남아 있다. 가장 높은 자국 옆에 누군가 " +
      "날짜 대신 이름을 적어두었다. 당신이 아는 이름은 하나도 없다.",
    choices: [
      {
        id: "add-name",
        label: "이름을 하나 더 적는다",
        description: "누구의 이름을 적을지는 당신이 정한다.",
        effects: { fragments: 30, flag: "wrote-on-tideline" },
      },
      {
        id: "read-all",
        label: "전부 읽는다",
        description: "시간이 걸리지만 무언가 배운다.",
        effects: { fragments: 15, hp: -6 },
      },
      {
        id: "wipe",
        label: "지운다",
        description: "지운 자리는 다시 물이 채운다.",
        effects: { stain: -12, coins: -10 },
      },
    ],
  },
  {
    id: "anchorage-empty-mooring",
    type: "event",
    title: "빈 계류장",
    description:
      "배를 묶어두는 자리가 줄지어 있고 전부 비어 있다. 밧줄만 물속으로 팽팽하게 " +
      "당겨져 있다. 무언가가 아직 반대편 끝에 매여 있다는 뜻이다.",
    choices: [
      {
        id: "pull-rope",
        label: "밧줄을 당겨본다",
        description: "무엇이 딸려 올지는 당겨봐야 안다.",
        effects: { coins: 40, stain: 10, riskUp: true },
      },
      {
        id: "cut-rope",
        label: "밧줄을 끊는다",
        description: "무엇이든 놓아준다.",
        effects: { stain: -18, flag: "cut-the-mooring" },
      },
      {
        id: "walk-past",
        label: "지나친다",
        description: "아무 일도 일어나지 않는다.",
        effects: {},
      },
    ],
  },
];

const REST_ROOM: RiftRoomDef = {
  id: "anchorage-dry-step",
  type: "rest",
  title: "마른 계단참",
  description:
    "딱 한 칸, 물이 닿지 않는 계단이 있다. 앉으면 젖은 옷에서 물이 빠지는 소리만 들린다.",
  choices: [
    {
      id: "wring-out",
      label: "옷을 짜고 숨을 고른다",
      description: "체력을 회복하고 얼룩을 조금 씻어낸다.",
      effects: { hp: 26, stain: -10 },
    },
    {
      id: "listen-down",
      label: "아래쪽 소리를 듣는다",
      description: "다음 방 보상이 늘지만 쉬지는 못한다.",
      effects: { nextRewardMultiplier: 1.6 },
    },
  ],
};

const BOSS_ROOM: RiftRoomDef = {
  id: "anchorage-boss",
  type: "boss",
  title: "심층주 · 셈이 틀린 것",
  description:
    "가장 낮은 곳에 수면이 없다. 물이 벽까지 차 있는데 가운데만 비어 있고, " +
    "그 안에서 무언가 손가락을 접었다 폈다 하며 세고 있다. 숫자가 자꾸 어긋난다.",
  enemy: MISCOUNT,
  coinReward: [70, 95],
};

export const SUNKEN_ANCHORAGE = {
  id: "sunken-anchorage",
  name: "잠긴 정박지",
  sceneryStyle: "sunken-corridor" as const,
  entrance: ENTRANCE,
  boss: BOSS_ROOM,
  combatPool: COMBAT_ROOMS,
  hazardPool: HAZARD_ROOMS,
  eventPool: EVENT_ROOMS,
  rest: REST_ROOM,
};

export const ANCHORAGE_ROOMS: RiftRoomDef[] = [
  ENTRANCE,
  ...COMBAT_ROOMS,
  ...HAZARD_ROOMS,
  ...EVENT_ROOMS,
  REST_ROOM,
  BOSS_ROOM,
];
