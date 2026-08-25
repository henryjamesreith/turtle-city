"use client";

import { type CSSProperties, type MutableRefObject } from "react";
import {
  type MultiplayerStatus,
  type RemotePlayerPresence,
} from "@/lib/multiplayer/useDistrictMultiplayer";
import { getTurtleImage, isTurtleVariant } from "@/lib/turtles";

type DistrictLiveStatusProps = {
  remotePlayerCount: number;
  status: MultiplayerStatus;
};

type RemoteDistrictPlayersProps = {
  playerRefs: MutableRefObject<Map<string, HTMLDivElement>>;
  remotePlayers: RemotePlayerPresence[];
};

export function DistrictLiveStatus({
  remotePlayerCount,
  status,
}: DistrictLiveStatusProps) {
  return (
    <aside
      className={`district-live-status is-${status}`}
      aria-live="polite"
    >
      <span aria-hidden="true" />
      <strong>
        {status === "live"
          ? `${remotePlayerCount + 1} ${
              remotePlayerCount === 0 ? "turtle" : "turtles"
            } here`
          : status === "connecting"
            ? "Joining the city"
            : "Solo mode"}
      </strong>
    </aside>
  );
}

export function RemoteDistrictPlayers({
  playerRefs,
  remotePlayers,
}: RemoteDistrictPlayersProps) {
  return remotePlayers.map((remotePlayer) => {
    const variant = isTurtleVariant(remotePlayer.variant)
      ? remotePlayer.variant
      : "clover";

    return (
      <div
        key={remotePlayer.sessionId}
        className="district-remote-player"
        ref={(element) => {
          if (element) {
            playerRefs.current.set(remotePlayer.sessionId, element);
          } else {
            playerRefs.current.delete(remotePlayer.sessionId);
          }
        }}
        data-facing="left"
        style={
          {
            "--remote-turtle-image": `url("${getTurtleImage(variant)}")`,
          } as CSSProperties
        }
      >
        <span className="turtle-sprite" aria-hidden="true" />
        <span className="turtle-nameplate">{remotePlayer.turtleName}</span>
      </div>
    );
  });
}
