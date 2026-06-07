class Platformer extends Phaser.Scene {
    constructor() {
        super("platformerScene");
    }

    init() {
        this.ACCELERATION = 2000;
        this.DRAG = 1400;
        this.JUMP_VELOCITY = -500;
        this.SUPER_JUMP_VELOCITY = -870;
        this.MAX_SPEED = 500;
        this.SPEED_CAP = 10;
        this.SPEED_RATE = 0.000008;
        this.FALL_TILE_SIZE = 18;       // pixels per tile
        this.FALL_BOOST_PER_TILE = 18;  // px/s of boost per tile dropped

        this.speedMult = 1.0;
        this.elapsed = 0;
        this.hasKey = false;
        this.isDead = false;
        this.hasWon = false;
        this.wasOnGround = false;
        this.jumpCount = 0;
        this.score = 0;
        this.fallBoostVel = 0;
        this.airborneY = null;
        this._fallBoostTween = null;
        this.dashActive = false;
        this.lastDashTime = -5000;
        this.DASH_DURATION = 300;
        this.DASH_COOLDOWN = 5000;
        this.DASH_SPEED = 800;
        this._preDashVelX = 0;
        this._superJumpTrailing = false;
        this._coyoteTimeLeft = 0;
        this.COYOTE_MS = 120;
        this._restoreCameraLerp = false;
        this._lastScrollX = 0;
    }

    create() {
        this.mapW = 350 * 18;
        this.mapH = 40  * 18;

        this.physics.world.setBounds(0, 0, this.mapW * 3, this.mapH);
        this.physics.world.gravity.y = 1500;
        this.cameras.main.setBackgroundColor('#0a0a1a');

        this.groundLayers   = [];
        this.platformLayers = [];

        for (let copy = 0; copy < 3; copy++) {
            const ox = this.mapW * copy;
            const map = this.make.tilemap({ key: 'platformer-level-1' });
            const tileset = map.addTilesetImage("tilemap_packed", "tilemap_tiles");

            if (map.getLayer('Decor')) {
                map.createLayer("Decor", tileset, ox, 0);
            }

            const g = map.createLayer("Ground",    tileset, ox, 0);
            const p = map.createLayer("Platforms", tileset, ox, 0);

            g.setCollisionByExclusion([-1]);
            p.setCollisionByExclusion([-1]);
            g.setTint(0xff7733);
            p.setTint(0x44aaff);

            this.groundLayers.push(g);
            this.platformLayers.push(p);

            if (copy === 0) this.map = map;
        }

        this.drawBackground();

        this.keyGroup   = this.physics.add.staticGroup();
        this.spikeGroup = this.physics.add.staticGroup();
        this.treeGroup  = this.physics.add.staticGroup();
        this.spawnObjects();

        this.player = this.physics.add.sprite(this.mapW + 60, 50, 'idle_0')
            .setScale(0.05)
            .setDepth(5)
            .setCollideWorldBounds(false);
        // 2048x2048 frame; opaque character lives at approx x[446..635], y[604..978]
        // offset/size in unscaled texture pixels so body bottom aligns with feet
        this.player.body.setSize(300, 400, false);
        this.player.body.setOffset(870, 1400);
        this.player.body.setMaxVelocityX(this.MAX_SPEED * this.SPEED_CAP);

        this.groundLayers.forEach(l   => this.physics.add.collider(this.player, l, this.onLand, null, this));
        this.platformLayers.forEach(l => this.physics.add.collider(this.player, l, this.onLand, null, this));

        this.physics.add.overlap(this.player, this.spikeGroup, () => this.triggerDeath(), null, this);
        this.physics.add.overlap(this.player, this.treeGroup,  () => this.triggerDeath(), null, this);
        this.physics.add.overlap(this.player, this.keyGroup,   (p, zone) => this.collectKey(zone), null, this);

        this.ghosts = [];
        for (let copy = 0; copy < 3; copy++) {
            const base = this.mapW * copy;
            this.ghosts.push(new Ghost(this, base + 3000, 655, base + 3800));
            this.ghosts.push(new Ghost(this, base + 3000, 330, base + 2100));
        }

        this.buildParticles();
        this.buildAudio();

        this.bgMusic = this.sound.add('bgmusic', { loop: true, volume: 0.1 });
        this.bgMusic.play();

        this.cameras.main.setBounds(0, -200, this.mapW * 3, this.mapH + 200);
        this.cameras.main.startFollow(this.player, false, 0.1, 0.1);
        this.cameras.main.setFollowOffset(0, 100);
        this.cameras.main.setDeadzone(50, 20);
        this.cameras.main.setZoom(1.5);
        this.cameras.main.fadeIn(400, 0, 0, 0);
        this.buildUI();

        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys({
            up:   Phaser.Input.Keyboard.KeyCodes.W,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            dash: Phaser.Input.Keyboard.KeyCodes.D
        });
        this.input.keyboard.on('keydown-SPACE', () => this.tryJump());
        this.input.keyboard.on('keydown-UP',    () => this.tryJump());
        this.input.keyboard.on('keydown-W',     () => this.tryJump());
    }

    drawBackground() {
        // --- Clouds: scattered images with very slow parallax ---
        // X positions chosen so clouds are spread across the visible screen
        // at game start and remain visible throughout the lap.
        this.cloudImages = [];

        // scrollFactor(0,0) keeps clouds in screen space, avoiding Phaser's
        // world-position culling which incorrectly removes low-scrollFactor objects.
        // Parallax is applied manually in update() via camera delta tracking.
        // Y values are in screen-world units (canvas_y = worldY * zoom).
        // Mountains start at canvas_y=225, so clouds must be < 150 worldY to show in sky.
        const cloud1Xs = [500, 700, 1000, 1100];
        const cloud1Ys = [320, 280, 340, 300];
        cloud1Xs.forEach((x, i) => {
            this.cloudImages.push(
                this.add.image(x, cloud1Ys[i], 'cloud1')
                    .setScale(1)
                    .setScrollFactor(0, 0)
                    .setDepth(-30)
            );
        });

        const cloud2Xs = [500, 700, 900];
        const cloud2Ys = [260, 320, 290];
        cloud2Xs.forEach((x, i) => {
            this.cloudImages.push(
                this.add.image(x, cloud2Ys[i], 'cloud2')
                    .setScale(0.6)
                    .setScrollFactor(0, 0)
                    .setDepth(-30)
            );
        });

        // --- Mountains: 8 copies side by side, two layers ---
        const m1src = this.textures.get('mountain1').source[0];
        for (let i = 0; i < 8; i++) {
            this.add.image(m1src.width * 1.2 * i, 150, 'mountain1')
                .setScale(3)
                .setOrigin(0, 0)
                .setScrollFactor(0.1, 0)
                .setDepth(-20);
        }

        const m2src = this.textures.get('mountain2').source[0];
        for (let i = 0; i < 8; i++) {
            this.add.image(m2src.width * 1.2 * i, 180, 'mountain2')
                .setScale(3)
                .setOrigin(0, 0)
                .setScrollFactor(0.15, 0)
                .setDepth(-19);
        }
    }

    spawnObjects() {
        const objLayer = this.map.getObjectLayer('Objects');
        if (!objLayer) return;

        objLayer.objects.forEach(obj => {
            const type = this.getObjType(obj);
            const x = obj.x + (obj.width  || 18) / 2;
            const y = obj.y - (obj.height || 18) / 2;

            for (let copy = 0; copy < 3; copy++) {
                const cx = x + this.mapW * copy;
                if (type === 'key')   this.spawnKey(cx, y);
                if (type === 'spike') this.spawnHazard(cx, y, obj.width||18, obj.height||18, 'spike', obj.gid);
                if (type === 'tree')  this.spawnHazard(cx, y, obj.width||18, obj.height||36, 'tree',  obj.gid);
            }
        });
    }

    getObjType(obj) {
        if (obj.properties) {
            const t = obj.properties.find(p => p.name === 'type');
            if (t && t.value !== 'string') return t.value.toLowerCase();
        }
        if (obj.type  && obj.type  !== '') return obj.type.toLowerCase();
        if (obj.class && obj.class !== '') return obj.class.toLowerCase();
        if (obj.name  && obj.name  !== '') return obj.name.toLowerCase();
        return '';
    }

    spawnKey(x, y) {
        const g = this.add.graphics().setDepth(4);
        g.fillStyle(0xffdd00, 1);
        g.fillCircle(0, 0, 9);
        g.fillStyle(0xffffff, 0.6);
        g.fillCircle(-3, -3, 3);
        g.lineStyle(2, 0xffffff, 0.8);
        g.strokeCircle(0, 0, 9);
        g.x = x; g.y = y;
        this.tweens.add({ targets: g, y: y - 7, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

        const zone = this.add.zone(x, y, 18, 18);
        this.physics.add.existing(zone, true);
        this.keyGroup.add(zone);
        zone._gfx = g;
        zone._active = true;
        zone._x = x;
        zone._y = y;
    }

    spawnHazard(x, y, w, h, kind, gid) {
        const zone = this.add.zone(x, y, w - 2, h - 2);
        this.physics.add.existing(zone, true);
        if (kind === 'spike') this.spikeGroup.add(zone);
        else                  this.treeGroup.add(zone);
        if (gid) {
            if (kind === 'spike') {
                this.add.image(x + 4, y + 4, 'tilemap_sheet', gid - 1)
                    .setDepth(3.5).setTint(0xff0000).setAlpha(0.55);
                const glow = this.add.image(x, y, 'tilemap_sheet', gid - 1)
                    .setDepth(3).setScale(1.8).setTint(0xff0000)
                    .setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
                this.tweens.add({
                    targets: glow,
                    alpha: 0.85,
                    duration: 350,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
            }
            this.add.image(x, y, 'tilemap_sheet', gid - 1).setDepth(4);
        }
    }

    buildParticles() {
        // Bake solid-color circle textures so particle color is exact (no tint needed)
        const makeCircleTex = (key, color) => {
            const g = this.make.graphics({ add: false });
            g.fillStyle(color, 1);
            g.fillCircle(8, 8, 8);
            g.generateTexture(key, 16, 16);
            g.destroy();
        };
        makeCircleTex('ptx_collect', 0xffdd00);
        makeCircleTex('ptx_jump',    0x00ff44);
        makeCircleTex('ptx_dash',    0xc4956a);
        makeCircleTex('ptx_death',   0xff1111);

        // Soft glow circle for super jump — layered rings so edges fade naturally
        (() => {
            const g = this.make.graphics({ add: false });
            g.fillStyle(0x00ccff, 0.15); g.fillCircle(32, 32, 32);
            g.fillStyle(0x00eeff, 0.30); g.fillCircle(32, 32, 22);
            g.fillStyle(0x00ffff, 0.55); g.fillCircle(32, 32, 13);
            g.fillStyle(0xaaffff, 0.90); g.fillCircle(32, 32,  5);
            g.generateTexture('ptx_superjump', 64, 64);
            g.destroy();
        })();

        this.dashLineEmitter = this.add.particles(0, 0, "ptx_dash", {
            frequency: 22,
            quantity: 3,
            speedX: { min: -750, max: -350 },
            speedY: { min: -12, max: 12 },
            scale: { start: 1.2, end: 0 },
            alpha: { start: 0.9, end: 0 },
            lifespan: 170,
            depth: 4
        });
        this.dashLineEmitter.stop();

        this.rollSmokeEmitter = this.add.particles(0, 0, "kenny-particles", {
            frame: ['smoke_01.png', 'smoke_02.png'],
            frequency: 70,
            quantity: 1,
            speedX: { min: -55, max: -15 },
            speedY: { min: -18, max: 8 },
            scale: { start: 0.07, end: 0.22 },
            alpha: { start: 0.55, end: 0 },
            lifespan: 340,
            tint: [0xaaaaaa, 0xcccccc, 0xffffff],
            depth: 3
        });
        this.rollSmokeEmitter.stop();

        this.jumpEmitter = this.add.particles(0, 0, "kenny-particles", {
            frame: ['star_01.png', 'star_02.png'],
            frequency: -1,
            speed: { min: 80, max: 200 },
            scale: { start: 0, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: { min: 250, max: 500 },
            angle: { min: 210, max: 330 },
            tint: [0xffff00, 0xffaa00, 0xffffff],
            depth: 3
        });

        // Launch kick — additive blend gives a natural glow as particles overlap
        this.superJumpEmitter = this.add.particles(0, 0, "energyball_6", {
            frequency: -1,
            speed: { min: 40, max: 100 },
            scale: { start: 0.2, end: 0 },
            alpha: { start: 0.55, end: 0 },
            lifespan: { min: 300, max: 600 },
            angle: { min: 0, max: 360 },
            blendMode: Phaser.BlendModes.ADD,
            depth: 3
        });

        // Dense glowing trail that follows the player all the way up
        this.superJumpTrailEmitter = this.add.particles(0, 0, "energyball_6", {
            frequency: 15,
            quantity: 8,
            speed: { min: 15, max: 50 },
            angle: { min: 60, max: 120 },
            scale: { start: 0.08, end: 0 },
            alpha: { start: 0.55, end: 0 },
            lifespan: 220,
            blendMode: Phaser.BlendModes.ADD,
            depth: 3
        });
        this.superJumpTrailEmitter.stop();

        this.landEmitter = this.add.particles(0, 0, "kenny-particles", {
            frame: ['smoke_01.png', 'smoke_02.png'],
            frequency: -1,
            speed: { min: 20, max: 80 },
            scale: { start: 0.15, end: 0 },
            alpha: { start: 0.5, end: 0 },
            lifespan: 280,
            angle: { min: 170, max: 370 },
            depth: 3
        });

        this.collectEmitter = this.add.particles(0, 0, "ptx_collect", {
            frequency: -1,
            speed: { min: 80, max: 220 },
            angle: { min: 0, max: 360 },
            scale: { start: 0.7, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: { min: 200, max: 400 },
            depth: 6
        });

        this.deathEmitter = this.add.particles(0, 0, "ptx_death", {
            frequency: -1,
            speed: { min: 120, max: 380 },
            scale: { start: 3.5, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: { min: 400, max: 900 },
            angle: { min: 0, max: 360 },
            depth: 8
        });

    }

    buildAudio() {
    this._sfx = {};
    this._sfx['sfx_jump'] = this.sound.add('jump', { volume: 0.5 });
    this._sfx['sfx_superjump'] = this.sound.add('superjump', { volume: 0.5 });
    this._sfx['sfx_land'] = this.sound.add('land', { volume: 0.5 });
    this._sfx['sfx_collect'] = this.sound.add('collect', { volume: 0.5 });
    this._sfx['sfx_die'] = this.sound.add('die', { volume: 0.5 });
}

    playSfx(key, vol = 0.5) {
        if (this._sfx && this._sfx[key]) this._sfx[key].play({ volume: vol });
    }

    buildUI() {
        const z    = this.cameras.main.zoom;
        const base = { fontFamily: 'monospace', stroke: '#000000', strokeThickness: Math.round(3/z) };

        this.scoreText = this.add.text(0, 0, 'SCORE: 0', {
            ...base, fontSize: `${Math.round(28/z)}px`, color: '#00ffff'
        }).setDepth(100);

        this.bestText = this.add.text(0, 0, `BEST: ${this.registry.get('highScore') || 0}`, {
            ...base, fontSize: `${Math.round(18/z)}px`, color: '#888888'
        }).setDepth(100);

        this.speedText = this.add.text(0, 0, 'SPEED: x1.0', {
            ...base, fontSize: `${Math.round(18/z)}px`, color: '#ff8800'
        }).setDepth(100);

        this.speedBar = this.add.graphics().setDepth(100);

        this.keyIndicator = this.add.text(0, 0, '★ SUPER JUMP READY', {
            ...base, fontSize: `${Math.round(20/z)}px`, color: '#ffff00'
        }).setDepth(100).setOrigin(1, 0).setVisible(false);

        this.tweens.add({ targets: this.keyIndicator, alpha: 0.3, duration: 400, yoyo: true, repeat: -1 });

        this.dashText = this.add.text(0, 0, 'DASH: READY', {
            ...base, fontSize: `${Math.round(18/z)}px`, color: '#00ff00'
        }).setDepth(100).setOrigin(1, 0);

        this._updateUIPos();
    }

    _updateUIPos() {
        const wv  = this.cameras.main.worldView;
        const z   = this.cameras.main.zoom;
        const pad = 16 / z;
        const L   = wv.left  + pad;
        const R   = wv.right - pad;
        const T   = wv.top   + pad;

        this.scoreText.setPosition(L, T);
        this.bestText.setPosition(L, T + 32/z);
        this.speedText.setPosition(L, T + 56/z);
        this._barX = L;
        this._barY = T + 78/z;
        this._barW = 160/z;
        this._barH = 9/z;
        this.keyIndicator.setPosition(R, T);
        this.dashText.setPosition(R, T + 26/z);
    }
    onLand() {
        if (!this.wasOnGround && this.player.body.blocked.down) {
            this.landEmitter.explode(6, this.player.x, this.player.y + 30);
            this.cameras.main.shake(60, 0.003);
            this.playSfx('sfx_land', 0.4);
        }
    }

    tryJump() {
        if (this.isDead || this.hasWon) return;
        const onGround = this.player.body.blocked.down;
        const coyoteOk = this.jumpCount === 0 && this._coyoteTimeLeft > 0;

        if (onGround || coyoteOk) {
            this._coyoteTimeLeft = 0;
            if (this.hasKey) {
                this.player.body.setVelocityY(this.SUPER_JUMP_VELOCITY);
                this.hasKey = false;
                this.keyIndicator.setVisible(false);
                // Tiny launch kick at feet
                this.superJumpEmitter.explode(6, this.player.x, this.player.y + 15);
                // Dense tiny trail follows player for the full upward journey (~580 ms)
                this._superJumpTrailing = true;
                this.superJumpTrailEmitter.setPosition(this.player.x, this.player.y + 10);
                this.superJumpTrailEmitter.start();
                this.time.delayedCall(580, () => {
                    this._superJumpTrailing = false;
                    this.superJumpTrailEmitter.stop();
                });
                this.cameras.main.shake(140, 0.007);
                this.playSfx('sfx_superjump', 0.8);
            } else {
                this.player.body.setVelocityY(this.JUMP_VELOCITY);
                this.jumpEmitter.explode(8, this.player.x, this.player.y + 14);
                this.playSfx('sfx_jump', 0.6);
            }
            this.player.anims.play('jump', true);
            this.jumpCount = 1;
        } else if (this.jumpCount < 2) {
            this.player.body.setVelocityY(this.JUMP_VELOCITY * 0.8);
            this.jumpCount = 2;
            this.jumpEmitter.explode(5, this.player.x, this.player.y);
            this.playSfx('sfx_jump', 0.35);
        }
    }

    collectKey(zone) {
        if (!zone._active || this.hasKey) return;
        this.hasKey = true;
        zone._active = false;
        if (zone._gfx) {
            this.tweens.killTweensOf(zone._gfx);
            zone._gfx.destroy();
            zone._gfx = null;
        }
        zone.body.enable = false;
        this.time.delayedCall(10000, () => this.spawnKey(zone._x, zone._y));
        this.score += 100;
        this.keyIndicator.setVisible(true);
        this.collectEmitter.explode(14, zone._x, zone._y);
        this.playSfx('sfx_collect', 0.7);
        this.tweens.add({
            targets: this.player, alpha: 0.3,
            duration: 80, yoyo: true, repeat: 4,
            onComplete: () => this.player.setAlpha(1)
        });
    }

    triggerDeath() {
        if (this.isDead || this.hasWon) return;
        this.isDead = true;

        this.tweens.add({ targets: this.bgMusic, volume: 0, duration: 1000 });

        this.player.body.setVelocity(0, 0);
        this.player.body.setAllowGravity(false);
        this.rollSmokeEmitter.stop();
        this.dashLineEmitter.stop();
        this.player.clearTint();
        this.playSfx('sfx_die', 0.8);

        // Particles burst immediately on death; animation plays concurrently
        this.deathEmitter.explode(32, this.player.x, this.player.y);
        this.player.anims.play('death');
        this.player.once('animationcomplete-death', () => {
            this.player.setVisible(false);
        });

        const flash = this.add.rectangle(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2 - 600,
            this.cameras.main.width,
            this.cameras.main.height,
            0xff0000, 0.3
        ).setScrollFactor(0).setDepth(15);
        this.tweens.add({ targets: flash, alpha: 0, duration: 400 });
        this.cameras.main.shake(300, 0.015);

        const hs = this.registry.get('highScore') || 0;
        if (this.score > hs) this.registry.set('highScore', this.score);

        // Death anim ~833 ms + brief pause before fade
        this.time.delayedCall(1600, () => {
            this.cameras.main.fadeOut(400, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => {
                this.scene.start('gameOverScene', {
                    score: this.score,
                    highScore: Math.max(this.score, hs),
                    won: false
                });
            });
        });
    }

    triggerWin() {
        if (this.isDead || this.hasWon) return;
        this.hasWon = true;

        this.player.body.setVelocity(0, 0);
        this.player.body.setAllowGravity(false);
        this.rollSmokeEmitter.stop();
        this.dashLineEmitter.stop();
        this.player.clearTint();

        // Win flash — green
        const flash = this.add.rectangle(720, 225, 1440, 450, 0x00ff88, 0.4)
            .setScrollFactor(0).setDepth(15);
        this.tweens.add({ targets: flash, alpha: 0, duration: 600 });

        // Burst of collect particles
        this.collectEmitter.explode(40, this.player.x, this.player.y);
        this.cameras.main.shake(200, 0.008);

        // Win text
        this.add.text(720, 200, 'YOU WIN!', {
            fontSize: '64px', fontFamily: 'monospace',
            color: '#00ff88', stroke: '#003322', strokeThickness: 6
        }).setScrollFactor(0).setDepth(20).setOrigin(0.5);

        this.add.text(720, 270, `SCORE: ${this.score}`, {
            fontSize: '28px', fontFamily: 'monospace',
            color: '#ffffff', stroke: '#000000', strokeThickness: 3
        }).setScrollFactor(0).setDepth(20).setOrigin(0.5);

        const hs = this.registry.get('highScore') || 0;
        if (this.score > hs) this.registry.set('highScore', this.score);

        this.time.delayedCall(3000, () => {
            this.cameras.main.fadeOut(400, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => {
                this.scene.start('gameOverScene', {
                    score: this.score,
                    highScore: Math.max(this.score, hs),
                    won: true
                });
            });
        });
    }

    checkLoop() {
        if (this.player.x > this.mapW * 2) {
            this.player.x             -= this.mapW;
            this.cameras.main.scrollX -= this.mapW;
            this._lastScrollX         -= this.mapW; // cancel the loop jump so cloud parallax doesn't spike
            // Instantly re-commit camera position this frame (clears deadzone artifact),
            // then restore smooth lerp on the next frame via the flag.
            this.cameras.main.startFollow(this.player, false, 1, 1);
            this.cameras.main.setFollowOffset(0, 100);
            this.cameras.main.setDeadzone(50, 20);
            this._restoreCameraLerp = true;
        }
    }

    isTileSolid(worldX, worldY) {
        const gt = this.groundLayers[1].getTileAtWorldXY(worldX, worldY);
        if (gt && gt.index !== -1) return true;
        const pt = this.platformLayers[1].getTileAtWorldXY(worldX, worldY);
        if (pt && pt.index !== -1) return true;
        return false;
    }

    getGroundSurface(worldX) {
        for (let y = 0; y < this.mapH; y += 18) {
            const gt = this.groundLayers[1].getTileAtWorldXY(worldX, y);
            if (gt && gt.index !== -1) return y;
            const pt = this.platformLayers[1].getTileAtWorldXY(worldX, y);
            if (pt && pt.index !== -1) return y;
        }
        return null;
    }

    update(time, delta) {
        // Clouds use scrollFactor(0,0) so c.x is screen-space (canvas_x = c.x * zoom).
        // Parallax is applied manually: camera delta * 0.03 mimics scrollFactor 0.03.
        const camDelta = this.cameras.main.scrollX - this._lastScrollX;
        this._lastScrollX = this.cameras.main.scrollX;
        const screenW = this.scale.width / this.cameras.main.zoom; // ~800 world units
        this.cloudImages.forEach(c => {
            c.x -= 0.2 + camDelta * 0.03;
            if (c.x < -200) {
                c.x = screenW + Phaser.Math.Between(100, 400);
            }
        });
        this._updateUIPos();

        if (this._superJumpTrailing) {
            this.superJumpTrailEmitter.setPosition(this.player.x, this.player.y + 25);
        }

        if (this._restoreCameraLerp) {
            this._restoreCameraLerp = false;
            this.cameras.main.startFollow(this.player, false, 0.1, 0.1);
            this.cameras.main.setFollowOffset(0, 100);
            this.cameras.main.setDeadzone(50, 20);
        }

        if (this.isDead || this.hasWon) return;

        this.elapsed += delta;
        this.speedMult = Math.min(this.SPEED_CAP, 1.0 + this.elapsed * this.SPEED_RATE);
        const maxSpd   = this.MAX_SPEED * this.speedMult;
        const MIN_SPEED = 150 * this.speedMult;

        const body     = this.player.body;
        const onGround = body.blocked.down;
        const goRight  = this.cursors.right.isDown;
        const goLeft   = this.cursors.left.isDown || this.wasd.left.isDown;

        let accelX = 0;
        if (goRight)     accelX =  this.ACCELERATION * this.speedMult;
        else if (goLeft) accelX = -this.ACCELERATION * this.speedMult;


        // Dash ability
        const dashReady = (this.time.now - this.lastDashTime) >= this.DASH_COOLDOWN;
        if (Phaser.Input.Keyboard.JustDown(this.wasd.dash) && dashReady && !this.dashActive) {
            this._preDashVelX = body.velocity.x;
            this.dashActive   = true;
            this.lastDashTime = this.time.now;
            body.setVelocityX(this.DASH_SPEED);
            this.player.setTint(0x00ffff);
            this.player.anims.play({ key: 'walk', frameRate: 20, repeat: -1 }, true);
            this.cameras.main.shake(100, 0.005);
            this.jumpEmitter.explode(10, this.player.x, this.player.y);
            this.time.delayedCall(this.DASH_DURATION, () => {
                this.dashActive = false;
                body.setVelocityX(this._preDashVelX);
                this.player.clearTint();
                this.dashLineEmitter.stop();
            });
        }

        if (dashReady) {
            this.dashText.setText('DASH: READY');
            this.dashText.setColor('#00ff00');
        } else {
            const secs = ((this.DASH_COOLDOWN - (this.time.now - this.lastDashTime)) / 1000).toFixed(1);
            this.dashText.setText(`DASH: ${secs}s`);
            this.dashText.setColor('#ff0000');
        }

        if (this.dashActive) {
            // Lock at fixed dash speed — no input, no drag, no deceleration
            body.setAccelerationX(0);
            body.setVelocityX(this.DASH_SPEED);
            this.dashLineEmitter.setPosition(this.player.x - 12, this.player.y + 30);
            this.dashLineEmitter.start();
        } else {
            body.setAccelerationX(accelX);
            body.setMaxVelocityX(maxSpd + this.fallBoostVel);
            // Always move forward
            if (body.velocity.x < MIN_SPEED) {
                body.setVelocityX(MIN_SPEED);
            }
        }

        // Auto-hop: clears 1-tile and 2-tile steps, restores pre-collision speed
        if (onGround && body.velocity.x > 0) {
            const lookX   = this.player.x + 18;
            const wallHit = body.blocked.right || this.isTileSolid(lookX, this.player.y + 4);
            const clear1  = !this.isTileSolid(lookX, this.player.y - 20);
            const clear2  = !this.isTileSolid(lookX, this.player.y - 38);

            if (wallHit && clear1) {
                body.setVelocityY(this.JUMP_VELOCITY * 0.5);
                body.setVelocityX(Math.max(this._prevVelX || MIN_SPEED, MIN_SPEED));
            } else if (wallHit && clear2) {
                body.setVelocityY(this.JUMP_VELOCITY * 0.75);
                body.setVelocityX(Math.max(this._prevVelX || MIN_SPEED, MIN_SPEED));
            }
        }

        if (onGround) {
            this.jumpCount = 0;
            if (this.dashActive) {
                this.player.anims.play({ key: 'walk', frameRate: 20, repeat: -1 }, true);
            } else if (Math.abs(body.velocity.x) > 10) {
                this.player.anims.play('roll', true);
            } else {
                this.player.anims.play('idle', true);
            }
        } else if (body.velocity.y > 0) {
            this.player.anims.play('fall', true);
        } else if (body.velocity.y < 0) {
            this.player.anims.play('jump', true);
        }

        if (!onGround && this.wasOnGround) {
            this.airborneY = this.player.y;
            this._coyoteTimeLeft = this.COYOTE_MS;
        }
        if (this._coyoteTimeLeft > 0) {
            this._coyoteTimeLeft = Math.max(0, this._coyoteTimeLeft - delta);
        }

        if (onGround && !this.wasOnGround) {
            this.landEmitter.explode(6, this.player.x, this.player.y + 30);
            this.cameras.main.shake(60, 0.003);
            this.playSfx('sfx_land', 0.4);

            if (this.airborneY !== null) {
                const dropDist = this.player.y - this.airborneY;
                if (dropDist >= 36) {
                    const tiles = Math.min(dropDist / this.FALL_TILE_SIZE, 3);
                    const boost = tiles * this.FALL_BOOST_PER_TILE;
                    this.fallBoostVel = boost;
                    body.setVelocityX(body.velocity.x + boost);
                    if (this._fallBoostTween) this._fallBoostTween.stop();
                    this._fallBoostTween = this.tweens.add({
                        targets: this,
                        fallBoostVel: 0,
                        duration: 1500,
                        ease: 'Quad.easeOut'
                    });
                }
                this.airborneY = null;
            }
        }
        this.wasOnGround = onGround;

        const isRolling = onGround && Math.abs(body.velocity.x) > 10 && !this.dashActive;
        if (isRolling) {
            this.rollSmokeEmitter.setPosition(this.player.x - 8, this.player.y + 30);
            this.rollSmokeEmitter.start();
        } else {
            this.rollSmokeEmitter.stop();
        }



        this.ghosts.forEach(g => g.update());
        this.checkLoop();

        // Win condition — survive to score 500
        if (this.score >= 2000) {
            this.triggerWin();
        }

        this.score = Math.floor(this.elapsed / 100 * this.speedMult);
        this.scoreText.setText(`SCORE: ${this.score}`);
        this.speedText.setText(`SPEED: x${this.speedMult.toFixed(1)}`);

        this.speedBar.clear();
        const pct = (this.speedMult - 1) / (this.SPEED_CAP - 1);
        const hue = 0.33 - pct * 0.33;
        this.speedBar.fillStyle(0x222222, 0.5);
        this.speedBar.fillRect(this._barX, this._barY, this._barW, this._barH);
        this.speedBar.fillStyle(Phaser.Display.Color.HSLToColor(hue, 1, 0.5).color, 1);
        this.speedBar.fillRect(this._barX, this._barY, this._barW * pct, this._barH);

        if (!this.dashActive) this._prevVelX = body.velocity.x;
    }
}