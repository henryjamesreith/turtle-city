"use client";

import { Client, type Room } from "@colyseus/sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import { getPlayerAccessToken } from "../persistence/playerPersistence";
import { HockeyMatchState } from "./hockeySchema";

export type HockeyConnectionStatus = "idle" | "connecting" | "live" | "offline";

export type HockeyLobbyPlayer = {
  name: string;
  ready: boolean;
  sessionId: string;
  team: "home" | "away";
};

export type HockeyMatchSummary = {
  awayScore: number;
  countdownLeft: number;
  homeScore: number;
  overtime: boolean;
  phase: string;
  players: HockeyLobbyPlayer[];
  timeLeft: number;
  winner: string;
};

const localDevelopmentUrl = "http://localhost:2567";

function getMultiplayerUrl() {
  return process.env.NEXT_PUBLIC_MULTIPLAYER_URL ??
    (process.env.NODE_ENV === "development" ? localDevelopmentUrl : "");
}

function summarize(state: HockeyMatchState): HockeyMatchSummary {
  return {
    awayScore: state.awayScore,
    countdownLeft: state.countdownLeft,
    homeScore: state.homeScore,
    overtime: state.overtime,
    phase: state.phase,
    players: [...state.players.entries()].map(([sessionId, player]) => ({
      name: player.turtleName,
      ready: player.ready,
      sessionId,
      team: player.team === "away" ? "away" : "home",
    })),
    timeLeft: state.timeLeft,
    winner: state.winner,
  };
}

const emptySummary: HockeyMatchSummary = {
  awayScore: 0,
  countdownLeft: 0,
  homeScore: 0,
  overtime: false,
  phase: "lobby",
  players: [],
  timeLeft: 90,
  winner: "",
};

export function useHockeyMultiplayer() {
  const roomRef = useRef<Room<HockeyMatchState> | null>(null);
  const stateRef = useRef<HockeyMatchState | null>(null);
  const sequenceRef = useRef(0);
  const [sessionId, setSessionId] = useState("");
  const [status, setStatus] = useState<HockeyConnectionStatus>("idle");
  const [match, setMatch] = useState<HockeyMatchSummary>(emptySummary);

  const disconnect = useCallback(() => {
    const room = roomRef.current;
    roomRef.current = null;
    stateRef.current = null;
    setSessionId("");
    setStatus("idle");
    setMatch(emptySummary);
    if (room) void room.leave();
  }, []);

  const connect = useCallback(async () => {
    if (roomRef.current || status === "connecting") return;
    const multiplayerUrl = getMultiplayerUrl();
    if (!multiplayerUrl) {
      setStatus("offline");
      return;
    }
    setStatus("connecting");
    try {
      const accessToken = await getPlayerAccessToken();
      if (!accessToken) throw new Error("Sign in before joining hockey.");
      const client = new Client(multiplayerUrl);
      client.auth.token = accessToken;
      const room = await client.joinOrCreate("hockey", {}, HockeyMatchState);
      roomRef.current = room;
      stateRef.current = room.state;
      setSessionId(room.sessionId);
      setStatus("live");
      setMatch(summarize(room.state));
      room.onStateChange((state) => {
        stateRef.current = state;
        setMatch(summarize(state));
      });
      room.onLeave(() => {
        if (roomRef.current === room) {
          roomRef.current = null;
          stateRef.current = null;
          setSessionId("");
          setStatus("offline");
        }
      });
    } catch (error) {
      console.warn("Pond hockey multiplayer is unavailable.", error);
      setStatus("offline");
    }
  }, [status]);

  const ready = useCallback(() => roomRef.current?.send("ready"), []);
  const rematch = useCallback(() => roomRef.current?.send("rematch"), []);
  const sendInput = useCallback((x: number, y: number, action?: "pass" | "shoot") => {
    sequenceRef.current += 1;
    roomRef.current?.send("input", { action, sequence: sequenceRef.current, x, y });
  }, []);

  useEffect(() => disconnect, [disconnect]);

  return { connect, disconnect, match, ready, rematch, sendInput, sessionId, stateRef, status };
}
