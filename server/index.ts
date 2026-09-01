import { defineRoom, defineServer } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import type { NextFunction, Request, Response } from "express";
import {
  CentralParkRoom,
  ChelseaRoom,
  EastVillageLesRoom,
  FidiRoom,
  MidtownRoom,
  WestVillageRoom,
} from "./DistrictRoom.js";
import { HockeyRoom } from "./HockeyRoom.js";
import { BikeRaceRoom } from "./BikeRaceRoom.js";
import { DeliveryRoom } from "./DeliveryRoom.js";

const webOrigin =
  process.env.TURTLE_CITY_WEB_ORIGIN ?? "http://localhost:3000";
const port = Number.parseInt(process.env.PORT ?? "2567", 10);

const gameServer = defineServer({
  devMode: process.env.NODE_ENV !== "production",
  transport: new WebSocketTransport(),
  rooms: {
    central_park: defineRoom(CentralParkRoom),
    bike_race: defineRoom(BikeRaceRoom),
    delivery: defineRoom(DeliveryRoom),
    chelsea: defineRoom(ChelseaRoom),
    east_village_les: defineRoom(EastVillageLesRoom),
    fidi: defineRoom(FidiRoom),
    hockey: defineRoom(HockeyRoom),
    midtown: defineRoom(MidtownRoom),
    west_village: defineRoom(WestVillageRoom),
  },
  express: (app) => {
    app.use((request: Request, response: Response, next: NextFunction) => {
      response.header("Access-Control-Allow-Origin", webOrigin);
      response.header("Access-Control-Allow-Credentials", "true");
      response.header(
        "Access-Control-Allow-Headers",
        "Authorization, Content-Type",
      );
      response.header(
        "Access-Control-Allow-Methods",
        "GET, POST, OPTIONS",
      );

      if (request.method === "OPTIONS") {
        response.sendStatus(204);
        return;
      }

      next();
    });

    app.get("/health", (_request: Request, response: Response) => {
      response.json({
        districts: [
          "central-park",
          "chelsea",
          "east-village-les",
          "fidi",
          "midtown",
          "west-village",
        ],
        games: ["hockey", "bike-race", "delivery"],
        status: "ok",
      });
    });
  },
});

await gameServer.listen(port);
console.log(`[Turtle City multiplayer] Listening on port ${port}.`);
