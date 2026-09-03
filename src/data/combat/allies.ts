/**
 * 동료 지원.
 *
 * 호감도 시스템이 결말에서만 값을 하면 플레이 중에는 체감되지 않는다. 그래서
 * 동료로 굳은 인물은 전투에 실제로 끼어든다.
 *
 * 설계 규칙:
 * - 동료마다 하는 일이 다르다. 전부 "피해를 더한다"면 누구와 친해지든 같아진다.
 * - 매 턴 오지 않는다. 각자 주기가 있어서, 언제 도움이 오는지를 세는 것도 전투의 일부다.
 * - 무작위가 아니라 턴 수로 정해진다 — 같은 전투는 같게 흘러야 회귀의 학습이 의미를 갖는다.
 */

export type AllySupportKind = "damage" | "heal" | "shield" | "cleanse" | "reveal" | "weaken";

export interface AllyDef {
  npcId: string;
  name: string;
  /** 몇 턴마다 끼어드는지. */
  everyTurns: number;
  kind: AllySupportKind;
  /** 효과 크기 — 종류에 따라 피해량·회복량·보호막 등으로 해석된다. */
  amount: number;
  /** 지원할 때의 대사. 전투 로그에 그대로 남는다. */
  line: string;
}

export const ALLY_SUPPORTS: Record<string, AllyDef> = {
  isra: {
    npcId: "isra",
    name: "이스라",
    everyTurns: 3,
    kind: "heal",
    amount: 11,
    line: "이스라가 붕대를 던진다. \"죽는 건 나중에 세도 돼요.\"",
  },
  riv: {
    npcId: "riv",
    name: "리브 칸",
    everyTurns: 4,
    kind: "shield",
    amount: 14,
    line: "리브가 장부를 펼쳐 앞을 가린다. \"이건 외상으로 달아두죠.\"",
  },
  helga: {
    npcId: "helga",
    name: "헬가 도른",
    everyTurns: 3,
    kind: "weaken",
    amount: 2,
    line: "헬가가 관측 결과를 외친다. \"오른쪽! 거기가 얇아!\"",
  },
  moren: {
    npcId: "moren",
    name: "모른",
    everyTurns: 4,
    kind: "reveal",
    amount: 1,
    line: "모른이 조용히 센다. \"…다음은 세 번째예요.\"",
  },
  "ash-bearer": {
    npcId: "ash-bearer",
    name: "재를 지고 가는 사람",
    everyTurns: 5,
    kind: "cleanse",
    amount: 16,
    line: "재를 지고 가는 사람이 한 줌을 뿌린다. 얼룩이 그 위로 옮겨 붙는다.",
  },
  "salt-warden": {
    npcId: "salt-warden",
    name: "소금 관리인",
    everyTurns: 3,
    kind: "damage",
    amount: 9,
    line: "소금 관리인이 굳은 덩어리를 내던진다.",
  },
};

export function allyDefsFor(npcIds: readonly string[]): AllyDef[] {
  return npcIds.map((id) => ALLY_SUPPORTS[id]).filter((a): a is AllyDef => !!a);
}
