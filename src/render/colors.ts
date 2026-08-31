/**
 * 색 보간 유틸 — 입체 음영 렌더링의 기반.
 * Phaser의 Graphics는 그라디언트를 직접 지원하지 않는 도형이 많아,
 * 색을 단계적으로 섞어 스트립/동심원으로 쌓는 방식으로 볼륨감을 만든다.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function toRgb(color: number): Rgb {
  return {
    r: (color >> 16) & 0xff,
    g: (color >> 8) & 0xff,
    b: color & 0xff,
  };
}

export function toHex(rgb: Rgb): number {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (clamp(rgb.r) << 16) | (clamp(rgb.g) << 8) | clamp(rgb.b);
}

/** 두 색을 t(0~1) 비율로 섞는다. */
export function lerpColor(a: number, b: number, t: number): number {
  const ca = toRgb(a);
  const cb = toRgb(b);
  return toHex({
    r: ca.r + (cb.r - ca.r) * t,
    g: ca.g + (cb.g - ca.g) * t,
    b: ca.b + (cb.b - ca.b) * t,
  });
}

/** amount > 0 이면 밝게, < 0 이면 어둡게. -1~1 범위. */
export function shade(color: number, amount: number): number {
  return amount >= 0 ? lerpColor(color, 0xffffff, amount) : lerpColor(color, 0x000000, -amount);
}

/** 대기 원근 — 멀리 있는 것일수록 안개색에 가깝고 대비가 낮아진다. */
export function atmospheric(color: number, fog: number, distance: number): number {
  return lerpColor(color, fog, Math.max(0, Math.min(1, distance)));
}

/** 채도를 낮춰 원경/그림자 표현에 쓴다. */
export function desaturate(color: number, amount: number): number {
  const c = toRgb(color);
  const gray = c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
  return toHex({
    r: c.r + (gray - c.r) * amount,
    g: c.g + (gray - c.g) * amount,
    b: c.b + (gray - c.b) * amount,
  });
}
