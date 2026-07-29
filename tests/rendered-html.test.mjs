import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("renders the full-screen Turtle City starter apartment", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Turtle City<\/title>/i);
  assert.match(html, /data-testid="chelsea-apartment"/);
  assert.match(html, /Chelsea · Apartment 4B/);
  assert.match(html, /Your apartment/);
  assert.match(html, /Starter condition · needs work/);
  assert.match(html, /World map/);
  assert.match(html, /Run-down starter apartment in Chelsea/);
  assert.match(html, /data-upgrade-slot="walls"/);
  assert.match(html, /data-tier="starter"/);
  assert.doesNotMatch(html, /data-testid="city-map"/);
  assert.doesNotMatch(html, /Snow Crew|Pond Hockey/i);
});

test("the map has focus interactions without game dependencies", async () => {
  const [map, park, styles, packageJson, turtleCharacter] = await Promise.all([
    readFile(new URL("../app/CityMap.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/CentralParkMap.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../public/assets/turtle-player.png", import.meta.url)),
  ]);

  assert.match(map, /setSelectedId\(district\.id\)/);
  assert.match(map, /setSelectedId\(null\)/);
  assert.match(map, /setScreen\("central-park"\)/);
  assert.match(map, /event\.key === "Escape"/);
  assert.match(park, /data-testid="central-park-map"/);
  assert.match(park, /South Slopes/);
  assert.doesNotMatch(park, /Winter Walk|Wooded paths/);
  assert.match(park, /Snow Crew/);
  assert.match(park, /Frozen Pond/);
  assert.match(park, /South Gate/);
  assert.match(park, /requestAnimationFrame/);
  assert.match(park, /translate3d/);
  assert.match(park, /movementKeys/);
  assert.match(park, /targetZoomRef/);
  assert.match(park, /event\.deltaY/);
  assert.match(park, /className="turtle-character"/);
  assert.match(park, /data-interaction-zone/);
  assert.doesNotMatch(park, /data-district-exit|West Gate|East Gate/);
  assert.match(park, /pathSegments/);
  assert.match(park, /isEditableTarget/);
  assert.match(park, /event\.key === "Enter"/);
  assert.match(park, /activeZoneId === "ice-hockey"/);
  assert.match(park, /activeZoneId === "snow-crew"/);
  assert.doesNotMatch(park, /is-walking|turtle-rig/);
  assert.match(styles, /\.park-zoom-controls/);
  assert.match(styles, /\.park-path-segment/);
  assert.match(styles, /\.activity-threshold/);
  assert.doesNotMatch(styles, /\.park-side-gate/);
  assert.match(styles, /turtle-player\.png/);
  assert.doesNotMatch(styles, /turtle-rig|is-walking|@keyframes turtle-walk/);
  assert.ok(turtleCharacter.length > 100_000);
  assert.equal(turtleCharacter.subarray(1, 4).toString("ascii"), "PNG");
  assert.match(styles, /--manhattan-shape:/);
  assert.match(styles, /\.district-fidi[\s\S]*68% 94%[\s\S]*37% 98%/);
  assert.doesNotMatch(styles, /52% 100%/);
  assert.doesNotMatch(packageJson, /phaser|drizzle|supabase|colyseus/i);
});

test("Chelsea connects the starter apartment, street, and world map", async () => {
  const [map, district, apartment, styles] = await Promise.all([
    readFile(new URL("../app/CityMap.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ChelseaDistrict.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ChelseaApartment.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(map, /useState<Screen>\("apartment"\)/);
  assert.match(map, /<ChelseaApartment/);
  assert.match(map, /<ChelseaDistrict/);
  assert.match(map, /mapReturn/);
  assert.match(map, /Visit Chelsea/);
  assert.match(district, /data-testid="chelsea-district"/);
  assert.match(district, /West 22 Apartments/);
  assert.match(district, /onEnterApartment/);
  assert.match(district, /requestAnimationFrame/);
  assert.match(apartment, /data-testid="chelsea-apartment"/);
  assert.match(apartment, /Apartment 4B/);
  assert.match(apartment, /data-upgrade-slot/);
  assert.match(apartment, /data-tier="starter"/);
  assert.match(apartment, /onExitToChelsea/);
  assert.match(apartment, /requestAnimationFrame/);
  assert.match(styles, /\.chelsea-stage/);
  assert.match(styles, /\.chelsea-apartment-building/);
  assert.match(styles, /\.apartment-stage/);
  assert.match(styles, /\.apartment-room/);
  assert.match(styles, /turtle-player\.png/);
});

test("pond hockey has two compact teams and session-only match rules", async () => {
  const [map, park, hockey, styles] = await Promise.all([
    readFile(new URL("../app/CityMap.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/CentralParkMap.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/HockeyGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(map, /setScreen\("hockey"\)/);
  assert.match(map, /<HockeyGame/);
  assert.match(park, /onEnterHockey/);
  assert.match(park, /ice-hockey/);
  assert.match(hockey, /data-testid="hockey-game"/);
  assert.match(hockey, /const MATCH_LENGTH = 90/);
  assert.match(hockey, /home-player/);
  assert.match(hockey, /home-wing/);
  assert.match(hockey, /home-goalie/);
  assert.match(hockey, /away-center/);
  assert.match(hockey, /away-wing/);
  assert.match(hockey, /away-goalie/);
  assert.match(hockey, /event\.code === "Space"/);
  assert.match(hockey, /event\.code === "KeyX"/);
  assert.match(hockey, /event\.code === "KeyC"/);
  assert.match(hockey, /switchControlledPlayer/);
  assert.match(hockey, /controlledRole/);
  assert.match(hockey, /context\.lineTo\(57, 12\)/);
  assert.match(hockey, /awardGoal/);
  assert.match(hockey, /requestAnimationFrame/);
  assert.match(hockey, /2 skaters \+ G/);
  assert.match(styles, /\.hockey-stage/);
  assert.match(styles, /\.hockey-scoreboard/);
  assert.match(styles, /\.hockey-start-card/);
});

test("snow shoveling clears the Snow Crew paths in a session-only shift", async () => {
  const [map, park, shoveling, styles] = await Promise.all([
    readFile(new URL("../app/CityMap.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/CentralParkMap.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/SnowShovelingGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(map, /setScreen\("snow-shoveling"\)/);
  assert.match(map, /<SnowShovelingGame/);
  assert.match(park, /onEnterShoveling/);
  assert.match(park, /snow-crew/);
  assert.match(shoveling, /data-testid="snow-shoveling-game"/);
  assert.match(shoveling, /const SHIFT_LENGTH = 90/);
  assert.match(shoveling, /const CLEAR_TARGET = 72/);
  assert.match(shoveling, /event\.code === "Space"/);
  assert.match(shoveling, /collectSnow/);
  assert.match(shoveling, /dumpShovel/);
  assert.match(shoveling, /refillSnowAt/);
  assert.match(shoveling, /turtle-player\.png/);
  assert.match(shoveling, /requestAnimationFrame/);
  assert.match(shoveling, /WASD/);
  assert.match(styles, /\.shoveling-stage/);
  assert.match(styles, /\.shoveling-scoreboard/);
  assert.match(styles, /\.shoveling-start-card/);
  assert.match(styles, /\.shovel-load/);
  assert.match(styles, /\.shoveling-coach/);
});
