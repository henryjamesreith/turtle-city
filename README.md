# Turtle City

Turtle City is a New York-inspired social world inhabited by turtles. The
current prototype includes the city map, explorable Central Park and Chelsea
districts, Apartment 4B, pond hockey, snow shoveling, and pressure washing.

See [PROJECT_PLAN.md](./PROJECT_PLAN.md) for the current product documentation.

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Use `npm run build` to create a production build.

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

## Contributing

If you would like to contribute:

1. Create your own branch and make your changes there. Do not work directly on
   `main`.
2. Test your changes before submitting them.
3. Open a pull request targeting `main`.
4. Ideally, include a video recording that demonstrates the change you made.
5. Do not merge the pull request. Wait for Henry to review and approve it.
