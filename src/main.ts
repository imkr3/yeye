import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { FieldScene } from "./scenes/FieldScene";
import { StatusOverlayScene } from "./scenes/StatusOverlayScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "app",
  width: 960,
  height: 600,
  backgroundColor: "#0e0c09",
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: "arcade",
    arcade: { debug: false },
  },
  scene: [BootScene, FieldScene, StatusOverlayScene],
};

new Phaser.Game(config);
