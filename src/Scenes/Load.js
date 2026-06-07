class Load extends Phaser.Scene {
    constructor() {
        super("loadScene");
    }

    preload() {
        this.load.setPath("./assets/");

        // Load tilemap and tileset
        this.load.image("tilemap_tiles", "tilemap_packed.png");
        this.load.spritesheet("tilemap_sheet", "tilemap_packed.png", { frameWidth: 18, frameHeight: 18 });
        this.load.tilemapTiledJSON("platformer-level-1", "platformer-level-1.tmj");

        // Load player character frames
        this.load.setPath("./assets/Char 4/with hands/");
        ['death','fall','hit','idle','jumpEnd','jumpStart','roll','walk'].forEach(anim => {
            const counts = { death:10, fall:5, hit:3, idle:6, jumpEnd:3, jumpStart:2, roll:5, walk:8 };
            for (let i = 0; i < counts[anim]; i++) {
                this.load.image(`${anim}_${i}`, `${anim}_${i}.png`);
            }
        });
        this.load.setPath("./assets/");

        // Load particle effects
        this.load.multiatlas("kenny-particles", "kenny-particles.json");

        // Load ghost enemy
        this.load.image('ghost_normal', 'ghost_normal.png');
        this.load.image('ghost', 'ghost.png');
        this.load.image('energyball_6', 'energyball_6.png');

        // Load parallax background images
        this.load.image('cloud1', 'Cloud01.png');
        this.load.image('cloud2', 'Cloud02.png');
        this.load.image('cloud3', 'Cloud03.png');
        this.load.image('cloud4', 'Clouds04.png');
        this.load.image('mountain1', 'BackgroundMountain_01.png');
        this.load.image('mountain2', 'BackgroundMuntain02.png');

        // Load audio
        this.load.audio("jump", "jump.wav.ogg");
        this.load.audio("collect", "collect.wav.ogg");
        this.load.audio("die", "die.wav.ogg");
        this.load.audio("land", "land.wav.ogg");
        this.load.audio("superjump", "superjump.wav.ogg");
        this.load.audio("ghost_alert", "ghostbreath.mp3");
        this.load.audio("bgmusic", "bkloop.mp3");
    }

    create() {
        const makeFrames = (prefix, count) =>
            Array.from({ length: count }, (_, i) => ({ key: `${prefix}_${i}` }));

        this.anims.create({ key: 'roll',   frames: makeFrames('roll',      5), frameRate: 12, repeat: -1 });
        this.anims.create({ key: 'idle',   frames: makeFrames('idle',      6), frameRate:  8, repeat: -1 });
        this.anims.create({ key: 'jump',   frames: makeFrames('jumpStart', 2), frameRate:  8, repeat:  0 });
        this.anims.create({ key: 'fall',   frames: makeFrames('fall',      5), frameRate: 10, repeat: -1 });
        this.anims.create({ key: 'death',  frames: makeFrames('death',    10), frameRate: 12, repeat:  0 });
        this.anims.create({ key: 'walk',   frames: makeFrames('walk',      8), frameRate: 12, repeat: -1 });
        this.anims.create({ key: 'hit',    frames: makeFrames('hit',       3), frameRate: 10, repeat:  0 });

        // Go to title screen
        this.scene.start("titleScene");
    }
}