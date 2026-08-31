import Phaser from "phaser";
import { lerpColor, shade } from "./colors";
import { drawCrest, type CrestShape } from "./silhouettes";

/**
 * 입체 캐릭터 렌더러.
 *
 * 도트/평면 실루엣 대신, 광원을 가정하고 색을 단계적으로 쌓아 볼륨을 만든다.
 * - 광원은 화면 왼쪽 위. 왼쪽 가장자리는 감쇠, 왼쪽 안쪽이 가장 밝고,
 *   오른쪽으로 갈수록 코어 섀도우, 맨 오른쪽 끝에 얇은 림라이트.
 * - 발밑에 접지 그림자(soft shadow)와 접촉 음영(AO)을 깔아 바닥에 붙어 보이게 한다.
 * - 계통색은 로브 자체가 아니라 림라이트/문장/후광에 실어 색 구분을 유지한다.
 */

export interface CharacterLook {
  /** 계통색 — 림라이트와 문장, 후광에 사용된다. */
  accent: number;
  /** 로브 기본색. 생략하면 어두운 중성색을 쓴다. */
  cloth?: number;
  crest: CrestShape;
  /** 전체 크기 기준값 (기존 bodyRadius와 동일한 의미). */
  scale?: number;
}

const LIGHT = 0xf3e7c8; // 따뜻한 키 라이트
const ROWS = 34;

/** 부드러운 접지 그림자 — 타원을 겹쳐 가장자리를 흐린다. */
export function drawGroundShadow(
  scene: Phaser.Scene,
  x: number,
  y: number,
  radius: number
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  const layers = 6;
  for (let i = layers; i >= 1; i--) {
    const t = i / layers;
    g.fillStyle(0x000000, 0.055 * (1 - t) + 0.03);
    g.fillEllipse(x, y, radius * 2.2 * t, radius * 0.72 * t);
  }
  return g;
}

/** 광원을 가정한 구체 음영 — 후드/머리 표현에 쓴다. */
function paintShadedSphere(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  radius: number,
  base: number,
  accent: number
) {
  const steps = 16;
  for (let i = steps; i >= 0; i--) {
    const t = i / steps; // 1 = 바깥, 0 = 중심(하이라이트 쪽)
    const r = radius * t;
    // 바깥일수록 어둡고, 안쪽(광원 방향)일수록 밝다.
    const lit = lerpColor(shade(base, -0.55), lerpColor(base, LIGHT, 0.45), 1 - t);
    // 하이라이트 중심을 왼쪽 위로 밀어 구형감을 준다.
    const ox = cx - radius * 0.26 * (1 - t);
    const oy = cy - radius * 0.3 * (1 - t);
    g.fillStyle(lit, 1);
    g.fillCircle(ox, oy, r);
  }
  // 오른쪽 아래 가장자리에 얇은 반사광(림라이트)
  g.lineStyle(1.6, lerpColor(accent, LIGHT, 0.25), 0.75);
  g.beginPath();
  g.arc(cx, cy, radius * 0.97, Phaser.Math.DegToRad(15), Phaser.Math.DegToRad(135), false);
  g.strokePath();
}

/**
 * 가로 그라디언트를 입힌 원통형 몸통.
 * 행마다 폭을 보간해 실루엣을 만들고, 각 행을 3구간으로 나눠 음영을 넣는다.
 */
function paintShadedRobe(
  g: Phaser.GameObjects.Graphics,
  topY: number,
  hemY: number,
  shoulderW: number,
  hemW: number,
  cloth: number,
  accent: number
) {
  const edgeDark = shade(cloth, -0.42);
  const keyLight = lerpColor(cloth, LIGHT, 0.42);
  const coreShadow = shade(cloth, -0.62);
  const rim = lerpColor(accent, LIGHT, 0.35);

  const height = hemY - topY;
  const rowH = height / ROWS;

  for (let i = 0; i < ROWS; i++) {
    const t = i / (ROWS - 1);
    const y = topY + i * rowH;
    // 어깨에서 밑단으로 갈수록 벌어지되, 허리쯤에서 살짝 조여 옷 주름을 암시한다.
    const waist = Math.sin(t * Math.PI) * 0.12;
    const halfW = (shoulderW + (hemW - shoulderW) * Math.pow(t, 1.35)) * (1 - waist);

    // 아래로 갈수록 바닥 반사가 줄어 어두워지는 수직 감쇠
    const floorFall = 1 - t * 0.28;
    const a = shade(edgeDark, (floorFall - 1) * 0.6);
    const b = shade(keyLight, (floorFall - 1) * 0.6);
    const c = shade(coreShadow, (floorFall - 1) * 0.6);

    const x0 = -halfW;
    const x1 = -halfW * 0.15;
    const x2 = halfW * 0.72;
    const x3 = halfW;

    g.fillGradientStyle(a, b, a, b, 1);
    g.fillRect(x0, y, x1 - x0, rowH + 0.6);

    g.fillGradientStyle(b, c, b, c, 1);
    g.fillRect(x1, y, x2 - x1, rowH + 0.6);

    g.fillGradientStyle(c, rim, c, rim, 1);
    g.fillRect(x2, y, x3 - x2, rowH + 0.6);
  }
}

/**
 * 입체 캐릭터 한 명을 그린다.
 * 반환되는 컨테이너의 원점은 캐릭터의 허리 높이이며, 발끝은 대략 +scale*1.4 지점이다.
 */
export function drawVolumetricCharacter(
  scene: Phaser.Scene,
  x: number,
  y: number,
  look: CharacterLook
): Phaser.GameObjects.Container {
  const scale = look.scale ?? 14;
  const cloth = look.cloth ?? 0x241f1a;
  const accent = look.accent;

  const parts: Phaser.GameObjects.GameObject[] = [];

  // 1. 계통색 후광 — 뒤쪽에 은은하게 깔리는 대기광
  const halo = scene.add.graphics();
  for (let i = 5; i >= 1; i--) {
    halo.fillStyle(accent, 0.035 * i * 0.5);
    halo.fillCircle(0, -scale * 0.1, scale * (1.1 + i * 0.32));
  }
  parts.push(halo);

  // 2. 접지 그림자와 접촉 음영
  const contact = scene.add.graphics();
  for (let i = 5; i >= 1; i--) {
    const t = i / 5;
    contact.fillStyle(0x000000, 0.16 * (1 - t) + 0.05);
    contact.fillEllipse(0, scale * 1.42, scale * 2.1 * t, scale * 0.6 * t);
  }
  parts.push(contact);

  // 3. 로브 몸통
  const robe = scene.add.graphics();
  paintShadedRobe(robe, -scale * 0.78, scale * 1.4, scale * 0.68, scale * 1.22, cloth, accent);
  parts.push(robe);

  // 4. 어깨 위 천 주름 — 몸통 위에 어두운 곡선을 얹어 겹침을 표현
  const drape = scene.add.graphics();
  drape.fillStyle(shade(cloth, -0.3), 0.9);
  drape.beginPath();
  drape.moveTo(-scale * 0.72, -scale * 0.72);
  drape.lineTo(scale * 0.72, -scale * 0.72);
  drape.lineTo(scale * 0.5, -scale * 0.1);
  drape.lineTo(-scale * 0.5, -scale * 0.1);
  drape.closePath();
  drape.fillPath();
  drape.lineStyle(1.2, lerpColor(accent, LIGHT, 0.4), 0.5);
  drape.beginPath();
  drape.moveTo(-scale * 0.7, -scale * 0.7);
  drape.lineTo(scale * 0.7, -scale * 0.7);
  drape.strokePath();
  parts.push(drape);

  // 5. 후드 — 구체 음영 + 안쪽 그림자
  const hood = scene.add.graphics();
  paintShadedSphere(hood, 0, -scale * 1.02, scale * 0.66, cloth, accent);
  hood.fillStyle(0x07060a, 0.92);
  hood.fillEllipse(0, -scale * 0.96, scale * 0.62, scale * 0.72);
  // 후드 안쪽에서 새어나오는 계통색 잔광
  hood.fillStyle(accent, 0.22);
  hood.fillEllipse(0, -scale * 0.92, scale * 0.4, scale * 0.5);
  parts.push(hood);

  // 6. 가슴 문장 — 발광 후광 위에 얹는다
  const crestGlow = scene.add.graphics();
  for (let i = 4; i >= 1; i--) {
    crestGlow.fillStyle(accent, 0.08 * i);
    crestGlow.fillCircle(0, scale * 0.2, scale * 0.28 * i * 0.55);
  }
  parts.push(crestGlow);
  parts.push(drawCrest(scene, 0, scale * 0.2, scale * 0.38, lerpColor(accent, LIGHT, 0.4), look.crest));

  return scene.add.container(x, y, parts);
}

/** 가만히 있을 때의 미세한 호흡 — 위아래로 아주 조금 뜬다. */
export function addIdleFloat(scene: Phaser.Scene, target: Phaser.GameObjects.Container) {
  scene.tweens.add({
    targets: target,
    y: target.y - 2.5,
    duration: 1700 + Math.random() * 500,
    yoyo: true,
    repeat: -1,
    ease: "Sine.InOut",
  });
}
