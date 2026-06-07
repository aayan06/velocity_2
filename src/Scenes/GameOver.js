class GameOver extends Phaser.Scene {
    constructor() {
        super("gameOverScene");
    }

    init(data) {
        this.finalScore = data.score      || 0;
        this.highScore  = data.highScore  || 0;
        this.won        = data.won        || false;
    }

    create() {
        this.cameras.main.setBackgroundColor(this.won ? '#001a00' : '#1a0000');

        const cx = 600;

        this.add.text(cx, 160, this.won ? 'YOU WIN!' : 'GAME OVER', {
            fontSize: '72px',
            fill: this.won ? '#00ff88' : '#ff0000',
            fontFamily: 'Arial',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.add.text(cx, 270, 'Score: ' + this.finalScore, {
            fontSize: '36px',
            fill: '#ffffff',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        if (this.finalScore >= this.highScore && this.finalScore > 0) {
            this.add.text(cx, 330, 'NEW HIGH SCORE!', {
                fontSize: '24px',
                fill: '#00ff00',
                fontFamily: 'Arial'
            }).setOrigin(0.5);
        } else {
            this.add.text(cx, 330, 'Best: ' + this.highScore, {
                fontSize: '24px',
                fill: '#aaaaaa',
                fontFamily: 'Arial'
            }).setOrigin(0.5);
        }

        this.add.text(cx, 430, 'Press R to restart', {
            fontSize: '26px',
            fill: '#ffff00',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        this.add.text(cx, 475, 'Press T for title screen', {
            fontSize: '20px',
            fill: '#aaaaaa',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        this.input.keyboard.on('keydown-R', () => {
            this.scene.start("platformerScene");
        });

        this.input.keyboard.on('keydown-T', () => {
            this.scene.start("titleScene");
        });
    }
}
