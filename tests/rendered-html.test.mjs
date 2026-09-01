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
  assert.match(auth, /Forgot your password\?/);
  assert.match(auth, /Send reset email/);
  assert.match(map, /onPlayerPasswordRecovery/);
  assert.match(map, /updatePlayerPassword/);
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
  assert.match(persistence, /resetPasswordForEmail/);
  assert.match(persistence, /auth\.updateUser\(\{ password \}\)/);
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
    readFile(new URL("../app/InteriorScenes3D.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ChelseaDistrict3D.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/OtherDistricts3D.tsx", import.meta.url), "utf8"),
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
  assert.match(apartment, /TurtleBillboard/);
  assert.match(district, /TurtleBillboard/);
  assert.match(park, /CentralParkDistrict3D/);
  assert.match(pressureWashing, /className="turtle-nameplate"/);
  assert.match(hockey, /strokeText\(turtleName/);
  assert.match(shoveling, /TurtleBillboard/);
  assert.match(styles, /\.turtle-nameplate/);
  assert.match(styles, /bottom: calc\(100% \+ 5px\)/);
  assert.match(styles, /\.map-toolbar/);
  assert.match(styles, /\.map-logout/);
  assert.match(styles, /\.logout-dialog/);
});

test("the map has focus interactions without game dependencies", async () => {
  const [map, park, styles, packageJson, turtleCharacter] = await Promise.all([
    readFile(new URL("../app/CityMap.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/OtherDistricts3D.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../public/assets/turtles/clover.png", import.meta.url)),
  ]);

  assert.match(map, /setSelectedId\(district\.id\)/);
  assert.match(map, /setSelectedId\(null\)/);
  assert.match(map, /setScreen\("central-park"\)/);
  assert.match(map, /event\.key === "Escape"/);
  assert.match(park, /CentralParkDistrict3D/);
  assert.match(park, /districtId="central-park"/);
  assert.match(park, /Snow Crew/);
  assert.match(park, /Frozen Pond/);
  assert.match(park, /South Gate Station/);
  assert.match(park, /onEnterHockey/);
  assert.match(park, /onEnterShoveling/);
  assert.match(park, /onEnterSubway/);
  assert.match(park, /spawnPositions/);
  assert.match(styles, /assets\/turtles\/clover\.png/);
  assert.doesNotMatch(styles, /turtle-rig|is-walking|@keyframes turtle-walk/);
  assert.ok(turtleCharacter.length > 100_000);
  assert.equal(turtleCharacter.subarray(1, 4).toString("ascii"), "PNG");
  assert.match(styles, /--manhattan-shape:/);
  assert.match(styles, /\.district-fidi[\s\S]*68% 94%[\s\S]*37% 98%/);
  assert.doesNotMatch(styles, /52% 100%/);
  assert.match(packageJson, /@supabase\/supabase-js/);
  assert.doesNotMatch(packageJson, /phaser|drizzle/i);
});

test("the subway map is directly available underground", async () => {
  const [map, styles] = await Promise.all([
    readFile(new URL("../app/CityMap.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(map, /screen === "subway-platform" \|\| screen === "subway-train"/);
  assert.match(map, /aria-label="Expand subway map"/);
  assert.match(map, /className="subway-mini-map"/);
  assert.match(map, /oneLineStops\.filter\(\(stop\) => stop\.district\)/);
  assert.match(styles, /\.subway-mini-map/);
  assert.match(styles, /\.subway-mini-route/);
});

test("Chelsea connects the starter apartment, street, and subway", async () => {
  const [map, district, apartment, styles] = await Promise.all([
    readFile(new URL("../app/CityMap.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ChelseaDistrict3D.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/InteriorScenes3D.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(map, /useState<Screen>\("apartment"\)/);
  assert.match(map, /<ChelseaApartment3D/);
  assert.match(map, /<ChelseaDistrict3D/);
  assert.match(map, /openWorldMap/);
  assert.match(map, /enterSubway\("chelsea"\)/);
  assert.match(district, /data-testid="chelsea-district-3d"/);
  assert.match(district, /West 22 Apartments/);
  assert.match(district, /onEnterApartment/);
  assert.match(district, /onEnterPressureWashing/);
  assert.match(district, /Chelsea Wash Crew/);
  assert.match(district, /"pressure-washing": \[-17, 0, -4\]/);
  assert.match(district, /subway: \[20, 0, 6\.4\]/);
  assert.match(district, /West 23 Street/);
  assert.match(district, /onEnterSubway/);
  assert.match(district, /TurtleBillboard/);
  assert.match(apartment, /data-testid="chelsea-apartment-3d"/);
  assert.match(apartment, /Apartment 4B/);
  assert.match(apartment, /TurtleBillboard/);
  assert.match(apartment, /onExitToChelsea/);
  assert.match(apartment, /moveWithCollisions/);
  assert.doesNotMatch(apartment, /City map|onOpenMap/);
  assert.match(styles, /\.chelsea-stage/);
  assert.match(styles, /\.chelsea-apartment-building/);
  assert.match(styles, /\.apartment-stage/);
  assert.match(styles, /\.apartment-room/);
  assert.match(styles, /assets\/turtles\/clover\.png/);
});

test("West Village connects its streets, music venue, and Hudson waterfront", async () => {
  const [
    map,
    village,
    bikeRace,
    jazzClub,
    rhythmGame,
    persistence,
    migration,
    styles,
  ] =
    await Promise.all([
    readFile(new URL("../app/CityMap.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/OtherDistricts3D.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/BikeRaceGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/JazzClub.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/RhythmGame.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../lib/persistence/playerPersistence.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../supabase/migrations/20260729030000_west_village_location.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    ]);

  assert.match(map, /WestVillageDistrict3D/);
  assert.match(map, /import \{ BikeRaceGame \}/);
  assert.match(map, /import \{ JazzClub \}/);
  assert.match(map, /import \{ RhythmGame \}/);
  assert.match(map, /screen === "west-village"/);
  assert.match(map, /screen === "bike-race"/);
  assert.match(map, /screen === "jazz-club"/);
  assert.match(map, /screen === "rhythm-game"/);
  assert.match(map, /setWestVillageSpawn\("waterfront"\)/);
  assert.match(map, /setWestVillageSpawn\("jazz-club"\)/);
  assert.match(map, /enterSubway\("west-village"\)/);
  assert.match(village, /districtId="west-village"/);
  assert.match(village, /The Cellar Note/);
  assert.match(village, /Hudson Greenway/);
  assert.match(village, /onEnterBikeRace/);
  assert.match(village, /onEnterJazzClub/);
  assert.match(village, /spawnPositions/);
  assert.match(village, /West 4 Street/);
  assert.match(village, /onEnterSubway/);
  assert.doesNotMatch(village, /City map|onOpenMap/);
  assert.match(persistence, /\| "west-village";/);
  assert.match(migration, /last_location in/);
  assert.match(migration, /'west-village'/);
  assert.match(styles, /\.village-stage/);
  assert.match(styles, /\.village-jazz-club/);
  assert.match(styles, /\.village-jazz-zone/);
  assert.match(styles, /\.village-waterfront/);
  assert.match(styles, /\.village-greenway/);
  assert.match(styles, /\.bike-race-stage/);
  assert.match(styles, /\.bike-race-canvas/);
  assert.match(styles, /\.bike-finish-label/);
  assert.match(bikeRace, /data-testid="bike-race-game"/);
  assert.match(bikeRace, /<Canvas/);
  assert.match(bikeRace, /BikeRaceWorld/);
  assert.match(bikeRace, /TurtleBillboard/);
  assert.match(bikeRace, /useBikeRaceMultiplayer/);
  assert.match(bikeRace, /Multiplayer/);
  assert.match(bikeRace, /const COURSE_LENGTH = 6200/);
  assert.match(bikeRace, /Use W\/S or ↑\/↓ to change lanes/);
  assert.match(bikeRace, /event\.code === "Space"/);
  assert.match(bikeRace, /requestAnimationFrame/);
  assert.match(bikeRace, /Return to West Village/);
  assert.match(jazzClub, /data-testid="jazz-club"/);
  assert.match(jazzClub, /OPEN SHELL SESSION/);
  assert.match(jazzClub, /Play the set/);
  assert.match(jazzClub, /className="turtle-nameplate"/);
  assert.match(rhythmGame, /data-testid="rhythm-game"/);
  assert.match(rhythmGame, /const LANE_KEYS = \["a", "s", "d", "f", "g"\]/);
  assert.match(rhythmGame, /new AudioContext/);
  assert.match(rhythmGame, /PERFECT/);
  assert.match(rhythmGame, /requestAnimationFrame/);
  assert.match(rhythmGame, /Start the set/);
  assert.match(styles, /\.jazz-club-stage/);
  assert.match(styles, /\.rhythm-stage/);
  assert.match(styles, /\.rhythm-board/);
  assert.match(styles, /\.rhythm-note/);
});

test("Midtown connects its night streets, subway, and two activities", async () => {
  const [
    map,
    district,
    fallingItems,
    trashPickup,
    persistence,
    migration,
    subway,
    train,
    styles,
  ] = await Promise.all([
    readFile(new URL("../app/CityMap.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/OtherDistricts3D.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/FallingItemsGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/TrashPickupGame.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../lib/persistence/playerPersistence.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../supabase/migrations/20260824000000_midtown_location.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../lib/world/subway.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/InteriorScenes3D.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(map, /<MidtownDistrict/);
  assert.match(map, /screen === "midtown"/);
  assert.match(map, /screen === "falling-items"/);
  assert.match(map, /screen === "trash-pickup"/);
  assert.match(map, /enterSubway\("midtown"\)/);
  assert.match(map, /setMidtownSpawn\("falling-items"\)/);
  assert.match(map, /setMidtownSpawn\("trash-pickup"\)/);
  assert.match(district, /districtId="midtown"/);
  assert.match(district, /Look Out Below/);
  assert.match(district, /Crossroads Cleanup/);
  assert.match(district, /Turtle Square Station/);
  assert.match(fallingItems, /data-testid="falling-items-game"/);
  assert.match(fallingItems, /const CHALLENGE_LENGTH = 45/);
  assert.match(fallingItems, /state\.lives -= 1/);
  assert.match(fallingItems, /requestAnimationFrame/);
  assert.match(trashPickup, /data-testid="trash-pickup-game"/);
  assert.match(trashPickup, /<Canvas/);
  assert.match(trashPickup, /CleanupWorld/);
  assert.match(trashPickup, /TurtleBillboard/);
  assert.match(trashPickup, /const SHIFT_LENGTH = 60/);
  assert.match(trashPickup, /event\.code === "Space"/);
  assert.match(trashPickup, /state\.collected\.add/);
  assert.match(trashPickup, /requestAnimationFrame/);
  assert.match(persistence, /\| "midtown"/);
  assert.match(migration, /'midtown'/);
  assert.match(subway, /id: "midtown-times-square"/);
  assert.match(train, /Next stop/);
  assert.match(styles, /\.midtown-stage/);
  assert.match(styles, /\.falling-game-stage/);
  assert.match(styles, /\.trash-game-stage/);
});

test("FiDi connects the harbor, subway, multiplayer, and delivery route", async () => {
  const [
    map,
    district,
    delivery,
    persistence,
    migration,
    subway,
    train,
    styles,
  ] = await Promise.all([
    readFile(new URL("../app/CityMap.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/OtherDistricts3D.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ShellExpressGame.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../lib/persistence/playerPersistence.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../supabase/migrations/20260825000000_fidi_location.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../lib/world/subway.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/InteriorScenes3D.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(map, /<FidiDistrict/);
  assert.match(map, /screen === "fidi"/);
  assert.match(map, /screen === "shell-express"/);
  assert.match(map, /enterSubway\("fidi"\)/);
  assert.match(map, /setFidiSpawn\("delivery"\)/);
  assert.match(district, /districtId="fidi"/);
  assert.match(district, /Shell Express/);
  assert.match(district, /Fulton Street/);
  assert.match(delivery, /data-testid="shell-express-game"/);
  assert.match(delivery, /<Canvas/);
  assert.match(delivery, /DeliveryWorld/);
  assert.match(delivery, /TurtleBillboard/);
  assert.match(delivery, /useDeliveryMultiplayer/);
  assert.match(delivery, /Online dispatch/);
  assert.match(delivery, /const ROUTE_TIME = 60/);
  assert.match(delivery, /const DELIVERY_TARGET = 6/);
  assert.match(delivery, /state\.cargo = Math\.min/);
  assert.match(delivery, /state\.delivered \+= state\.cargo/);
  assert.match(delivery, /requestAnimationFrame/);
  assert.match(persistence, /\| "fidi"/);
  assert.match(migration, /'fidi'/);
  assert.match(subway, /id: "fidi-fulton"/);
  assert.match(train, /Exit train/);
  assert.match(styles, /\.fidi-stage/);
  assert.match(styles, /\.shell-express-stage/);
  assert.match(styles, /\.shell-express-canvas/);
  assert.match(styles, /\.delivery-drop-label/);
});

test("East Village connects its district, excavator shift, persistence, and apartment economy", async () => {
  const [map, districts, excavator, multiplayer, persistence, locationMigration, storeMigration, apartment] = await Promise.all([
    readFile(new URL("../app/CityMap.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/OtherDistricts3D.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ExcavatorGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/multiplayer/districts.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/persistence/playerPersistence.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260831000000_east_village_location.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260831010000_apartment_upgrade_store.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/InteriorScenes3D.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(map, /<EastVillageLesDistrict3D/);
  assert.match(map, /screen === "excavator"/);
  assert.match(districts, /districtId="east-village-les"/);
  assert.match(districts, /East River Works/);
  assert.match(excavator, /data-testid="excavator-game"/);
  assert.match(excavator, /const ROCKS/);
  assert.match(multiplayer, /roomName: "east_village_les"/);
  assert.match(persistence, /purchaseApartmentUpgrade/);
  assert.match(locationMigration, /'east-village-les'/);
  assert.match(storeMigration, /purchase_apartment_upgrade/);
  assert.match(storeMigration, /security definer/);
  assert.match(storeMigration, /revoke all on function public\.purchase_apartment_upgrade\(text\) from public/);
  assert.match(storeMigration, /grant execute on function public\.purchase_apartment_upgrade\(text\) to authenticated/);
  assert.match(persistence, /Number\.isSafeInteger\(shells\)/);
  assert.match(apartment, /Warm Lighting/);
  assert.match(apartment, /Fresh Walls/);
  assert.match(apartment, /Comfy Bed/);
});

test("outdoor districts have authenticated shared multiplayer presence", async () => {
  const [
    park,
    chelsea,
    players,
    districts,
    hook,
    schema,
    room,
    server,
    persistence,
    packageJson,
    styles,
  ] =
    await Promise.all([
      readFile(new URL("../app/OutdoorDistrict3D.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/ChelseaDistrict3D.tsx", import.meta.url), "utf8"),
      readFile(
        new URL("../app/MultiplayerDistrictPlayers.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../lib/multiplayer/districts.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL(
          "../lib/multiplayer/useDistrictMultiplayer.ts",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL("../lib/multiplayer/schema.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../server/DistrictRoom.ts", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../server/index.ts", import.meta.url), "utf8"),
      readFile(
        new URL("../lib/persistence/playerPersistence.ts", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../package.json", import.meta.url), "utf8"),
      readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    ]);

  assert.match(park, /useDistrictMultiplayer\(props\.districtId, props\.spawn\)/);
  assert.match(chelsea, /useDistrictMultiplayer\("chelsea", props\.spawn\)/);
  assert.match(park, /RemotePlayers/);
  assert.match(chelsea, /RemotePlayers/);
  assert.match(chelsea, /riding, x: toNetworkX/);
  assert.match(chelsea, /name="remote-skateboard"/);
  assert.match(players, /className="district-remote-player"/);
  assert.match(players, /DistrictLiveStatus/);
  assert.match(park, /remoteTargetsRef/);
  assert.match(chelsea, /remoteTargetsRef/);
  assert.match(park, /sendMovement/);
  assert.match(chelsea, /sendMovement/);
  assert.match(hook, /client\.auth\.token = accessToken/);
  assert.match(hook, /joinOrCreate\(/);
  assert.match(hook, /Callbacks\.get\(room\)/);
  assert.match(hook, /callbacks\.onAdd/);
  assert.match(hook, /callbacks\.onChange/);
  assert.match(hook, /callbacks\.onRemove/);
  assert.match(schema, /class DistrictPlayer extends Schema/);
  assert.match(schema, /riding = false/);
  assert.match(schema, /players = new MapSchema/);
  assert.match(districts, /roomName: "central_park"/);
  assert.match(districts, /roomName: "chelsea"/);
  assert.match(districts, /roomName: "fidi"/);
  assert.match(districts, /roomName: "midtown"/);
  assert.match(districts, /roomName: "west_village"/);
  assert.match(room, /maxClients = 20/);
  assert.match(room, /authenticatePlayer\(context\.token\)/);
  assert.match(room, /elapsedMilliseconds < 40/);
  assert.match(room, /requestedX/);
  assert.match(room, /requestedY/);
  assert.match(room, /player\.riding = message\.riding/);
  assert.match(room, /this\.state\.players\.delete/);
  assert.match(server, /central_park: defineRoom\(CentralParkRoom\)/);
  assert.match(server, /chelsea: defineRoom\(ChelseaRoom\)/);
  assert.match(server, /fidi: defineRoom\(FidiRoom\)/);
  assert.match(server, /midtown: defineRoom\(MidtownRoom\)/);
  assert.match(server, /west_village: defineRoom\(WestVillageRoom\)/);
  assert.match(server, /TURTLE_CITY_WEB_ORIGIN/);
  assert.match(server, /\/health/);
  assert.match(persistence, /getPlayerAccessToken/);
  assert.match(packageJson, /"@colyseus\/sdk"/);
  assert.match(packageJson, /"@colyseus\/core"/);
  assert.match(packageJson, /"@colyseus\/ws-transport"/);
  assert.match(packageJson, /"multiplayer:dev"/);
  assert.match(packageJson, /"multiplayer:build"/);
  assert.match(styles, /\.district-remote-player/);
  assert.match(styles, /\.district-live-status/);
  assert.match(
    styles,
    /\.district-live-status\s*\{[^}]*top:\s*calc\(clamp\(18px, 3vh, 34px\) \+ 52px\)/s,
  );
});

test("hockey has a reusable server-authoritative multiplayer match", async () => {
  const [server, room, lifecycle, schema, auth, hook] = await Promise.all([
    readFile(new URL("../server/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../server/HockeyRoom.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/multiplayer/matchLifecycle.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/multiplayer/hockeySchema.ts", import.meta.url), "utf8"),
    readFile(new URL("../server/playerAuth.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/multiplayer/useHockeyMultiplayer.ts", import.meta.url), "utf8"),
  ]);

  assert.match(server, /hockey: defineRoom\(HockeyRoom\)/);
  assert.match(room, /class HockeyRoom extends Room/);
  assert.match(room, /maxClients = 6/);
  assert.match(room, /authenticatePlayer\(context\.token\)/);
  assert.match(room, /setSimulationInterval/);
  assert.match(room, /message\.sequence/);
  assert.match(room, /beginCountdown/);
  assert.match(room, /beginGoalPause/);
  assert.match(room, /OVERTIME_LENGTH/);
  assert.match(room, /this\.score\("home"\)/);
  assert.match(room, /this\.score\("away"\)/);
  assert.match(room, /rematch/);
  assert.match(lifecycle, /type MatchPhase/);
  assert.match(lifecycle, /tickMatchLifecycle/);
  assert.match(schema, /class HockeyMatchState extends Schema/);
  assert.match(schema, /players = new MapSchema/);
  assert.match(schema, /homeScore/);
  assert.match(auth, /authClient\.auth\.getUser\(token\)/);
  assert.match(hook, /joinOrCreate\("hockey"/);
  assert.match(hook, /room\.onStateChange/);
  assert.match(hook, /send\("ready"\)/);
  assert.match(hook, /send\("input"/);
  assert.match(hook, /sequenceRef\.current \+= 1/);
  assert.match(hook, /send\("rematch"\)/);
});

test("the map is universally viewable but subway travel stays onboard-only", async () => {
  const [map, park, platform, train, subway, apartment, district, village] =
    await Promise.all([
      readFile(new URL("../app/CityMap.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/OtherDistricts3D.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/InteriorScenes3D.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/InteriorScenes3D.tsx", import.meta.url), "utf8"),
      readFile(new URL("../lib/world/subway.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/InteriorScenes3D.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/ChelseaDistrict3D.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/OtherDistricts3D.tsx", import.meta.url), "utf8"),
    ]);

  assert.match(map, /screen === "subway-platform"/);
  assert.match(map, /screen === "subway-train"/);
  assert.match(map, /<SubwayPlatform3D/);
  assert.match(map, /<SubwayTrain3D/);
  assert.match(map, /onExitAtStop={arriveInDistrict}/);
  assert.equal([...map.matchAll(/setScreen\("city"\)/g)].length, 1);
  assert.match(map, /subwayDirection/);
  assert.doesNotMatch(map, /subway-map-line-one/);
  assert.match(map, /subway-mini-route/);
  assert.match(map, /View only — enter a subway station to travel/);
  assert.match(map, /className="universal-settings-button"/);
  assert.match(map, /Keyboard commands/);
  assert.match(map, /arriveInDistrict/);
  assert.match(platform, /data-testid="subway-platform-3d"/);
  assert.match(platform, /FIRST_ARRIVAL_TIME = 1/);
  assert.match(platform, /phase === "boarding"/);
  assert.match(platform, /PlatformTrain/);
  assert.match(platform, /onBoard/);
  assert.match(train, /data-testid="subway-train-3d"/);
  assert.match(train, /oneLineStops\.map/);
  assert.match(train, /setStopIndex/);
  assert.match(train, /doorsOpen/);
  assert.match(train, /onExitAtStop/);
  assert.match(train, /TrainCar/);
  assert.match(subway, /central-park/);
  assert.match(subway, /west-village/);
  assert.match(subway, /chelsea/);
  assert.match(park, /id: "south-gate"/);
  assert.match(park, /onEnterSubway/);
  assert.doesNotMatch(park, /City map|onReturnToCity/);
  assert.doesNotMatch(apartment, /City map|onOpenMap/);
  assert.doesNotMatch(district, /City map|onOpenMap/);
  assert.doesNotMatch(village, /City map|onOpenMap/);
  assert.match(train, /train-route-card/);
});

test("Chelsea pressure washing clears a facade in a session-only shift", async () => {
  const [map, district, pressureWashing, styles] = await Promise.all([
    readFile(new URL("../app/CityMap.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ChelseaDistrict3D.tsx", import.meta.url), "utf8"),
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
  assert.match(pressureWashing, /const SHIFT_LENGTH = 90/);
  assert.match(pressureWashing, /const CLEAN_TARGET = 100/);
  assert.match(pressureWashing, /const SPRAY_RADIUS = 74/);
  assert.match(pressureWashing, /state\.dirt\.size === 0/);
  assert.match(pressureWashing, /Overtime — keep washing/);
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
    readFile(new URL("../app/OtherDistricts3D.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/HockeyGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(map, /setScreen\("hockey"\)/);
  assert.match(map, /<HockeyGame/);
  assert.match(park, /onEnterHockey/);
  assert.match(park, /frozen-pond/);
  assert.match(hockey, /data-testid="hockey-game"/);
  assert.match(hockey, /const MATCH_LENGTH = 90/);
  assert.match(hockey, /const COUNTDOWN_LENGTH = 3/);
  assert.match(hockey, /const FIXED_STEP = 1 \/ 120/);
  assert.match(hockey, /const OVERTIME_LENGTH = 30/);
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
  assert.match(hockey, /event\.code === "KeyP"/);
  assert.match(hockey, /hockey-countdown/);
  assert.match(hockey, /hockey-stats/);
  assert.match(hockey, /stats\[player\.team\]\.shots \+= 1/);
  assert.match(hockey, /stats\[player\.team\]\.saves \+= 1/);
  assert.match(hockey, /drawPuckTrail/);
  assert.match(hockey, /hockey-goal-flash/);
  assert.match(hockey, /hockey-result-stats/);
  assert.match(hockey, /game\.period = "overtime"/);
  assert.match(hockey, /AudioContext/);
  assert.match(hockey, /pauseForLostFocus/);
  assert.match(hockey, /queueAction/);
  assert.match(hockey, /context\.lineTo\(57, 12\)/);
  assert.match(hockey, /awardGoal/);
  assert.match(hockey, /requestAnimationFrame/);
  assert.match(hockey, /2 skaters \+ G/);
  assert.match(styles, /\.hockey-stage/);
  assert.match(styles, /\.hockey-scoreboard/);
  assert.match(styles, /\.hockey-start-card/);
  assert.match(styles, /\.hockey-countdown/);
  assert.match(styles, /\.hockey-stats/);
  assert.match(styles, /\.hockey-goal-flash/);
  assert.match(styles, /\.hockey-result-stats/);
});

test("snow shoveling clears the Snow Crew paths in a session-only shift", async () => {
  const [map, park, shoveling, styles] = await Promise.all([
    readFile(new URL("../app/CityMap.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/OtherDistricts3D.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/SnowShovelingGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(map, /setScreen\("snow-shoveling"\)/);
  assert.match(map, /<SnowShovelingGame/);
  assert.match(park, /onEnterShoveling/);
  assert.match(park, /snow-crew/);
  assert.match(shoveling, /data-testid="snow-shoveling-game"/);
  assert.match(shoveling, /<Canvas/);
  assert.match(shoveling, /SnowField/);
  assert.match(shoveling, /InstancedMesh/);
  assert.match(shoveling, /const SHIFT_LENGTH = 90/);
  assert.match(shoveling, /const CLEAR_TARGET = 72/);
  assert.match(shoveling, /event\.code === "Space"/);
  assert.match(shoveling, /collectSnow/);
  assert.match(shoveling, /dumpShovel/);
  assert.match(shoveling, /refillSnowAt/);
  assert.match(shoveling, /turtleVariant/);
  assert.match(shoveling, /requestAnimationFrame/);
  assert.match(shoveling, /WASD/);
  assert.match(styles, /\.shoveling-stage/);
  assert.match(styles, /\.shoveling-scoreboard/);
  assert.match(styles, /\.shoveling-start-card/);
  assert.match(styles, /\.shovel-load/);
  assert.match(styles, /\.shoveling-coach/);
});
