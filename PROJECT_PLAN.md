# Turtle City — Founding Product Plan

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
- Present the game itself full-screen, without a surrounding website frame or
  persistent control instructions.
- Let players see the whole city, zoom into a district, and then explore that
  district beyond a single static room.
- Favor short, tactile activities that are satisfying to repeat.
- Make social interaction safe and useful from the first public test.
- Keep the generally successful illustrated palette and 2.5D city style, while
  redesigning the turtles separately.
- Prefer clarity over ambient decoration. Weather should be communicated by the
  environment; falling snow and similar effects are unnecessary by default.
- Sell expression and personalization, never power or access to fair play.
- Design the city structure first, then one district, then characters, and only
  then activities and game systems.

## Core loop

1. Start in the player’s apartment or the last location they occupied.
2. Explore the current area and meet players or characters.
3. Open the city map when choosing another district or destination.
4. Discover an activity entrance, point of interest, or destination.
5. Enter a self-contained activity and play it for two to five minutes.
6. Return to the neighborhood and continue exploring.
7. Later, earn Shells or collectibles and customize the turtle or apartment.

**Economy:** Shells are earned through play and pay for normal cosmetics and
furniture. Real-money items can be introduced later as direct, clearly priced
purchases. The initial release should avoid loot boxes, trading, and a premium
currency; those systems create complexity before the game has proven that it is
fun. The first prototype does not persist activity results, scores, rewards,
progression, or character advancement. Activities can show session-only
feedback, but closing the game resets it.

## World

The world has two connected navigation levels:

1. **City map:** a full-city overview using Manhattan’s long north-south shape
   and broad neighborhood relationships. The map is not the default starting
   screen; players open it from their apartment or current location, then pan,
   zoom, and select a district.
2. **District exploration:** zooming into a district reveals one continuous,
   scrollable environment. The camera follows the player as they move through
   paths, streets, landmarks, and activity entrances. The environment can be
   authored in connected sections and loaded in chunks, but those seams should
   not feel like separate social rooms.

Interiors, apartments, transit vehicles, and self-contained activities may
still use separate fixed-camera scenes. A transit layer connects distant
districts without requiring every intervening street to be built.

| District | Landmark or identity | Candidate activities |
| --- | --- | --- |
| FiDi | One World Trade-inspired skyline | Street cleanup, deliveries |
| Chelsea | Flatiron-inspired building | Pressure washing, shopping |
| West Village | Jazz cellar, West Side waterfront | Music activity, biking |
| Central Park | Winter park, pond-hockey rink, and maintenance yard | Pond hockey, snow shoveling, sledding later |
| Midtown | Times Square and Empire State-inspired skyline | Social hub, cleanup |
| East Village / LES | East River park construction | Excavator, trash pickup |

Later expansion can add the Upper West Side, Upper East Side, Harlem,
Williamsburg, Downtown Brooklyn, Brooklyn Heights, Cobble Hill, Park Slope, and
Bushwick.

Real landmarks can guide shape and atmosphere, but the shipped world should use
stylized art and mostly fictional businesses. Names and likenesses should be
reviewed before commercial release, especially for privately owned venues.

## World prototype

The first prototype contains the **full-screen city map**. It establishes:

- Manhattan’s overall silhouette and the relative location of the initial
  districts.
- A clear visual identity for each district using original, non-infringing city
  cues.
- A city overview and a district-focused zoom state.
- Minimal interface chrome so the map feels like the game, not a game embedded
  inside a webpage.
- A visual path for later expansion into other Manhattan and Brooklyn
  neighborhoods.

Selecting Central Park opens a continuous camera prototype. The first
north-to-south route is:

- **South Gate:** the initial transit edge and subway entrance.
- **South Slopes:** the starting sledding area.
- **Wooded paths:** the connective landscape through the center of the park.
- **Frozen Pond:** a larger northern destination for pond hockey.
- **Winter Walk and Snow Crew:** further exploration and a future shoveling
  activity.

The first player-character direction is an original, friendly upright turtle
with a large readable head, compact body, olive-green skin, warm yellow belly,
and brick-red shell. The current prototype uses one complete neutral character
sprite, mirrored for leftward travel. It intentionally has no walking animation
or separated body-part rig. Until collision boundaries are implemented, the
player is intentionally drawn above environment artwork so large landmarks
cannot hide it. Character animation and true foreground/background depth
sorting will be reconsidered only after the static character direction,
gameplay proportions, and collision geometry are approved.

Environment art uses an angled three-quarter perspective while movement and
collision coordinates remain top-down internally. The player can smoothly zoom
the camera within a limited range without changing the underlying world scale.
Districts use a consistent navigation grammar: a clear primary route connects
major destinations, smaller branches lead to activity entrances, and perimeter
gates connect to transit or neighboring streets. An activity’s interaction
zone is a small, intentional threshold beside its destination—not the entire
pond, hill, building, or landmark.

Central Park’s primary promenade runs north from South Gate, branches through
the South Slopes and woodland, loops around the Frozen Pond, and continues to
the north end. Secondary paths provide alternate short routes, while activity
spurs terminate at sledding, hockey, and Snow Crew entrances. West and east
gates visibly cross the sidewalk and avenue so the park feels embedded in the
city rather than sealed off from it.

Future city districts should use the same continuous camera and world-coordinate
model. Park paths become sidewalks and crosswalks; landscape masses become
building footprints; activity thresholds become storefront doors, stoops,
subway stairs, and lobby entrances. Buildings line the back edge of the
walkable street plane so players feel that they are moving among them.
Doorways, activities, apartments, and detailed interiors can open as separate
fixed-camera scenes without interrupting ordinary outdoor exploration.

The first activity is pond hockey at the Frozen Pond. Each side has three
skaters and one goalie. The initial prototype is a 90-second session-only match:
one human controls a Lettuce Leafs skater, while the remaining five skaters and
both goalies use simple local AI. The player moves with WASD or the arrow keys
and shoots with Space. Scores reset when the activity closes; multiplayer,
matchmaking, rewards, and leaderboards come later.

The second activity is snow shoveling in the Snow Crew maintenance yard. The
initial prototype is a 75-second session-only shift: the player moves with WASD
or the arrow keys and holds Space to push the shovel, clearing at least 82% of
the marked paths. Cleared snow becomes visible snowbanks at the route edges.
Results reset when the activity closes, and returning places the player beside
the Snow Crew entrance.
Sledding remains a later Central Park activity. Do not add multiplayer,
accounts, progression, chat, snow particles, or permanent explanatory HUD
elements yet. Central Park remains permanently winter, expressed through the
environment rather than an ambient particle effect.

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

The technical stack remains suitable, but backend services should not drive the
current work. Next.js/React can present the map and Phaser can later power
district navigation. Colyseus, Supabase, authentication, chat, and persistence
wait until the map, district structure, and character direction are proven.

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

1. **City map:** design and approve the full-screen city overview and district
   zoom behavior.
2. **District structure:** build Central Park as a continuous explorable
   environment and establish the camera behavior, scale, and major landmarks.
3. **Character design:** refine the first turtle silhouette, proportions,
   expression, and gameplay size as a separate visual-design phase.
4. **Exploration:** add one character, collision boundaries, and basic
   navigation through the continuous Central Park environment.
5. **Activities:** build pond hockey first, snow shoveling second, and sledding
   later.
6. **Social foundation:** add multiplayer, identity, chat safety, and transit
   between districts.
7. **Persistence and business:** only then add apartments, inventory,
   progression, analytics, and monetization.

## Confirmed decisions

- The target audience is adults ages 20–40, especially post-college city
  dwellers and parents, but players of any age may join.
- The first supported platform is desktop web, with clean boundaries that make
  later mobile and desktop-store packaging possible.
- The game view is full-screen, without the prototype’s outer page frame,
  footer, persistent control legend, or large explanatory overlays.
- Players can view the complete map, zoom into a district, and explore multiple
  connected areas within that district.
- A session starts in the player’s apartment or saved last location. The city
  map is opened on demand as a travel/navigation view and can be closed to
  return to the current location.
- District areas use an illustrated 2.5D style, but the player is not confined
  to one fixed room for an entire district.
- Outdoor districts use a continuous, softly following camera. Separate
  fixed-camera scenes remain appropriate for interiors, apartments, transit,
  and activities.
- Outdoor environments use a 2.5D three-quarter perspective rather than a
  literal overhead view. Movement and collision remain on a simple top-down
  coordinate plane, and scenery is depth-sorted around the player.
- Camera zoom is smooth, centered on the player, and intentionally constrained
  so players cannot reveal unloaded world sections or lose navigation context.
- Central Park in winter is the first district. Its first games are four-a-side
  pond hockey—with three skaters and one goalie per team—and snow shoveling in
  the maintenance yard. Sledding remains a later activity. Central Park is
  always winter; other districts can have their own permanent or seasonal
  weather.
- Central Park does not need falling-snow effects; static environmental art is
  enough to communicate winter.
- The first turtle direction is friendly, compact, and highly readable at
  gameplay scale. It currently uses one static three-quarter character sprite;
  walking animation, clothing attachment layers, and additional directional
  views come later.
- Authenticated players can use open text chat.
- The setting directly parodies New York through a mostly normal city inhabited
  by turtles, with turtle-themed stores, food, dialogue, and visual jokes.
- The city uses original art, fictional businesses, generic city infrastructure,
  and recognizable geographic cues without reproducing protected logos,
  characters, private brands, or distinctive commercial designs.
- Players explore continuous outdoor districts and enter interiors or
  activities as separate scenes. Activity results and progression are not
  persisted in the first version.
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
4. **World loading:** Decide how large a district can be before its illustrated
   sections need to be loaded and unloaded in chunks.
5. **Initial map extent:** Decide whether the first overview shows Manhattan
   only or also includes simplified, locked silhouettes for future Brooklyn
   districts.

## Immediate next steps

1. Playtest pond hockey and tune skating speed, puck control, AI pressure,
   goalie behavior, match duration, and rink readability.
2. Build the Snow Crew maintenance-yard transition and the first snow-shoveling
   game loop.
3. Refine Central Park scenery clusters and landmark proportions around the
   path network.
4. Add district collision boundaries later, after the first two activities
   establish the desired game feel.
