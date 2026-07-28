# Turtle City — Founding Product Plan

Status: Working brief for product discovery and the first playable

## Product

Turtle City is a browser-based, multiplayer social game in which players are
turtles living in a playful, compressed version of New York City. Players
explore recognizable neighborhoods, meet other turtles, complete short civic
jobs and activities, earn rewards, customize their turtle, and improve their
apartment.

The game may share broad social-world conventions with Club Penguin, but its
setting, art, characters, writing, activities, and identity should be original.
It is aimed first at adults ages 20–40: post-college city dwellers, people
nostalgic for social games, and parents who may eventually share the world with
their families. The tone should feel funny, energetic, welcoming, and
unmistakably inspired by New York.

The city itself is mostly normal: recognizable streets, cars, apartments,
parks, transit, and city jobs. The parody comes from turtles living ordinary New
York lives. Shops, food, dialogue, and details can use turtle jokes—for example,
a corner store selling lettuce—without turning the entire environment into a
fantasy habitat.

### Experience principles

- Make the city recognizable without reproducing Manhattan at literal scale.
- Let a new player become a turtle and start moving in under two minutes.
- Favor short, tactile activities that are satisfying to repeat.
- Make social interaction safe and useful from the first public test.
- Use illustrated 2.5D rooms with strong compositions instead of literal-scale
  city blocks or expensive real-time 3D.
- Sell expression and personalization, never power or access to fair play.
- Build one delightful neighborhood before attempting an entire city.

## Core loop

1. Explore a neighborhood and meet players or characters.
2. Discover an activity entrance, point of interest, or destination.
3. Enter a self-contained activity and play it for two to five minutes.
4. Return to the neighborhood and continue exploring.
5. Later, earn Shells or collectibles and customize the turtle or apartment.
6. Travel, meet other turtles, and choose the next activity.

**Economy:** Shells are earned through play and pay for normal cosmetics and
furniture. Real-money items can be introduced later as direct, clearly priced
purchases. The initial release should avoid loot boxes, trading, and a premium
currency; those systems create complexity before the game has proven that it is
fun. The first prototype does not persist activity results, scores, rewards,
progression, or character advancement. Activities can show session-only
feedback, but closing the game resets it.

## World

The map should use the long north-south shape and broad relationships of
Manhattan while compressing each district into a small set of memorable,
illustrated 2.5D rooms. Rooms use a fixed or tightly controlled camera,
foreground/background layering, depth sorting, and simple walkable areas to
create dimensionality without building a true 3D world. A transit map connects
districts; the player does not need to walk every street between them.

| District | Landmark or identity | Candidate activities |
| --- | --- | --- |
| FiDi | One World Trade-inspired skyline | Street cleanup, deliveries |
| Chelsea | Flatiron-inspired building | Pressure washing, shopping |
| West Village | Jazz cellar, West Side waterfront | Music activity, biking |
| Central Park | Winter park, rink, and sledding hill | Ice skating, sledding, snow shoveling |
| Midtown | Times Square and Empire State-inspired skyline | Social hub, cleanup |
| East Village / LES | East River park construction | Excavator, trash pickup |

Later expansion can add the Upper West Side, Upper East Side, Harlem,
Williamsburg, Downtown Brooklyn, Brooklyn Heights, Cobble Hill, Park Slope, and
Bushwick.

Real landmarks can guide shape and atmosphere, but the shipped world should use
stylized art and mostly fictional businesses. Names and likenesses should be
reviewed before commercial release, especially for privately owned venues.

## Recommended first playable

Start in **Central Park in winter**. It is immediately recognizable, visually
contained, and supports three activities that feel different while sharing the
same snow-and-ice art set. The district can eventually contain a rink/plaza
room, a sledding hill, a snowy path, a food kiosk, and a subway entrance.

The first playable should include:

- One polished 2.5D rink/plaza room with movement, walkable boundaries,
  foreground occlusion, depth sorting, and 12–20 players per instance.
- A turtle creator with a small set of colors, shells, and accessories.
- Guest preview for movement, plus email magic-link and Google sign-in for
  saved progress and public chat.
- Keyboard movement using WASD or arrow keys.
- One simple, polished job: clearing snow from marked sections of a path.
- A skating mode with different acceleration, turning, and stopping on the
  rink. Treat sledding as the next activity after these systems are stable.
- Clearly marked activity entrances that move the player from the explorable
  room into a self-contained game, then return them to the room afterward.
- Session-only activity completion feedback with no leaderboard, progression,
  inventory, or database writes.
- A subway map with the current stop and visible “coming soon” destinations.
- Open text chat for authenticated players, plus emotes.
- Player mute/block/report, automated filtering, rate limits, moderation logs,
  an admin review queue, analytics, and crash reporting.

The Central Park district is complete for private alpha when skating, shoveling,
and sledding all work. Midtown should be the second district. Connecting it by
subway proves the multi-district and transit model before more of Manhattan is
built. Buses and Citi Bikes can initially be alternate travel animations over
the same destination system rather than three separate simulations.

## Technical direction

The proposed stack is a good fit:

```text
Next.js + React + TypeScript (Vercel)
  Marketing site, authentication, profile, catalog, apartment UI
  Phaser client mounted inside the game route

Colyseus + Node.js + TypeScript (Railway)
  District and apartment rooms, authoritative movement and activity state
  Reward validation, inventory grants, presence and room matchmaking

Supabase
  Postgres, Auth, Storage, row-level security
  Profiles, inventory, apartments, friends, entitlements and moderation data
```

Use a monorepo with `apps/web`, `apps/game-server`, and `packages/shared`. Shared
packages should hold network messages, item definitions, validation schemas,
and game constants so the client and server cannot silently disagree.

Desktop browser is the first supported platform, but gameplay code should not
depend directly on browser-only UI. Keep input, authentication, storage,
payments, and platform services behind small adapters; use scalable canvas
layouts and asset-resolution tiers. This leaves a practical path to a mobile
wrapper such as Capacitor and a desktop-store wrapper such as Tauri or Electron.
Touch controls, app-store identity, and store payments would still require
dedicated later work.

### Important boundaries

- The browser sends player intent; the Colyseus server decides valid movement,
  job completion, and rewards.
- The server verifies the Supabase identity token before admitting a player to
  a room.
- Only durable state is stored in Postgres. Frame-by-frame positions stay in
  memory and are saved only when needed.
- Purchases eventually use a server-verified payment webhook and idempotent,
  append-only entitlement records. The client never grants an item to itself.
- Supabase row-level security protects player-owned records; privileged keys
  remain on servers.
- Districts are separate, capacity-limited rooms that can be instanced when
  full. Friends should preferentially join the same instance.
- Public chat is available only to authenticated accounts configured for the
  final all-ages safety policy. Messages are filtered and rate-limited before
  broadcast, then retained for a defined moderation window with access controls
  and audit logs.
- Activity results remain in the current game session until persistent
  progression is intentionally introduced. Do not create placeholder database
  writes that will become accidental product behavior.

Initial data domains are: users/profiles, turtle appearance, items/catalog,
inventory/equipment, currencies/ledger, apartments/furniture placements,
activities/completions, friends/blocks/mutes, room presence, chat/moderation
records, purchases/entitlements, and player reports.

## Delivery sequence

1. **Discovery and feel:** decide controls, exact age policy, room composition,
   and art direction; build a gray-box Central Park movement test before
   producing final world art.
2. **Foundation:** monorepo, deployment environments, authentication, shared
   protocol, database migrations, logging, open-chat safety systems, and a basic
   admin view.
3. **Vertical slice:** Central Park rink/plaza, keyboard exploration, enterable
   snow-shoveling activity, skating, open chat, and transit-map shell. Activity
   results are session-only.
4. **Private alpha:** improve onboarding and performance from playtests; add
   sledding, apartments, inventory, and a small Midtown room connected by
   subway.
5. **Public test:** friends, stronger moderation tools, more catalog content,
   events, and economy balancing.
6. **Commercial release:** real-money checkout only after retention and safety
   are healthy; then expand activities and districts one at a time.

Large-scale Manhattan, player trading, user-generated content, native mobile
apps, real-money purchases, and elaborate vehicle simulations are intentionally
outside the first playable.

## Confirmed decisions

- The target audience is adults ages 20–40, especially post-college city
  dwellers and parents, but players of any age may join.
- The first supported platform is desktop web, with clean boundaries that make
  later mobile and desktop-store packaging possible.
- The world is made from illustrated 2.5D rooms.
- Turtles move with standard desktop controls: WASD or arrow keys.
- Each room uses a fixed camera composition.
- Central Park in winter is the first district, featuring skating, sledding, and
  snow shoveling. Central Park is always winter; other districts can have their
  own permanent or seasonal weather.
- Authenticated players can use open text chat.
- The setting directly parodies New York through a mostly normal city inhabited
  by turtles, with turtle-themed stores, food, dialogue, and visual jokes.
- The city uses original art, fictional businesses, generic city infrastructure,
  and recognizable geographic cues without reproducing protected logos,
  characters, private brands, or distinctive commercial designs.
- Players explore neighborhood rooms and enter activities as separate games.
  Activity results and progression are not persisted in the first version.
- Monetization is deferred until the core game and retention are proven.

## Remaining decisions

1. **All-ages operations:** Because any age can join and open chat is planned,
   determine the required age checks, parental-consent flows, default privacy,
   moderation staffing, and data handling with specialist review before a
   public launch.
2. **Activity presentation:** Decide whether activities replace the room as a
   new full-screen scene or appear inside a focused overlay. Full scenes are the
   working assumption.
3. **Initial identity:** Decide whether the first private test uses temporary
   guest names or requires email/Google sign-in. Public chat should require an
   authenticated identity even when exploration does not.

## Immediate next steps

1. Define an all-ages safety and privacy policy before inviting the public. This
   does not block a local or tightly controlled prototype.
2. Make a one-page first-playable specification defining the rink/plaza room,
   its exits, walkable zones, player count, shoveling loop, and skating feel.
3. Create a rough visual concept for the room and turtle, including front,
   back, side, walking, and skating views. Keep it sketch-level until movement
   works.
4. Scaffold the monorepo and a local Next.js + Phaser game route, with shared
   TypeScript packages but no database or store yet.
5. Build a gray-box prototype in which one turtle moves with WASD or arrow keys,
   passes behind and in front of scenery, transitions onto the ice, and enters
   and exits the shoveling activity.
6. Add Colyseus and confirm that two browser windows can join the same room and
   see smooth, server-validated movement.
7. Add Supabase authentication and the minimum open-chat safety set: filtered
   display names, filtering, rate limits, mute/block/report, retention, and an
   admin review screen.
8. Add session-only completion feedback to the shoveling activity, then add the
   skating challenge. Only after that loop feels good should production art,
   persistence, apartments, inventory, and sledding expand the slice.
