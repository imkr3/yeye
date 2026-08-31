/**
 * 소모품 실사용 효과 레지스트리.
 *
 * 아이템 40종 전부에 즉시 기능을 붙이지 않는다 — 실제 게임 시스템과 자연스럽게
 * 연결되는 것부터 하나씩 늘려나간다 (설계 문서 11.3 커밋 메시지 방식과 동일한 원칙).
 * 여기 등록되지 않은 아이템은 인벤토리에서 "사용" 버튼이 뜨지 않고 텍스트 설명만 보여준다.
 */

import { addWardCharge, removeConsumable, type RegressionState } from "./RegressionSystem";

type EffectHandler = (state: RegressionState) => RegressionState;

const EFFECT_HANDLERS: Partial<Record<string, EffectHandler>> = {
  // 액막이 종이부적 — 다음 죽음 페널티를 1회 방지한다.
  "warding-talisman": (state) => addWardCharge(state),
};

export function hasConsumableEffect(itemId: string): boolean {
  return itemId in EFFECT_HANDLERS;
}

/** 아이템을 하나 소모하고 효과를 적용한다. 효과가 없으면 아무 일도 일어나지 않는다. */
export function useConsumable(state: RegressionState, itemId: string): RegressionState {
  const handler = EFFECT_HANDLERS[itemId];
  if (!handler) return state;
  return handler(removeConsumable(state, itemId));
}
