import Phaser from "phaser";

/**
 * 지역 배경 절차적 렌더러 — 단색 배경 대신, 각 지역의 정체성을 저비용으로
 * 표현하기 위한 레이어. 08번 섹션 팔레트(잉크-양피지 톤 + 계통색 포인트)를 따른다.
 */

export type BackgroundStyle = "sunken-corridor" | "ash-market" | "frost-observatory" | "endless-stairs";

export function paintRegionBackground(scene: Phaser.Scene, style: BackgroundStyle) {
  switch (style) {
    case "sunken-corridor":
      paintSunkenCorridor(scene);
      break;
    case "ash-market":
      paintAshMarket(scene);
      break;
    case "frost-observatory":
      paintFrostObservatory(scene);
      break;
    case "endless-stairs":
      paintEndlessStairs(scene);
      break;
  }
}

function paintSunkenCorridor(scene: Phaser.Scene) {
  scene.add.rectangle(480, 300, 960, 600, 0x101d18);

  // 물결 — 가로로 흐르는 곡선 여러 겹
  const g = scene.add.graphics();
  g.lineStyle(1.5, 0x4c6e5c, 0.35);
  for (let row = 0; row < 6; row++) {
    const baseY = 60 + row * 90;
    g.beginPath();
    for (let x = 0; x <= 960; x += 20) {
      const y = baseY + Math.sin((x + row * 40) / 60) * 10;
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.strokePath();
  }

  // 수면 위 빛 — 옅은 녹색 점
  for (let i = 0; i < 40; i++) {
    const x = Phaser.Math.Between(0, 960);
    const y = Phaser.Math.Between(0, 600);
    scene.add.circle(x, y, 1.5, 0x8fbfa4, 0.25);
  }
}

function paintAshMarket(scene: Phaser.Scene) {
  scene.add.rectangle(480, 300, 960, 600, 0x241c14);

  // 좌판 실루엣 — 낮은 사각형 여러 개
  const stalls = [
    { x: 160, w: 100 }, { x: 340, w: 80 }, { x: 560, w: 120 }, { x: 780, w: 90 },
  ];
  stalls.forEach((s) => {
    const stall = scene.add.rectangle(s.x, 500, s.w, 40, 0x3a2c1c, 0.8);
    stall.setStrokeStyle(1, 0xa8873a, 0.4);
  });

  // 떠도는 여진(잔재) 입자 — 따뜻한 금빛 먼지
  for (let i = 0; i < 60; i++) {
    const x = Phaser.Math.Between(0, 960);
    const y = Phaser.Math.Between(0, 460);
    scene.add.circle(x, y, Phaser.Math.Between(1, 2), 0xa8873a, 0.2);
  }
}

function paintFrostObservatory(scene: Phaser.Scene) {
  scene.add.rectangle(480, 300, 960, 600, 0x0f1622);

  // 서리 결정 — 대칭 육각 라인 패턴
  const g = scene.add.graphics();
  g.lineStyle(1, 0x6ea78c, 0.25);
  const positions = [
    { x: 150, y: 120 }, { x: 780, y: 100 }, { x: 250, y: 480 }, { x: 700, y: 500 }, { x: 480, y: 300 },
  ];
  positions.forEach((p) => drawFrostCrystal(g, p.x, p.y, 36));
}

function drawFrostCrystal(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number) {
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    const x2 = cx + Math.cos(angle) * r;
    const y2 = cy + Math.sin(angle) * r;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(x2, y2);
    g.strokePath();
  }
}

function paintEndlessStairs(scene: Phaser.Scene) {
  scene.add.rectangle(480, 300, 960, 600, 0x18201f);

  // 반복되는 계단참 실루엣
  const g = scene.add.graphics();
  g.fillStyle(0x22201e, 1);
  g.lineStyle(1, 0x8c8168, 0.3);
  for (let step = 0; step < 8; step++) {
    const y = step * 75;
    g.fillRect(0, y, 960, 6);
    g.strokeRect(0, y, 960, 6);
  }
}
