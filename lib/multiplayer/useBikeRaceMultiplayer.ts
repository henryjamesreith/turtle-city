"use client";

import { Client, type Room } from "@colyseus/sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import { getPlayerAccessToken } from "../persistence/playerPersistence";
import { BikeRaceMatchState } from "./bikeRaceSchema";

export type BikeRaceConnectionStatus = "idle" | "connecting" | "live" | "offline";
export type BikeRacePlayer = { boost: number; distance: number; drifting: boolean; item: string; lane: number; name: string; place: number; ready: boolean; sessionId: string; shieldTime: number; speed: number; steer: number; variant: string };
export type BikeRaceSummary = { countdownLeft: number; elapsed: number; eventId: number; eventOwner: string; eventType: string; phase: string; players: BikeRacePlayer[] };
const emptySummary: BikeRaceSummary = { countdownLeft: 0, elapsed: 0, eventId: 0, eventOwner: "", eventType: "", phase: "lobby", players: [] };
function multiplayerUrl() { return process.env.NEXT_PUBLIC_MULTIPLAYER_URL ?? (process.env.NODE_ENV === "development" ? "http://localhost:2567" : ""); }
function summarize(state: BikeRaceMatchState): BikeRaceSummary { return { countdownLeft: state.countdownLeft, elapsed: state.elapsed, eventId: state.eventId, eventOwner: state.eventOwner, eventType: state.eventType, phase: state.phase, players: [...state.players.entries()].map(([sessionId, player]) => ({ boost: player.boost, distance: player.distance, drifting: player.drifting, item: player.item, lane: player.lane, name: player.turtleName, place: player.place, ready: player.ready, sessionId, shieldTime: player.shieldTime, speed: player.speed, steer: player.steer, variant: player.variant })) }; }

export function useBikeRaceMultiplayer() {
  const roomRef = useRef<Room<BikeRaceMatchState> | null>(null); const sequenceRef = useRef(0); const [sessionId, setSessionId] = useState(""); const [status, setStatus] = useState<BikeRaceConnectionStatus>("idle"); const [match, setMatch] = useState<BikeRaceSummary>(emptySummary);
  const disconnect = useCallback(() => { const room = roomRef.current; roomRef.current = null; setSessionId(""); setStatus("idle"); setMatch(emptySummary); if (room) void room.leave(); }, []);
  const connect = useCallback(async () => { if (roomRef.current || status === "connecting") return; const url = multiplayerUrl(); if (!url) { setStatus("offline"); return; } setStatus("connecting"); try { const token = await getPlayerAccessToken(); if (!token) throw new Error("Sign in before joining the bike race."); const client = new Client(url); client.auth.token = token; const room = await client.joinOrCreate("bike_race", {}, BikeRaceMatchState); roomRef.current = room; setSessionId(room.sessionId); setStatus("live"); setMatch(summarize(room.state)); room.onStateChange((state) => setMatch(summarize(state))); room.onLeave(() => { if (roomRef.current === room) { roomRef.current = null; setSessionId(""); setStatus("offline"); } }); } catch (error) { console.warn("Bike race multiplayer is unavailable.", error); setStatus("offline"); } }, [status]);
  const ready = useCallback(() => roomRef.current?.send("ready"), []); const rematch = useCallback(() => roomRef.current?.send("rematch"), []);
  const sendInput = useCallback((steer: number, throttle: boolean, braking: boolean, drifting: boolean) => { sequenceRef.current += 1; roomRef.current?.send("input", { braking, drifting, sequence: sequenceRef.current, steer, throttle }); }, []);
  const useItem = useCallback(() => roomRef.current?.send("item"), []);
  useEffect(() => disconnect, [disconnect]);
  return { connect, disconnect, match, ready, rematch, sendInput, sessionId, status, useItem };
}
