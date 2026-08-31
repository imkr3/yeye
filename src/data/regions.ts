import type { DialogueTree } from "../systems/DialogueSystem";
import type { CrestShape } from "../render/silhouettes";
import { israDialogue } from "./dialogues/isra";
import { rivDialogue } from "./dialogues/riv";
import { helgaDialogue } from "./dialogues/helga";
import { morenDialogue } from "./dialogues/moren";

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
  /** 분기점과 무관하게 항상 오갈 수 있는 곁가지 통로 (파밍 루프 연결용). */
  sideExit?: { x: number; y: number; toRegionKey: string; label: string };
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
    hazard: { x: 950, y: 420, w: 44, h: 140, label: "함정 — 점프로 넘으세요" },
    platforms: [{ x: 650, y: 340, w: 120, h: 16 }],
    savePoint: { id: "sp-1", x: 2080, y: 420, label: "회랑 안쪽 분기점" },
    npcs: [{ id: "isra", label: "이스라", x: 500, y: 420, color: 0x4c6e5c, shape: "leaf", dialogue: israDialogue }],
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
    npcs: [{ id: "riv", label: "리브 칸", x: 320, y: 420, color: 0x3d4a7c, shape: "diamond", dialogue: rivDialogue }],
    nextRegionKey: "frost-observatory",
    sideExit: { x: 480, y: 550, toRegionKey: "endless-stairs", label: "곁길: 끝없는 계단" },
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
    npcs: [{ id: "moren", label: "모른", x: 480, y: 480, color: 0x8c8168, shape: "zigzag", dialogue: morenDialogue }],
    sideExit: { x: 480, y: 560, toRegionKey: "ash-market", label: "재의 시장으로 돌아가기" },
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
    hazard: { x: 1000, y: 420, w: 50, h: 150, label: "정면 승부 불가 구간 — 점프로 넘으세요" },
    platforms: [{ x: 700, y: 340, w: 120, h: 16 }, { x: 1350, y: 340, w: 120, h: 16 }],
    npcs: [{ id: "helga", label: "헬가 도른", x: 1750, y: 420, color: 0xa8873a, shape: "triangle", dialogue: helgaDialogue }],
    // nextRegionKey 없음 — 헬가와의 대화가 끝나면 엔딩으로 이어진다.
  },
};

export const FIRST_REGION_KEY = "sunken-corridor";
