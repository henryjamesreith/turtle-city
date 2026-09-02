import { MapSchema, Schema, type as schemaType } from "@colyseus/schema";

export class BikeRacePlayerState extends Schema {
  @schemaType("string") userId = "";
  @schemaType("string") turtleName = "";
  @schemaType("string") variant = "clover";
  @schemaType("boolean") ready = false;
  /** Track-relative offset: roughly -1 to 1 on asphalt, with room to drive onto the grass. */
  @schemaType("number") lane = 0;
  @schemaType("number") distance = 0;
  @schemaType("number") speed = 0;
  @schemaType("number") boost = 100;
  @schemaType("number") steer = 0;
  @schemaType("boolean") throttle = false;
  @schemaType("boolean") braking = false;
  @schemaType("boolean") drifting = false;
  @schemaType("string") item = "";
  @schemaType("number") itemCooldown = 0;
  @schemaType("number") shieldTime = 0;
  @schemaType("number") slowTime = 0;
  @schemaType("number") place = 0;
}

export class BikeRaceMatchState extends Schema {
  @schemaType({ map: BikeRacePlayerState }) players = new MapSchema<BikeRacePlayerState>();
  @schemaType("string") phase = "lobby";
  @schemaType("number") countdownLeft = 0;
  @schemaType("number") elapsed = 0;
  @schemaType("number") finishCount = 0;
  @schemaType("number") eventId = 0;
  @schemaType("string") eventType = "";
  @schemaType("string") eventOwner = "";
}
