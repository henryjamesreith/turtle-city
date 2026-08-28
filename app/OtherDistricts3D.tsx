"use client";

import { OutdoorDistrict3D } from "./OutdoorDistrict3D";
import type { TurtleVariant } from "@/lib/turtles";

type SharedProps = { turtleName: string; turtleVariant: TurtleVariant };

export function WestVillageDistrict3D({
  onEnterBikeRace,
  onEnterJazzClub,
  onEnterSubway,
  spawn,
  ...player
}: SharedProps & {
  onEnterBikeRace: () => void;
  onEnterJazzClub: () => void;
  onEnterSubway: () => void;
  spawn: "jazz-club" | "neighborhood" | "subway" | "waterfront";
}) {
  return <OutdoorDistrict3D {...player} districtId="west-village" title="West Village" theme="village" spawn={spawn} spawnPositions={{ "jazz-club": [8, -4], neighborhood: [2, 0], subway: [22, 5], waterfront: [-13.4, 4] }} actions={[
    { id: "jazz-club", label: "The Cellar Note", detail: "Enter the neighborhood jazz cellar.", button: "Enter club", onEnter: onEnterJazzClub, position: [8, -7], type: "activity" },
    { id: "waterfront", label: "Hudson Greenway", detail: "Start the waterfront bike race.", button: "Start race", onEnter: onEnterBikeRace, position: [-13.4, 1], type: "activity" },
    { id: "subway", label: "West 4 Street", detail: "Enter the Turtle City subway.", button: "Enter station", onEnter: onEnterSubway, position: [22, 8], type: "subway" },
  ]} />;
}

export function MidtownDistrict3D({
  onEnterFallingItems,
  onEnterSubway,
  onEnterTrashPickup,
  spawn,
  ...player
}: SharedProps & {
  onEnterFallingItems: () => void;
  onEnterSubway: () => void;
  onEnterTrashPickup: () => void;
  spawn: "falling-items" | "plaza" | "subway" | "trash-pickup";
}) {
  return <OutdoorDistrict3D {...player} districtId="midtown" title="Midtown" theme="midtown" spawn={spawn} spawnPositions={{ "falling-items": [-12, -4], plaza: [0, 0], subway: [-23, 5], "trash-pickup": [13, -4] }} actions={[
    { id: "falling-items", label: "Look Out Below", detail: "Dodge trouble beneath the Empire Shell Building.", button: "Start challenge", onEnter: onEnterFallingItems, position: [-12, -7], type: "activity" },
    { id: "trash-pickup", label: "Crossroads Cleanup", detail: "Help clean up Turtle Square.", button: "Start shift", onEnter: onEnterTrashPickup, position: [13, -7], type: "activity" },
    { id: "subway", label: "Turtle Square Station", detail: "Enter the Turtle City subway.", button: "Enter station", onEnter: onEnterSubway, position: [-23, 8], type: "subway" },
  ]} />;
}

export function FidiDistrict3D({
  onEnterDelivery,
  onEnterSubway,
  spawn,
  ...player
}: SharedProps & {
  onEnterDelivery: () => void;
  onEnterSubway: () => void;
  spawn: "delivery" | "harbor" | "subway";
}) {
  return <OutdoorDistrict3D {...player} districtId="fidi" title="FiDi" theme="fidi" spawn={spawn} spawnPositions={{ delivery: [13, -4], harbor: [22, 7], subway: [-22, 5] }} actions={[
    { id: "delivery", label: "Shell Express", detail: "Pick up a harbor delivery route.", button: "Start deliveries", onEnter: onEnterDelivery, position: [13, -7], type: "activity" },
    { id: "subway", label: "Fulton Street", detail: "Enter the Turtle City subway.", button: "Enter station", onEnter: onEnterSubway, position: [-22, 8], type: "subway" },
  ]} />;
}

export function CentralParkDistrict3D({
  onEnterHockey,
  onEnterShoveling,
  onEnterSubway,
  spawn = "south-gate",
  ...player
}: SharedProps & {
  onEnterHockey: () => void;
  onEnterShoveling: () => void;
  onEnterSubway: () => void;
  spawn?: "south-gate" | "frozen-pond" | "snow-crew";
}) {
  return <OutdoorDistrict3D {...player} districtId="central-park" title="Central Park" theme="park" spawn={spawn} spawnPositions={{ "south-gate": [0, 7], "frozen-pond": [12, 1], "snow-crew": [-14, -3] }} actions={[
    { id: "snow-crew", label: "Snow Crew", detail: "Help clear the park paths.", button: "Start shoveling", onEnter: onEnterShoveling, position: [-14, -5], type: "activity" },
    { id: "frozen-pond", label: "Frozen Pond", detail: "Join a pond hockey match.", button: "Play hockey", onEnter: onEnterHockey, position: [13, 1], type: "activity" },
    { id: "south-gate", label: "South Gate Station", detail: "Enter the Turtle City subway.", button: "Enter station", onEnter: onEnterSubway, position: [0, 9], type: "subway" },
  ]} />;
}
