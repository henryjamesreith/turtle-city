export type TransitDistrict =
  | "central-park"
  | "chelsea"
  | "midtown"
  | "west-village";

export type SubwayStation = {
  district: TransitDistrict;
  id: string;
  name: string;
  neighborhood: string;
  platformDirection: string;
  terminus: string;
};

export const subwayStations: Record<TransitDistrict, SubwayStation> = {
  chelsea: {
    district: "chelsea",
    id: "chelsea-23",
    name: "West 23 Street",
    neighborhood: "Chelsea",
    platformDirection: "Downtown & Uptown",
    terminus: "Turtle City",
  },
  "west-village": {
    district: "west-village",
    id: "village-west-4",
    name: "West 4 Street",
    neighborhood: "West Village",
    platformDirection: "Uptown & Downtown",
    terminus: "Central Park",
  },
  "central-park": {
    district: "central-park",
    id: "park-south",
    name: "Park South",
    neighborhood: "Central Park",
    platformDirection: "Downtown",
    terminus: "West Village",
  },
  midtown: {
    district: "midtown",
    id: "midtown-times-square",
    name: "Times Square",
    neighborhood: "Midtown",
    platformDirection: "Uptown & Downtown",
    terminus: "Central Park",
  },
};

export const transitDistricts = Object.keys(
  subwayStations,
) as TransitDistrict[];

export function isTransitDistrict(
  district: string,
): district is TransitDistrict {
  return district in subwayStations;
}
