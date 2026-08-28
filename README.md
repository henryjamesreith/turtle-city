# Turtle City

Turtle City is a New York-inspired social world inhabited by turtles. The
current prototype includes five explorable districts, Apartment 4B, the
subway, eight activities, and shared multiplayer presence throughout every
outdoor district.

See [PROJECT_PLAN.md](./PROJECT_PLAN.md) for the current product documentation.

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Start the multiplayer server in a second terminal:

```bash
npm run multiplayer:dev
```

The web app runs at `http://localhost:3000` and the local Colyseus server runs
at `http://localhost:2567`. Outdoor districts remain playable in solo mode when
the multiplayer server is unavailable.

Use `npm run build` to build both the web app and multiplayer server.

## Supabase persistence

Supabase configuration is required for account creation, login, and saved
player data.

1. Create a Supabase project.
2. In Authentication settings, keep the Email provider enabled and turn off
   **Confirm email**. Turtle City creates the account and signs the player in
   immediately.
3. Copy `.env.example` to `.env.local` and enter the project URL and
   **publishable** key. Never put a secret or service-role key in a
   `NEXT_PUBLIC_` variable.
4. Link the repository to the project:

   ```bash
   npm run supabase:link -- --project-ref YOUR_PROJECT_REF
   ```

5. Apply the versioned database migration:

   ```bash
   npm run supabase:push
   ```

The migration creates player profiles, saved location, apartments, wallets,
catalog items, inventory, and activity progress. Row-level security limits each
player to their own records. The browser can update only the turtle profile and
last location; currency, inventory, upgrades, and rewards require trusted
server logic.

Configure the production Site URL and redirect URLs before deploying.

## Multiplayer

Central Park, Chelsea, FiDi, Midtown, and West Village each use a separate
authenticated Colyseus room with a maximum of 20 turtles. The server verifies
the Supabase access token, loads the turtle name and appearance through the
player's row-level security policy, and applies district-specific movement
bounds before synchronizing it. Entering an interior or activity leaves the
outdoor room.

For deployment, run `npm run multiplayer:start` on the game-server host and
configure:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `TURTLE_CITY_WEB_ORIGIN` with the deployed web origin
- `PORT`, normally supplied by the host

Set `NEXT_PUBLIC_MULTIPLAYER_URL` on the Next.js deployment to the public HTTPS
URL of that game server.

## Contributing

If you would like to contribute:

1. Create your own branch and make your changes there. Do not work directly on
   `main`.
2. Test your changes before submitting them.
3. Open a pull request targeting `main`.
4. Ideally, include a video recording that demonstrates the change you made.
5. Do not merge the pull request. Wait for Henry to review and approve it.
