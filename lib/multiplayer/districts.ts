export type MultiplayerDistrictId =
  | "central-park"
  | "chelsea"
  | "fidi"
  | "midtown"
  | "west-village";

type DistrictPosition = {
  x: number;
  y: number;
};

export type DistrictMultiplayerConfig = {
  bounds: {
    maximumX: number;
    maximumY: number;
    minimumX: number;
    minimumY: number;
  };
  label: string;
  maximumMovementPerSecond: DistrictPosition;
  roomName: string;
  spawns: Record<string, DistrictPosition>;
};

export const districtMultiplayerConfigs: Record<
  MultiplayerDistrictId,
  DistrictMultiplayerConfig
> = {
  "central-park": {
    bounds: {
      maximumX: 0.92,
      maximumY: 0.955,
      minimumX: 0.08,
      minimumY: 0.045,
    },
    label: "Central Park",
    maximumMovementPerSecond: { x: 0.5, y: 0.34 },
    roomName: "central_park",
    spawns: {
      "frozen-pond": { x: 0.733, y: 0.485 },
      "snow-crew": { x: 0.29, y: 0.697 },
      "south-gate": { x: 0.71, y: 0.864 },
    },
  },
  chelsea: {
    bounds: {
      maximumX: 0.96,
      maximumY: 0.88,
      minimumX: 0.04,
      minimumY: 0.58,
    },
    label: "Chelsea",
    maximumMovementPerSecond: { x: 0.22, y: 0.75 },
    roomName: "chelsea",
    spawns: {
      apartment: { x: 0.62, y: 0.72 },
      "pressure-washing": { x: 0.28, y: 0.72 },
      subway: { x: 0.86, y: 0.72 },
    },
  },
  fidi: {
    bounds: {
      maximumX: 0.965,
      maximumY: 0.9,
      minimumX: 0.035,
      minimumY: 0.57,
    },
    label: "FiDi",
    maximumMovementPerSecond: { x: 0.22, y: 0.75 },
    roomName: "fidi",
    spawns: {
      delivery: { x: 0.71, y: 0.73 },
      harbor: { x: 0.88, y: 0.73 },
      subway: { x: 0.11, y: 0.73 },
    },
  },
  midtown: {
    bounds: {
      maximumX: 0.965,
      maximumY: 0.89,
      minimumX: 0.035,
      minimumY: 0.56,
    },
    label: "Midtown",
    maximumMovementPerSecond: { x: 0.22, y: 0.75 },
    roomName: "midtown",
    spawns: {
      "falling-items": { x: 0.43, y: 0.72 },
      plaza: { x: 0.58, y: 0.72 },
      subway: { x: 0.1, y: 0.72 },
      "trash-pickup": { x: 0.78, y: 0.72 },
    },
  },
  "west-village": {
    bounds: {
      maximumX: 0.973,
      maximumY: 0.9,
      minimumX: 0.027,
      minimumY: 0.58,
    },
    label: "West Village",
    maximumMovementPerSecond: { x: 0.22, y: 0.75 },
    roomName: "west_village",
    spawns: {
      "jazz-club": { x: 0.4, y: 0.72 },
      neighborhood: { x: 0.48, y: 0.72 },
      subway: { x: 0.88, y: 0.72 },
      waterfront: { x: 0.25, y: 0.72 },
    },
  },
};
