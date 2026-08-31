import Phaser from "phaser";

/**
 * 지역 배경 절차적 렌더러 — 단색 배경 대신, 각 지역의 정체성을 저비용으로
 * 표현하기 위한 레이어. 08번 섹션 팔레트(잉크-양피지 톤 + 계통색 포인트)를 따른다.
 *
 * width는 지역의 실제 월드 폭이다. 탑다운 지역은 화면 폭(960)과 같지만,
 * 횡스크롤 지역은 카메라보다 훨씬 넓은 값을 받는다. 비네트만은 예외로,
 * 카메라 뷰포트(960×600) 기준 화면 고정 오버레이라 월드 폭과 무관하게 그린다.
 */

export type BackgroundStyle = "sunken-corridor" | "ash-market" | "frost-observatory" | "endless-stairs";

export function paintRegionBackground(scene: Phaser.Scene, style: BackgroundStyle, width = 960) {
  switch (style) {
    case "sunken-corridor":
      paintSunkenCorridor(scene, width);
      break;
    case "ash-market":
      paintAshMarket(scene, width);
      break;
    case "frost-observatory":
      paintFrostObservatory(scene, width);
      break;
    case "endless-stairs":
      paintEndlessStairs(scene, width);
      break;
  }
  paintVignette(scene);
}

function paintVignette(scene: Phaser.Scene) {
  const g = scene.add.graphics();
  g.setScrollFactor(0); // 카메라가 움직여도 화면 가장자리에 고정된다.
  g.fillStyle(0x000000, 0.18);
  g.fillRect(0, 0, 960, 26);
  g.fillRect(0, 574, 960, 26);
  g.fillRect(0, 0, 26, 600);
  g.fillRect(934, 0, 26, 600);
  g.fillStyle(0x000000, 0.08);
  g.fillRect(0, 26, 960, 20);
  g.fillRect(0, 554, 960, 20);
  g.fillRect(26, 0, 20, 600);
  g.fillRect(914, 0, 20, 600);
}

/** 은은하게 흔들리며 떠다니는 입자 하나를 만든다. */
function driftingParticle(
  scene: Phaser.Scene,
  x: number,
  y: number,
  radius: number,
  color: number,
  alpha: number
) {
  const dot = scene.add.circle(x, y, radius, color, alpha);
  scene.tweens.add({
    targets: dot,
    y: y - Phaser.Math.Between(20, 50),
    alpha: 0,
    duration: Phaser.Math.Between(3000, 6000),
    delay: Phaser.Math.Between(0, 3000),
    repeat: -1,
    onRepeat: () => {
      dot.y = y;
      dot.setAlpha(alpha);
    },
  });
  return dot;
}

function paintSunkenCorridor(scene: Phaser.Scene, width: number) {
  const cx = width / 2;
  scene.add.rectangle(cx, 300, width, 600, 0x0e1a15);
  scene.add.rectangle(cx, 300, width, 600, 0x14211c, 0.6);

  // 물결 — 가로로 흐르는 곡선 여러 겹, 천천히 위아래로 유영
  for (let row = 0; row < 6; row++) {
    const baseY = 60 + row * 90;
    const g = scene.add.graphics();
    g.lineStyle(1.5, 0x4c6e5c, 0.3);
    g.beginPath();
    for (let x = 0; x <= width; x += 20) {
      const y = Math.sin((x + row * 40) / 60) * 10;
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.strokePath();
    g.setPosition(0, baseY);
    scene.tweens.add({
      targets: g,
      y: baseY + 6,
      duration: 2600 + row * 200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });
  }

  const particleCount = Math.round(26 * (width / 960));
  for (let i = 0; i < particleCount; i++) {
    driftingParticle(scene, Phaser.Math.Between(0, width), Phaser.Math.Between(80, 560), 1.5, 0x8fbfa4, 0.3);
  }
}

function paintAshMarket(scene: Phaser.Scene, width: number) {
  const cx = width / 2;
  scene.add.rectangle(cx, 300, width, 600, 0x1c1610);
  scene.add.rectangle(cx, 300, width, 600, 0x2a2015, 0.7);

  const stallCount = Math.max(4, Math.round(4 * (width / 960)));
  const spacing = width / (stallCount + 1);
  for (let i = 1; i <= stallCount; i++) {
    const x = spacing * i;
    const w = Phaser.Math.Between(80, 120);

    const roof = scene.add.graphics();
    roof.fillStyle(0x2f2416, 1);
    roof.lineStyle(1, 0xa8873a, 0.4);
    roof.beginPath();
    roof.moveTo(x - w / 2 - 6, 480);
    roof.lineTo(x, 460);
    roof.lineTo(x + w / 2 + 6, 480);
    roof.closePath();
    roof.fillPath();
    roof.strokePath();

    const stall = scene.add.rectangle(x, 500, w, 40, 0x3a2c1c, 0.85);
    stall.setStrokeStyle(1, 0xa8873a, 0.4);
  }

  const particleCount = Math.round(40 * (width / 960));
  for (let i = 0; i < particleCount; i++) {
    driftingParticle(scene, Phaser.Math.Between(0, width), Phaser.Math.Between(0, 460), Phaser.Math.Between(1, 2), 0xa8873a, 0.25);
  }
}

function paintFrostObservatory(scene: Phaser.Scene, width: number) {
  const cx = width / 2;
  scene.add.rectangle(cx, 300, width, 600, 0x090e17);
  scene.add.rectangle(cx, 300, width, 600, 0x1a2230, 0.6);

  const crystalCount = Math.max(5, Math.round(5 * (width / 960)));
  for (let i = 0; i < crystalCount; i++) {
    const x = Phaser.Math.Between(80, width - 80);
    const y = Phaser.Math.Between(80, 520);
    const g = scene.add.graphics();
    g.lineStyle(1, 0x6ea78c, 0.22);
    drawFrostCrystal(g, x, y, 36);
    scene.tweens.add({
      targets: g,
      alpha: 0.4,
      duration: 2200 + Math.random() * 800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });
  }

  const particleCount = Math.round(30 * (width / 960));
  for (let i = 0; i < particleCount; i++) {
    driftingParticle(scene, Phaser.Math.Between(0, width), Phaser.Math.Between(0, 600), 1, 0xe8e1cd, 0.2);
  }
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

function paintEndlessStairs(scene: Phaser.Scene, width: number) {
  const cx = width / 2;
  scene.add.rectangle(cx, 300, width, 600, 0x14100c);
  scene.add.rectangle(cx, 300, width, 600, 0x22201e, 0.7);

  for (let step = 0; step < 8; step++) {
    const y = step * 75;
    const tread = scene.add.rectangle(cx, y + 3, width, 6, 0x2b241c, 1);
    tread.setStrokeStyle(1, 0x8c8168, 0.3);
  }

  const particleCount = Math.round(20 * (width / 960));
  for (let i = 0; i < particleCount; i++) {
    driftingParticle(scene, Phaser.Math.Between(0, width), Phaser.Math.Between(0, 600), 1, 0x8c8168, 0.2);
  }
}
