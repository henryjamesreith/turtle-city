"use client";

import { useEffect, useRef, useState } from "react";

type HockeyGameProps = {
  onExit: () => void;
  turtleImage: string;
  turtleName: string;
};

type Team = "home" | "away";
type Role = "skater" | "goalie";
type MatchStatus = "ready" | "playing" | "finished";

type HockeyPlayer = {
  id: string;
  team: Team;
  role: Role;
  controlled: boolean;
  slot: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  facingX: number;
  facingY: number;
  kickCooldown: number;
};

type HockeyPuck = {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

type MatchState = {
  players: HockeyPlayer[];
  puck: HockeyPuck;
  score: Record<Team, number>;
  timeLeft: number;
  status: MatchStatus;
  goalPause: number;
  message: string;
  actionQueued: "pass" | "shoot" | null;
  switchQueued: boolean;
};

type HudState = {
  home: number;
  away: number;
  timeLeft: number;
  status: MatchStatus;
  message: string;
  controlledRole: string;
};

const RINK_WIDTH = 1200;
const RINK_HEIGHT = 680;
const ICE_LEFT = 70;
const ICE_RIGHT = RINK_WIDTH - 70;
const ICE_TOP = 54;
const ICE_BOTTOM = RINK_HEIGHT - 54;
const GOAL_TOP = 254;
const GOAL_BOTTOM = 426;
const PUCK_RADIUS = 12;
const MATCH_LENGTH = 90;
const PLAYER_SPEED = 360;
const HOME_AI_SPEED = 270;
const AWAY_AI_SPEED = 230;

const teamNames: Record<Team, string> = {
  home: "Lettuce Leafs",
  away: "Shellbacks",
};

const movementKeys = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "w",
  "a",
  "s",
  "d",
  "W",
  "A",
  "S",
  "D",
]);

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function distanceSquared(
  first: { x: number; y: number },
  second: { x: number; y: number },
) {
  const horizontal = first.x - second.x;
  const vertical = first.y - second.y;
  return horizontal * horizontal + vertical * vertical;
}

function createPlayer(
  id: string,
  team: Team,
  role: Role,
  slot: number,
  x: number,
  y: number,
  controlled = false,
): HockeyPlayer {
  return {
    id,
    team,
    role,
    controlled,
    slot,
    x,
    y,
    vx: 0,
    vy: 0,
    radius: role === "goalie" ? 29 : 24,
    facingX: team === "home" ? 1 : -1,
    facingY: 0,
    kickCooldown: 0,
  };
}

function createRoster() {
  return [
    createPlayer("home-player", "home", "skater", 0, 315, 340, true),
    createPlayer("home-wing", "home", "skater", 1, 410, 225),
    createPlayer("home-goalie", "home", "goalie", 0, 112, 340),
    createPlayer("away-center", "away", "skater", 0, 885, 340),
    createPlayer("away-wing", "away", "skater", 1, 790, 455),
    createPlayer("away-goalie", "away", "goalie", 0, 1088, 340),
  ];
}

function createMatchState(status: MatchStatus = "ready"): MatchState {
  return {
    players: createRoster(),
    puck: { x: RINK_WIDTH / 2, y: RINK_HEIGHT / 2, vx: 0, vy: 0 },
    score: { home: 0, away: 0 },
    timeLeft: MATCH_LENGTH,
    status,
    goalPause: 0,
    message: "",
    actionQueued: null,
    switchQueued: false,
  };
}

function resetFaceoff(game: MatchState) {
  const controlledId =
    game.players.find((player) => player.controlled)?.id ?? "home-player";
  game.players = createRoster();
  for (const player of game.players) {
    player.controlled = player.id === controlledId;
  }
  game.puck = {
    x: RINK_WIDTH / 2,
    y: RINK_HEIGHT / 2,
    vx: 0,
    vy: 0,
  };
  game.goalPause = 0;
  game.message = "";
  game.actionQueued = null;
  game.switchQueued = false;
}

function controlledRoleLabel(game: MatchState) {
  const controlled = game.players.find((player) => player.controlled);

  if (!controlled) {
    return "Skater";
  }

  if (controlled.role === "goalie") {
    return "Goalie";
  }

  return controlled.slot === 0 ? "Center" : "Wing";
}

function switchControlledPlayer(game: MatchState) {
  const teammates = game.players.filter((player) => player.team === "home");
  const currentIndex = teammates.findIndex((player) => player.controlled);
  const nextPlayer = teammates[(currentIndex + 1) % teammates.length];

  for (const player of teammates) {
    player.controlled = player.id === nextPlayer.id;
  }

  nextPlayer.facingX = 1;
  nextPlayer.facingY = 0;
}

function moveToward(
  player: HockeyPlayer,
  targetX: number,
  targetY: number,
  speed: number,
  elapsed: number,
) {
  const horizontal = targetX - player.x;
  const vertical = targetY - player.y;
  const magnitude = Math.hypot(horizontal, vertical) || 1;
  const desiredX = (horizontal / magnitude) * speed;
  const desiredY = (vertical / magnitude) * speed;
  const response = Math.min(1, elapsed * 4.2);

  player.vx += (desiredX - player.vx) * response;
  player.vy += (desiredY - player.vy) * response;

  if (magnitude > 8) {
    player.facingX = horizontal / magnitude;
    player.facingY = vertical / magnitude;
  }
}

function keepPlayerOnIce(player: HockeyPlayer) {
  if (player.role === "goalie") {
    player.x = clamp(
      player.x,
      player.team === "home" ? ICE_LEFT + 34 : ICE_RIGHT - 240,
      player.team === "home" ? ICE_LEFT + 240 : ICE_RIGHT - 34,
    );
    player.y = clamp(
      player.y,
      ICE_TOP + player.radius,
      ICE_BOTTOM - player.radius,
    );
    return;
  }

  player.x = clamp(
    player.x,
    ICE_LEFT + 45,
    ICE_RIGHT - 45,
  );
  player.y = clamp(
    player.y,
    ICE_TOP + player.radius,
    ICE_BOTTOM - player.radius,
  );
}

function roundedRectangle(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const corner = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + corner, y);
  context.lineTo(x + width - corner, y);
  context.quadraticCurveTo(x + width, y, x + width, y + corner);
  context.lineTo(x + width, y + height - corner);
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - corner,
    y + height,
  );
  context.lineTo(x + corner, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - corner);
  context.lineTo(x, y + corner);
  context.quadraticCurveTo(x, y, x + corner, y);
  context.closePath();
}

function drawRink(context: CanvasRenderingContext2D) {
  context.fillStyle = "#a8c9cf";
  context.fillRect(0, 0, RINK_WIDTH, RINK_HEIGHT);

  context.save();
  context.shadowColor = "rgb(21 53 48 / 18%)";
  context.shadowBlur = 0;
  context.shadowOffsetX = 14;
  context.shadowOffsetY = 17;
  roundedRectangle(
    context,
    ICE_LEFT,
    ICE_TOP,
    ICE_RIGHT - ICE_LEFT,
    ICE_BOTTOM - ICE_TOP,
    118,
  );
  context.fillStyle = "#dff1f2";
  context.fill();
  context.restore();

  roundedRectangle(
    context,
    ICE_LEFT,
    ICE_TOP,
    ICE_RIGHT - ICE_LEFT,
    ICE_BOTTOM - ICE_TOP,
    118,
  );
  context.strokeStyle = "#153530";
  context.lineWidth = 9;
  context.stroke();

  context.save();
  roundedRectangle(
    context,
    ICE_LEFT + 5,
    ICE_TOP + 5,
    ICE_RIGHT - ICE_LEFT - 10,
    ICE_BOTTOM - ICE_TOP - 10,
    112,
  );
  context.clip();

  context.fillStyle = "rgb(255 255 255 / 30%)";
  context.fillRect(ICE_LEFT, ICE_TOP, ICE_RIGHT - ICE_LEFT, 110);

  context.strokeStyle = "rgb(190 107 104 / 72%)";
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(RINK_WIDTH / 2, ICE_TOP);
  context.lineTo(RINK_WIDTH / 2, ICE_BOTTOM);
  context.stroke();

  context.strokeStyle = "rgb(71 127 118 / 62%)";
  context.lineWidth = 8;
  for (const x of [385, 815]) {
    context.beginPath();
    context.moveTo(x, ICE_TOP);
    context.lineTo(x, ICE_BOTTOM);
    context.stroke();
  }

  context.lineWidth = 4;
  context.strokeStyle = "rgb(190 107 104 / 60%)";
  for (const [x, y] of [
    [310, 190],
    [310, 490],
    [890, 190],
    [890, 490],
  ]) {
    context.beginPath();
    context.arc(x, y, 55, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.arc(x, y, 6, 0, Math.PI * 2);
    context.fillStyle = "#be6b68";
    context.fill();
  }

  context.beginPath();
  context.arc(RINK_WIDTH / 2, RINK_HEIGHT / 2, 82, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.arc(RINK_WIDTH / 2, RINK_HEIGHT / 2, 8, 0, Math.PI * 2);
  context.fillStyle = "#be6b68";
  context.fill();

  context.strokeStyle = "rgb(71 127 118 / 45%)";
  context.lineWidth = 4;
  context.beginPath();
  context.arc(
    ICE_LEFT + 35,
    RINK_HEIGHT / 2,
    92,
    -Math.PI / 2,
    Math.PI / 2,
  );
  context.stroke();
  context.beginPath();
  context.arc(
    ICE_RIGHT - 35,
    RINK_HEIGHT / 2,
    92,
    Math.PI / 2,
    (Math.PI * 3) / 2,
  );
  context.stroke();
  context.restore();

  context.strokeStyle = "#be6b68";
  context.lineWidth = 7;
  for (const side of ["left", "right"] as const) {
    const x = side === "left" ? ICE_LEFT - 24 : ICE_RIGHT + 24;
    context.beginPath();
    context.moveTo(side === "left" ? ICE_LEFT : ICE_RIGHT, GOAL_TOP);
    context.lineTo(x, GOAL_TOP);
    context.lineTo(x, GOAL_BOTTOM);
    context.lineTo(side === "left" ? ICE_LEFT : ICE_RIGHT, GOAL_BOTTOM);
    context.stroke();
  }
}

function drawPlayer(
  context: CanvasRenderingContext2D,
  player: HockeyPlayer,
  turtleImage: HTMLImageElement,
  turtleName: string,
) {
  const color = player.team === "home" ? "#477f76" : "#d7835f";
  const lightColor = player.team === "home" ? "#b8d7c5" : "#f1b494";

  context.save();
  context.translate(player.x, player.y);

  context.fillStyle = "rgb(21 53 48 / 14%)";
  context.beginPath();
  context.ellipse(4, 15, player.radius + 8, 13, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = lightColor;
  context.strokeStyle = color;
  context.lineWidth = player.controlled ? 7 : 5;
  context.beginPath();
  context.ellipse(0, 10, player.radius + 8, 18, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  const facingLeft = player.facingX < 0;
  context.save();
  if (facingLeft) {
    context.scale(-1, 1);
  }

  if (turtleImage.complete && turtleImage.naturalWidth > 0) {
    const width = player.role === "goalie" ? 68 : 62;
    const height = player.role === "goalie" ? 82 : 76;
    context.drawImage(turtleImage, -width / 2, -height + 18, width, height);
  } else {
    context.fillStyle = "#8fa65c";
    context.strokeStyle = "#153530";
    context.lineWidth = 4;
    context.beginPath();
    context.arc(0, -23, player.radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }
  context.restore();

  if (player.controlled && player.team === "home") {
    const nameY = player.role === "goalie" ? -73 : -67;
    context.font = '800 11px "Avenir Next", Avenir, sans-serif';
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.lineJoin = "round";
    context.lineWidth = 4;
    context.strokeStyle = "rgb(248 242 223 / 96%)";
    context.strokeText(turtleName, 0, nameY);
    context.fillStyle = "#153530";
    context.fillText(turtleName, 0, nameY);
  }

  context.save();
  context.rotate(Math.atan2(player.facingY, player.facingX));
  context.strokeStyle = "#8b684a";
  context.lineWidth = 5;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  context.moveTo(2, -2);
  context.lineTo(43, 17);
  context.lineTo(57, 12);
  context.stroke();
  context.strokeStyle = "#153530";
  context.lineWidth = 1.5;
  context.stroke();
  context.restore();

  context.fillStyle = color;
  roundedRectangle(context, -20, -15, 40, 12, 6);
  context.fill();
  context.strokeStyle = "#153530";
  context.lineWidth = 2;
  context.stroke();

  if (player.controlled || player.role === "goalie") {
    const label = player.controlled ? "YOU" : "G";
    context.font =
      player.controlled
        ? "900 14px Avenir Next, sans-serif"
        : "900 13px Avenir Next, sans-serif";
    const labelWidth = context.measureText(label).width + 16;
    roundedRectangle(context, -labelWidth / 2, -81, labelWidth, 22, 11);
    context.fillStyle = player.controlled ? "#f8f2df" : color;
    context.fill();
    context.strokeStyle = "#153530";
    context.lineWidth = 2;
    context.stroke();
    context.fillStyle = player.controlled ? "#153530" : "#f8f2df";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(label, 0, -70);
  }

  context.restore();
}

function drawPuck(context: CanvasRenderingContext2D, puck: HockeyPuck) {
  context.fillStyle = "rgb(21 53 48 / 18%)";
  context.beginPath();
  context.ellipse(puck.x + 4, puck.y + 8, 17, 8, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#20342f";
  context.strokeStyle = "#0d1e1b";
  context.lineWidth = 3;
  context.beginPath();
  context.arc(puck.x, puck.y, PUCK_RADIUS, 0, Math.PI * 2);
  context.fill();
  context.stroke();
}

function formatTime(time: number) {
  const seconds = Math.max(0, Math.ceil(time));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export function HockeyGame({
  onExit,
  turtleImage: turtleImageSrc,
  turtleName,
}: HockeyGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<MatchState>(createMatchState());
  const [hud, setHud] = useState<HudState>({
    home: 0,
    away: 0,
    timeLeft: MATCH_LENGTH,
    status: "ready",
    message: "",
    controlledRole: "Center",
  });

  function publishHud(game: MatchState) {
    setHud({
      home: game.score.home,
      away: game.score.away,
      timeLeft: game.timeLeft,
      status: game.status,
      message: game.message,
      controlledRole: controlledRoleLabel(game),
    });
  }

  function startMatch() {
    const game = createMatchState("playing");
    gameRef.current = game;
    publishHud(game);
    canvasRef.current?.focus();
  }

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const activeCanvas: HTMLCanvasElement = canvas;
    const context = activeCanvas.getContext("2d");

    if (!context) {
      return;
    }

    const activeContext: CanvasRenderingContext2D = context;
    const turtleImage = new Image();
    turtleImage.src = turtleImageSrc;
    const pressed = new Set<string>();
    let animationFrame = 0;
    let previousTime = performance.now();
    let previousPublishedSecond = MATCH_LENGTH;

    function resizeCanvas() {
      const density = Math.min(window.devicePixelRatio || 1, 2);
      activeCanvas.width = Math.max(
        1,
        Math.floor(activeCanvas.clientWidth * density),
      );
      activeCanvas.height = Math.max(
        1,
        Math.floor(activeCanvas.clientHeight * density),
      );
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable ||
          event.target.tagName === "INPUT" ||
          event.target.tagName === "TEXTAREA" ||
          event.target.tagName === "SELECT" ||
          event.target.tagName === "BUTTON")
      ) {
        return;
      }

      if (
        movementKeys.has(event.key) ||
        event.code === "Space" ||
        event.code === "KeyX" ||
        event.code === "KeyC"
      ) {
        event.preventDefault();
      }

      if (movementKeys.has(event.key)) {
        pressed.add(event.key.toLowerCase());
      } else if (event.code === "Space" && !event.repeat) {
        gameRef.current.switchQueued = true;
      } else if (event.code === "KeyX" && !event.repeat) {
        gameRef.current.actionQueued = "pass";
      } else if (event.code === "KeyC" && !event.repeat) {
        gameRef.current.actionQueued = "shoot";
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      pressed.delete(event.key.toLowerCase());
    }

    function clearInput() {
      pressed.clear();
      gameRef.current.actionQueued = null;
      gameRef.current.switchQueued = false;
    }

    function awardGoal(game: MatchState, team: Team) {
      game.score[team] += 1;
      game.goalPause = 1.25;
      game.message = `Goal — ${teamNames[team]}!`;
      game.puck.vx = 0;
      game.puck.vy = 0;
      publishHud(game);
    }

    function updateHuman(
      game: MatchState,
      player: HockeyPlayer,
      elapsed: number,
    ) {
      const horizontal =
        Number(pressed.has("arrowright") || pressed.has("d")) -
        Number(pressed.has("arrowleft") || pressed.has("a"));
      const vertical =
        Number(pressed.has("arrowdown") || pressed.has("s")) -
        Number(pressed.has("arrowup") || pressed.has("w"));
      const magnitude = Math.hypot(horizontal, vertical);

      if (magnitude > 0) {
        const desiredX = (horizontal / magnitude) * PLAYER_SPEED;
        const desiredY = (vertical / magnitude) * PLAYER_SPEED;
        const response = Math.min(1, elapsed * 8);
        player.vx += (desiredX - player.vx) * response;
        player.vy += (desiredY - player.vy) * response;
        player.facingX = horizontal / magnitude;
        player.facingY = vertical / magnitude;
      } else {
        const friction = Math.pow(0.025, elapsed);
        player.vx *= friction;
        player.vy *= friction;
      }

      if (
        game.actionQueued &&
        player.kickCooldown <= 0 &&
        distanceSquared(player, game.puck) < 78 * 78
      ) {
        let targetX =
          player.x + player.facingX * (player.radius + PUCK_RADIUS + 8);
        let targetY =
          player.y + player.facingY * (player.radius + PUCK_RADIUS + 8);
        let puckSpeed = 720;

        if (game.actionQueued === "pass") {
          const teammates = game.players
            .filter(
              (teammate) =>
                teammate.team === player.team && teammate.id !== player.id,
            )
            .map((teammate) => {
              const horizontal = teammate.x - player.x;
              const vertical = teammate.y - player.y;
              const magnitude = Math.hypot(horizontal, vertical) || 1;
              const alignment =
                (horizontal / magnitude) * player.facingX +
                (vertical / magnitude) * player.facingY;

              return {
                teammate,
                priority: alignment * 2 - magnitude / 1200,
              };
            })
            .sort((first, second) => second.priority - first.priority);
          const receiver = teammates[0]?.teammate;

          if (receiver) {
            targetX = receiver.x + receiver.vx * 0.22;
            targetY = receiver.y + receiver.vy * 0.22;
          }
          puckSpeed = 480;
        } else {
          targetX =
            player.x + player.facingX * (player.radius + PUCK_RADIUS + 80);
          targetY =
            player.y + player.facingY * (player.radius + PUCK_RADIUS + 80);
        }

        const aimX = targetX - player.x;
        const aimY = targetY - player.y;
        const aimMagnitude = Math.hypot(aimX, aimY) || 1;
        const directionX = aimX / aimMagnitude;
        const directionY = aimY / aimMagnitude;

        game.puck.x =
          player.x + directionX * (player.radius + PUCK_RADIUS + 7);
        game.puck.y =
          player.y + directionY * (player.radius + PUCK_RADIUS + 7);
        game.puck.vx = directionX * puckSpeed + player.vx * 0.2;
        game.puck.vy = directionY * puckSpeed + player.vy * 0.2;
        player.kickCooldown = game.actionQueued === "pass" ? 0.3 : 0.42;
      }
    }

    function updateGoalie(player: HockeyPlayer, game: MatchState, elapsed: number) {
      const homeGoalie = player.team === "home";
      const targetX = homeGoalie ? 112 : 1088;
      const targetY = clamp(game.puck.y, GOAL_TOP + 35, GOAL_BOTTOM - 35);
      moveToward(player, targetX, targetY, homeGoalie ? 245 : 218, elapsed);
    }

    function updateSkaterAi(
      player: HockeyPlayer,
      game: MatchState,
      elapsed: number,
      chaserId: string,
    ) {
      const attackDirection = player.team === "home" ? 1 : -1;
      let targetX = game.puck.x;
      let targetY = game.puck.y;

      if (player.id !== chaserId) {
        const laneY = player.slot === 1 ? 210 : 470;
        targetX = clamp(
          game.puck.x - attackDirection * 155,
          ICE_LEFT + 170,
          ICE_RIGHT - 170,
        );
        targetY = laneY + (game.puck.y - RINK_HEIGHT / 2) * 0.18;
      }

      moveToward(
        player,
        targetX,
        targetY,
        player.team === "home" ? HOME_AI_SPEED : AWAY_AI_SPEED,
        elapsed,
      );
    }

    function separatePlayers(players: HockeyPlayer[]) {
      for (let firstIndex = 0; firstIndex < players.length; firstIndex += 1) {
        for (
          let secondIndex = firstIndex + 1;
          secondIndex < players.length;
          secondIndex += 1
        ) {
          const first = players[firstIndex];
          const second = players[secondIndex];
          const horizontal = second.x - first.x;
          const vertical = second.y - first.y;
          const distance = Math.hypot(horizontal, vertical) || 0.001;
          const minimumDistance = first.radius + second.radius - 6;

          if (distance >= minimumDistance) {
            continue;
          }

          const overlap = (minimumDistance - distance) * 0.5;
          const normalX = horizontal / distance;
          const normalY = vertical / distance;
          first.x -= normalX * overlap;
          first.y -= normalY * overlap;
          second.x += normalX * overlap;
          second.y += normalY * overlap;
        }
      }
    }

    function collidePlayersWithPuck(game: MatchState) {
      let aiKickTaken = false;

      for (const player of game.players) {
        const horizontal = game.puck.x - player.x;
        const vertical = game.puck.y - player.y;
        const distance = Math.hypot(horizontal, vertical) || 0.001;
        const minimumDistance = player.radius + PUCK_RADIUS;

        if (distance >= minimumDistance) {
          continue;
        }

        const normalX = horizontal / distance;
        const normalY = vertical / distance;
        game.puck.x = player.x + normalX * minimumDistance;
        game.puck.y = player.y + normalY * minimumDistance;
        game.puck.vx += player.vx * 0.42 + normalX * 72;
        game.puck.vy += player.vy * 0.42 + normalY * 72;

        if (
          !player.controlled &&
          !aiKickTaken &&
          player.kickCooldown <= 0 &&
          (player.role === "goalie" || distanceSquared(player, game.puck) < 58 * 58)
        ) {
          const targetX =
            player.team === "home" ? ICE_RIGHT + 30 : ICE_LEFT - 30;
          const targetY =
            RINK_HEIGHT / 2 +
            (player.slot === 1 ? -58 : player.slot === 2 ? 58 : 0);
          const aimX = targetX - game.puck.x;
          const aimY = targetY - game.puck.y;
          const aimMagnitude = Math.hypot(aimX, aimY) || 1;
          const kickSpeed =
            player.team === "home"
              ? player.role === "goalie"
                ? 525
                : 490
              : player.role === "goalie"
                ? 395
                : 420;
          game.puck.vx = (aimX / aimMagnitude) * kickSpeed;
          game.puck.vy = (aimY / aimMagnitude) * kickSpeed;
          player.kickCooldown = player.team === "home" ? 0.82 : 1.08;
          aiKickTaken = true;
        }
      }
    }

    function updateGame(game: MatchState, elapsed: number) {
      if (game.status !== "playing") {
        game.actionQueued = null;
        game.switchQueued = false;
        return;
      }

      if (game.goalPause > 0) {
        game.actionQueued = null;
        game.switchQueued = false;
        game.goalPause -= elapsed;
        if (game.goalPause <= 0) {
          resetFaceoff(game);
          publishHud(game);
        }
        return;
      }

      if (game.switchQueued) {
        switchControlledPlayer(game);
        game.switchQueued = false;
        publishHud(game);
      }

      game.timeLeft = Math.max(0, game.timeLeft - elapsed);

      if (game.timeLeft <= 0) {
        game.status = "finished";
        game.message =
          game.score.home === game.score.away
            ? "Final score — tie game"
            : game.score.home > game.score.away
              ? "Lettuce Leafs win!"
              : "Shellbacks win!";
        publishHud(game);
        return;
      }

      const homeSkaters = game.players.filter(
        (player) => player.team === "home" && player.role === "skater",
      );
      const awaySkaters = game.players.filter(
        (player) => player.team === "away" && player.role === "skater",
      );
      const closestHome =
        [...homeSkaters].sort(
          (first, second) =>
            distanceSquared(first, game.puck) -
            distanceSquared(second, game.puck),
        )[0]?.id ?? "";
      const closestAway =
        [...awaySkaters].sort(
          (first, second) =>
            distanceSquared(first, game.puck) -
            distanceSquared(second, game.puck),
        )[0]?.id ?? "";

      for (const player of game.players) {
        player.kickCooldown = Math.max(0, player.kickCooldown - elapsed);

        if (player.controlled) {
          updateHuman(game, player, elapsed);
        } else if (player.role === "goalie") {
          updateGoalie(player, game, elapsed);
        } else {
          updateSkaterAi(
            player,
            game,
            elapsed,
            player.team === "home" ? closestHome : closestAway,
          );
        }

        player.x += player.vx * elapsed;
        player.y += player.vy * elapsed;
        keepPlayerOnIce(player);
      }

      separatePlayers(game.players);
      for (const player of game.players) {
        keepPlayerOnIce(player);
      }

      collidePlayersWithPuck(game);
      game.actionQueued = null;

      game.puck.x += game.puck.vx * elapsed;
      game.puck.y += game.puck.vy * elapsed;
      const puckFriction = Math.pow(0.3, elapsed);
      game.puck.vx *= puckFriction;
      game.puck.vy *= puckFriction;

      if (game.puck.y < ICE_TOP + PUCK_RADIUS) {
        game.puck.y = ICE_TOP + PUCK_RADIUS;
        game.puck.vy = Math.abs(game.puck.vy) * 0.82;
      } else if (game.puck.y > ICE_BOTTOM - PUCK_RADIUS) {
        game.puck.y = ICE_BOTTOM - PUCK_RADIUS;
        game.puck.vy = -Math.abs(game.puck.vy) * 0.82;
      }

      const insideGoal =
        game.puck.y > GOAL_TOP && game.puck.y < GOAL_BOTTOM;

      if (game.puck.x < ICE_LEFT + PUCK_RADIUS) {
        if (insideGoal) {
          awardGoal(game, "away");
        } else {
          game.puck.x = ICE_LEFT + PUCK_RADIUS;
          game.puck.vx = Math.abs(game.puck.vx) * 0.82;
        }
      } else if (game.puck.x > ICE_RIGHT - PUCK_RADIUS) {
        if (insideGoal) {
          awardGoal(game, "home");
        } else {
          game.puck.x = ICE_RIGHT - PUCK_RADIUS;
          game.puck.vx = -Math.abs(game.puck.vx) * 0.82;
        }
      }

      const currentSecond = Math.ceil(game.timeLeft);
      if (currentSecond !== previousPublishedSecond) {
        previousPublishedSecond = currentSecond;
        publishHud(game);
      }
    }

    function drawGame(game: MatchState) {
      const pixelWidth = activeCanvas.width;
      const pixelHeight = activeCanvas.height;
      const scale = Math.min(
        pixelWidth / RINK_WIDTH,
        pixelHeight / RINK_HEIGHT,
      );
      const offsetX = (pixelWidth - RINK_WIDTH * scale) / 2;
      const offsetY = (pixelHeight - RINK_HEIGHT * scale) / 2;

      activeContext.setTransform(1, 0, 0, 1, 0, 0);
      activeContext.clearRect(0, 0, pixelWidth, pixelHeight);
      activeContext.setTransform(scale, 0, 0, scale, offsetX, offsetY);

      drawRink(activeContext);

      const playersByDepth = [...game.players].sort(
        (first, second) => first.y - second.y,
      );
      for (const player of playersByDepth) {
        drawPlayer(activeContext, player, turtleImage, turtleName);
      }
      drawPuck(activeContext, game.puck);
    }

    function animate(time: number) {
      const elapsed = Math.min((time - previousTime) / 1000, 0.04);
      previousTime = time;
      updateGame(gameRef.current, elapsed);
      drawGame(gameRef.current);
      animationFrame = requestAnimationFrame(animate);
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("keydown", handleKeyDown, { passive: false });
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", clearInput);
    document.addEventListener("visibilitychange", clearInput);
    animationFrame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", clearInput);
      document.removeEventListener("visibilitychange", clearInput);
    };
  }, [turtleImageSrc, turtleName]);

  const result =
    hud.home === hud.away
      ? "Tie game"
      : hud.home > hud.away
        ? `${teamNames.home} win`
        : `${teamNames.away} win`;

  return (
    <main className="hockey-stage" data-testid="hockey-game">
      <canvas
        ref={canvasRef}
        className="hockey-canvas"
        aria-label="Pond hockey game with two skaters and one goalie on each team"
        tabIndex={-1}
      />

      <button type="button" className="hockey-exit" onClick={onExit}>
        <span aria-hidden="true">←</span>
        Central Park
      </button>

      <header className="hockey-scoreboard" aria-live="polite">
        <div className="hockey-team home-team">
          <small>2 skaters + G</small>
          <strong>{teamNames.home}</strong>
          <span>{hud.home}</span>
        </div>
        <time>{formatTime(hud.timeLeft)}</time>
        <div className="hockey-team away-team">
          <span>{hud.away}</span>
          <strong>{teamNames.away}</strong>
          <small>2 skaters + G</small>
        </div>
      </header>

      {hud.message && hud.status === "playing" ? (
        <div className="hockey-announcement">{hud.message}</div>
      ) : null}

      {hud.status === "playing" ? (
        <aside className="hockey-controls" aria-live="polite">
          <strong>Controlling: {hud.controlledRole}</strong>
          <span><kbd>Space</kbd> Switch</span>
          <span><kbd>X</kbd> Pass</span>
          <span><kbd>C</kbd> Shoot</span>
        </aside>
      ) : null}

      {hud.status !== "playing" ? (
        <section className="hockey-start-card">
          <p>Turtle City Pond Hockey</p>
          <h1>{hud.status === "finished" ? result : "Drop the puck"}</h1>
          <span>
            You are the marked Lettuce Leafs skater. Move with WASD or the
            arrow keys. Press Space to switch turtles, X to pass, and C to
            shoot. You can switch into your goalie at any time.
          </span>
          <div className="hockey-matchup">
            <b>2 skaters</b>
            <i>+</i>
            <b>1 goalie</b>
            <i>per team</i>
          </div>
          <button type="button" onClick={startMatch}>
            {hud.status === "finished" ? "Play again" : "Start match"}
          </button>
        </section>
      ) : null}
    </main>
  );
}
