import { MapSchema, Schema, type as schemaType } from "@colyseus/schema";

export class HockeyPlayerState extends Schema {
  @schemaType("string") userId = "";
  @schemaType("string") turtleName = "";
  @schemaType("string") variant = "clover";
  @schemaType("string") team = "home";
  @schemaType("boolean") ready = false;
  @schemaType("number") x = 0;
  @schemaType("number") y = 0;
  @schemaType("number") vx = 0;
  @schemaType("number") vy = 0;
  @schemaType("number") facingX = 1;
  @schemaType("number") facingY = 0;
}

export class HockeyPuckState extends Schema {
  @schemaType("number") x = 600;
  @schemaType("number") y = 340;
  @schemaType("number") vx = 0;
  @schemaType("number") vy = 0;
}

export class HockeyMatchState extends Schema {
  @schemaType({ map: HockeyPlayerState }) players = new MapSchema<HockeyPlayerState>();
  @schemaType(HockeyPuckState) puck = new HockeyPuckState();
  @schemaType("string") phase = "lobby";
  @schemaType("number") countdownLeft = 0;
  @schemaType("number") timeLeft = 90;
  @schemaType("number") homeScore = 0;
  @schemaType("number") awayScore = 0;
  @schemaType("boolean") overtime = false;
  @schemaType("string") winner = "";
}
