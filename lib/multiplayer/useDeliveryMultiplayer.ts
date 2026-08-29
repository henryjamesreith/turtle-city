"use client";
import { Client, type Room } from "@colyseus/sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import { getPlayerAccessToken } from "../persistence/playerPersistence";
import { DeliveryMatchState } from "./deliverySchema";
export type DeliveryPlayer = { cargo: number; delivered: number; distance: number; lane: number; lives: number; name: string; place: number; ready: boolean; sessionId: string; variant: string };
export type DeliverySummary = { countdownLeft: number; elapsed: number; phase: string; players: DeliveryPlayer[]; timeLeft: number };
type Status = "idle" | "connecting" | "live" | "offline";
const empty: DeliverySummary = { countdownLeft: 0, elapsed: 0, phase: "lobby", players: [], timeLeft: 60 };
function url() { return process.env.NEXT_PUBLIC_MULTIPLAYER_URL ?? (process.env.NODE_ENV === "development" ? "http://localhost:2567" : ""); }
function summarize(state: DeliveryMatchState): DeliverySummary { return { countdownLeft: state.countdownLeft, elapsed: state.elapsed, phase: state.phase, timeLeft: state.timeLeft, players: [...state.players.entries()].map(([sessionId, player]) => ({ cargo: player.cargo, delivered: player.delivered, distance: player.distance, lane: player.lane, lives: player.lives, name: player.turtleName, place: player.place, ready: player.ready, sessionId, variant: player.variant })) }; }
export function useDeliveryMultiplayer() { const roomRef = useRef<Room<DeliveryMatchState> | null>(null); const sequence = useRef(0); const [sessionId, setSessionId] = useState(""); const [status, setStatus] = useState<Status>("idle"); const [match, setMatch] = useState<DeliverySummary>(empty);
  const disconnect = useCallback(() => { const room = roomRef.current; roomRef.current = null; setSessionId(""); setStatus("idle"); setMatch(empty); if (room) void room.leave(); }, []);
  const connect = useCallback(async () => { if (roomRef.current || status === "connecting") return; const endpoint = url(); if (!endpoint) { setStatus("offline"); return; } setStatus("connecting"); try { const token = await getPlayerAccessToken(); if (!token) throw new Error("Sign in before joining Shell Express."); const client = new Client(endpoint); client.auth.token = token; const room = await client.joinOrCreate("delivery", {}, DeliveryMatchState); roomRef.current = room; setSessionId(room.sessionId); setStatus("live"); setMatch(summarize(room.state)); room.onStateChange((state) => setMatch(summarize(state))); room.onLeave(() => { if (roomRef.current === room) { roomRef.current = null; setSessionId(""); setStatus("offline"); } }); } catch (error) { console.warn("Shell Express multiplayer is unavailable.", error); setStatus("offline"); } }, [status]);
  const ready = useCallback(() => roomRef.current?.send("ready"), []); const rematch = useCallback(() => roomRef.current?.send("rematch"), []); const sendInput = useCallback((lane: number, boosting: boolean) => { sequence.current += 1; roomRef.current?.send("input", { boosting, lane, sequence: sequence.current }); }, []); useEffect(() => disconnect, [disconnect]); return { connect, disconnect, match, ready, rematch, sendInput, sessionId, status };
}
