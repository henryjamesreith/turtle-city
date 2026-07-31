import { defineRoom, defineServer } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import type { NextFunction, Request, Response } from "express";
import { WestVillageRoom } from "./WestVillageRoom.js";

const webOrigin =
  process.env.TURTLE_CITY_WEB_ORIGIN ?? "http://localhost:3000";
const port = Number.parseInt(process.env.PORT ?? "2567", 10);

const gameServer = defineServer({
  devMode: process.env.NODE_ENV !== "production",
  transport: new WebSocketTransport(),
  rooms: {
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
      response.json({ district: "west-village", status: "ok" });
    });
  },
});

await gameServer.listen(port);
console.log(`[Turtle City multiplayer] Listening on port ${port}.`);
