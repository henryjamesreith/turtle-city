# Turtle City

Turtle City is a map-first, New York-inspired social world inhabited by
turtles. The project is being developed from the bottom up:

1. city map;
2. connected district layouts;
3. character design;
4. exploration;
5. activities; and
6. multiplayer and persistence.

The application currently contains the first full-screen city-map artifact:

- a simplified Manhattan overview;
- the six initial districts in their broad geographic relationships;
- muted expansion areas for later neighborhoods; and
- a click-to-focus transition for each initial district.

Characters, movement, activities, multiplayer, and persistence remain deferred.

See [PROJECT_PLAN.md](./PROJECT_PLAN.md) for the current product documentation.

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Use `npm run build` to create a production build and `npm test` to verify the
clean map foundation.

## Contributing

If you would like to contribute:

1. Create your own branch and make your changes there. Do not work directly on
   `main`.
2. Test your changes before submitting them.
3. Open a pull request targeting `main`.
4. Ideally, include a video recording that demonstrates the change you made.
5. Do not merge the pull request. Wait for Henry to review and approve it.
