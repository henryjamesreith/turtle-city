"use client";

import {
  Callbacks,
  Client,
  type Room,
} from "@colyseus/sdk";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { getPlayerAccessToken } from "../persistence/playerPersistence";
import {
  WestVillageState,
  type WestVillagePlayer,
} from "./schema";

export type MultiplayerStatus = "connecting" | "live" | "offline";

export type RemotePlayerPresence = {
  sessionId: string;
  turtleName: string;
  variant: string;
};

export type RemotePlayerTarget = {
  currentX: number;
  currentY: number;
  facing: string;
  x: number;
  y: number;
};

type MovementMessage = {
  facing: "left" | "right";
  x: number;
  y: number;
};

type WestVillageMultiplayer = {
  remotePlayers: RemotePlayerPresence[];
  remoteTargetsRef: MutableRefObject<Map<string, RemotePlayerTarget>>;
  sendMovement: (movement: MovementMessage) => void;
  status: MultiplayerStatus;
};

const localDevelopmentUrl = "http://localhost:2567";

function getMultiplayerUrl() {
  return (
    process.env.NEXT_PUBLIC_MULTIPLAYER_URL ??
    (process.env.NODE_ENV === "development" ? localDevelopmentUrl : "")
  );
}

function toPresence(
  sessionId: string,
  player: WestVillagePlayer,
): RemotePlayerPresence {
  return {
    sessionId,
    turtleName: player.turtleName,
    variant: player.variant,
  };
}

export function useWestVillageMultiplayer(
  spawn: "jazz-club" | "neighborhood" | "subway" | "waterfront",
): WestVillageMultiplayer {
  const roomRef = useRef<Room<WestVillageState> | null>(null);
  const remoteTargetsRef = useRef(new Map<string, RemotePlayerTarget>());
  const [remotePlayers, setRemotePlayers] = useState<RemotePlayerPresence[]>([]);
  const [status, setStatus] = useState<MultiplayerStatus>(() =>
    getMultiplayerUrl() ? "connecting" : "offline",
  );

  const sendMovement = useCallback((movement: MovementMessage) => {
    roomRef.current?.send("move", movement);
  }, []);

  useEffect(() => {
    const multiplayerUrl = getMultiplayerUrl();
    let cancelled = false;
    let retryTimer = 0;
    let activeRoom: Room<WestVillageState> | null = null;
    const playerUnbinds = new Map<string, () => void>();
    const remoteTargets = remoteTargetsRef.current;

    if (!multiplayerUrl) {
      return;
    }

    async function connect() {
      setStatus((current) => (current === "live" ? current : "connecting"));

      try {
        const accessToken = await getPlayerAccessToken();
        if (!accessToken) {
          throw new Error("A signed-in turtle is required for multiplayer.");
        }

        const client = new Client(multiplayerUrl);
        client.auth.token = accessToken;
        const room = await client.joinOrCreate(
          "west_village",
          { spawn },
          WestVillageState,
        );

        if (cancelled) {
          void room.leave();
          return;
        }

        activeRoom = room;
        roomRef.current = room;
        setStatus("live");

        const callbacks = Callbacks.get(room);
        const unbindAdd = callbacks.onAdd(
          "players",
          (player, sessionId) => {
            if (sessionId === room.sessionId) {
              return;
            }

            remoteTargets.set(sessionId, {
              currentX: player.x,
              currentY: player.y,
              facing: player.facing,
              x: player.x,
              y: player.y,
            });
            setRemotePlayers((current) => [
              ...current.filter((entry) => entry.sessionId !== sessionId),
              toPresence(sessionId, player),
            ]);

            const unbindChange = callbacks.onChange(player, () => {
              const target = remoteTargets.get(sessionId);
              if (!target) {
                return;
              }

              target.x = player.x;
              target.y = player.y;
              target.facing = player.facing;
            });
            playerUnbinds.set(sessionId, unbindChange);
          },
        );
        const unbindRemove = callbacks.onRemove(
          "players",
          (_player, sessionId) => {
            playerUnbinds.get(sessionId)?.();
            playerUnbinds.delete(sessionId);
            remoteTargets.delete(sessionId);
            setRemotePlayers((current) =>
              current.filter((entry) => entry.sessionId !== sessionId),
            );
          },
        );

        room.onLeave(() => {
          unbindAdd();
          unbindRemove();
          playerUnbinds.forEach((unbind) => unbind());
          playerUnbinds.clear();
          remoteTargets.clear();
          setRemotePlayers([]);
          roomRef.current = null;

          if (!cancelled) {
            setStatus("offline");
            retryTimer = window.setTimeout(connect, 4000);
          }
        });
      } catch (error) {
        console.warn("West Village multiplayer is unavailable.", error);
        if (!cancelled) {
          setStatus("offline");
          retryTimer = window.setTimeout(connect, 4000);
        }
      }
    }

    void connect();

    return () => {
      cancelled = true;
      window.clearTimeout(retryTimer);
      playerUnbinds.forEach((unbind) => unbind());
      playerUnbinds.clear();
      remoteTargets.clear();
      setRemotePlayers([]);
      roomRef.current = null;

      if (activeRoom) {
        void activeRoom.leave();
      }
    };
  }, [spawn]);

  return {
    remotePlayers,
    remoteTargetsRef,
    sendMovement,
    status,
  };
}
