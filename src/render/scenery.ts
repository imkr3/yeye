import Phaser from "phaser";
import { atmospheric, desaturate, lerpColor, shade } from "./colors";

/**
 * 입체감 있는 지역 배경.
 *
 * 평면 도형 대신 "깊이"를 만든다:
 *  - 원경/중경/근경을 나누고 각각 다른 scrollFactor로 시차(패럴랙스)를 준다.
 *  - 멀수록 안개색에 가깝게 섞고(대기 원근) 채도를 낮춘다.
 *  - 바닥은 지평선에서 카메라 쪽으로 어두워지는 그라디언트를 깔아 평면이 아닌
 *    비스듬한 지면처럼 읽히게 한다.
 *  - 광선(god ray)과 부유 입자를 깊이별로 배치해 공간에 공기를 채운다.
 */

export type SceneryStyle =
  | "sunken-corridor"
  | "ash-market"
  | "frost-observatory"
  | "endless-stairs"
  | "glassvein-underway";

interface SceneryPalette {
  skyTop: number;
  skyBottom: number;
  fog: number;
  structure: number;
  accent: number;
  groundNear: number;
  groundFar: number;
  particle: number;
  rayColor: number;
  rayAlpha: number;
}

const PALETTES: Record<SceneryStyle, SceneryPalette> = {
  "sunken-corridor": {
    skyTop: 0x07120f,
    skyBottom: 0x16302a,
    fog: 0x2c5a4d,
    structure: 0x123028,
    accent: 0x6ea78c,
    groundNear: 0x0a1512,
    groundFar: 0x1d3d34,
    particle: 0x9fd8c0,
    rayColor: 0x8fd8bb,
    rayAlpha: 0.05,
  },
  "ash-market": {
    skyTop: 0x140d07,
    skyBottom: 0x3a2513,
    fog: 0x6b4a22,
    structure: 0x2a1c10,
    accent: 0xd8a24a,
    groundNear: 0x140e08,
    groundFar: 0x3d2a16,
    particle: 0xe0b264,
    rayColor: 0xf0c070,
    rayAlpha: 0.055,
  },
  "frost-observatory": {
    skyTop: 0x050a14,
    skyBottom: 0x16243c,
    fog: 0x3d5878,
    structure: 0x0e1a2c,
    accent: 0x8fc4e8,
    groundNear: 0x070d18,
    groundFar: 0x1d3048,
    particle: 0xd8ecff,
    rayColor: 0xa8d4ff,
    rayAlpha: 0.06,
  },
  "endless-stairs": {
    skyTop: 0x0b0908,
    skyBottom: 0x241d16,
    fog: 0x4a3d2e,
    structure: 0x1a1510,
    accent: 0xbfa87e,
    groundNear: 0x0c0a08,
    groundFar: 0x2a2219,
    particle: 0xd6c49a,
    rayColor: 0xd8bc84,
    rayAlpha: 0.045,
  },
  "glassvein-underway": {
    skyTop: 0x06060d,
    skyBottom: 0x1a1430,
    fog: 0x40306a,
    structure: 0x120e22,
    accent: 0xa98cf0,
    groundNear: 0x08060f,
    groundFar: 0x241a3e,
    particle: 0xc9b0ff,
    rayColor: 0xb69cf5,
    rayAlpha: 0.07,
  },
};

const VIEW_W = 960;
const VIEW_H = 600;

/** 시차 레이어가 카메라 이동 범위를 덮으려면 필요한 폭. */
function layerWidth(worldWidth: number, scrollFactor: number): number {
  return VIEW_W + Math.max(0, worldWidth - VIEW_W) * scrollFactor + 200;
}

function verticalGradient(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  top: number,
  bottom: number,
  alpha = 1
) {
  g.fillGradientStyle(top, top, bottom, bottom, alpha);
  g.fillRect(x, y, w, h);
}

/** 지역 배경 전체를 그린다. groundY는 캐릭터가 서는 바닥 높이. */
export function paintScenery(
  scene: Phaser.Scene,
  style: SceneryStyle,
  worldWidth: number,
  groundY: number
) {
  const p = PALETTES[style];

  // --- 0. 공허/하늘 — 화면 고정, 수직 그라디언트 ---
  const sky = scene.add.graphics().setScrollFactor(0).setDepth(-100);
  verticalGradient(sky, 0, 0, VIEW_W, VIEW_H, p.skyTop, p.skyBottom);

  // --- 1. 원경 (scrollFactor 0.15) — 안개에 잠긴 거대 구조물 ---
  const farW = layerWidth(worldWidth, 0.15);
  const far = scene.add.graphics().setScrollFactor(0.15).setDepth(-90);
  paintFarLayer(far, style, p, farW, groundY);

  // --- 2. 안개 띠 — 원경과 중경을 갈라놓는 공기층 ---
  const haze = scene.add.graphics().setScrollFactor(0.3).setDepth(-85);
  verticalGradient(haze, 0, groundY - 210, layerWidth(worldWidth, 0.3), 210, p.fog, p.fog, 0.0);
  haze.fillGradientStyle(p.fog, p.fog, p.fog, p.fog, 0, 0, 0.26, 0.26);
  haze.fillRect(0, groundY - 210, layerWidth(worldWidth, 0.3), 210);

  // --- 3. 중경 (scrollFactor 0.55) — 형태가 읽히는 구조물 ---
  const midW = layerWidth(worldWidth, 0.55);
  const mid = scene.add.graphics().setScrollFactor(0.55).setDepth(-80);
  paintMidLayer(mid, style, p, midW, groundY);

  // --- 4. 광선 — 중경과 근경 사이의 공기 ---
  const rays = scene.add.graphics().setScrollFactor(0.65).setDepth(-70);
  paintLightShafts(rays, p, layerWidth(worldWidth, 0.65), groundY);

  // --- 5. 바닥면 — 지평선에서 카메라 쪽으로 어두워진다 ---
  const floor = scene.add.graphics().setDepth(-60);
  verticalGradient(floor, 0, groundY, worldWidth, VIEW_H - groundY, p.groundFar, p.groundNear);
  // 접지선 하이라이트 — 바닥과 벽이 만나는 지점
  floor.fillStyle(lerpColor(p.groundFar, p.accent, 0.25), 0.35);
  floor.fillRect(0, groundY - 1.5, worldWidth, 3);
  // 바닥 반사 — 계통색이 옅게 번진다
  floor.fillGradientStyle(p.accent, p.accent, p.accent, p.accent, 0.13, 0.13, 0, 0);
  floor.fillRect(0, groundY, worldWidth, 70);

  // --- 6. 부유 입자 — 깊이별로 크기/속도를 달리한다 ---
  paintDepthParticles(scene, p, worldWidth, groundY);

  // --- 7. 근경 프레임 (scrollFactor 1.25) — 화면 앞을 스치는 어두운 실루엣 ---
  const near = scene.add.graphics().setScrollFactor(1.25).setDepth(20);
  paintNearLayer(near, style, p, layerWidth(worldWidth, 1.25), groundY);

  // --- 8. 비네트 — 화면 고정 ---
  paintVignette(scene);
}

function paintFarLayer(
  g: Phaser.GameObjects.Graphics,
  style: SceneryStyle,
  p: SceneryPalette,
  width: number,
  groundY: number
) {
  const color = atmospheric(desaturate(p.structure, 0.5), p.fog, 0.72);

  if (style === "endless-stairs") {
    // 아득히 멀어지는 계단참
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const y = groundY - 40 - t * 300;
      const inset = t * width * 0.22;
      g.fillStyle(atmospheric(color, p.fog, t * 0.5), 0.85 - t * 0.35);
      g.fillRect(inset, y, width - inset * 2, 16);
    }
    return;
  }

  if (style === "ash-market") {
    // 멀리 늘어선 지붕 능선 + 창문 불빛
    for (let x = -100; x < width; x += 150) {
      const h = 120 + ((x * 7919) % 130);
      g.fillStyle(color, 0.9);
      g.fillRect(x, groundY - h, 130, h);
      g.fillStyle(lerpColor(p.accent, p.fog, 0.45), 0.5);
      for (let wy = groundY - h + 24; wy < groundY - 30; wy += 34) {
        g.fillRect(x + 22, wy, 12, 10);
        g.fillRect(x + 74, wy, 12, 10);
      }
    }
    return;
  }

  // 기본: 아치가 줄지어 멀어지는 회랑/홀
  const archW = 220;
  for (let x = -archW; x < width; x += archW) {
    const h = 300;
    g.fillStyle(color, 0.9);
    g.fillRect(x, groundY - h, 34, h);
    g.fillStyle(color, 0.75);
    g.fillEllipse(x + archW * 0.5, groundY - h + 10, archW * 0.92, 120);
    g.fillStyle(p.skyBottom, 1);
    g.fillEllipse(x + archW * 0.5, groundY - h + 26, archW * 0.72, 96);
  }
}

function paintMidLayer(
  g: Phaser.GameObjects.Graphics,
  style: SceneryStyle,
  p: SceneryPalette,
  width: number,
  groundY: number
) {
  const near = atmospheric(p.structure, p.fog, 0.28);
  const lit = lerpColor(near, p.accent, 0.22);

  if (style === "ash-market") {
    for (let x = 40; x < width; x += 240) {
      const stallH = 96;
      // 차양 — 윗면은 밝고 아랫면은 어둡게 해 두께를 만든다
      g.fillGradientStyle(lit, lit, shade(near, -0.35), shade(near, -0.35), 1);
      g.fillRect(x - 84, groundY - stallH - 34, 168, 20);
      g.fillStyle(shade(near, -0.5), 1);
      g.fillRect(x - 76, groundY - stallH - 14, 152, 8);
      // 좌판 몸통
      g.fillGradientStyle(lit, shade(near, -0.4), shade(near, -0.25), shade(near, -0.62), 1);
      g.fillRect(x - 62, groundY - stallH, 124, stallH);
      // 매달린 등불
      g.fillStyle(p.accent, 0.85);
      g.fillCircle(x + 52, groundY - stallH - 44, 5);
      g.fillStyle(p.accent, 0.14);
      g.fillCircle(x + 52, groundY - stallH - 44, 20);
    }
    return;
  }

  if (style === "frost-observatory") {
    for (let x = 100; x < width; x += 320) {
      // 얼어붙은 관측 비계
      g.fillGradientStyle(lit, shade(near, -0.45), shade(near, -0.2), shade(near, -0.7), 1);
      g.fillRect(x - 14, groundY - 260, 28, 260);
      g.fillRect(x - 90, groundY - 200, 180, 14);
      g.fillRect(x - 66, groundY - 120, 132, 12);
      // 렌즈 돔
      g.fillGradientStyle(lerpColor(lit, p.accent, 0.4), lit, near, shade(near, -0.5), 1);
      g.fillEllipse(x, groundY - 276, 96, 62);
      g.lineStyle(1.5, p.accent, 0.5);
      g.strokeEllipse(x, groundY - 276, 96, 62);
    }
    return;
  }

  if (style === "endless-stairs") {
    for (let x = -120; x < width; x += 200) {
      for (let s = 0; s < 6; s++) {
        const y = groundY - 30 - s * 46;
        g.fillGradientStyle(lit, shade(near, -0.4), shade(near, -0.3), shade(near, -0.65), 1);
        g.fillRect(x + s * 26, y, 190 - s * 10, 15);
      }
    }
    return;
  }

  if (style === "glassvein-underway") {
    for (let x = 0; x < width; x += 260) {
      // 유리질 광맥이 박힌 터널 벽
      g.fillGradientStyle(lit, shade(near, -0.5), shade(near, -0.25), shade(near, -0.72), 1);
      g.fillRect(x, groundY - 300, 120, 300);
      g.lineStyle(2, p.accent, 0.55);
      g.beginPath();
      g.moveTo(x + 20, groundY - 290);
      g.lineTo(x + 74, groundY - 190);
      g.lineTo(x + 34, groundY - 96);
      g.lineTo(x + 88, groundY - 10);
      g.strokePath();
      g.fillStyle(p.accent, 0.1);
      g.fillCircle(x + 60, groundY - 160, 46);
    }
    return;
  }

  // 침수 회랑 — 부러진 기둥과 수면 아래 잔해
  for (let x = 60; x < width; x += 280) {
    const h = 200 + ((x * 104729) % 90);
    g.fillGradientStyle(lit, shade(near, -0.5), shade(near, -0.2), shade(near, -0.7), 1);
    g.fillRect(x, groundY - h, 46, h);
    // 부러진 단면
    g.fillStyle(lerpColor(lit, p.accent, 0.3), 0.9);
    g.fillEllipse(x + 23, groundY - h, 46, 14);
    // 물때 라인
    g.fillStyle(p.accent, 0.16);
    g.fillRect(x, groundY - 54, 46, 5);
  }
}

function paintLightShafts(
  g: Phaser.GameObjects.Graphics,
  p: SceneryPalette,
  width: number,
  groundY: number
) {
  for (let x = 120; x < width; x += 340) {
    const topW = 34;
    const botW = 128;
    g.fillGradientStyle(p.rayColor, p.rayColor, p.rayColor, p.rayColor, p.rayAlpha * 2.2, p.rayAlpha * 2.2, 0, 0);
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + topW, 0);
    g.lineTo(x + topW + botW, groundY);
    g.lineTo(x + botW, groundY);
    g.closePath();
    g.fillPath();
  }
}

function paintDepthParticles(
  scene: Phaser.Scene,
  p: SceneryPalette,
  worldWidth: number,
  groundY: number
) {
  const depths = [
    { scroll: 0.35, count: 26, size: 1, alpha: 0.22, rise: 26 },
    { scroll: 0.7, count: 22, size: 1.7, alpha: 0.3, rise: 40 },
    { scroll: 1.15, count: 14, size: 2.6, alpha: 0.22, rise: 62 },
  ];

  depths.forEach((d) => {
    const w = layerWidth(worldWidth, d.scroll);
    for (let i = 0; i < d.count; i++) {
      const x = Phaser.Math.Between(0, w);
      const y = Phaser.Math.Between(60, groundY + 60);
      const dot = scene.add
        .circle(x, y, d.size, p.particle, d.alpha)
        .setScrollFactor(d.scroll)
        .setDepth(-40);
      scene.tweens.add({
        targets: dot,
        y: y - d.rise,
        alpha: 0,
        duration: Phaser.Math.Between(3200, 6400),
        delay: Phaser.Math.Between(0, 3200),
        repeat: -1,
        onRepeat: () => {
          dot.y = y;
          dot.setAlpha(d.alpha);
        },
      });
    }
  });
}

function paintNearLayer(
  g: Phaser.GameObjects.Graphics,
  style: SceneryStyle,
  p: SceneryPalette,
  width: number,
  groundY: number
) {
  const dark = shade(p.structure, -0.75);

  if (style === "ash-market" || style === "endless-stairs") {
    // 화면 위를 가로지르는 늘어진 줄과 천 조각
    g.lineStyle(3, dark, 0.85);
    for (let x = -100; x < width; x += 420) {
      g.beginPath();
      g.moveTo(x, 40);
      g.lineTo(x + 210, 96);
      g.lineTo(x + 420, 34);
      g.strokePath();
      g.fillStyle(dark, 0.8);
      g.fillRect(x + 190, 92, 40, 54);
    }
    return;
  }

  // 위에서 드리운 덩굴/고드름 실루엣
  for (let x = -60; x < width; x += 260) {
    const len = 90 + ((x * 7873) % 120);
    g.fillStyle(dark, 0.88);
    g.beginPath();
    g.moveTo(x, -10);
    g.lineTo(x + 46, -10);
    g.lineTo(x + 22, len);
    g.closePath();
    g.fillPath();
  }
  // 바닥 근처 앞쪽 잔해
  g.fillStyle(dark, 0.9);
  for (let x = 0; x < width; x += 520) {
    g.fillEllipse(x + 120, groundY + 92, 300, 60);
  }
}

function paintVignette(scene: Phaser.Scene) {
  const g = scene.add.graphics().setScrollFactor(0).setDepth(90);
  const bands = 16;
  for (let i = 0; i < bands; i++) {
    const t = i / bands;
    const inset = t * 150;
    g.lineStyle(10, 0x000000, 0.035 * (1 - t) + 0.012);
    g.strokeRect(inset - 4, inset - 4, VIEW_W - inset * 2 + 8, VIEW_H - inset * 2 + 8);
  }
  // 위아래 시네마틱 음영
  g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.55, 0.55, 0, 0);
  g.fillRect(0, 0, VIEW_W, 90);
  g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.6, 0.6);
  g.fillRect(0, VIEW_H - 110, VIEW_W, 110);
}
