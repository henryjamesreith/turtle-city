# Turtle City — Project Plan

## Concept

Turtle City is a multiplayer social game about turtles living in a playful,
compressed version of New York City. Players explore neighborhoods, meet other
turtles, play short activities, customize their turtle, and improve their
apartment.

- Primary audience: adults ages 20–40, although anyone may join.
- First platform: full-screen desktop browser.
- Style: original illustrated 2.5D art with a three-quarter camera angle.
- Tone: funny, welcoming, energetic, and recognizably New York.
- The city is mostly normal—streets, cars, buildings, transit, and parks—with
  turtle-themed businesses, food, dialogue, and jokes.
- Use fictional businesses and original art. Avoid protected characters, logos,
  private brands, and distinctive commercial designs.

## Core experience

1. Start in the player’s apartment or their last saved location.
2. Explore the current district in a continuous environment.
3. Enter a neighborhood subway station to travel.
4. Board a train, open the map, and choose an available station.
5. Enter buildings or activity areas as separate scenes.
6. Play short activities and return to the same neighborhood afterward.
7. Later, earn currency and use it for turtle cosmetics and apartment upgrades.

Outdoor districts use a continuous following camera with zoom. Apartments,
interiors, transit, and activities can use separate fixed-camera scenes.

## Districts

| District | Identity | Activities |
| --- | --- | --- |
| Central Park | Permanently winter | Pond hockey, snow shoveling; sledding later, Chess with old man |
| Chelsea | Starter apartment and west-side blocks | Pressure washing; cooking @ gregs papaya, doorman game, news stand for puzzles |
| Midtown | Times Square and Empire State-inspired skyline | Falling-object dodge game, trash pickup |
| FiDi | One Shell Plaza and the harbor edge | Shell Express delivery run; tycoon progression later |
| West Village | Jazz cellar and waterfront | Hudson bike race; music activity later |
| East Village / LES | East River construction area | Excavator |

Later districts may include the Upper West Side, Upper East Side, Harlem,
Williamsburg, Downtown Brooklyn, Brooklyn Heights, Cobble Hill, Park Slope, and
Bushwick.

## Current prototype

- The game opens on a full-screen home page with Play and Create a turtle.
- Players create an email and password account or sign back in with an existing
  account. Supabase keeps the browser session active until the player logs out.
- Turtle creation saves a 2–20 character name, character variant, and an
  optional personality description. New turtles enter Apartment 4B.
- Display names may be shared. Each profile also receives a database-enforced
  unique turtle tag for future multiplayer identity.
- Returning players can resume immediately with Play.
- The turtle’s display name appears above the character in explorable scenes.
- The city map includes a Log out action. Players can sign back in later and
  recover their turtle, apartment, and saved location.
- The game starts in Apartment 4B at the fictional West 22 Apartments in
  Chelsea.
- Apartment 4B is intentionally shabby and contains future upgrade slots for
  its walls, floor, window, kitchen, heating, bed, lighting, furniture, and
  storage.
- Leaving the apartment opens an explorable Chelsea block. The player can
  re-enter West 22 or walk to the West 23 Street subway.
- West Village is an explorable continuous district connecting quiet restaurant
  and jazz-club streets to the Hudson greenway. The bike race and Cellar Note
  rhythm set are playable.
- Midtown is an explorable nighttime district with the Empire Shell Building,
  Times Square station, a falling-object dodge challenge, and a street cleanup
  shift.
- FiDi is an explorable harbor-side business district with One Shell Plaza,
  Fulton Street station, and the Shell Express delivery dispatch.
- Central Park, Chelsea, FiDi, Midtown, and West Village have separate multiplayer
  rooms. Up to 20 authenticated turtles in the same outdoor district can see one
  another's names, appearances, positions, and facing direction. Movement uses
  district-specific server validation and is smoothed in the browser.
- The playable 1 line connects Central Park, Midtown, Chelsea, West Village,
  Tribeca, and FiDi. Players choose an uptown or downtown platform, board while
  the doors are open, ride through each stop in order, and can exit only during
  a station dwell. Tribeca currently appears as a coming-soon pass-through stop.
- The city map shows the 1 line and its stations but is view-only. Subway travel
  happens entirely through the platform and train ride rather than a destination
  picker.
- Central Park, Chelsea, FiDi, Midtown, and West Village use continuous movement. Collision
  boundaries are intentionally deferred.
- The turtle currently uses one static character image with no walking
  animation.
- Supabase restores the turtle profile and last stable location. Profiles,
  apartments, wallets, inventory, and activity progress have protected database
  tables for later phases.

### Playable activities

- **Pond hockey:** 90-second match with two skaters and one goalie per team.
  Space switches teammates, X passes, C shoots, and the player may control the
  goalie.
- **Snow shoveling:** 90-second shift. Push collected snow off the path and
  clear at least 72%.
- **Pressure washing:** 75-second Chelsea shift. Hold the mouse button and sweep
  across the facade, or aim with WASD/arrows and spray with Space. Clean at
  least 85%.
- **Hudson bike race:** Change lanes with W/S or the arrow keys, hold Space to
  sprint, avoid obstacles, and race two riders to the Greenway finish.
- **Cellar Note rhythm set:** Enter the West Village jazz club and play a
  five-lane original set with A, S, D, F, and G. Accurate hits build a combo
  and score multiplier.
- **Look Out Below:** Survive 45 seconds beneath the Empire Shell Building by
  dodging falling coins, coffee cups, playbills, and loose signs.
- **Crossroads Cleanup:** Walk a Midtown block and collect at least 10 pieces of
  litter before the 60-second shift ends.
- **Shell Express:** Change lanes through FiDi traffic, collect parcels, cross
  delivery zones, and complete at least six deliveries before dispatch closes.

All activity scores and results are session-only and reset when the activity
closes.

## Later product systems

- Bus and bike travel between districts.
- Multiplayer interiors and activities.
- Friends and open text chat with filtering, reporting, blocking, rate limits,
  and appropriate all-ages safeguards.
- Shells earned through play for normal cosmetics and furniture.
- Paid turtle cosmetics, apartment upgrades, and furniture.
- Avoid loot boxes, trading, pay-to-win items, and a premium currency until the
  core game and economy are proven.
- Saved inventory, apartment layouts, progression, rewards, and last location.
- You move slow by default and then you can buy a skateboard to move faster

## Technical direction

```text
Next.js + React + TypeScript
  Website, profiles, store, map, and game client

Phaser
  Use when district and activity complexity warrants a dedicated game engine

Colyseus + Node.js + TypeScript
  Multiplayer rooms and authoritative movement/game state

Supabase
  PostgreSQL, authentication, storage, friends, inventory, apartments, and chat
```

Backend services are deferred while the world structure, activities, and game
feel are still being developed. When multiplayer and purchases are added, the
server must validate movement, rewards, inventory changes, and entitlements.

Keep platform-specific input, storage, authentication, and payments behind
small interfaces so mobile and desktop-store versions remain possible later.

## Build order

1. **Persistence foundation — complete:** email/password accounts, persistent
   sessions, turtle profiles, apartments, inventory, activity progress, and
   last location.
2. **Onboarding — complete:** account access, welcome page, turtle creator,
   saved appearance, and Apartment 4B arrival.
3. **West Village — complete:** connect restaurant and jazz-club streets to the
   Hudson greenway.
4. **Subway system — ongoing:** playable 1 local with direction-aware platforms,
   sequential station rides, route displays, and station exits is complete; add
   the 2/3 express and future 4/5/6, L, and F/M corridors as districts open.
5. **More neighborhoods — ongoing:** Midtown and FiDi are complete; the East
   Village / LES remains next.
6. **More games — ongoing:** Midtown adds falling-object and trash-pickup
   activities, and FiDi adds Shell Express; continue adding games alongside
   neighborhood development.
7. **Minimal outdoor multiplayer — complete:** authenticated shared presence
   and synchronized movement cover Central Park, Chelsea, FiDi, Midtown, and
   West Village.
   Keep interiors and activities private until their multiplayer rules exist.
8. **Store and apartment upgrades:** add Shells, inventory, turtle cosmetics,
   furniture, apartment improvements, and paid items.
9. **Player-created games:** build an original underground creator hub with a
   sidebar chat interface where players can design and publish mini-games.
   Players can browse trending games, invite friends, and issue challenges.
