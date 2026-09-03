import type { DialogueTree } from "../systems/DialogueSystem";
import type { CrestShape } from "../render/silhouettes";
import { israDialogue } from "./dialogues/isra";
import { rivDialogue } from "./dialogues/riv";
import { helgaDialogue } from "./dialogues/helga";
import { morenDialogue } from "./dialogues/moren";
import { borrowedFaceDialogue } from "./dialogues/borrowed-face";
import { countingMouthDialogue } from "./dialogues/counting-mouth";
import { silentPilgrimDialogue } from "./dialogues/silent-pilgrim";
import { ashBearerDialogue } from "./dialogues/ash-bearer";

export interface RegionNpcConfig {
  id: string;
  label: string;
  x: number;
  y: number;
  color: number;
  shape: CrestShape;
  dialogue: DialogueTree;
}

export interface RegionConfig {
  key: string;
  title: string;
  backgroundColor: number;
  /**
   * 이동 방식 — 선형 위험 구간(함정·전투)은 sidescroll, 되돌아와 상호작용하는
   * 허브형 공간(NPC 밀집, 반복 탐사)은 topdown이 자연스럽다.
   */
  movementMode: "topdown" | "sidescroll";
  /** sidescroll 전용: 월드 폭(카메라보다 넓음)과 캐릭터가 서는 바닥 y좌표. */
  worldWidth?: number;
  groundY?: number;
  /** sidescroll 전용: 점프로 올라설 수 있는 공중 발판. 진행에 필수는 아닌 보조 경로. */
  platforms?: { x: number; y: number; w: number; h: number }[];
  /** 필드에 놓인 파편 픽업 — 보통 발판 위에 얹어 점프에 목적을 준다. */
  pickups?: { id: string; x: number; y: number; fragmentReward: number }[];
  playerStart: { x: number; y: number };
  hazard?: {
    x: number;
    y: number;
    w: number;
    h: number;
    label: string;
    /** 있으면 즉사 대신 CombatScene을 연다. */
    combat?: { encounterId: string; enemyName: string; enemyMaxHp: number };
  };
  savePoint?: { id: string; x: number; y: number; label: string };
  npcs: RegionNpcConfig[];
  /** 분기점 도달 후 열리는 다음 지역. 없으면 이 지역이 이야기의 종착점. */
  nextRegionKey?: string;
  /**
   * 분기점과 무관하게 항상 오갈 수 있는 곁가지 통로 (파밍 루프 연결용).
   * 허브에서 여러 갈래로 뻗을 수 있도록 배열로 둔다.
   */
  sideExits?: { x: number; y: number; toRegionKey: string; label: string }[];
  /** 균열 진입구 — 닿으면 RiftScene으로 들어간다. */
  riftEntrance?: { x: number; y: number; label: string; riftId?: string };
  /** 환로 — 여진화로 뽑기와 교환을 하는 자리. */
  exchangePost?: { x: number; y: number; label: string };
}

export const REGIONS: Record<string, RegionConfig> = {
  // 함정 하나를 피하며 끝까지 걸어가는 선형 구간 — 횡스크롤이 어울린다.
  "sunken-corridor": {
    key: "sunken-corridor",
    title: "침수 회랑",
    backgroundColor: 0x14211c,
    movementMode: "sidescroll",
    worldWidth: 2200,
    groundY: 420,
    playerStart: { x: 80, y: 420 },
    // 크기는 Platforming.hazardClearance가 검증한다 — 여유 배율 1.4 미만이면 테스트가 실패한다.
    hazard: { x: 950, y: 420, w: 44, h: 90, label: "갈라진 바닥 — 점프로 넘으세요" },
    platforms: [{ x: 650, y: 340, w: 120, h: 16 }],
    pickups: [{ id: "sunken-corridor-ledge-1", x: 650, y: 310, fragmentReward: 10 }],
    savePoint: { id: "sp-1", x: 2080, y: 420, label: "회랑 안쪽 분기점" },
    npcs: [
      { id: "isra", label: "이스라", x: 500, y: 420, color: 0x4c6e5c, shape: "leaf", dialogue: israDialogue },
      // 말을 거는 것 자체가 위험한 상대. 함정 앞쪽에 둬서 그냥 지나칠 수 있게 했다.
      {
        id: "silent-pilgrim",
        label: "무릎 꿇은 사람",
        x: 1450,
        y: 420,
        color: 0x3d4a7c,
        shape: "zigzag",
        dialogue: silentPilgrimDialogue,
      },
    ],
    nextRegionKey: "ash-market",
  },

  // NPC와 상점이 모여 있고, 계속 되돌아와서 상호작용하는 허브 — 탑다운이 어울린다.
  "ash-market": {
    key: "ash-market",
    title: "재의 시장",
    backgroundColor: 0x2a2015,
    movementMode: "topdown",
    playerStart: { x: 80, y: 300 },
    savePoint: { id: "sp-2", x: 700, y: 300, label: "시장 뒷골목 분기점" },
    npcs: [
      { id: "riv", label: "리브 칸", x: 320, y: 420, color: 0x3d4a7c, shape: "diamond", dialogue: rivDialogue },
      // 한 마디씩은 전부 안전하다. 세 번 연속 동의할 때만 죽는다.
      {
        id: "counting-mouth",
        label: "앉아 있는 것",
        x: 840,
        y: 470,
        color: 0xa8873a,
        shape: "triangle",
        dialogue: countingMouthDialogue,
      },
    ],
    nextRegionKey: "frost-observatory",
    sideExits: [
      { x: 300, y: 550, toRegionKey: "endless-stairs", label: "곁길: 끝없는 계단" },
      { x: 700, y: 550, toRegionKey: "anchorage", label: "곁길: 정박지" },
    ],
    riftEntrance: { x: 800, y: 470, label: "균열: 유리맥의 지하도", riftId: "glassvein-underway" },
    exchangePost: { x: 560, y: 180, label: "환로" },
  },

  // 반복 방문하는 파밍 루프 던전 — 방 하나짜리 탑다운, 아이작류 구조에 가깝다.
  "endless-stairs": {
    key: "endless-stairs",
    title: "끝없는 계단",
    backgroundColor: 0x22201e,
    movementMode: "topdown",
    playerStart: { x: 480, y: 60 },
    hazard: {
      x: 480,
      y: 300,
      w: 960,
      h: 30,
      label: "무너지는 계단참 (닿으면 전투)",
      combat: { encounterId: "stairwell-wreckage", enemyName: "무너진 잔해", enemyMaxHp: 40 },
    },
    npcs: [
      { id: "moren", label: "모른", x: 480, y: 480, color: 0x8c8168, shape: "zigzag", dialogue: morenDialogue },
      // 사람이 아닌 상대. 말 한마디로 죽을 수 있는 첫 자리다.
      {
        id: "borrowed-face",
        label: "낯익은 얼굴",
        x: 170,
        y: 430,
        color: 0x7c1f2b,
        shape: "diamond",
        dialogue: borrowedFaceDialogue,
      },
      // 미끼. 가장 무섭게 생겼지만 해롭지 않다 — "수상하면 도망"이 유일한 답이
      // 되지 않도록 두는 반례.
      {
        id: "ash-bearer",
        label: "천으로 감싼 사람",
        x: 790,
        y: 430,
        color: 0x4c6e5c,
        shape: "leaf",
        dialogue: ashBearerDialogue,
      },
    ],
    sideExits: [{ x: 480, y: 560, toRegionKey: "ash-market", label: "재의 시장으로 돌아가기" }],
  },

  // 정면 승부 불가 구간을 뚫고 헬가에게 도달하는 선형 구간 — 횡스크롤.
  "frost-observatory": {
    key: "frost-observatory",
    title: "서리 관측소",
    backgroundColor: 0x1a2230,
    movementMode: "sidescroll",
    worldWidth: 2000,
    groundY: 420,
    playerStart: { x: 80, y: 420 },
    hazard: { x: 1000, y: 420, w: 50, h: 96, label: "서리 갈퀴 — 점프로 넘으세요" },
    platforms: [{ x: 700, y: 340, w: 120, h: 16 }, { x: 1350, y: 340, w: 120, h: 16 }],
    pickups: [
      { id: "frost-observatory-ledge-1", x: 700, y: 310, fragmentReward: 10 },
      { id: "frost-observatory-ledge-2", x: 1350, y: 310, fragmentReward: 15 },
    ],
    npcs: [{ id: "helga", label: "헬가 도른", x: 1750, y: 420, color: 0xa8873a, shape: "triangle", dialogue: helgaDialogue }],
    // nextRegionKey 없음 — 헬가와의 대화가 끝나면 엔딩으로 이어진다.
  },

  // --- 곁가지 지역 ---------------------------------------------------------

  // 정박지 — 던전 허브. 물이 빠지지 않는 항구, 잠긴 정박지 균열로 내려가는 자리.
  // NPC 대신 상호작용 지점을 촘촘히 둬서 "장비 갖추고 내려가는 곳" 역할을 맡긴다.
  anchorage: {
    key: "anchorage",
    title: "정박지",
    backgroundColor: 0x12242c,
    movementMode: "topdown",
    playerStart: { x: 80, y: 300 },
    pickups: [
      { id: "anchorage-pier-1", x: 300, y: 180, fragmentReward: 12 },
      { id: "anchorage-pier-2", x: 820, y: 380, fragmentReward: 18 },
    ],
    npcs: [],
    sideExits: [
      { x: 120, y: 550, toRegionKey: "ash-market", label: "재의 시장으로 돌아가기" },
      { x: 860, y: 550, toRegionKey: "boundary-gate", label: "곁길: 경계문 앞" },
    ],
    riftEntrance: {
      x: 520,
      y: 430,
      label: "균열: 잠긴 정박지",
      riftId: "sunken-anchorage",
    },
    exchangePost: { x: 780, y: 170, label: "환로 (부두)" },
  },

  // 경계문 앞 — 색이 거의 빠진 선형 구간. 지나가려면 붙어 있는 것을 떼어내야 한다.
  "boundary-gate": {
    key: "boundary-gate",
    title: "경계문 앞",
    backgroundColor: 0x1a181e,
    movementMode: "sidescroll",
    worldWidth: 2400,
    groundY: 420,
    playerStart: { x: 70, y: 380 },
    // 크기는 Platforming.hazardClearance가 검증한다 — 여유 배율 1.4 미만이면 테스트가 실패한다.
    hazard: { x: 1150, y: 420, w: 46, h: 88, label: "갈라진 포석 — 점프로 넘으세요" },
    platforms: [
      { x: 620, y: 330, w: 130, h: 16 },
      { x: 1600, y: 320, w: 130, h: 16 },
    ],
    pickups: [
      { id: "boundary-ledge-1", x: 620, y: 300, fragmentReward: 14 },
      { id: "boundary-ledge-2", x: 1600, y: 290, fragmentReward: 20 },
    ],
    npcs: [],
    sideExits: [{ x: 60, y: 420, toRegionKey: "anchorage", label: "정박지로 돌아가기" }],
  },
};

export const FIRST_REGION_KEY = "sunken-corridor";
