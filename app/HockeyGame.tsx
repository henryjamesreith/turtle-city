"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useHockeyMultiplayer } from "@/lib/multiplayer/useHockeyMultiplayer";
import type { HockeyMatchState } from "@/lib/multiplayer/hockeySchema";
import { useGameReward } from "./GameEconomy";

type HockeyGameProps = {
  onExit: () => void;
  turtleImage: string;
  turtleName: string;
};

type Team = "home" | "away";
type Role = "skater" | "goalie";
type MatchStatus = "ready" | "countdown" | "playing" | "paused" | "finished";

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

type TeamStats = { shots: number; passes: number; saves: number };
type MatchPeriod = "regulation" | "overtime";
type PlayMode = "choose" | "solo" | "multiplayer";

type MatchState = {
  players: HockeyPlayer[];
  puck: HockeyPuck;
  score: Record<Team, number>;
  timeLeft: number;
  status: MatchStatus;
  goalPause: number;
  message: string;
  actionQueued: "pass" | "shoot" | null;
  actionBuffer: number;
  switchQueued: boolean;
  countdown: number;
  stats: Record<Team, TeamStats>;
  puckTrail: Array<{ x: number; y: number; opacity: number }>;
  goalFlash: Team | null;
  period: MatchPeriod;
};

type HudState = {
  home: number;
  away: number;
  timeLeft: number;
  status: MatchStatus;
  message: string;
  controlledRole: string;
  countdown: number;
  stats: Record<Team, TeamStats>;
  goalFlash: Team | null;
  period: MatchPeriod;
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
const COUNTDOWN_LENGTH = 3;
const FIXED_STEP = 1 / 120;
const OVERTIME_LENGTH = 30;

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
    actionBuffer: 0,
    switchQueued: false,
    countdown: status === "countdown" ? COUNTDOWN_LENGTH : 0,
    stats: {
      home: { shots: 0, passes: 0, saves: 0 },
      away: { shots: 0, passes: 0, saves: 0 },
    },
    puckTrail: [],
    goalFlash: null,
    period: "regulation",
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
  game.actionBuffer = 0;
  game.switchQueued = false;
  game.puckTrail = [];
  game.goalFlash = null;
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

function drawPuckTrail(
  context: CanvasRenderingContext2D,
  trail: MatchState["puckTrail"],
) {
  for (const point of trail) {
    context.fillStyle = `rgb(32 52 47 / ${point.opacity * 0.24})`;
    context.beginPath();
    context.arc(point.x, point.y, PUCK_RADIUS * point.opacity, 0, Math.PI * 2);
    context.fill();
  }
}

function playerAimDirection(player: HockeyPlayer) {
  const speed = Math.hypot(player.vx, player.vy);
  if (speed > 24) {
    return { x: player.vx / speed, y: player.vy / speed };
  }
  const facingMagnitude = Math.hypot(player.facingX, player.facingY) || 1;
  return {
    x: player.facingX / facingMagnitude,
    y: player.facingY / facingMagnitude,
  };
}

function drawShotArrow(
  context: CanvasRenderingContext2D,
  player: HockeyPlayer,
  puck: HockeyPuck,
) {
  if (distanceSquared(player, puck) > 92 * 92) return;
  const direction = playerAimDirection(player);
  const startX = puck.x + direction.x * 18;
  const startY = puck.y + direction.y * 18;
  const endX = startX + direction.x * 126;
  const endY = startY + direction.y * 126;
  const sideX = -direction.y;
  const sideY = direction.x;

  context.save();
  context.strokeStyle = "rgb(190 107 104 / 82%)";
  context.fillStyle = "rgb(190 107 104 / 92%)";
  context.lineWidth = 7;
  context.lineCap = "round";
  context.setLineDash([13, 10]);
  context.beginPath();
  context.moveTo(startX, startY);
  context.lineTo(endX, endY);
  context.stroke();
  context.setLineDash([]);
  context.beginPath();
  context.moveTo(endX + direction.x * 10, endY + direction.y * 10);
  context.lineTo(endX - direction.x * 22 + sideX * 16, endY - direction.y * 22 + sideY * 16);
  context.lineTo(endX - direction.x * 22 - sideX * 16, endY - direction.y * 22 - sideY * 16);
  context.closePath();
  context.fill();
  context.restore();
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
  const multiplayer = useHockeyMultiplayer();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<MatchState>(createMatchState());
  const modeRef = useRef<PlayMode>("choose");
  const multiplayerRef = useRef(multiplayer);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [mode, setMode] = useState<PlayMode>("choose");
  const [hud, setHud] = useState<HudState>({
    home: 0,
    away: 0,
    timeLeft: MATCH_LENGTH,
    status: "ready",
    message: "",
    controlledRole: "Center",
    countdown: 0,
    stats: {
      home: { shots: 0, passes: 0, saves: 0 },
      away: { shots: 0, passes: 0, saves: 0 },
    },
    goalFlash: null,
    period: "regulation",
  });

  useEffect(() => {
    modeRef.current = mode;
    multiplayerRef.current = multiplayer;
  }, [mode, multiplayer]);
  const localOnlinePlayer = multiplayer.match.players.find((player) => player.sessionId === multiplayer.sessionId);
  useGameReward("hockey", (mode !== "multiplayer" && hud.status === "finished" && hud.home > hud.away) || (mode === "multiplayer" && multiplayer.match.phase === "finished" && localOnlinePlayer?.team === multiplayer.match.winner));

  function publishHud(game: MatchState) {
    setHud({
      home: game.score.home,
      away: game.score.away,
      timeLeft: game.timeLeft,
      status: game.status,
      message: game.message,
      controlledRole: controlledRoleLabel(game),
      countdown: game.countdown,
      stats: {
        home: { ...game.stats.home },
        away: { ...game.stats.away },
      },
      goalFlash: game.goalFlash,
      period: game.period,
    });
  }

  const playSound = useCallback((kind: "countdown" | "pass" | "shot" | "goal") => {
    const AudioContextConstructor = window.AudioContext;
    const audio = audioContextRef.current ?? new AudioContextConstructor();
    audioContextRef.current = audio;
    if (audio.state === "suspended") void audio.resume();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const now = audio.currentTime;
    const settings = {
      countdown: { frequency: 440, duration: 0.08, volume: 0.035 },
      pass: { frequency: 170, duration: 0.055, volume: 0.025 },
      shot: { frequency: 105, duration: 0.11, volume: 0.045 },
      goal: { frequency: 620, duration: 0.42, volume: 0.055 },
    }[kind];
    oscillator.type = kind === "goal" ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(settings.frequency, now);
    if (kind === "goal") oscillator.frequency.exponentialRampToValueAtTime(930, now + settings.duration);
    gain.gain.setValueAtTime(settings.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + settings.duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now + settings.duration);
  }, []);

  function startMatch() {
    setMode("solo");
    const game = createMatchState("countdown");
    gameRef.current = game;
    publishHud(game);
    playSound("countdown");
    canvasRef.current?.focus();
  }

  function startMultiplayer() {
    setMode("multiplayer");
    void multiplayer.connect();
  }

  function leaveMultiplayer() {
    multiplayer.disconnect();
    setMode("choose");
    const game = createMatchState();
    gameRef.current = game;
    publishHud(game);
  }

  function resumeMatch() {
    const game = gameRef.current;
    game.status = "countdown";
    game.countdown = COUNTDOWN_LENGTH;
    game.message = "";
    publishHud(game);
    playSound("countdown");
    canvasRef.current?.focus();
  }

  function queueAction(action: "pass" | "shoot") {
    gameRef.current.actionQueued = action;
    gameRef.current.actionBuffer = 0.3;
    canvasRef.current?.focus();
  }

  function queueSwitch() {
    gameRef.current.switchQueued = true;
    canvasRef.current?.focus();
  }

  function pauseMatch() {
    const game = gameRef.current;
    if (game.status !== "playing") return;
    game.status = "paused";
    game.message = "Game paused";
    publishHud(game);
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
    let simulationAccumulator = 0;
    let multiplayerInputAccumulator = 0;

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
        event.code === "KeyC" ||
        event.code === "KeyP"
      ) {
        event.preventDefault();
      }

      if (movementKeys.has(event.key)) {
        pressed.add(event.key.toLowerCase());
      } else if (event.code === "Space" && !event.repeat) {
        gameRef.current.switchQueued = true;
      } else if (event.code === "KeyX" && !event.repeat) {
        gameRef.current.actionQueued = "pass";
        gameRef.current.actionBuffer = 0.3;
      } else if (event.code === "KeyC" && !event.repeat) {
        gameRef.current.actionQueued = "shoot";
        gameRef.current.actionBuffer = 0.3;
      } else if (event.code === "KeyP" && !event.repeat) {
        if (modeRef.current === "multiplayer") return;
        const game = gameRef.current;
        if (game.status === "playing") {
          game.status = "paused";
          game.message = "Game paused";
          clearInput();
          publishHud(game);
        } else if (game.status === "paused") {
          game.status = "countdown";
          game.countdown = COUNTDOWN_LENGTH;
          game.message = "";
          publishHud(game);
        }
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      pressed.delete(event.key.toLowerCase());
    }

    function clearInput() {
      pressed.clear();
      gameRef.current.actionQueued = null;
      gameRef.current.actionBuffer = 0;
      gameRef.current.switchQueued = false;
    }

    function pauseForLostFocus() {
      clearInput();
      const game = gameRef.current;
      if (game.status === "playing" || game.status === "countdown") {
        game.status = "paused";
        game.message = "Game paused";
        publishHud(game);
      }
    }

    function handleVisibilityChange() {
      if (document.hidden) pauseForLostFocus();
    }

    function awardGoal(game: MatchState, team: Team) {
      game.score[team] += 1;
      game.goalPause = 1.25;
      game.message = `Goal — ${teamNames[team]}!`;
      game.goalFlash = team;
      game.puck.vx = 0;
      game.puck.vy = 0;
      playSound("goal");
      if (game.period === "overtime") {
        game.status = "finished";
        game.timeLeft = 0;
        game.message = `${teamNames[team]} win in overtime!`;
      }
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

      const puckDistance = Math.sqrt(distanceSquared(player, game.puck));
      const puckSpeed = Math.hypot(game.puck.vx, game.puck.vy);
      if (puckDistance < 62 && puckSpeed < 430) {
        const stickX = player.x + player.facingX * (player.radius + 19);
        const stickY = player.y + player.facingY * (player.radius + 19);
        const control = Math.min(1, elapsed * 9);
        game.puck.vx += (player.vx * 0.72 + (stickX - game.puck.x) * 8 - game.puck.vx) * control;
        game.puck.vy += (player.vy * 0.72 + (stickY - game.puck.y) * 8 - game.puck.vy) * control;
      }

      if (
        game.actionQueued &&
        player.kickCooldown <= 0 &&
        distanceSquared(player, game.puck) < 92 * 92
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
                teammate.team === player.team &&
                teammate.id !== player.id &&
                teammate.role === "skater",
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
          const direction = playerAimDirection(player);
          targetX = player.x + direction.x * 160;
          targetY = player.y + direction.y * 160;
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
        if (game.actionQueued === "pass") {
          game.stats[player.team].passes += 1;
          playSound("pass");
        } else {
          game.stats[player.team].shots += 1;
          playSound("shot");
        }
        game.actionQueued = null;
        game.actionBuffer = 0;
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
        const laneY = player.slot === 1 ? 220 : 460;
        const puckInDefensiveHalf = player.team === "home"
          ? game.puck.x < RINK_WIDTH / 2
          : game.puck.x > RINK_WIDTH / 2;
        targetX = puckInDefensiveHalf
          ? clamp(
              game.puck.x - attackDirection * 110,
              player.team === "home" ? ICE_LEFT + 185 : RINK_WIDTH / 2,
              player.team === "home" ? RINK_WIDTH / 2 : ICE_RIGHT - 185,
            )
          : clamp(
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
          if (player.role === "goalie") {
            game.stats[player.team].saves += 1;
            playSound("pass");
          } else {
            game.stats[player.team].shots += 1;
            playSound("shot");
          }
          aiKickTaken = true;
        }
      }
    }

    function updateGame(game: MatchState, elapsed: number) {
      if (game.status === "countdown") {
        const previousCount = Math.ceil(game.countdown);
        game.countdown = Math.max(0, game.countdown - elapsed);
        if (game.countdown <= 0) {
          game.status = "playing";
          game.message = "Play!";
        }
        if (Math.ceil(game.countdown) !== previousCount || game.status === "playing") {
          playSound(game.status === "playing" ? "shot" : "countdown");
          publishHud(game);
        }
        return;
      }

      if (game.status !== "playing") {
        game.actionQueued = null;
        game.actionBuffer = 0;
        game.switchQueued = false;
        return;
      }

      if (game.goalPause > 0) {
        game.actionQueued = null;
        game.actionBuffer = 0;
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
      if (game.actionQueued) {
        game.actionBuffer = Math.max(0, game.actionBuffer - elapsed);
        if (game.actionBuffer === 0) game.actionQueued = null;
      }

      if (game.timeLeft <= 0) {
        if (game.score.home === game.score.away && game.period === "regulation") {
          game.period = "overtime";
          game.timeLeft = OVERTIME_LENGTH;
          resetFaceoff(game);
          game.status = "countdown";
          game.countdown = COUNTDOWN_LENGTH;
          game.message = "Sudden death overtime";
          publishHud(game);
          playSound("countdown");
          return;
        }
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

      game.puck.x += game.puck.vx * elapsed;
      game.puck.y += game.puck.vy * elapsed;
      game.puckTrail = game.puckTrail
        .map((point) => ({ ...point, opacity: point.opacity - elapsed * 3.6 }))
        .filter((point) => point.opacity > 0.08);
      const lastTrailPoint = game.puckTrail.at(-1);
      if (
        Math.hypot(game.puck.vx, game.puck.vy) > 260 &&
        (!lastTrailPoint || distanceSquared(lastTrailPoint, game.puck) > 14 * 14)
      ) {
        game.puckTrail.push({ x: game.puck.x, y: game.puck.y, opacity: 1 });
      }
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
      drawPuckTrail(activeContext, game.puckTrail);

      const controlledPlayer = game.players.find((player) => player.controlled);
      if (game.status === "playing" && controlledPlayer) {
        drawShotArrow(activeContext, controlledPlayer, game.puck);
      }

      const playersByDepth = [...game.players].sort(
        (first, second) => first.y - second.y,
      );
      for (const player of playersByDepth) {
        drawPlayer(activeContext, player, turtleImage, turtleName);
      }
      drawPuck(activeContext, game.puck);
    }

    function drawMultiplayerGame(state: HockeyMatchState, sessionId: string) {
      const pixelWidth = activeCanvas.width;
      const pixelHeight = activeCanvas.height;
      const scale = Math.min(pixelWidth / RINK_WIDTH, pixelHeight / RINK_HEIGHT);
      const offsetX = (pixelWidth - RINK_WIDTH * scale) / 2;
      const offsetY = (pixelHeight - RINK_HEIGHT * scale) / 2;
      activeContext.setTransform(1, 0, 0, 1, 0, 0);
      activeContext.clearRect(0, 0, pixelWidth, pixelHeight);
      activeContext.setTransform(scale, 0, 0, scale, offsetX, offsetY);
      drawRink(activeContext);
      const players = [...state.players.entries()].map(([id, player], index): HockeyPlayer => ({
        controlled: id === sessionId,
        facingX: player.facingX,
        facingY: player.facingY,
        id,
        kickCooldown: 0,
        radius: 24,
        role: "skater",
        slot: index,
        team: player.team === "away" ? "away" : "home",
        vx: player.vx,
        vy: player.vy,
        x: player.x,
        y: player.y,
      }));
      const controlledPlayer = players.find((player) => player.controlled);
      if (state.phase === "playing" && controlledPlayer) {
        drawShotArrow(activeContext, controlledPlayer, state.puck);
      }
      for (const player of players.sort((first, second) => first.y - second.y)) {
        const networkName = state.players.get(player.id)?.turtleName ?? turtleName;
        drawPlayer(activeContext, player, turtleImage, networkName);
      }
      drawPuck(activeContext, state.puck);
    }

    function animate(time: number) {
      const elapsed = Math.min((time - previousTime) / 1000, 0.1);
      previousTime = time;
      const activeMultiplayer = multiplayerRef.current;
      const networkState = activeMultiplayer.stateRef.current;
      if (modeRef.current === "multiplayer" && networkState) {
        multiplayerInputAccumulator += elapsed;
        if (multiplayerInputAccumulator >= 0.05) {
          multiplayerInputAccumulator = 0;
          const horizontal = Number(pressed.has("arrowright") || pressed.has("d")) - Number(pressed.has("arrowleft") || pressed.has("a"));
          const vertical = Number(pressed.has("arrowdown") || pressed.has("s")) - Number(pressed.has("arrowup") || pressed.has("w"));
          activeMultiplayer.sendInput(horizontal, vertical, gameRef.current.actionQueued ?? undefined);
          gameRef.current.actionQueued = null;
        }
        drawMultiplayerGame(networkState, activeMultiplayer.sessionId);
        animationFrame = requestAnimationFrame(animate);
        return;
      }
      simulationAccumulator = Math.min(simulationAccumulator + elapsed, 0.25);
      while (simulationAccumulator >= FIXED_STEP) {
        updateGame(gameRef.current, FIXED_STEP);
        simulationAccumulator -= FIXED_STEP;
      }
      drawGame(gameRef.current);
      animationFrame = requestAnimationFrame(animate);
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("keydown", handleKeyDown, { passive: false });
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", pauseForLostFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    animationFrame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", pauseForLostFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      void audioContextRef.current?.close();
      audioContextRef.current = null;
    };
  }, [playSound, turtleImageSrc, turtleName]);

  const result =
    hud.home === hud.away
      ? "Tie game"
      : hud.home > hud.away
        ? `${teamNames.home} win${hud.period === "overtime" ? " in OT" : ""}`
        : `${teamNames.away} win${hud.period === "overtime" ? " in OT" : ""}`;
  const multiplayerMatch = multiplayer.match;
  const displayedHomeScore = mode === "multiplayer" ? multiplayerMatch.homeScore : hud.home;
  const displayedAwayScore = mode === "multiplayer" ? multiplayerMatch.awayScore : hud.away;
  const displayedTime = mode === "multiplayer" ? multiplayerMatch.timeLeft : hud.timeLeft;
  const isMultiplayerPlaying = mode === "multiplayer" && multiplayerMatch.phase === "playing";

  return (
    <main className="hockey-stage" data-testid="hockey-game">
      <canvas
        ref={canvasRef}
        className="hockey-canvas"
        aria-label="Pond hockey game with two skaters and one goalie on each team"
        onPointerDown={() => canvasRef.current?.focus()}
        tabIndex={-1}
      />

      <button type="button" className="hockey-exit" onClick={() => { if (mode === "multiplayer") multiplayer.disconnect(); onExit(); }}>
        <span aria-hidden="true">←</span>
        Central Park
      </button>

      <header className="hockey-scoreboard" aria-live="polite">
        <div className="hockey-team home-team">
          <small>2 skaters + G</small>
          <strong>{teamNames.home}</strong>
          <span>{displayedHomeScore}</span>
        </div>
        <time>{(mode === "multiplayer" ? multiplayerMatch.overtime : hud.period === "overtime") ? <small>OT</small> : null}{formatTime(displayedTime)}</time>
        <div className="hockey-team away-team">
          <span>{displayedAwayScore}</span>
          <strong>{teamNames.away}</strong>
          <small>2 skaters + G</small>
        </div>
      </header>

      {mode !== "multiplayer" && hud.message && hud.status === "playing" && hud.message !== "Play!" ? (
        <div className="hockey-announcement">{hud.message}</div>
      ) : null}

      {mode !== "multiplayer" && hud.goalFlash && hud.status !== "ready" ? (
        <div className={`hockey-goal-flash is-${hud.goalFlash}`} aria-hidden="true" />
      ) : null}

      {(mode === "multiplayer" ? multiplayerMatch.phase === "countdown" : hud.status === "countdown") ? (
        <div className="hockey-countdown" aria-live="assertive">
          <small>{(mode === "multiplayer" ? multiplayerMatch.overtime : hud.period === "overtime") ? "Sudden death in" : "Faceoff in"}</small>
          <strong>{Math.max(1, Math.ceil(mode === "multiplayer" ? multiplayerMatch.countdownLeft : hud.countdown))}</strong>
        </div>
      ) : null}

      {(mode === "multiplayer" ? isMultiplayerPlaying : hud.status === "playing") ? (
        <aside className="hockey-controls" aria-live="polite">
          <strong>Controlling: {hud.controlledRole}</strong>
          {mode === "multiplayer" ? null : <button type="button" onClick={queueSwitch}><kbd>Space</kbd> Switch</button>}
          <button type="button" onClick={() => queueAction("pass")}><kbd>X</kbd> Pass</button>
          <button type="button" onClick={() => queueAction("shoot")}><kbd>C</kbd> Shoot</button>
          {mode === "multiplayer" ? null : <button type="button" onClick={pauseMatch}><kbd>P</kbd> Pause</button>}
        </aside>
      ) : null}

      {mode !== "multiplayer" && (hud.status === "playing" || hud.status === "finished") ? (
        <aside className="hockey-stats" aria-label="Match statistics">
          <span><small>Shots</small><b>{hud.stats.home.shots}–{hud.stats.away.shots}</b></span>
          <span><small>Passes</small><b>{hud.stats.home.passes}–{hud.stats.away.passes}</b></span>
          <span><small>Saves</small><b>{hud.stats.home.saves}–{hud.stats.away.saves}</b></span>
        </aside>
      ) : null}

      {mode !== "multiplayer" && hud.status === "paused" ? (
        <section className="hockey-start-card hockey-pause-card">
          <p>Turtle City Pond Hockey</p>
          <h1>Game paused</h1>
          <span>Your match is frozen right where you left it.</span>
          <button type="button" onClick={resumeMatch}>Resume match</button>
        </section>
      ) : null}

      {mode !== "multiplayer" && (hud.status === "ready" || hud.status === "finished") ? (
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
          {hud.status === "finished" ? (
            <div className="hockey-result-stats">
              <span><small>Shots</small><b>{hud.stats.home.shots}–{hud.stats.away.shots}</b></span>
              <span><small>Passes</small><b>{hud.stats.home.passes}–{hud.stats.away.passes}</b></span>
              <span><small>Saves</small><b>{hud.stats.home.saves}–{hud.stats.away.saves}</b></span>
            </div>
          ) : null}
          <button type="button" onClick={startMatch}>
            {hud.status === "finished" ? "Play again" : "Start match"}
          </button>
          {mode === "choose" && hud.status === "ready" ? (
            <button type="button" className="hockey-secondary-action" onClick={startMultiplayer}>
              Play multiplayer
            </button>
          ) : null}
        </section>
      ) : null}

      {mode === "multiplayer" && (multiplayer.status === "connecting" || multiplayer.status === "offline") ? (
        <section className="hockey-start-card">
          <p>Online Pond Hockey</p>
          <h1>{multiplayer.status === "connecting" ? "Finding a rink…" : "Rink unavailable"}</h1>
          <span>{multiplayer.status === "connecting" ? "Connecting you to a quick match." : "The multiplayer server could not be reached. Solo play is still available."}</span>
          {multiplayer.status === "offline" ? <button type="button" onClick={() => void multiplayer.connect()}>Try again</button> : null}
          <button type="button" className="hockey-secondary-action" onClick={leaveMultiplayer}>Play solo instead</button>
        </section>
      ) : null}

      {mode === "multiplayer" && multiplayer.status === "live" && multiplayerMatch.phase === "lobby" ? (
        <section className="hockey-start-card hockey-lobby-card">
          <p>Online Pond Hockey</p>
          <h1>Locker room</h1>
          <span>At least two turtles are needed. The match starts when everyone is ready.</span>
          <div className="hockey-lobby-roster">
            {multiplayerMatch.players.map((player) => <div key={player.sessionId} className={`is-${player.team}`}><b>{player.name}</b><small>{player.team === "home" ? teamNames.home : teamNames.away}</small><i>{player.ready ? "Ready" : "Waiting"}</i></div>)}
          </div>
          <button type="button" disabled={multiplayerMatch.players.find((player) => player.sessionId === multiplayer.sessionId)?.ready} onClick={multiplayer.ready}>Ready up</button>
          <button type="button" className="hockey-secondary-action" onClick={leaveMultiplayer}>Leave lobby</button>
        </section>
      ) : null}

      {mode === "multiplayer" && multiplayer.status === "live" && multiplayerMatch.phase === "finished" ? (
        <section className="hockey-start-card">
          <p>Online Pond Hockey · Final</p>
          <h1>{multiplayerMatch.winner === "home" ? teamNames.home : teamNames.away} win{multiplayerMatch.overtime ? " in OT" : ""}</h1>
          <span>Rematch begins when every remaining turtle votes to play again.</span>
          <div className="hockey-matchup"><b>{multiplayerMatch.homeScore}</b><i>final</i><b>{multiplayerMatch.awayScore}</b></div>
          <button type="button" onClick={multiplayer.rematch}>Vote rematch</button>
          <button type="button" className="hockey-secondary-action" onClick={leaveMultiplayer}>Leave rink</button>
        </section>
      ) : null}
    </main>
  );
}
