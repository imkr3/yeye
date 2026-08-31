import Phaser from "phaser";

/**
 * 문장(紋章) 기반 실루엣 렌더러 — 설계 문서 08번 섹션 "비주얼 디렉션" 참고.
 * 초상화 대신, 후드 로브 실루엣 + 계통색 림라이트 + 문장으로 캐릭터를 구분한다.
 * 필드 스프라이트와 대화창 초상 아이콘이 같은 함수를 공유해 일관성을 유지한다.
 */

export type CrestShape = "dual-ring" | "leaf" | "diamond" | "triangle" | "zigzag";

/**
 * 문장 하나를 Graphics로 그린다. (cx, cy) 중심, radius는 대략적인 반지름.
 */
export function drawCrest(
  scene: Phaser.Scene,
  cx: number,
  cy: number,
  radius: number,
  color: number,
  shape: CrestShape
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.lineStyle(Math.max(1.5, radius / 14), color, 1);

  switch (shape) {
    case "dual-ring": {
      // 노아(플레이어) — 연·멸 혼합을 상징하는 이중 원 + 중심축
      g.strokeCircle(cx, cy, radius);
      g.strokeCircle(cx, cy, radius * 0.6);
      g.lineStyle(1, 0xe8e1cd, 0.8);
      g.beginPath();
      g.moveTo(cx, cy - radius);
      g.lineTo(cx, cy + radius);
      g.strokePath();
      break;
    }
    case "leaf": {
      // 이스라 — 생(生), 원 안의 잎사귀 곡선
      g.strokeCircle(cx, cy, radius);
      g.beginPath();
      g.moveTo(cx - radius * 0.6, cy);
      g.arc(cx, cy, radius * 0.6, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(-20), false);
      g.arc(cx, cy, radius * 0.6, Phaser.Math.DegToRad(-160), Phaser.Math.DegToRad(20), true);
      g.strokePath();
      break;
    }
    case "diamond": {
      // 리브 칸 — 연(緣), 마름모 + 중심점
      g.beginPath();
      g.moveTo(cx, cy - radius);
      g.lineTo(cx + radius, cy);
      g.lineTo(cx, cy + radius);
      g.lineTo(cx - radius, cy);
      g.closePath();
      g.strokePath();
      g.fillStyle(color, 1);
      g.fillCircle(cx, cy, radius * 0.18);
      break;
    }
    case "triangle": {
      // 헬가 도른 — 성(聖), 삼각형 + 수직축
      g.beginPath();
      g.moveTo(cx, cy - radius);
      g.lineTo(cx + radius * 0.9, cy + radius * 0.7);
      g.lineTo(cx - radius * 0.9, cy + radius * 0.7);
      g.closePath();
      g.strokePath();
      g.lineStyle(1, 0xe8e1cd, 0.8);
      g.beginPath();
      g.moveTo(cx, cy - radius);
      g.lineTo(cx, cy + radius * 0.7);
      g.strokePath();
      break;
    }
    case "zigzag": {
      // 모른 — 계통 불명, 계단을 상징하는 꺾인 선 + 점
      g.beginPath();
      g.moveTo(cx - radius * 0.6, cy + radius);
      g.lineTo(cx, cy - radius);
      g.lineTo(cx + radius * 0.6, cy + radius);
      g.strokePath();
      g.fillStyle(color, 1);
      g.fillCircle(cx, cy + radius * 0.1, radius * 0.14);
      break;
    }
  }

  return g;
}

/**
 * 필드 위 캐릭터 실루엣 — 후드 로브 형태 + 부드러운 계통색 글로우 + 림라이트.
 * bodyRadius 기준으로 전체 비례를 잡는다.
 */
export function drawFieldSilhouette(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number,
  shape: CrestShape,
  bodyRadius = 14
): Phaser.GameObjects.Container {
  const parts: Phaser.GameObjects.GameObject[] = [];

  // 1. 부드러운 글로우 — 반투명 원을 겹쳐 은은한 후광 효과를 낸다.
  const glow = scene.add.graphics();
  glow.fillStyle(color, 0.06);
  glow.fillCircle(0, -bodyRadius * 0.2, bodyRadius * 2.4);
  glow.fillStyle(color, 0.1);
  glow.fillCircle(0, -bodyRadius * 0.2, bodyRadius * 1.7);
  parts.push(glow);

  // 2. 로브 몸통 — 어깨에서 밑단으로 퍼지는 사다리꼴 + 부드러운 밑단 곡선
  const robe = scene.add.graphics();
  robe.fillStyle(0x14110d, 1);
  robe.lineStyle(2, color, 0.85);
  const shoulderW = bodyRadius * 0.85;
  const hemW = bodyRadius * 1.35;
  const topY = -bodyRadius * 0.75;
  const hemY = bodyRadius * 1.35;
  robe.beginPath();
  robe.moveTo(-shoulderW, topY);
  robe.lineTo(shoulderW, topY);
  robe.lineTo(hemW, hemY);
  robe.lineTo(hemW * 0.55, hemY - bodyRadius * 0.18);
  robe.lineTo(0, hemY);
  robe.lineTo(-hemW * 0.55, hemY - bodyRadius * 0.18);
  robe.lineTo(-hemW, hemY);
  robe.closePath();
  robe.fillPath();
  robe.strokePath();
  parts.push(robe);

  // 3. 후드 — 머리를 감싸는 원, 안쪽은 그림자
  const hood = scene.add.graphics();
  hood.fillStyle(0x0c0a08, 1);
  hood.fillCircle(0, -bodyRadius * 0.95, bodyRadius * 0.62);
  hood.lineStyle(1.5, color, 0.7);
  hood.strokeCircle(0, -bodyRadius * 0.95, bodyRadius * 0.62);
  parts.push(hood);

  // 4. 문장 — 가슴팍에 계통 상징을 새긴다.
  const crest = drawCrest(scene, 0, bodyRadius * 0.15, bodyRadius * 0.4, color, shape);
  parts.push(crest);

  const container = scene.add.container(x, y, parts);
  return container;
}

/**
 * 가만히 있을 때 살아있는 느낌을 주는 미세한 들숨/날숨 애니메이션.
 * 이동 중인 플레이어에는 걷기 바운스를 따로 적용하므로 NPC에만 쓴다.
 */
export function addIdleBreath(scene: Phaser.Scene, target: Phaser.GameObjects.Container) {
  scene.tweens.add({
    targets: target,
    scaleY: 1.035,
    duration: 1600 + Math.random() * 400,
    yoyo: true,
    repeat: -1,
    ease: "Sine.InOut",
  });
}
