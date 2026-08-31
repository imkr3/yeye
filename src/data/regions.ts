import type { DialogueTree } from "../systems/DialogueSystem";
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
  dialogue: DialogueTree;
}

export interface RegionConfig {
  key: string;
  title: string;
  backgroundColor: number;
  playerStart: { x: number; y: number };
  hazard?: { x: number; y: number; w: number; h: number; label: string };
  savePoint?: { id: string; x: number; y: number; label: string };
  npcs: RegionNpcConfig[];
  /** 분기점 도달 후 열리는 다음 지역. 없으면 이 지역이 이야기의 종착점. */
  nextRegionKey?: string;
  /** 분기점과 무관하게 항상 오갈 수 있는 곁가지 통로 (파밍 루프 연결용). */
  sideExit?: { x: number; y: number; toRegionKey: string; label: string };
}

export const REGIONS: Record<string, RegionConfig> = {
  "sunken-corridor": {
    key: "sunken-corridor",
    title: "침수 회랑",
    backgroundColor: 0x14211c,
    playerStart: { x: 100, y: 300 },
    hazard: { x: 450, y: 300, w: 40, h: 400, label: "함정 (닿으면 회귀)" },
    savePoint: { id: "sp-1", x: 700, y: 300, label: "회랑 안쪽 분기점" },
    npcs: [{ id: "isra", label: "이스라", x: 250, y: 420, color: 0x4c6e5c, dialogue: israDialogue }],
    nextRegionKey: "ash-market",
  },
  "ash-market": {
    key: "ash-market",
    title: "재의 시장",
    backgroundColor: 0x2a2015,
    playerStart: { x: 80, y: 300 },
    savePoint: { id: "sp-2", x: 700, y: 300, label: "시장 뒷골목 분기점" },
    npcs: [{ id: "riv", label: "리브 칸", x: 320, y: 420, color: 0x3d4a7c, dialogue: rivDialogue }],
    nextRegionKey: "frost-observatory",
    sideExit: { x: 480, y: 550, toRegionKey: "endless-stairs", label: "곁길: 끝없는 계단" },
  },
  "endless-stairs": {
    key: "endless-stairs",
    title: "끝없는 계단",
    backgroundColor: 0x22201e,
    playerStart: { x: 480, y: 60 },
    hazard: { x: 480, y: 300, w: 960, h: 30, label: "무너지는 계단참" },
    npcs: [{ id: "moren", label: "모른", x: 480, y: 480, color: 0x8c8168, dialogue: morenDialogue }],
    sideExit: { x: 480, y: 560, toRegionKey: "ash-market", label: "재의 시장으로 돌아가기" },
  },
  "frost-observatory": {
    key: "frost-observatory",
    title: "서리 관측소",
    backgroundColor: 0x1a2230,
    playerStart: { x: 80, y: 480 },
    hazard: { x: 480, y: 150, w: 960, h: 40, label: "정면 승부 불가 구간" },
    npcs: [{ id: "helga", label: "헬가 도른", x: 480, y: 400, color: 0xa8873a, dialogue: helgaDialogue }],
    // nextRegionKey 없음 — 헬가와의 대화가 끝나면 엔딩으로 이어진다.
  },
};

export const FIRST_REGION_KEY = "sunken-corridor";
