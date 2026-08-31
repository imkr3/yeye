import Phaser from "phaser";

/**
 * 문장(紋章) 기반 실루엣 렌더러 — 설계 문서 08번 섹션 "비주얼 디렉션" 참고.
 * 초상화 대신, 계통색 + 기하학적 문장으로 캐릭터를 구분한다.
 * 필드 스프라이트와 대화창 아이콘이 같은 함수를 공유해 일관성을 유지한다.
 */

export type CrestShape = "dual-ring" | "leaf" | "diamond" | "triangle" | "zigzag";

/**
 * 문장 하나를 Graphics로 그린다. (cx, cy) 중심, radius는 대략적인 반지름.
 * 반환값은 계속 재사용할 수 있는 Graphics 오브젝트.
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
 * 필드 위 캐릭터 실루엣. 몸통(둥근 사각) + drawCrest 문장 하이라이트.
 */
export function drawFieldSilhouette(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number,
  shape: CrestShape,
  bodyRadius = 14
): Phaser.GameObjects.Container {
  const body = scene.add.graphics();
  body.fillStyle(0x1a1712, 1);
  body.fillRoundedRect(-bodyRadius * 0.75, -bodyRadius * 1.3, bodyRadius * 1.5, bodyRadius * 2.2, bodyRadius * 0.5);
  body.lineStyle(2, color, 0.9);
  body.strokeRoundedRect(-bodyRadius * 0.75, -bodyRadius * 1.3, bodyRadius * 1.5, bodyRadius * 2.2, bodyRadius * 0.5);

  const crest = drawCrest(scene, 0, -bodyRadius * 0.55, bodyRadius * 0.5, color, shape);

  const container = scene.add.container(x, y, [body, crest]);
  return container;
}
