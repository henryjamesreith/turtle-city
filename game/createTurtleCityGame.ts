import Phaser from "phaser";

const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;

const COLORS = {
  ink: 0x17332d,
  cream: 0xfffaef,
  snow: 0xf7fbf5,
  snowShadow: 0xd9e9e5,
  sky: 0xb9deea,
  distant: 0x8db7b8,
  pine: 0x1f6a50,
  pineDark: 0x174e40,
  turtle: 0x78a94f,
  shell: 0x3e7350,
  shellLight: 0x60925c,
  coral: 0xf2765c,
  yellow: 0xffd76e,
  ice: 0xa9dce5,
  iceLight: 0xd9f2f1,
  path: 0xd8e5dc,
  pathShadow: 0xc5d5cc,
};

type KeyMap = {
  W: Phaser.Input.Keyboard.Key;
  A: Phaser.Input.Keyboard.Key;
  S: Phaser.Input.Keyboard.Key;
  D: Phaser.Input.Keyboard.Key;
  E: Phaser.Input.Keyboard.Key;
  SPACE: Phaser.Input.Keyboard.Key;
  ESC: Phaser.Input.Keyboard.Key;
};

type Turtle = Phaser.GameObjects.Container & {
  shellBody?: Phaser.GameObjects.Arc;
  leftFoot?: Phaser.GameObjects.Ellipse;
  rightFoot?: Phaser.GameObjects.Ellipse;
};

type Interaction = {
  x: number;
  y: number;
  radius: number;
  label: string;
  action: "activity" | "vendor" | "transit";
};

function addText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size: number,
  color = "#17332d",
  weight = "700",
) {
  return scene.add
    .text(x, y, text, {
      color,
      fontFamily: "Nunito, Arial, sans-serif",
      fontSize: `${size}px`,
      fontStyle: weight === "900" ? "bold" : "normal",
      lineSpacing: 3,
    })
    .setOrigin(0.5);
}

function createTurtle(
  scene: Phaser.Scene,
  x: number,
  y: number,
  name: string,
  shellColor = COLORS.shell,
): Turtle {
  const turtle = scene.add.container(x, y) as Turtle;
  const shadow = scene.add.ellipse(0, 23, 58, 16, 0x143a35, 0.15);
  const tail = scene.add.triangle(0, 0, -8, 17, 8, 17, 0, 29, COLORS.turtle);
  const leftArm = scene.add.ellipse(-28, 0, 15, 34, COLORS.turtle).setRotation(-0.2);
  const rightArm = scene.add.ellipse(28, 0, 15, 34, COLORS.turtle).setRotation(0.2);
  const leftFoot = scene.add.ellipse(-16, 23, 24, 13, COLORS.turtle);
  const rightFoot = scene.add.ellipse(16, 23, 24, 13, COLORS.turtle);
  const shell = scene.add.ellipse(0, 0, 61, 72, shellColor);
  shell.setStrokeStyle(4, COLORS.ink, 0.82);
  const shellInset = scene.add.ellipse(0, 0, 43, 54, COLORS.shellLight, 0.92);
  shellInset.setStrokeStyle(2, COLORS.ink, 0.36);
  const shellLineV = scene.add.rectangle(0, 0, 2, 48, COLORS.ink, 0.28);
  const shellLineH = scene.add.rectangle(0, 0, 38, 2, COLORS.ink, 0.28);
  const head = scene.add.ellipse(0, -39, 43, 37, COLORS.turtle);
  head.setStrokeStyle(3, COLORS.ink, 0.75);
  const eyeLeft = scene.add.circle(-8, -44, 3.2, COLORS.ink);
  const eyeRight = scene.add.circle(8, -44, 3.2, COLORS.ink);
  const smile = scene.add.arc(0, -36, 7, 15, 165, false, COLORS.ink).setStrokeStyle(
    2,
    COLORS.ink,
  );
  const nameplate = addText(scene, 0, -76, name, 13, "#17332d", "900")
    .setPadding(8, 4, 8, 4)
    .setBackgroundColor("rgba(255,250,239,0.88)");

  turtle.add([
    shadow,
    tail,
    leftArm,
    rightArm,
    leftFoot,
    rightFoot,
    shell,
    shellInset,
    shellLineV,
    shellLineH,
    head,
    eyeLeft,
    eyeRight,
    smile,
    nameplate,
  ]);
  turtle.setSize(62, 80);
  turtle.shellBody = shell;
  turtle.leftFoot = leftFoot;
  turtle.rightFoot = rightFoot;
  turtle.setDepth(y);
  return turtle;
}

function addTree(scene: Phaser.Scene, x: number, y: number, scale = 1) {
  const tree = scene.add.container(x, y).setDepth(y);
  const shadow = scene.add.ellipse(0, 8, 94, 24, 0x153b31, 0.14);
  const trunk = scene.add.rectangle(0, -48, 20, 104, 0x7c5b42);
  trunk.setStrokeStyle(3, COLORS.ink, 0.5);
  const snowBack = scene.add.ellipse(0, -114, 100, 55, COLORS.snowShadow);
  const canopyBack = scene.add.ellipse(0, -108, 94, 100, COLORS.pineDark);
  const canopyFront = scene.add.ellipse(0, -122, 84, 89, COLORS.pine);
  const snowCap = scene.add.ellipse(-8, -151, 69, 24, COLORS.snow);
  tree.add([shadow, trunk, snowBack, canopyBack, canopyFront, snowCap]);
  tree.setScale(scale);
  return tree;
}

function addLamp(scene: Phaser.Scene, x: number, y: number) {
  const lamp = scene.add.container(x, y).setDepth(y);
  const pole = scene.add.rectangle(0, -52, 7, 104, COLORS.ink);
  const base = scene.add.ellipse(0, 2, 28, 10, COLORS.ink);
  const glow = scene.add.circle(0, -110, 25, COLORS.yellow, 0.16);
  const light = scene.add.circle(0, -110, 13, COLORS.yellow);
  light.setStrokeStyle(4, COLORS.ink);
  lamp.add([glow, pole, base, light]);
  scene.tweens.add({
    targets: glow,
    alpha: { from: 0.08, to: 0.25 },
    scale: { from: 0.9, to: 1.1 },
    yoyo: true,
    repeat: -1,
    duration: 1600,
  });
}

function addBench(scene: Phaser.Scene, x: number, y: number) {
  const bench = scene.add.container(x, y).setDepth(y);
  const shadow = scene.add.ellipse(0, 10, 96, 18, 0x17332d, 0.12);
  const seat = scene.add.rectangle(0, -12, 92, 15, 0x9a6544);
  const back = scene.add.rectangle(0, -39, 92, 25, 0xb57b4f);
  const legLeft = scene.add.rectangle(-31, 1, 7, 31, COLORS.ink);
  const legRight = scene.add.rectangle(31, 1, 7, 31, COLORS.ink);
  [seat, back].forEach((part) => part.setStrokeStyle(3, COLORS.ink, 0.75));
  bench.add([shadow, legLeft, legRight, seat, back]);
}

function addSnowflakes(scene: Phaser.Scene, count: number) {
  for (let index = 0; index < count; index += 1) {
    const flake = scene.add
      .circle(
        Phaser.Math.Between(0, GAME_WIDTH),
        Phaser.Math.Between(-50, GAME_HEIGHT),
        Phaser.Math.Between(1, 3),
        0xffffff,
        Phaser.Math.FloatBetween(0.35, 0.8),
      )
      .setDepth(3000);
    const duration = Phaser.Math.Between(7000, 13000);
    scene.tweens.add({
      targets: flake,
      y: GAME_HEIGHT + 40,
      x: flake.x + Phaser.Math.Between(-90, 90),
      repeat: -1,
      duration,
      delay: Phaser.Math.Between(0, 5000),
      onRepeat: () => {
        flake.setPosition(
          Phaser.Math.Between(0, GAME_WIDTH),
          Phaser.Math.Between(-80, -10),
        );
      },
    });
  }
}

function createRoomHeader(
  scene: Phaser.Scene,
  kicker: string,
  title: string,
  rightLabel: string,
) {
  const panel = scene.add
    .rectangle(30, 25, 430, 84, COLORS.cream, 0.93)
    .setOrigin(0)
    .setDepth(5000);
  panel.setStrokeStyle(3, COLORS.ink, 0.72);
  addText(scene, 53, 48, kicker.toUpperCase(), 12, "#58776d", "900")
    .setOrigin(0)
    .setDepth(5001)
    .setLetterSpacing(2);
  addText(scene, 53, 77, title, 28, "#17332d", "900")
    .setOrigin(0)
    .setDepth(5001);

  scene.add
    .rectangle(GAME_WIDTH - 30, 28, 235, 46, COLORS.ink, 0.9)
    .setOrigin(1, 0)
    .setDepth(5000);
  addText(
    scene,
    GAME_WIDTH - 147,
    51,
    rightLabel,
    13,
    "#fffaf0",
    "900",
  ).setDepth(5001);
}

class ExploreScene extends Phaser.Scene {
  private player!: Turtle;
  private keys!: KeyMap;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private velocity = new Phaser.Math.Vector2();
  private prompt!: Phaser.GameObjects.Text;
  private iceBadge!: Phaser.GameObjects.Text;
  private interactions: Interaction[] = [];
  private toast?: Phaser.GameObjects.Container;
  private spawnX = 620;
  private spawnY = 590;
  private returnMessage?: string;

  constructor() {
    super("Explore");
  }

  init(data: { x?: number; y?: number; message?: string } = {}) {
    this.spawnX = data.x ?? 620;
    this.spawnY = data.y ?? 590;
    this.returnMessage = data.message;
    this.velocity.set(0, 0);
  }

  create() {
    this.cameras.main.setBackgroundColor(COLORS.sky);
    this.drawPark();
    addSnowflakes(this, 42);
    createRoomHeader(
      this,
      "Turtle City · Room 01",
      "Central Park",
      "Always winter · 24°F",
    );

    this.player = createTurtle(
      this,
      this.spawnX,
      this.spawnY,
      "You",
      COLORS.shell,
    );

    createTurtle(this, 385, 555, "Myrtle", 0xc26455).setScale(0.82);
    createTurtle(this, 875, 305, "Franklin", 0x4d7ea2).setScale(0.82);
    createTurtle(this, 695, 255, "Shelly", 0x94734f).setScale(0.82);

    this.keys = this.input.keyboard?.addKeys(
      "W,A,S,D,E,SPACE,ESC",
    ) as KeyMap;
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.input.keyboard?.addCapture([
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
      Phaser.Input.Keyboard.KeyCodes.SPACE,
    ]);

    this.prompt = addText(
      this,
      GAME_WIDTH / 2,
      GAME_HEIGHT - 38,
      "Walk around with WASD or the arrow keys",
      17,
      "#fffaf0",
      "900",
    )
      .setPadding(18, 10, 18, 10)
      .setBackgroundColor("rgba(23,51,45,0.92)")
      .setDepth(6000);

    this.iceBadge = addText(
      this,
      GAME_WIDTH - 46,
      104,
      "⛸  Skating",
      15,
      "#17332d",
      "900",
    )
      .setOrigin(1, 0)
      .setPadding(14, 8, 14, 8)
      .setBackgroundColor("rgba(255,250,239,0.92)")
      .setDepth(5500)
      .setVisible(false);

    if (this.returnMessage) {
      this.time.delayedCall(250, () => this.showToast(this.returnMessage!));
    }
  }

  update(_time: number, delta: number) {
    const direction = new Phaser.Math.Vector2(
      Number(this.keys.D.isDown || this.cursors.right.isDown) -
        Number(this.keys.A.isDown || this.cursors.left.isDown),
      Number(this.keys.S.isDown || this.cursors.down.isDown) -
        Number(this.keys.W.isDown || this.cursors.up.isDown),
    );

    if (direction.lengthSq() > 0) {
      direction.normalize();
    }

    const onIce = this.isOnIce(this.player.x, this.player.y);
    this.iceBadge.setVisible(onIce);

    if (onIce) {
      this.velocity.x += direction.x * 9.5;
      this.velocity.y += direction.y * 9.5;
      this.velocity.scale(direction.lengthSq() > 0 ? 0.985 : 0.974);
      this.velocity.limit(245);
    } else {
      this.velocity.set(direction.x * 178, direction.y * 178);
    }

    const seconds = Math.min(delta, 32) / 1000;
    this.player.x = Phaser.Math.Clamp(
      this.player.x + this.velocity.x * seconds,
      58,
      GAME_WIDTH - 58,
    );
    this.player.y = Phaser.Math.Clamp(
      this.player.y + this.velocity.y * seconds,
      188,
      GAME_HEIGHT - 78,
    );

    const speed = this.velocity.length();
    const moving = speed > 7;
    const bob = moving ? Math.sin(this.time.now / (onIce ? 145 : 82)) * 2.2 : 0;
    this.player.setDepth(this.player.y);
    this.player.setRotation(
      onIce && moving
        ? Phaser.Math.Clamp(this.velocity.x / 1100, -0.14, 0.14)
        : 0,
    );
    if (this.player.leftFoot && this.player.rightFoot) {
      this.player.leftFoot.y = 23 + bob;
      this.player.rightFoot.y = 23 - bob;
    }
    if (Math.abs(this.velocity.x) > 8) {
      this.player.setScale(this.velocity.x < 0 ? -1 : 1, 1);
      const nameplate = this.player.list.at(-1) as Phaser.GameObjects.Text;
      nameplate.setScale(this.velocity.x < 0 ? -1 : 1, 1);
    }

    const interaction = this.getNearbyInteraction();
    if (interaction) {
      this.prompt.setText(`E  ·  ${interaction.label}`);
      if (Phaser.Input.Keyboard.JustDown(this.keys.E)) {
        this.handleInteraction(interaction);
      }
    } else if (onIce) {
      this.prompt.setText("Skate with WASD or arrows · Momentum carries you");
    } else {
      this.prompt.setText("Explore with WASD or arrows · Look for the coral E");
    }
  }

  private drawPark() {
    this.add.rectangle(0, 0, GAME_WIDTH, 210, COLORS.sky).setOrigin(0);
    this.add.circle(1060, 92, 54, 0xffe49b, 0.86);

    const skyline = this.add.graphics().setDepth(1);
    const buildingWidths = [60, 44, 84, 52, 70, 39, 90, 50, 64, 42, 78];
    let skylineX = 0;
    buildingWidths.forEach((width, index) => {
      const height = 42 + ((index * 37) % 74);
      skyline.fillStyle(index % 2 ? 0x729e9f : COLORS.distant, 0.84);
      skyline.fillRect(skylineX, 184 - height, width - 4, height + 35);
      for (let windowX = skylineX + 10; windowX < skylineX + width - 9; windowX += 15) {
        skyline.fillStyle(0xf7e7a8, 0.55);
        skyline.fillRect(windowX, 158 - height / 2, 5, 7);
      }
      skylineX += width;
    });

    this.add.rectangle(0, 185, GAME_WIDTH, 535, COLORS.snow).setOrigin(0).setDepth(2);
    this.add
      .ellipse(640, 705, 1450, 300, COLORS.snowShadow, 0.8)
      .setDepth(2);

    const path = this.add.graphics().setDepth(3);
    path.lineStyle(112, COLORS.pathShadow, 1);
    path.beginPath();
    path.moveTo(38, 633);
    path.lineTo(140, 570);
    path.lineTo(260, 530);
    path.lineTo(360, 550);
    path.lineTo(440, 600);
    path.lineTo(555, 642);
    path.lineTo(675, 650);
    path.lineTo(805, 565);
    path.lineTo(930, 500);
    path.lineTo(1060, 500);
    path.lineTo(1250, 545);
    path.strokePath();
    path.lineStyle(92, COLORS.path, 1);
    path.beginPath();
    path.moveTo(38, 625);
    path.lineTo(140, 565);
    path.lineTo(260, 525);
    path.lineTo(360, 546);
    path.lineTo(440, 596);
    path.lineTo(555, 635);
    path.lineTo(675, 642);
    path.lineTo(805, 557);
    path.lineTo(930, 496);
    path.lineTo(1060, 496);
    path.lineTo(1250, 541);
    path.strokePath();

    this.add
      .ellipse(633, 397, 590, 286, COLORS.iceLight, 1)
      .setStrokeStyle(18, 0xe6f1ec, 1)
      .setDepth(4);
    this.add
      .ellipse(633, 401, 548, 250, COLORS.ice, 1)
      .setStrokeStyle(5, 0x78afbd, 0.7)
      .setDepth(5);

    const iceMarks = this.add.graphics().setDepth(6);
    iceMarks.lineStyle(3, 0xffffff, 0.55);
    iceMarks.arc(590, 405, 100, 0.3, 2.5);
    iceMarks.arc(710, 390, 70, 3.3, 5.8);
    iceMarks.lineBetween(490, 340, 575, 318);
    iceMarks.lineBetween(690, 475, 770, 450);

    addTree(this, 80, 355, 0.9);
    addTree(this, 185, 330, 0.72);
    addTree(this, 1140, 380, 0.9);
    addTree(this, 1230, 410, 0.68);
    addTree(this, 325, 275, 0.66);
    addTree(this, 965, 245, 0.62);
    addTree(this, 775, 205, 0.5);
    addBench(this, 305, 565);
    addBench(this, 890, 565);
    addLamp(this, 250, 495);
    addLamp(this, 950, 515);

    const kiosk = this.add.container(150, 525).setDepth(525);
    const kioskShadow = this.add.ellipse(0, 18, 150, 30, 0x17332d, 0.14);
    const kioskBody = this.add.rectangle(0, -45, 126, 104, 0xfff3ca);
    kioskBody.setStrokeStyle(4, COLORS.ink);
    const kioskRoof = this.add.rectangle(0, -105, 150, 28, COLORS.coral);
    kioskRoof.setStrokeStyle(4, COLORS.ink);
    const kioskWindow = this.add.rectangle(0, -48, 76, 42, 0x9ed5d7);
    kioskWindow.setStrokeStyle(3, COLORS.ink);
    const kioskSign = addText(
      this,
      0,
      -82,
      "LEAF & LADLE",
      13,
      "#17332d",
      "900",
    );
    kiosk.add([kioskShadow, kioskBody, kioskRoof, kioskWindow, kioskSign]);

    const transit = this.add.container(1140, 270).setDepth(270);
    const stairs = this.add.rectangle(0, 0, 150, 58, 0x56736d);
    stairs.setStrokeStyle(4, COLORS.ink);
    const railLeft = this.add.rectangle(-68, -37, 6, 75, COLORS.ink);
    const railRight = this.add.rectangle(68, -37, 6, 75, COLORS.ink);
    const transitSign = this.add.rectangle(0, -78, 116, 34, COLORS.yellow);
    transitSign.setStrokeStyle(4, COLORS.ink);
    const transitText = addText(
      this,
      0,
      -78,
      "TURTLE CITY TRANSIT",
      10,
      "#17332d",
      "900",
    );
    transit.add([stairs, railLeft, railRight, transitSign, transitText]);

    const activity = this.add.container(1060, 555).setDepth(555);
    const activityShadow = this.add.ellipse(0, 12, 164, 30, 0x17332d, 0.16);
    const coneLeft = this.add
      .triangle(-67, -5, -13, 35, 0, -35, 13, 35, COLORS.coral)
      .setStrokeStyle(3, COLORS.ink);
    const coneRight = this.add
      .triangle(67, -5, -13, 35, 0, -35, 13, 35, COLORS.coral)
      .setStrokeStyle(3, COLORS.ink);
    const board = this.add.rectangle(0, -45, 150, 62, COLORS.yellow);
    board.setStrokeStyle(4, COLORS.ink);
    const boardText = addText(
      this,
      0,
      -46,
      "SNOW CREW\nACTIVITY",
      15,
      "#17332d",
      "900",
    );
    const enterBadge = this.add.circle(0, -105, 25, COLORS.coral);
    enterBadge.setStrokeStyle(4, COLORS.ink);
    const enterText = addText(this, 0, -105, "E", 19, "#fffaf0", "900");
    activity.add([
      activityShadow,
      coneLeft,
      coneRight,
      board,
      boardText,
      enterBadge,
      enterText,
    ]);
    this.tweens.add({
      targets: [enterBadge, enterText],
      y: "-=8",
      yoyo: true,
      repeat: -1,
      duration: 750,
      ease: "Sine.inOut",
    });

    this.interactions = [
      {
        x: 1060,
        y: 555,
        radius: 112,
        label: "Enter Snow Crew activity",
        action: "activity",
      },
      {
        x: 150,
        y: 525,
        radius: 104,
        label: "Visit Leaf & Ladle",
        action: "vendor",
      },
      {
        x: 1140,
        y: 270,
        radius: 105,
        label: "Check the transit map",
        action: "transit",
      },
    ];
  }

  private isOnIce(x: number, y: number) {
    const normalizedX = (x - 633) / 274;
    const normalizedY = (y - 401) / 125;
    return normalizedX * normalizedX + normalizedY * normalizedY < 0.82;
  }

  private getNearbyInteraction() {
    return this.interactions.find(
      (interaction) =>
        Phaser.Math.Distance.Between(
          this.player.x,
          this.player.y,
          interaction.x,
          interaction.y,
        ) < interaction.radius,
    );
  }

  private handleInteraction(interaction: Interaction) {
    if (interaction.action === "activity") {
      this.scene.start("Shoveling", {
        returnX: this.player.x,
        returnY: this.player.y,
      });
      return;
    }

    if (interaction.action === "vendor") {
      this.showToast(
        "Leaf & Ladle\nHot leaf cider is brewing. The shop opens later.",
      );
      return;
    }

    this.showToast(
      "Turtle City Transit\nCentral Park is open · Midtown is coming soon.",
    );
  }

  private showToast(message: string) {
    this.toast?.destroy(true);
    const panel = this.add
      .rectangle(GAME_WIDTH / 2, 155, 500, 94, COLORS.cream, 0.96)
      .setStrokeStyle(4, COLORS.ink, 0.8);
    const text = addText(
      this,
      GAME_WIDTH / 2,
      155,
      message,
      17,
      "#17332d",
      "900",
    );
    this.toast = this.add.container(0, -18, [panel, text]).setDepth(7000);
    this.tweens.add({
      targets: this.toast,
      y: 0,
      alpha: { from: 0, to: 1 },
      duration: 220,
      ease: "Back.out",
    });
    this.time.delayedCall(2600, () => {
      if (this.toast?.active) {
        this.tweens.add({
          targets: this.toast,
          alpha: 0,
          y: -10,
          duration: 180,
          onComplete: () => this.toast?.destroy(true),
        });
      }
    });
  }
}

class ShovelingScene extends Phaser.Scene {
  private player!: Turtle;
  private keys!: KeyMap;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private piles: Phaser.GameObjects.Container[] = [];
  private cleared = 0;
  private countText!: Phaser.GameObjects.Text;
  private prompt!: Phaser.GameObjects.Text;
  private returnX = 1060;
  private returnY = 610;
  private completed = false;
  private startedAt = 0;

  constructor() {
    super("Shoveling");
  }

  init(data: { returnX?: number; returnY?: number } = {}) {
    this.returnX = data.returnX ?? 1060;
    this.returnY = data.returnY ?? 610;
    this.cleared = 0;
    this.completed = false;
    this.piles = [];
  }

  create() {
    this.startedAt = this.time.now;
    this.cameras.main.setBackgroundColor(0xc5e1ea);
    this.drawActivity();
    addSnowflakes(this, 32);
    createRoomHeader(
      this,
      "Central Park activity",
      "Snow Crew",
      "Session-only · No score saved",
    );

    this.keys = this.input.keyboard?.addKeys(
      "W,A,S,D,E,SPACE,ESC",
    ) as KeyMap;
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.input.keyboard?.addCapture([
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
      Phaser.Input.Keyboard.KeyCodes.SPACE,
    ]);

    this.player = createTurtle(this, 165, 600, "You", COLORS.shell);
    this.countText = addText(
      this,
      GAME_WIDTH - 52,
      100,
      "0 / 5 drifts cleared",
      16,
      "#17332d",
      "900",
    )
      .setOrigin(1, 0)
      .setPadding(14, 9, 14, 9)
      .setBackgroundColor("rgba(255,250,239,0.94)")
      .setDepth(5500);

    this.prompt = addText(
      this,
      GAME_WIDTH / 2,
      GAME_HEIGHT - 38,
      "Find a snowdrift · Press SPACE nearby to shovel",
      17,
      "#fffaf0",
      "900",
    )
      .setPadding(18, 10, 18, 10)
      .setBackgroundColor("rgba(23,51,45,0.94)")
      .setDepth(6000);
  }

  update(_time: number, delta: number) {
    if (
      this.time.now - this.startedAt > 350 &&
      Phaser.Input.Keyboard.JustDown(this.keys.ESC)
    ) {
      this.returnToPark();
      return;
    }

    if (
      this.completed &&
      this.time.now - this.startedAt > 350 &&
      Phaser.Input.Keyboard.JustDown(this.keys.E)
    ) {
      this.returnToPark(true);
      return;
    }

    const direction = new Phaser.Math.Vector2(
      Number(this.keys.D.isDown || this.cursors.right.isDown) -
        Number(this.keys.A.isDown || this.cursors.left.isDown),
      Number(this.keys.S.isDown || this.cursors.down.isDown) -
        Number(this.keys.W.isDown || this.cursors.up.isDown),
    );
    if (direction.lengthSq() > 0) {
      direction.normalize();
    }

    const speed = 182;
    const seconds = Math.min(delta, 32) / 1000;
    this.player.x = Phaser.Math.Clamp(
      this.player.x + direction.x * speed * seconds,
      55,
      GAME_WIDTH - 55,
    );
    this.player.y = Phaser.Math.Clamp(
      this.player.y + direction.y * speed * seconds,
      205,
      GAME_HEIGHT - 78,
    );
    this.player.setDepth(this.player.y);

    if (direction.x !== 0) {
      this.player.setScale(direction.x < 0 ? -1 : 1, 1);
      const nameplate = this.player.list.at(-1) as Phaser.GameObjects.Text;
      nameplate.setScale(direction.x < 0 ? -1 : 1, 1);
    }

    if (this.completed) {
      this.prompt.setText("Path clear! · Press E to return to Central Park");
      return;
    }

    const pile = this.getNearbyPile();
    if (pile) {
      const hits = pile.getData("hits") as number;
      this.prompt.setText(
        hits === 0
          ? "SPACE  ·  Shovel this snowdrift"
          : "SPACE  ·  One more scoop",
      );
      if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
        this.shovelPile(pile);
      }
    } else {
      this.prompt.setText("Find a snowdrift · Press SPACE nearby to shovel");
    }
  }

  private drawActivity() {
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xc5e1ea).setOrigin(0);
    this.add.rectangle(0, 185, GAME_WIDTH, 535, COLORS.snow).setOrigin(0);

    const skyline = this.add.graphics().setDepth(1);
    for (let index = 0; index < 16; index += 1) {
      const width = 82;
      const height = 35 + ((index * 29) % 80);
      skyline.fillStyle(index % 2 ? 0x87aaab : 0x73999b, 0.7);
      skyline.fillRect(index * 82, 188 - height, width - 7, height);
    }

    const path = this.add
      .rectangle(GAME_WIDTH / 2, 485, 1110, 360, COLORS.path)
      .setStrokeStyle(16, COLORS.pathShadow)
      .setDepth(2);
    path.setRotation(-0.035);

    addTree(this, 90, 350, 0.78);
    addTree(this, 1190, 340, 0.8);
    addTree(this, 1030, 255, 0.56);
    addTree(this, 245, 245, 0.55);
    addLamp(this, 350, 330);
    addLamp(this, 920, 395);

    const pilePositions = [
      { x: 330, y: 555 },
      { x: 520, y: 365 },
      { x: 670, y: 585 },
      { x: 825, y: 325 },
      { x: 1000, y: 520 },
    ];

    pilePositions.forEach(({ x, y }, index) => {
      const pile = this.add.container(x, y).setDepth(y);
      const shadow = this.add.ellipse(0, 10, 108, 24, 0x17332d, 0.12);
      const snowLeft = this.add.circle(-28, -5, 35, COLORS.snow);
      const snowCenter = this.add.circle(5, -18, 47, 0xffffff);
      const snowRight = this.add.circle(39, -3, 31, COLORS.snowShadow);
      const marker = this.add.circle(0, -82, 19, COLORS.coral);
      marker.setStrokeStyle(3, COLORS.ink);
      const markerText = addText(this, 0, -82, "!", 17, "#fffaf0", "900");
      pile.add([shadow, snowLeft, snowRight, snowCenter, marker, markerText]);
      pile.setData("hits", 0);
      pile.setData("index", index);
      this.piles.push(pile);
      this.tweens.add({
        targets: [marker, markerText],
        y: "-=6",
        yoyo: true,
        repeat: -1,
        duration: 700 + index * 60,
      });
    });

    addText(
      this,
      120,
      670,
      "ESC  Return to park",
      13,
      "#5a746c",
      "900",
    )
      .setOrigin(0, 0.5)
      .setDepth(5000);
  }

  private getNearbyPile() {
    return this.piles.find(
      (pile) =>
        pile.visible &&
        Phaser.Math.Distance.Between(
          this.player.x,
          this.player.y,
          pile.x,
          pile.y,
        ) < 88,
    );
  }

  private shovelPile(pile: Phaser.GameObjects.Container) {
    const hits = (pile.getData("hits") as number) + 1;
    pile.setData("hits", hits);
    this.cameras.main.shake(70, 0.0014);

    for (let index = 0; index < 9; index += 1) {
      const flurry = this.add
        .circle(
          pile.x + Phaser.Math.Between(-25, 25),
          pile.y + Phaser.Math.Between(-35, 5),
          Phaser.Math.Between(3, 7),
          0xffffff,
          0.9,
        )
        .setDepth(7000);
      this.tweens.add({
        targets: flurry,
        x: flurry.x + Phaser.Math.Between(-55, 55),
        y: flurry.y - Phaser.Math.Between(35, 80),
        alpha: 0,
        duration: Phaser.Math.Between(380, 620),
        onComplete: () => flurry.destroy(),
      });
    }

    if (hits < 2) {
      this.tweens.add({
        targets: pile,
        scaleX: 0.82,
        scaleY: 0.82,
        duration: 160,
        ease: "Back.in",
      });
      return;
    }

    this.cleared += 1;
    this.countText.setText(`${this.cleared} / 5 drifts cleared`);
    this.tweens.add({
      targets: pile,
      alpha: 0,
      scaleX: 0.3,
      scaleY: 0.3,
      duration: 220,
      ease: "Back.in",
      onComplete: () => pile.setVisible(false),
    });

    if (this.cleared === this.piles.length) {
      this.completed = true;
      this.showCompletion();
    }
  }

  private showCompletion() {
    const panel = this.add
      .rectangle(GAME_WIDTH / 2, 160, 570, 104, COLORS.yellow, 0.97)
      .setStrokeStyle(4, COLORS.ink)
      .setDepth(7000);
    const title = addText(
      this,
      GAME_WIDTH / 2,
      143,
      "THE PATH IS CLEAR!",
      25,
      "#17332d",
      "900",
    ).setDepth(7001);
    const subtitle = addText(
      this,
      GAME_WIDTH / 2,
      180,
      "Nice work. This result stays in this session only.",
      15,
      "#345d53",
      "700",
    ).setDepth(7001);
    this.tweens.add({
      targets: [panel, title, subtitle],
      scale: { from: 0.7, to: 1 },
      ease: "Back.out",
      duration: 360,
    });
  }

  private returnToPark(completed = false) {
    this.scene.start("Explore", {
      x: this.returnX,
      y: Math.min(this.returnY + 60, 635),
      message: completed
        ? "Snow Crew complete!\nNo score saved—just a cleaner park."
        : "Back in Central Park",
    });
  }
}

export function createTurtleCityGame(
  parent: HTMLElement,
  onReady?: () => void,
) {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: "#b9deea",
    transparent: false,
    scene: [ExploreScene, ShovelingScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
    },
    render: {
      antialias: true,
      pixelArt: false,
    },
    input: {
      keyboard: true,
    },
  });

  game.events.once(Phaser.Core.Events.READY, () => {
    onReady?.();
  });

  return game;
}
