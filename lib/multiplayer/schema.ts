import { MapSchema, Schema, type as schemaType } from "@colyseus/schema";

export class WestVillagePlayer extends Schema {
  @schemaType("string")
  userId = "";

  @schemaType("string")
  turtleName = "";

  @schemaType("string")
  variant = "clover";

  @schemaType("number")
  x = 0.48;

  @schemaType("number")
  y = 0.72;

  @schemaType("string")
  facing = "left";
}

export class WestVillageState extends Schema {
  @schemaType({ map: WestVillagePlayer })
  players = new MapSchema<WestVillagePlayer>();
}
