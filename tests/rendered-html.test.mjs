import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
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

test("server-renders the Turtle City game shell and metadata", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Turtle City · Central Park Prototype<\/title>/i);
  assert.match(html, /Turtle City/);
  assert.match(html, /Central Park · Permanent winter/);
  assert.match(html, /WASD/);
  assert.match(html, /Nothing is saved yet/);
  assert.match(html, /og\.png/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("the first playable includes keyboard exploration and an activity scene", async () => {
  const [game, packageJson, plan] = await Promise.all([
    readFile(
      new URL("../game/createTurtleCityGame.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../PROJECT_PLAN.md", import.meta.url), "utf8"),
    access(new URL("../public/og.png", import.meta.url)),
  ]);

  assert.match(packageJson, /"phaser":/);
  assert.match(game, /class ExploreScene extends Phaser\.Scene/);
  assert.match(game, /class ShovelingScene extends Phaser\.Scene/);
  assert.match(game, /"W,A,S,D,E,SPACE,ESC"/);
  assert.match(game, /this\.scene\.start\("Shoveling"/);
  assert.match(game, /No score saved/);
  assert.doesNotMatch(game, /localStorage|indexedDB|supabase|leaderboard/i);
  assert.match(plan, /Activity results and progression are not persisted/);
});
