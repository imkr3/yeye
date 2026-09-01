/**
 * 횡스크롤 구간의 점프 물리.
 *
 * 함정 크기를 눈대중으로 정하면 "넘을 수 있어 보이지만 실제로는 불가능한" 함정이
 * 조용히 만들어진다. 실제로 그런 함정이 두 개 있었다 — 서리 관측소 쪽은 아무리
 * 잘 눌러도 넘을 수 없었고, 침수 회랑 쪽은 프레임 단위로 정확해야 했다.
 *
 * 그래서 점프 관련 상수와 판정식을 여기 한 곳에 모으고, 테스트가 모든 함정에 대해
 * 여유를 확인한다. 값을 바꾸면 테스트가 먼저 잡는다.
 */

export const PLATFORMING = {
  /** 점프 시작 속도의 크기 (위쪽). */
  jumpSpeed: 420,
  gravity: 900,
  runSpeed: 220,
  /** 플레이어 물리 바디는 반지름 14의 원. */
  playerBodyRadius: 14,
  /** 바닥 충돌체는 groundY보다 이만큼 아래에 놓인다. */
  groundColliderOffset: 20,
  groundColliderThickness: 8,
};

/** 넘을 수 있다고 보기 위한 최소 여유 배율. 1.0은 프레임 단위 정확도를 요구한다. */
export const MIN_CLEARANCE_RATIO = 1.4;

/** 점프로 올라갈 수 있는 최대 높이. */
export function maxJumpRise(): number {
  const { jumpSpeed, gravity } = PLATFORMING;
  return (jumpSpeed * jumpSpeed) / (2 * gravity);
}

/** 플레이어가 바닥에 서 있을 때 물리 바디 아래쪽의 y좌표. */
export function standingFootY(groundY: number): number {
  const { groundColliderOffset, groundColliderThickness } = PLATFORMING;
  return groundY + groundColliderOffset - groundColliderThickness / 2;
}

export interface HazardBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Clearance {
  /** 함정 위를 지나가려면 발이 올라가야 하는 높이. */
  requiredRise: number;
  /** 그 높이 위에 머무는 시간. */
  airWindow: number;
  /** 함정을 가로지르는 데 걸리는 시간. */
  crossingTime: number;
  /** airWindow / crossingTime. 1 미만이면 물리적으로 불가능하다. */
  ratio: number;
}

/**
 * 함정을 점프로 넘을 수 있는지 계산한다.
 * 함정 사각형은 (x, y)를 중심으로 하므로 윗면은 y - h/2다.
 */
export function hazardClearance(hazard: HazardBox, groundY: number): Clearance {
  const { jumpSpeed, gravity, runSpeed, playerBodyRadius } = PLATFORMING;
  const hazardTop = hazard.y - hazard.h / 2;
  const requiredRise = standingFootY(groundY) - hazardTop;

  // 함정 폭에 플레이어 바디 지름을 더해야 실제로 "완전히 지나간" 거리가 된다.
  const crossingTime = (hazard.w + playerBodyRadius * 2) / runSpeed;

  if (requiredRise <= 0) {
    return { requiredRise, airWindow: Infinity, crossingTime, ratio: Infinity };
  }

  // rise(t) = jumpSpeed*t - gravity*t^2/2 가 requiredRise 이상인 구간의 길이.
  const disc = jumpSpeed * jumpSpeed - 2 * gravity * requiredRise;
  if (disc <= 0) return { requiredRise, airWindow: 0, crossingTime, ratio: 0 };

  const airWindow = (2 * Math.sqrt(disc)) / gravity;
  return { requiredRise, airWindow, crossingTime, ratio: airWindow / crossingTime };
}

/** 여유를 두고 넘을 수 있는 함정인지. */
export function canClearHazard(hazard: HazardBox, groundY: number): boolean {
  return hazardClearance(hazard, groundY).ratio >= MIN_CLEARANCE_RATIO;
}
