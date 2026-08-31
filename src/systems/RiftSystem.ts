import { createRng } from "./Rng";
import { GLASSVEIN_UNDERWAY, type RiftRoomDef } from "../data/rifts/glassvein";

/**
 * 균열 진행 — 시드 기반 방 순서 조합.
 *
 * 완전 무작위였다면 "지난번에 배운 것"이 쓸모없어진다. 같은 회귀 주기(runSeed) 안에서는
 * 항상 같은 배치를 내주고, 심층주를 격파하거나 새 분기점에 도달할 때만 시드가 갱신된다.
 */

export interface RiftRun {
  riftId: string;
  riftName: string;
  seed: string;
  /** 확정된 방 순서. */
  rooms: RiftRoomDef[];
  /** 현재 위치한 방 인덱스. */
  index: number;
  /** 이 시도에서 이미 해결한 방. */
  resolvedRoomIds: string[];
  /** 휴식에서 "더 깊이 들여다본" 결과 — 다음 방 보상 배율. */
  nextRewardMultiplier: number;
  /** 이번 시도의 위험도 상승 여부. */
  riskUp: boolean;
  /** 균열 안에서만 유지되는 임시 체력. */
  hp: number;
  maxHp: number;
}

/** 시드에서 방 순서를 결정한다. 같은 시드 → 항상 같은 결과. */
export function buildRiftRun(seed: string, playerMaxHp: number): RiftRun {
  const rift = GLASSVEIN_UNDERWAY;
  const rng = createRng(`${seed}:${rift.id}`);

  // 일반 방 2개는 전투와 함정 후보를 섞어서 뽑는다.
  const generalPool = rng.shuffle([...rift.combatPool, ...rift.hazardPool]);
  const generalRooms = generalPool.slice(0, 2);

  // 세 번째 방은 사건 또는 휴식.
  const middleRoom = rng.chance(0.65) ? rng.pick(rift.eventPool) : rift.rest;

  return {
    riftId: rift.id,
    riftName: rift.name,
    seed,
    rooms: [rift.entrance, ...generalRooms, middleRoom, rift.boss],
    index: 0,
    resolvedRoomIds: [],
    nextRewardMultiplier: 1,
    riskUp: false,
    hp: playerMaxHp,
    maxHp: playerMaxHp,
  };
}

export function currentRoom(run: RiftRun): RiftRoomDef {
  return run.rooms[Math.min(run.index, run.rooms.length - 1)];
}

export function isLastRoom(run: RiftRun): boolean {
  return run.index >= run.rooms.length - 1;
}

/** 방을 해결하고 다음으로 넘어간다. */
export function advanceRoom(run: RiftRun): RiftRun {
  const room = currentRoom(run);
  return {
    ...run,
    index: Math.min(run.index + 1, run.rooms.length - 1),
    resolvedRoomIds: run.resolvedRoomIds.includes(room.id)
      ? run.resolvedRoomIds
      : [...run.resolvedRoomIds, room.id],
    // 보상 배율은 한 방에만 적용되고 소모된다.
    nextRewardMultiplier: 1,
  };
}

export function damageRun(run: RiftRun, amount: number): RiftRun {
  return { ...run, hp: Math.max(0, run.hp - amount) };
}

export function healRun(run: RiftRun, amount: number): RiftRun {
  return { ...run, hp: Math.min(run.maxHp, run.hp + amount) };
}

/** 진행률 표시용 — 입구를 0, 심층주를 1로 본다. */
export function riftProgress(run: RiftRun): number {
  return run.rooms.length <= 1 ? 0 : run.index / (run.rooms.length - 1);
}
