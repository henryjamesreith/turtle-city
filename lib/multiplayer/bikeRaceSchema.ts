import { MapSchema, Schema, type as schemaType } from "@colyseus/schema";

export class BikeRacePlayerState extends Schema {
  @schemaType("string") userId = "";
  @schemaType("string") turtleName = "";
  @schemaType("string") variant = "clover";
  @schemaType("boolean") ready = false;
  @schemaType("number") lane = 1;
  @schemaType("number") distance = 0;
  @schemaType("number") boost = 100;
  @schemaType("boolean") sprinting = false;
  @schemaType("number") slowTime = 0;
  @schemaType("number") place = 0;
}

export class BikeRaceMatchState extends Schema {
  @schemaType({ map: BikeRacePlayerState }) players = new MapSchema<BikeRacePlayerState>();
  @schemaType("string") phase = "lobby";
  @schemaType("number") countdownLeft = 0;
  @schemaType("number") elapsed = 0;
  @schemaType("number") finishCount = 0;
}
