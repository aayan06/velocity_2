// Aayan Abdullah
// Velocity - Final Game Project
// CMPM 120, Spring 2026

let my = { sprite: {}, vfx: {} };
let cursors;

const SCALE = 2.0;
let highScore = 0;

let config = {
    parent: 'phaser-game',
    type: Phaser.CANVAS,
    render: { pixelArt: true },
    width: 1200,
    height: 800,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 1200,
        height: 800,
    },
    //added virtuals to see hitboxes for debugging, can be toggled with V key
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: [Load, Title, Platformer, GameOver]
}

const game = new Phaser.Game(config);