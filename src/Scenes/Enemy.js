class Ghost {
    constructor(scene, x, y, spawnX) {
        this.scene  = scene;
        this.spawnX = spawnX ?? x;
        this.dir        = 1;
        this.state      = 'patrol';
        this.wasChasing = false;

        this.glow = scene.add.sprite(this.spawnX, y, 'ghost_normal')
            .setScale(0.58)
            .setOrigin(0.5, 1)
            .setDepth(3)
            .setTint(0xff2222)
            .setAlpha(0)
            .setBlendMode(Phaser.BlendModes.ADD);

        scene.tweens.add({
            targets: this.glow,
            alpha: 0.35,
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.shadow = scene.add.sprite(this.spawnX + 5, y + 5, 'ghost_normal')
            .setScale(0.4)
            .setOrigin(0.5, 1)
            .setDepth(3.5)
            .setTint(0xff0000)
            .setAlpha(0.55);

        this.sprite = scene.physics.add.sprite(this.spawnX, y, 'ghost_normal')
            .setScale(0.4)
            .setOrigin(0.5, 1)
            .setDepth(4);
        this.sprite.body.setAllowGravity(false);
        this.sprite.body.setVelocityX(this.dir * 40);

        scene.physics.add.overlap(
            scene.player, this.sprite,
            () => scene.triggerDeath(), null, scene
        );
    }

    update() {
        const player       = this.scene.player;
        const dx           = player.x - this.sprite.x;
        const distToPlayer = Math.abs(dx);
        const distToSpawn  = Math.abs(this.sprite.x - this.spawnX);

        this.state = (distToPlayer < 150 && distToSpawn < 200) ? 'chase' : 'patrol';
        this.sprite.setTexture(this.state === 'chase' ? 'ghost' : 'ghost_normal');

        if (this.state === 'chase' && !this.wasChasing) {
            this.scene.sound.play('ghost_alert', { volume: 0.6 });
        }
        this.wasChasing = (this.state === 'chase');

        let targetVel;
        if (this.state === 'chase') {
            const dir = dx > 0 ? 1 : -1;
            targetVel = dir * 90;
            this.sprite.setFlipX(dir < 0);
        } else {
            if      (this.sprite.x >= this.spawnX + 80) this.dir = -1;
            else if (this.sprite.x <= this.spawnX - 80) this.dir =  1;
            targetVel = this.dir * 40;
            this.sprite.setFlipX(this.dir < 0);
        }

        // Lerp toward target velocity for smooth acceleration/deceleration
        const curVel = this.sprite.body.velocity.x;
        this.sprite.body.setVelocityX(curVel + (targetVel - curVel) * 0.1);

        // Keep glow and shadow locked to the sprite
        this.glow.setPosition(this.sprite.x, this.sprite.y);
        this.glow.setFlipX(this.sprite.flipX);
        this.shadow.setPosition(this.sprite.x + 5, this.sprite.y + 5);
        this.shadow.setFlipX(this.sprite.flipX);
        this.shadow.setTexture(this.state === 'chase' ? 'ghost' : 'ghost_normal');
    }

    destroy() {
        this.scene.tweens.killTweensOf(this.glow);
        this.glow.destroy();
        this.shadow.destroy();
        this.sprite.destroy();
    }
}
