"use client";

import { Client, type Room } from "@colyseus/sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import { getPlayerAccessToken } from "../persistence/playerPersistence";
import { SnowBrawlMatchState } from "./snowBrawlSchema";

export type SnowBrawlSnapshot = {
  blueScore: number; countdownLeft: number; phase: string; redScore: number;
  timeLeft: number; winner: string;
  eventId: number; eventTeam: string; eventType: string; eventX: number; eventY: number;
  players: Array<{ cooldown: number; facingX: number; facingY: number; hearts: number; invulnerable: number; knockedOut: boolean; name: string; ready: boolean; sessionId: string; team: string; userId: string; variant: string; x: number; y: number }>;
  snowballs: Array<{ id: number; team: string; x: number; y: number }>;
};

const empty: SnowBrawlSnapshot = { blueScore: 0, countdownLeft: 0, eventId: 0, eventTeam: "", eventType: "", eventX: 0, eventY: 0, phase: "lobby", players: [], redScore: 0, snowballs: [], timeLeft: 75, winner: "" };
const url = () => process.env.NEXT_PUBLIC_MULTIPLAYER_URL ?? (process.env.NODE_ENV === "development" ? "http://localhost:2567" : "");

function snapshot(state: SnowBrawlMatchState): SnowBrawlSnapshot {
  return {
    blueScore: state.blueScore, countdownLeft: state.countdownLeft, eventId: state.eventId, eventTeam: state.eventTeam, eventType: state.eventType, eventX: state.eventX, eventY: state.eventY, phase: state.phase,
    players: [...state.players.entries()].map(([sessionId, p]) => ({ cooldown: p.cooldown, facingX: p.facingX, facingY: p.facingY, hearts: p.hearts, invulnerable: p.invulnerable, knockedOut: p.knockedOut, name: p.turtleName, ready: p.ready, sessionId, team: p.team, userId: p.userId, variant: p.variant, x: p.x, y: p.y })),
    redScore: state.redScore, snowballs: [...state.snowballs].map((ball) => ({ id: ball.id, team: ball.team, x: ball.x, y: ball.y })), timeLeft: state.timeLeft, winner: state.winner,
  };
}

export function useSnowBrawlMultiplayer() {
  const roomRef = useRef<Room<SnowBrawlMatchState> | null>(null);
  const sequence = useRef(0);
  const [match, setMatch] = useState(empty);
  const [sessionId, setSessionId] = useState("");
  const [status, setStatus] = useState<"idle" | "connecting" | "live" | "offline">("idle");
  const disconnect = useCallback(() => { const room = roomRef.current; roomRef.current = null; setSessionId(""); setMatch(empty); setStatus("idle"); if (room) void room.leave(); }, []);
  const connect = useCallback(async () => {
    if (roomRef.current) return;
    if (!url()) { setStatus("offline"); return; }
    setStatus("connecting");
    try {
      const token = await getPlayerAccessToken();
      if (!token) throw new Error("Sign in first.");
      const client = new Client(url()); client.auth.token = token;
      const room = await client.joinOrCreate("snow_brawl", {}, SnowBrawlMatchState);
      roomRef.current = room; setSessionId(room.sessionId); setMatch(snapshot(room.state)); setStatus("live");
      room.onStateChange((state) => setMatch(snapshot(state)));
      room.onLeave(() => { if (roomRef.current === room) { roomRef.current = null; setStatus("offline"); } });
    } catch (error) { console.warn("Snow Brawl multiplayer unavailable.", error); setStatus("offline"); }
  }, []);
  const ready = useCallback(() => roomRef.current?.send("ready"), []);
  const solo = useCallback(() => roomRef.current?.send("solo"), []);
  const rematch = useCallback(() => roomRef.current?.send("rematch"), []);
  const sendInput = useCallback((x: number, y: number, throwBall = false, aimX = x, aimY = y) => { sequence.current += 1; roomRef.current?.send("input", { aimX, aimY, sequence: sequence.current, throwBall, x, y }); }, []);
  useEffect(() => disconnect, [disconnect]);
  return { connect, disconnect, match, ready, rematch, sendInput, sessionId, solo, status };
}
