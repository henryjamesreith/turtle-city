import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("renders the full-screen Turtle City welcome", async () => {
  const [layout, map, onboarding, auth] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/CityMap.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/TurtleOnboarding.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/TurtleAuth.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /title:\s*"Turtle City"/);
  assert.match(map, /useState<EntryMode>\("welcome"\)/);
  assert.match(map, /entryMode !== "game"/);
  assert.match(onboarding, /data-testid="turtle-welcome"/);
  assert.match(onboarding, /Create a turtle/);
  assert.match(onboarding, /Opening Turtle City/);
  assert.doesNotMatch(onboarding, /Play as|Create another turtle/);
  assert.match(auth, /data-testid=\{`turtle-\$\{mode\}`\}/);
  assert.match(auth, /Find your turtle/);
  assert.match(auth, /Create an account/);
  assert.doesNotMatch(auth, /Check your email|email-confirmation/);
});

test("email onboarding saves a turtle and enters Apartment 4B", async () => {
  const [map, onboarding, persistence, databaseTypes, onboardingMigration, styles] =
    await Promise.all([
      readFile(new URL("../app/CityMap.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/TurtleOnboarding.tsx", import.meta.url), "utf8"),
      readFile(
        new URL("../lib/persistence/playerPersistence.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../lib/supabase/database.types.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL(
          "../supabase/migrations/20260729010000_profile_onboarding.sql",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    ]);

  assert.match(map, /<TurtleOnboarding/);
  assert.match(map, /hasCompletedOnboarding/);
  assert.match(map, /saveTurtleProfile/);
  assert.match(map, /saveLastLocation\("apartment"\)/);
  assert.match(map, /setScreen\("apartment"\)/);
  assert.match(onboarding, /data-testid="turtle-welcome"/);
  assert.match(onboarding, /data-testid="turtle-creator"/);
  assert.match(onboarding, /What should we call you\?/);
  assert.match(onboarding, /Choose your turtle/);
  assert.match(onboarding, /turtleVariants\.map/);
  assert.match(onboarding, /Describe your personality/);
  assert.match(onboarding, /Move to Turtle City/);
  assert.doesNotMatch(persistence, /signInAnonymously/);
  assert.match(persistence, /signInWithPassword/);
  assert.match(persistence, /auth\.signUp/);
  assert.match(persistence, /onboarding_completed_at/);
  assert.match(persistence, /personality/);
  assert.match(databaseTypes, /onboarding_completed_at/);
  assert.match(onboardingMigration, /add column personality text/);
  assert.match(onboardingMigration, /add column onboarding_completed_at/);
  assert.match(styles, /\.onboarding-stage/);
  assert.match(styles, /\.creator-shell/);
  assert.match(styles, /data-turtle-variant="marina"/);
});

test("accounts receive unique turtle tags and can log out safely", async () => {
  const [
    map,
    apartment,
    district,
    park,
    pressureWashing,
    hockey,
    shoveling,
    persistence,
    databaseTypes,
    migration,
    styles,
  ] = await Promise.all([
    readFile(new URL("../app/CityMap.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ChelseaApartment.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ChelseaDistrict.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/CentralParkMap.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/PressureWashingGame.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/HockeyGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/SnowShovelingGame.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../lib/persistence/playerPersistence.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../lib/supabase/database.types.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../supabase/migrations/20260729020000_unique_turtle_tags.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(map, /Log out/);
  assert.match(map, /className="map-toolbar"/);
  assert.match(map, /You can sign back in as/);
  assert.match(map, /signOutPlayer/);
  assert.match(map, /setEntryMode\("welcome"\)/);
  assert.match(persistence, /auth\.signOut\(\{ scope: "local" \}\)/);
  assert.match(databaseTypes, /turtle_tag/);
  assert.match(migration, /add column turtle_tag text/);
  assert.match(migration, /create unique index profiles_turtle_tag_unique_idx/);
  assert.match(migration, /replace\(new\.user_id::text, '-', ''\)/);
  assert.match(apartment, /className="turtle-nameplate"/);
  assert.match(district, /className="turtle-nameplate"/);
  assert.match(park, /className="turtle-nameplate"/);
  assert.match(pressureWashing, /className="turtle-nameplate"/);
  assert.match(hockey, /strokeText\(turtleName/);
  assert.match(shoveling, /strokeText\(turtleName/);
  assert.match(styles, /\.turtle-nameplate/);
  assert.match(styles, /bottom: calc\(100% \+ 5px\)/);
  assert.match(styles, /\.map-toolbar/);
  assert.match(styles, /\.map-logout/);
  assert.match(styles, /\.logout-dialog/);
});

test("the map has focus interactions without game dependencies", async () => {
  const [map, park, styles, packageJson, turtleCharacter] = await Promise.all([
    readFile(new URL("../app/CityMap.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/CentralParkMap.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../public/assets/turtles/clover.png", import.meta.url)),
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
  assert.match(styles, /assets\/turtles\/clover\.png/);
  assert.doesNotMatch(styles, /turtle-rig|is-walking|@keyframes turtle-walk/);
  assert.ok(turtleCharacter.length > 100_000);
  assert.equal(turtleCharacter.subarray(1, 4).toString("ascii"), "PNG");
  assert.match(styles, /--manhattan-shape:/);
  assert.match(styles, /\.district-fidi[\s\S]*68% 94%[\s\S]*37% 98%/);
  assert.doesNotMatch(styles, /52% 100%/);
  assert.match(packageJson, /@supabase\/supabase-js/);
  assert.doesNotMatch(packageJson, /phaser|drizzle|colyseus/i);
});

test("Chelsea connects the starter apartment, street, and city map", async () => {
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
  assert.match(district, /onEnterPressureWashing/);
  assert.match(district, /chelsea-pressure-marker/);
  assert.match(district, /spawn === "pressure-washing"/);
  assert.match(district, /requestAnimationFrame/);
  assert.match(apartment, /data-testid="chelsea-apartment"/);
  assert.match(apartment, /Apartment 4B/);
  assert.match(apartment, /data-upgrade-slot/);
  assert.equal(
    [...apartment.matchAll(/className="turtle-nameplate"/g)].length,
    1,
  );
  assert.match(apartment, /data-tier="starter"/);
  assert.match(apartment, /onExitToChelsea/);
  assert.match(apartment, /requestAnimationFrame/);
  assert.match(styles, /\.chelsea-stage/);
  assert.match(styles, /\.chelsea-apartment-building/);
  assert.match(styles, /\.apartment-stage/);
  assert.match(styles, /\.apartment-room/);
  assert.match(styles, /assets\/turtles\/clover\.png/);
});

test("Chelsea pressure washing clears a facade in a session-only shift", async () => {
  const [map, district, pressureWashing, styles] = await Promise.all([
    readFile(new URL("../app/CityMap.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ChelseaDistrict.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/PressureWashingGame.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(map, /import \{ PressureWashingGame \}/);
  assert.match(map, /screen === "pressure-washing"/);
  assert.match(map, /setChelseaSpawn\("pressure-washing"\)/);
  assert.match(map, /<PressureWashingGame/);
  assert.match(district, /Chelsea Wash Crew/);
  assert.match(district, /Pressure wash Lettuce/);
  assert.match(pressureWashing, /data-testid="pressure-washing-game"/);
  assert.match(pressureWashing, /const SHIFT_LENGTH = 75/);
  assert.match(pressureWashing, /const CLEAN_TARGET = 85/);
  assert.match(pressureWashing, /const SPRAY_RADIUS = 68/);
  assert.match(pressureWashing, /washAtAim/);
  assert.match(pressureWashing, /pointerdown/);
  assert.match(pressureWashing, /event\.code === "Space"/);
  assert.match(pressureWashing, /requestAnimationFrame/);
  assert.match(pressureWashing, /<canvas/);
  assert.match(styles, /\.pressure-stage/);
  assert.match(styles, /\.pressure-work-area/);
  assert.match(styles, /\.pressure-start-card/);
  assert.match(styles, /\.chelsea-pressure-marker/);
});

test("Supabase persistence protects player data and saves stable locations", async () => {
  const [map, client, persistence, databaseTypes, migration, environment, config] =
    await Promise.all([
      readFile(new URL("../app/CityMap.tsx", import.meta.url), "utf8"),
      readFile(new URL("../lib/supabase/client.ts", import.meta.url), "utf8"),
      readFile(
        new URL("../lib/persistence/playerPersistence.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../lib/supabase/database.types.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL(
          "../supabase/migrations/20260729000000_initial_persistence.sql",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(new URL("../.env.example", import.meta.url), "utf8"),
      readFile(new URL("../supabase/config.toml", import.meta.url), "utf8"),
    ]);

  assert.match(map, /loadPlayerSnapshot/);
  assert.match(map, /saveLastLocation/);
  assert.match(map, /isPersistedScreen/);
  assert.match(client, /NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(client, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(client, /SECRET|SERVICE_ROLE/);
  assert.doesNotMatch(persistence, /signInAnonymously/);
  assert.match(persistence, /signInWithPassword/);
  assert.match(persistence, /auth\.signUp/);
  assert.match(persistence, /PersistedLocation/);
  assert.match(persistence, /saveTurtleProfile/);
  assert.match(databaseTypes, /activity_progress/);
  assert.match(databaseTypes, /inventory_items/);
  assert.match(migration, /create table public\.profiles/);
  assert.match(migration, /create table public\.player_states/);
  assert.match(migration, /create table public\.apartments/);
  assert.match(migration, /create table public\.wallets/);
  assert.match(migration, /create table public\.inventory_items/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /grant select, update on public\.player_states/);
  assert.match(migration, /grant select on public\.wallets/);
  assert.doesNotMatch(migration, /grant .*update on public\.wallets/);
  assert.doesNotMatch(migration, /grant .*update on public\.inventory_items/);
  assert.match(environment, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(environment, /SECRET|SERVICE_ROLE/);
  assert.match(config, /enable_anonymous_sign_ins = false/);
  assert.match(config, /enable_confirmations = false/);
  assert.doesNotMatch(persistence, /playerSessionPromise/);
  assert.match(persistence, /Your session has expired\. Sign in again\./);
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
  assert.match(shoveling, /turtleImageSrc/);
  assert.match(shoveling, /requestAnimationFrame/);
  assert.match(shoveling, /WASD/);
  assert.match(styles, /\.shoveling-stage/);
  assert.match(styles, /\.shoveling-scoreboard/);
  assert.match(styles, /\.shoveling-start-card/);
  assert.match(styles, /\.shovel-load/);
  assert.match(styles, /\.shoveling-coach/);
});
