import Phaser from "phaser";

/**
 * 최초 로딩 씬. 지금은 외부 에셋이 없으므로 즉시 FieldScene으로 넘어간다.
 * 나중에 스프라이트/타일맵을 추가하면 여기서 preload한다.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    // TODO: 침수 회랑 타일맵 및 캐릭터 스프라이트 로드
  }

  create() {
    this.scene.start("FieldScene");
    this.scene.launch("StatusOverlayScene");
  }
}
