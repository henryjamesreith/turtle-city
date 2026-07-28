# Turtle City

An early desktop-browser prototype for a New York-inspired social game where
small turtles explore illustrated 2.5D neighborhood rooms and enter separate
activities.

The current playable is set in an always-winter Central Park. It includes:

- a fixed-camera explorable room;
- WASD and arrow-key movement;
- a slippery skating surface;
- fictional park details and a transit entrance;
- an enterable Snow Crew shoveling activity; and
- session-only activity feedback with no accounts, database, or progression.

See [PROJECT_PLAN.md](./PROJECT_PLAN.md) for the product and technical direction.

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Use `npm run build` to create a production build and `npm test` to verify the
rendered game shell and first-playable structure.

## Current structure

- `app/` contains the web shell and game loader.
- `game/` contains the Phaser scenes and prototype game logic.
- `public/` contains share and static assets.
- `PROJECT_PLAN.md` is the living founding brief.
- `.openai/hosting.json` contains Sites hosting bindings.

Persistent profiles, chat, multiplayer rooms, rewards, and the database are
deliberately deferred until the exploration/activity loop has been tested.
