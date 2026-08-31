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

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "app",
  width: 960,
  height: 600,
  backgroundColor: "#0e0c09",
  pixelArt: true,
  dom: { createContainer: true }, // 대화 자유 입력용 HTML <input> 사용
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: "arcade",
    arcade: { debug: false },
  },
  scene: [BootScene, RegionScene, StatusOverlayScene, DialogueScene, EndingScene, CombatScene, ToastScene, GachaScene, InventoryScene],
};

new Phaser.Game(config);
