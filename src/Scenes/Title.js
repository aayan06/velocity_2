class Title extends Phaser.Scene {
    constructor() {
        super("titleScene");
    }

    create() {
        this.cameras.main.setBackgroundColor('#0a0a2e');

        const cx = 600;

        this.add.text(cx, 150, 'VELOCITY', {
            fontSize: '72px',
            fill: '#00ffff',
            fontFamily: 'Arial',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.add.text(cx, 230, 'How long can you survive?', {
            fontSize: '22px',
            fill: '#ffffff',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        this.add.text(cx, 320, 'CONTROLS', {
            fontSize: '16px',
            fill: '#555555',
            fontFamily: 'Arial',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.add.text(cx, 350, '→   Accelerate', {
            fontSize: '18px',
            fill: '#aaaaaa',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        this.add.text(cx, 378, 'A   Brake', {
            fontSize: '18px',
            fill: '#aaaaaa',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        this.add.text(cx, 406, 'D   Dash  (5s cooldown)', {
            fontSize: '18px',
            fill: '#aaaaaa',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        this.add.text(cx, 434, 'W / SPACE   Jump', {
            fontSize: '18px',
            fill: '#aaaaaa',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        this.add.text(cx, 510, 'Press SPACE to start', {
            fontSize: '26px',
            fill: '#ffff00',
            fontFamily: 'Arial',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.add.text(cx, 570, 'by Aayan Abdullah', {
            fontSize: '14px',
            fill: '#444444',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        this.input.keyboard.on('keydown-SPACE', () => {
            this.scene.start("platformerScene");
        });
    }
}
