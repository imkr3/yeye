import type { CombatState } from "./CombatSystem";
import { addStain } from "./StainSystem";
import { addWardCharge, removeConsumable, type RegressionState } from "./RegressionSystem";

/**
 * 아이템 효과 레지스트리.
 *
 * 유물은 이벤트를 "구독"하지 않는다. 장착 목록에서 매번 순수 함수로 수정치를 계산해
 * 쓰기만 한다. 그래서 구독 해제를 잊어 두 번 발동하거나, 장착 해제 후에도 효과가
 * 남는 부류의 버그가 구조적으로 생길 수 없다.
 *
 * 소모품은 "사용하는 순간" 한 번만 적용되며, 필드용과 전투용을 나눠 등록한다.
 */

// ---------------------------------------------------------------------------
// 유물 — 장착 목록에서 파생되는 수정치
// ---------------------------------------------------------------------------

export interface RelicModifiers {
  /** 기초 타격에 더해지는 고정 피해 */
  basicStrikeBonus: number;
  /** 방어 감소율에 더해지는 보정 (0.15 = 15%p) */
  guardBonus: number;
  /** 회복량 배율 */
  healingMultiplier: number;
  /** 여진화 보상 배율 */
  coinMultiplier: number;
  /** 상점 가격 할인율 (0.2 = 20% 할인) */
  shopDiscount: number;
  /** 죽음의 기억 최소 단계 — 첫 조우에도 이만큼은 보인다 */
  memoryFloor: number;
  /** 함정 피해 배율 */
  trapDamageMultiplier: number;
  /** 얼룩이 오를 때 얻는 파편 */
  fragmentsOnStain: number;
  /** 전투 시작 시 받는 보호막 */
  startingShield: number;
  /** 필드 이동 속도 배율 */
  moveSpeedMultiplier: number;
  /** 분기점 갱신 시 추가로 얻는 파편 */
  savePointFragmentBonus: number;
  /** 전투 시작 시 주어지는 무료 행동 횟수 (적이 반격하지 않는 턴) */
  freeActions: number;
  /** 개인 범람 지속 턴 감소 */
  overflowShorten: number;
  /** NPC 신뢰 획득 배율 */
  trustMultiplier: number;
  /** 트루엔딩 판정에 더해지는 가산점 */
  endingTrustBonus: number;
  /** 진열대 추가 슬롯 */
  relicSlotBonus: number;
  /** 균열의 방 구성을 미리 보여준다 */
  revealRooms: boolean;
}

export const NEUTRAL_MODIFIERS: RelicModifiers = {
  basicStrikeBonus: 0,
  guardBonus: 0,
  healingMultiplier: 1,
  coinMultiplier: 1,
  shopDiscount: 0,
  memoryFloor: 0,
  trapDamageMultiplier: 1,
  fragmentsOnStain: 0,
  startingShield: 0,
  moveSpeedMultiplier: 1,
  savePointFragmentBonus: 0,
  freeActions: 0,
  overflowShorten: 0,
  trustMultiplier: 1,
  endingTrustBonus: 0,
  relicSlotBonus: 0,
  revealRooms: false,
};

type RelicModifier = (mods: RelicModifiers) => void;

/** 실제 효과가 붙은 유물. 여기 없는 유물은 아직 설명만 있는 상태다. */
const RELIC_EFFECTS: Record<string, { note: string; apply: RelicModifier }> = {
  "worn-leather-gloves": {
    note: "기초 타격 피해 +3",
    apply: (m) => {
      m.basicStrikeBonus += 3;
    },
  },
  "waterproof-boots": {
    note: "함정 피해 25% 감소",
    apply: (m) => {
      m.trapDamageMultiplier *= 0.75;
    },
  },
  "isras-glass-bead": {
    note: "죽음의 기억이 최소 1단계에서 시작",
    apply: (m) => {
      m.memoryFloor = Math.max(m.memoryFloor, 1);
    },
  },
  "rivs-calculator": {
    note: "환로 가격 20% 할인",
    apply: (m) => {
      m.shopDiscount = Math.max(m.shopDiscount, 0.2);
    },
  },
  "frost-rimmed-lens": {
    note: "전투 시작 시 보호막 6",
    apply: (m) => {
      m.startingShield += 6;
    },
  },
  "stained-diary": {
    note: "얼룩이 오를 때마다 파편 +2",
    apply: (m) => {
      m.fragmentsOnStain += 2;
    },
  },
  "helgas-broken-staff-shard": {
    note: "방어 감소율 +12%p",
    apply: (m) => {
      m.guardBonus += 0.12;
    },
  },
  "moss-ring": {
    note: "회복량 40% 증가",
    apply: (m) => {
      m.healingMultiplier *= 1.4;
    },
  },
  "ash-crystal-core": {
    note: "여진화 획득 30% 증가",
    apply: (m) => {
      m.coinMultiplier *= 1.3;
    },
  },
  "stairwell-shadow": {
    note: "죽음의 기억이 항상 최대 단계",
    apply: (m) => {
      m.memoryFloor = 3;
    },
  },
  "worn-wristwatch": {
    note: "이동 속도 15% 증가",
    apply: (m) => {
      m.moveSpeedMultiplier *= 1.15;
    },
  },
  "second-save": {
    note: "분기점 갱신 시 파편 +15",
    apply: (m) => {
      m.savePointFragmentBonus += 15;
    },
  },
  "corroded-atlas": {
    note: "균열의 방 구성을 미리 볼 수 있다",
    apply: (m) => {
      m.revealRooms = true;
    },
  },
  "cracked-pocket-watch": {
    note: "전투 시작 시 반격받지 않는 행동 1회",
    apply: (m) => {
      m.freeActions += 1;
    },
  },
  "overflow-condensate": {
    note: "개인 범람 지속이 1턴 짧아진다",
    apply: (m) => {
      m.overflowShorten += 1;
    },
  },
  "morens-old-footprint": {
    note: "여진화 획득 20% 추가 증가",
    apply: (m) => {
      m.coinMultiplier *= 1.2;
    },
  },
  "silent-seal-shard": {
    note: "NPC 신뢰 획득이 두 배가 된다",
    apply: (m) => {
      m.trustMultiplier *= 2;
    },
  },
  "unspoken-name-fragment": {
    note: "숨겨진 결말 판정에 가산점",
    apply: (m) => {
      m.endingTrustBonus += 1;
    },
  },
  "double-vow-seal": {
    note: "진열대 슬롯 +1",
    apply: (m) => {
      m.relicSlotBonus += 1;
    },
  },
  "residue-necklace": {
    note: "환로 가격 10% 추가 할인",
    apply: (m) => {
      m.shopDiscount = Math.min(0.6, m.shopDiscount + 0.1);
    },
  },
};

export function relicHasEffect(itemId: string): boolean {
  return itemId in RELIC_EFFECTS;
}

export function relicEffectNote(itemId: string): string | null {
  return RELIC_EFFECTS[itemId]?.note ?? null;
}

/** 장착된 유물에서 수정치를 계산한다. 순수 함수라 몇 번을 불러도 결과가 같다. */
export function relicModifiers(equippedRelics: readonly string[]): RelicModifiers {
  const mods: RelicModifiers = { ...NEUTRAL_MODIFIERS };
  // 중복 장착이 들어와도 한 번만 적용한다.
  for (const id of new Set(equippedRelics)) {
    RELIC_EFFECTS[id]?.apply(mods);
  }
  return mods;
}

// ---------------------------------------------------------------------------
// 소모품 — 사용 시 1회 적용
// ---------------------------------------------------------------------------

export interface RiftUseContext {
  /** 남은 방 정보를 드러낸다. */
  revealRooms?: number;
  /** 다음 함정에 대한 기억을 임시로 올린다. */
  trapInsight?: boolean;
  /** 현재 방을 건너뛴다. */
  skipRoom?: boolean;
  /** 심층주로 곧장 간다. */
  jumpToBoss?: boolean;
  /** 체력 회복량. */
  heal?: number;
  /** 얼룩 변화량. */
  stain?: number;
  message: string;
}

export interface ConsumableDefinition {
  /** 전투 중 사용 가능 여부 */
  combat?: (state: CombatState, mods: RelicModifiers) => string;
  /** 필드(인벤토리)에서 사용 가능 여부 */
  field?: (state: RegressionState) => RegressionState;
  /** 균열 안에서 사용 가능 여부 — 방 구조에 개입한다 */
  rift?: () => RiftUseContext;
  note: string;
}

const CONSUMABLE_EFFECTS: Record<string, ConsumableDefinition> = {
  "warding-talisman": {
    note: "다음 죽음 페널티를 1회 막는다",
    field: (state) => addWardCharge(state),
  },
  "dried-jerky": {
    note: "체력 14 회복",
    combat: (state, mods) => {
      const healed = Math.round(14 * mods.healingMultiplier);
      state.player.hp = Math.min(state.player.maxHp, state.player.hp + healed);
      return `마른 육포 — 체력 ${healed} 회복.`;
    },
  },
  "half-full-canteen": {
    note: "체력 10 회복, 얼룩 6 감소",
    combat: (state, mods) => {
      const healed = Math.round(10 * mods.healingMultiplier);
      state.player.hp = Math.min(state.player.maxHp, state.player.hp + healed);
      state.player.stain = addStain(state.player.stain, -6);
      return `반쯤 남은 물통 — 체력 ${healed} 회복, 얼룩이 조금 가라앉는다.`;
    },
  },
  "stain-suppressant": {
    note: "얼룩 20 감소",
    combat: (state) => {
      state.player.stain = addStain(state.player.stain, -20);
      return "얼룩 억제 연고 — 번지던 얼룩이 물러난다.";
    },
  },
  "ash-filter-bottle": {
    note: "보호막 14 획득",
    combat: (state) => {
      state.player.shield += 14;
      return "재의 여과병 — 얇은 보호막이 몸을 감싼다.";
    },
  },
  "truth-buoy": {
    note: "이번 전투의 적 의도를 완전히 드러낸다",
    combat: (state) => {
      state.memoryTier = 3;
      return "거짓말 탐지 부표 — 상대의 다음 수가 또렷하게 읽힌다.";
    },
  },
  "overflow-shard": {
    note: "강력한 일격, 얼룩 18 증가",
    combat: (state) => {
      const dealt = Math.round(state.enemy.def.maxHp * 0.22);
      state.enemy.hp = Math.max(0, state.enemy.hp - dealt);
      state.record.damageDealt += dealt;
      state.player.stain = addStain(state.player.stain, 18);
      return `대범람의 파편 — ${dealt}의 피해. 손끝이 저릿하다.`;
    },
  },
  "morens-stair-chart": {
    note: "적 패턴을 전부 드러낸다",
    combat: (state) => {
      state.memoryTier = 3;
      state.enemy.markedPlayer = false;
      return "모른의 계단표 — 다음 박자가 전부 적혀 있다.";
    },
  },
  "damp-matches": {
    note: "다음 한 수가 잠깐 보인다",
    combat: (state) => {
      state.memoryTier = Math.max(state.memoryTier, 1);
      return "눅눅한 성냥 — 잠깐 불이 붙는다. 그 사이에 상대의 손이 보였다.";
    },
  },
  "ash-bead-necklace": {
    note: "보호막 6 획득",
    combat: (state) => {
      state.player.shield += 6;
      return "여진 방울 목걸이 — 옅은 빛이 몸을 감싼다.";
    },
  },
  "rewound-hand": {
    note: "체력을 절반까지 되돌린다",
    combat: (state) => {
      const target = Math.round(state.player.maxHp * 0.5);
      if (state.player.hp >= target) return "되감긴 시침 — 아직 되돌릴 것이 없다.";
      const healed = target - state.player.hp;
      state.player.hp = target;
      return `되감긴 시침 — 시곗바늘이 거꾸로 돈다. 체력 ${healed} 회복.`;
    },
  },
  "vow-ghostwrite": {
    note: "서약 역류를 가라앉힌다",
    field: (state) => ({
      ...state,
      storyFlags: state.storyFlags.filter((f) => f !== "vow-backlash"),
    }),
  },
  "dull-flint": {
    note: "균열에서 잠깐 쉬어간다 (체력 12, 얼룩 -4)",
    rift: () => ({ heal: 12, stain: -4, message: "무딘 부싯돌 — 작은 불을 피워 잠시 숨을 돌린다." }),
  },
  "moldy-map-scrap": {
    note: "균열에서 앞의 방 2개를 드러낸다",
    rift: () => ({ revealRooms: 2, message: "곰팡이 슨 지도 조각 — 앞쪽 두 칸이 흐릿하게 읽힌다." }),
  },
  "helgas-notebook-copy": {
    note: "균열의 방 구성을 전부 드러낸다",
    rift: () => ({ revealRooms: 99, message: "헬가의 실험 노트 사본 — 지하도의 구조가 표로 정리되어 있다." }),
  },
  "stairkeepers-mark": {
    note: "다음 함정을 미리 읽는다",
    rift: () => ({ trapInsight: true, message: "계단지기의 표식 — 다음 함정의 박자가 손끝에 남는다." }),
  },
  "translucent-key": {
    note: "균열의 현재 방을 건너뛴다",
    rift: () => ({ skipRoom: true, message: "반투명 열쇠 — 없던 문이 열린다. 이 방은 지나간다." }),
  },
  "unnamed-invitation": {
    note: "심층주 앞으로 곧장 간다",
    rift: () => ({ jumpToBoss: true, message: "이름 없는 자의 초대장 — 길이 접힌다. 최심부가 바로 앞이다." }),
  },
};

export function consumableHasCombatUse(itemId: string): boolean {
  return !!CONSUMABLE_EFFECTS[itemId]?.combat;
}

export function consumableHasRiftUse(itemId: string): boolean {
  return !!CONSUMABLE_EFFECTS[itemId]?.rift;
}

/** 균열 안에서의 사용 결과. 아이템 소모는 호출부가 처리한다. */
export function riftUseEffect(itemId: string): RiftUseContext | null {
  return CONSUMABLE_EFFECTS[itemId]?.rift?.() ?? null;
}

export function consumableHasFieldUse(itemId: string): boolean {
  return !!CONSUMABLE_EFFECTS[itemId]?.field;
}

export function consumableEffectNote(itemId: string): string | null {
  return CONSUMABLE_EFFECTS[itemId]?.note ?? null;
}

/** 전투 중 사용. 로그 문구를 돌려준다. */
export function applyCombatConsumable(
  state: CombatState,
  itemId: string,
  mods: RelicModifiers
): string {
  const effect = CONSUMABLE_EFFECTS[itemId]?.combat;
  if (!effect) return "";
  return effect(state, mods);
}

/** 필드에서 사용. 아이템 소모까지 함께 처리한다. */
export function applyFieldConsumable(state: RegressionState, itemId: string): RegressionState {
  const effect = CONSUMABLE_EFFECTS[itemId]?.field;
  if (!effect) return state;
  return effect(removeConsumable(state, itemId));
}

/** 실제 효과가 하나라도 붙어 있는 소모품인지. */
export function consumableHasAnyEffect(itemId: string): boolean {
  return itemId in CONSUMABLE_EFFECTS;
}
