import { MapSchema, Schema, type as schemaType } from "@colyseus/schema";

export class DeliveryPlayerState extends Schema {
  @schemaType("string") userId = "";
  @schemaType("string") turtleName = "";
  @schemaType("string") variant = "clover";
  @schemaType("boolean") ready = false;
  @schemaType("number") lane = 1;
  @schemaType("number") distance = 0;
  @schemaType("number") cargo = 0;
  @schemaType("number") delivered = 0;
  @schemaType("number") lives = 3;
  @schemaType("number") place = 0;
  @schemaType("boolean") boosting = false;
}

export class DeliveryMatchState extends Schema {
  @schemaType({ map: DeliveryPlayerState }) players = new MapSchema<DeliveryPlayerState>();
  @schemaType("string") phase = "lobby";
  @schemaType("number") countdownLeft = 0;
  @schemaType("number") elapsed = 0;
  @schemaType("number") timeLeft = 60;
}
