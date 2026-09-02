"use client";

import { OutdoorDistrict3D } from "./OutdoorDistrict3D";
import type { TurtleVariant } from "@/lib/turtles";

type SharedProps = { hasSkateboard: boolean; turtleName: string; turtleVariant: TurtleVariant };

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
  onEnterRailRush,
  onEnterSubway,
  spawn,
  ...player
}: SharedProps & {
  onEnterDelivery: () => void;
  onEnterRailRush: () => void;
  onEnterSubway: () => void;
  spawn: "delivery" | "harbor" | "rail-rush" | "subway";
}) {
  return <OutdoorDistrict3D {...player} districtId="fidi" title="FiDi" theme="fidi" spawn={spawn} spawnPositions={{ delivery: [10, -4], harbor: [22, 7], "rail-rush": [17, -4], subway: [-22, 5] }} actions={[
    { id: "delivery", label: "Shell Express", detail: "Pick up a harbor delivery route.", button: "Start deliveries", onEnter: onEnterDelivery, position: [10, -7], type: "activity" },
    { id: "rail-rush", label: "Rail Rush", detail: "Dash across the downtown tracks.", button: "Start running", onEnter: onEnterRailRush, position: [17, -7], type: "activity" },
    { id: "subway", label: "Fulton Street", detail: "Enter the Turtle City subway.", button: "Enter station", onEnter: onEnterSubway, position: [-22, 8], type: "subway" },
  ]} />;
}

export function EastVillageLesDistrict3D({
  onEnterExcavator,
  onEnterSubway,
  spawn,
  ...player
}: SharedProps & {
  onEnterExcavator: () => void;
  onEnterSubway: () => void;
  spawn: "construction" | "neighborhood" | "subway";
}) {
  return <OutdoorDistrict3D {...player} districtId="east-village-les" title="East Village / LES" theme="east-village" spawn={spawn} spawnPositions={{ construction: [13, -4], neighborhood: [0, 0], subway: [-23, 5] }} actions={[
    { id: "construction", label: "East River Works", detail: "Take the controls and clear the construction site.", button: "Start excavating", onEnter: onEnterExcavator, position: [13, -7], type: "activity" },
    { id: "subway", label: "Delancey Street", detail: "Enter the Turtle City subway.", button: "Enter station", onEnter: onEnterSubway, position: [-23, 8], type: "subway" },
  ]} />;
}

export function CentralParkDistrict3D({
  onEnterHockey,
  onEnterSnowBrawl,
  onEnterShoveling,
  onEnterSubway,
  spawn = "south-gate",
  ...player
}: SharedProps & {
  onEnterHockey: () => void;
  onEnterSnowBrawl: () => void;
  onEnterShoveling: () => void;
  onEnterSubway: () => void;
  spawn?: "south-gate" | "frozen-pond" | "snow-crew" | "snow-brawl";
}) {
  return <OutdoorDistrict3D {...player} districtId="central-park" title="Central Park" theme="park" spawn={spawn} spawnPositions={{ "south-gate": [9, 24], "frozen-pond": [10, -1], "snow-crew": [-9, 13], "snow-brawl": [-2, -11] }} actions={[
    { id: "snow-crew", label: "Snow Crew", detail: "Help clear the park paths.", button: "Start shoveling", onEnter: onEnterShoveling, position: [-9, 9], type: "activity" },
    { id: "frozen-pond", label: "Wollman Frozen Pond Hockey", detail: "Skate onto the rink and join the match.", button: "Play hockey", onEnter: onEnterHockey, position: [10, -5], radius: 5, type: "activity" },
    { id: "snow-brawl", label: "Great Lawn Snow Brawl", detail: "Pick a side and pelt the rival team with snowballs.", button: "Join brawl", onEnter: onEnterSnowBrawl, position: [-2, -14], radius: 5, type: "activity" },
    { id: "south-gate", label: "South Gate Station", detail: "Enter the Turtle City subway.", button: "Enter station", onEnter: onEnterSubway, position: [14, 27], type: "subway" },
  ]} />;
}
