"use client";

import { useState } from "react";

export function GearEquipmentPanel({
  equippedItems,
  onSetEquipped,
  ownedItems,
}: {
  equippedItems: string[];
  onSetEquipped: (itemKey: string, equipped: boolean) => Promise<void>;
  ownedItems: string[];
}) {
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const ownsHelmet = ownedItems.includes("shell-and-roll-helmet");
  const ownsStarter = ownedItems.includes("chelsea-skateboard");
  const ownsNightDeck = ownedItems.includes("shell-and-roll-deck");
  const helmetEquipped = equippedItems.includes("shell-and-roll-helmet");
  const nightDeckEquipped = equippedItems.includes("shell-and-roll-deck");

  async function setGear(itemKey: string, equipped: boolean) {
    setSaving(itemKey);
    setError("");
    try { await onSetEquipped(itemKey, equipped); }
    catch (nextError) { setError(nextError instanceof Error ? nextError.message : "Gear could not be updated."); }
    finally { setSaving(""); }
  }

  return <section className="settings-gear" aria-labelledby="gear-heading">
    <h3 id="gear-heading">Equipped gear</h3>
    <div><span><b>Helmet</b><small>{ownsHelmet ? "Street-Safe Helmet" : "Visit Shell & Roll"}</small></span>{ownsHelmet ? <button type="button" disabled={saving !== ""} onClick={() => void setGear("shell-and-roll-helmet", !helmetEquipped)}>{saving === "shell-and-roll-helmet" ? "Saving…" : helmetEquipped ? "Unequip" : "Equip"}</button> : null}</div>
    <div><span><b>Skateboard</b><small>{nightDeckEquipped ? "Night Line Deck" : ownsStarter ? "Starter Board" : "No board owned"}</small></span>{ownsNightDeck ? <button type="button" disabled={saving !== ""} onClick={() => void setGear(nightDeckEquipped ? "chelsea-skateboard" : "shell-and-roll-deck", true)}>{saving ? "Saving…" : nightDeckEquipped ? "Use starter" : "Use Night Line"}</button> : null}</div>
    {error ? <em role="alert">{error}</em> : null}
    <style jsx>{`.settings-gear{margin-top:14px;padding:14px;border:2px solid rgb(21 53 48 / 22%);border-radius:14px;background:#fffaf0}.settings-gear h3{margin:0 0 8px;font-size:13px}.settings-gear>div{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 0;border-top:1px solid rgb(21 53 48 / 14%)}.settings-gear span{display:grid}.settings-gear small{color:rgb(21 53 48 / 65%)}.settings-gear button{padding:7px 10px;border:2px solid #17352f;border-radius:999px;background:#e8bd57;color:#17352f;font-size:10px;font-weight:900}.settings-gear em{display:block;color:#a13f31;font-size:11px;font-style:normal;font-weight:800}`}</style>
  </section>;
}
