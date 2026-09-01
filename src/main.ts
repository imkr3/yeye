import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { RegionScene } from "./scenes/RegionScene";
import { StatusOverlayScene } from "./scenes/StatusOverlayScene";
import { DialogueScene } from "./scenes/DialogueScene";
import { EndingScene } from "./scenes/EndingScene";
import { CombatScene } from "./scenes/CombatScene";
import { ToastScene } from "./scenes/ToastScene";
import { GachaScene } from "./scenes/GachaScene";
import { InventoryScene } from "./scenes/InventoryScene";
import { RiftScene } from "./scenes/RiftScene";
import { ExchangeScene } from "./scenes/ExchangeScene";
import { SettingsScene } from "./scenes/SettingsScene";
import { RegressionSummaryScene } from "./scenes/RegressionSummaryScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "app",
  width: 960,
  height: 600,
  backgroundColor: "#07060b",
  // 도트가 아니라 부드러운 음영으로 입체를 만드는 방향이라 픽셀 스냅을 끈다.
  pixelArt: false,
  antialias: true,
  roundPixels: false,
  dom: { createContainer: true }, // 대화 자유 입력용 HTML <input> 사용
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: "arcade",
    arcade: { debug: false },
  },
  scene: [BootScene, RegionScene, StatusOverlayScene, DialogueScene, EndingScene, CombatScene, ToastScene, GachaScene, InventoryScene, RiftScene, RegressionSummaryScene, ExchangeScene, SettingsScene],
};

const game = new Phaser.Game(config);

// 브라우저 자동화 스모크 테스트가 씬 상태를 들여다볼 수 있도록 노출한다.
// 게임 로직은 이 참조를 쓰지 않는다.
(window as unknown as { __UNBROKEN_VOW__?: Phaser.Game }).__UNBROKEN_VOW__ = game;
