import { ArraySchema, MapSchema, Schema, type as schemaType } from "@colyseus/schema";

export class SnowBrawlPlayerState extends Schema {
  @schemaType("string") userId = "";
  @schemaType("string") turtleName = "";
  @schemaType("string") variant = "clover";
  @schemaType("string") team = "blue";
  @schemaType("boolean") ready = false;
  @schemaType("number") x = 0;
  @schemaType("number") y = 0;
  @schemaType("number") facingX = 1;
  @schemaType("number") facingY = 0;
  @schemaType("number") hearts = 3;
  @schemaType("number") cooldown = 0;
  @schemaType("number") invulnerable = 0;
  @schemaType("boolean") knockedOut = false;
}

export class SnowballState extends Schema {
  @schemaType("number") id = 0;
  @schemaType("string") owner = "";
  @schemaType("string") team = "blue";
  @schemaType("number") x = 0;
  @schemaType("number") y = 0;
  @schemaType("number") vx = 0;
  @schemaType("number") vy = 0;
}

export class SnowBrawlMatchState extends Schema {
  @schemaType({ map: SnowBrawlPlayerState }) players = new MapSchema<SnowBrawlPlayerState>();
  @schemaType([SnowballState]) snowballs = new ArraySchema<SnowballState>();
  @schemaType("string") phase = "lobby";
  @schemaType("number") countdownLeft = 0;
  @schemaType("number") timeLeft = 75;
  @schemaType("number") blueScore = 0;
  @schemaType("number") redScore = 0;
  @schemaType("string") winner = "";
  @schemaType("number") eventId = 0;
  @schemaType("string") eventType = "";
  @schemaType("number") eventX = 0;
  @schemaType("number") eventY = 0;
  @schemaType("string") eventTeam = "";
}
