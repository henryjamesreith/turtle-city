import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("owned Shell & Roll gear can be equipped and rendered", async () => {
  const [map, panel, turtle, skateboard, persistence, types, migration] = await Promise.all([
    readFile(new URL("../app/CityMap.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/GearEquipmentPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/world3d/TurtleBillboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/world3d/Skateboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/persistence/playerPersistence.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/supabase/database.types.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260901020000_equipped_shop_gear.sql", import.meta.url), "utf8"),
  ]);

  assert.match(map, /<GearEquipmentPanel/);
  assert.match(map, /EquippedGearContext\.Provider/);
  assert.match(map, /snapshot\.inventory\.filter\(\(item\) => item\.equipped\)/);
  assert.match(panel, /Street-Safe Helmet/);
  assert.match(panel, /Night Line Deck/);
  assert.match(turtle, /gear\.helmet && !suppressGear/);
  assert.match(skateboard, /gear\.deck/);
  assert.match(skateboard, /#293f69/);
  assert.match(persistence, /set_equipped_gear/);
  assert.match(types, /set_equipped_gear/);
  assert.match(migration, /security definer/);
  assert.match(migration, /You do not own that item/);
  assert.match(migration, /update public\.inventory_items set equipped = false/);
  assert.match(migration, /revoke all on function public\.set_equipped_gear\(text, boolean\) from public/);
});
