"use client";

import { Canvas } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { Suspense, useState } from "react";
import { TurtleBillboard } from "./world3d/TurtleBillboard";
import { type TurtleVariant } from "@/lib/turtles";

const products = [
  { key: "chelsea-skateboard", name: "Starter Board", price: 0, detail: "Sunset yellow · faster city travel", kind: "board" },
  { key: "shell-and-roll-helmet", name: "Street-Safe Helmet", price: 60, detail: "Forest green · hard-shell certified", kind: "helmet" },
  { key: "shell-and-roll-deck", name: "Night Line Deck", price: 140, detail: "Midnight blue · subway stripe", kind: "deck" },
] as const;

function ShopRoom({ turtleName, turtleVariant }: { turtleName: string; turtleVariant: TurtleVariant }) {
  return <>
    <color attach="background" args={["#183c35"]} />
    <ambientLight intensity={1.8} />
    <directionalLight castShadow intensity={2.4} position={[4, 9, 6]} />
    <mesh position={[0, -.25, 0]} receiveShadow><boxGeometry args={[18, .5, 13]} /><meshStandardMaterial color="#d2b47d" /></mesh>
    <mesh position={[0, 4, -6]} receiveShadow><boxGeometry args={[18, 8, .35]} /><meshStandardMaterial color="#244f45" /></mesh>
    <mesh position={[-8.8, 4, 0]}><boxGeometry args={[.35, 8, 13]} /><meshStandardMaterial color="#1b3933" /></mesh>
    <mesh position={[8.8, 4, 0]}><boxGeometry args={[.35, 8, 13]} /><meshStandardMaterial color="#1b3933" /></mesh>
    <Html center position={[0, 6.1, -5.7]} distanceFactor={12}><strong className="shop-wall-sign">SHELL &amp; ROLL</strong></Html>
    {[-4.9, 0, 4.9].map((x, shelf) => <group key={x} position={[x, 2.5, -5.4]}>
      {[0, 1.6, 3.2].map((y) => <mesh key={y} position-y={y}><boxGeometry args={[4.2, .22, 1.35]} /><meshStandardMaterial color="#e1b74d" /></mesh>)}
      {[0, 1].map((side) => <mesh key={side} position={[side ? 1.9 : -1.9, 1.6, 0]}><boxGeometry args={[.2, 3.4, 1.2]} /><meshStandardMaterial color="#724f31" /></mesh>)}
      <mesh position={[0, 2.05, .05]} rotation-z={shelf === 1 ? .08 : -.06}><boxGeometry args={[2.8, .22, .8]} /><meshStandardMaterial color={shelf === 0 ? "#efa83c" : shelf === 1 ? "#467c70" : "#253d68"} /></mesh>
    </group>)}
    <group position={[0, 0, 2.2]}><TurtleBillboard name={turtleName} variant={turtleVariant} /></group>
    <mesh position={[0, .65, 5.4]}><boxGeometry args={[5.5, 1.3, 1.2]} /><meshStandardMaterial color="#bd8d4e" /></mesh>
  </>;
}

export function ShellAndRollShop({
  onClaimStarter,
  onExit,
  onPurchase,
  ownedItems,
  shells,
  turtleName,
  turtleVariant,
}: {
  onClaimStarter: () => Promise<void>;
  onExit: () => void;
  onPurchase: (itemKey: string) => Promise<void>;
  ownedItems: string[];
  shells: number;
  turtleName: string;
  turtleVariant: TurtleVariant;
}) {
  const [buying, setBuying] = useState("");
  const [message, setMessage] = useState("Walk up to a shelf and choose your gear.");

  async function buy(itemKey: string, name: string, free: boolean) {
    setBuying(itemKey);
    setMessage("");
    try {
      if (free) await onClaimStarter(); else await onPurchase(itemKey);
      setMessage(`${name} added to your gear.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That purchase could not be completed.");
    } finally {
      setBuying("");
    }
  }

  return <main className="shell-shop" data-testid="shell-and-roll-shop">
    <Canvas camera={{ fov: 48, near: .1, far: 80, position: [0, 6.8, 12.5] }} dpr={[1, 1.5]} shadows="basic"><Suspense fallback={null}><ShopRoom turtleName={turtleName} turtleVariant={turtleVariant} /></Suspense></Canvas>
    <header className="shell-shop-title"><p>Chelsea · Shell &amp; Roll</p><h1>Gear shop</h1><span>Pick an item directly from the shelves.</span></header>
    <button type="button" className="shell-shop-exit" onClick={onExit}>← Back to Chelsea</button>
    <section className="shop-shelf-panel" aria-label="Shop shelves">
      {products.map((product) => {
        const owned = ownedItems.includes(product.key);
        const unavailable = owned || buying !== "" || shells < product.price;
        return <article key={product.key} className={`shop-product is-${product.kind}`}>
          <span className="shop-product-art" aria-hidden="true"><i /></span>
          <div><small>On the shelf</small><strong>{product.name}</strong><p>{product.detail}</p></div>
          <button type="button" disabled={unavailable} onClick={() => void buy(product.key, product.name, product.price === 0)}>
            {owned ? "Owned" : buying === product.key ? "Buying…" : product.price === 0 ? "Take free" : shells < product.price ? `Need ${product.price - shells}` : `${product.price} Shells`}
          </button>
        </article>;
      })}
    </section>
    <aside className="shop-message" role="status">{message}</aside>
  </main>;
}
