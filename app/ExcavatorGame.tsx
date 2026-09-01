"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "ready" | "playing" | "finished";
const ROCKS = [12, 24, 38, 51, 65, 78, 89];

export function ExcavatorGame({ onExit, turtleName }: { onExit: () => void; turtleName: string }) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [bucket, setBucket] = useState(50);
  const [cleared, setCleared] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(45);
  const bucketRef = useRef(bucket);
  const clearedRef = useRef(cleared);

  useEffect(() => { bucketRef.current = bucket; }, [bucket]);
  useEffect(() => { clearedRef.current = cleared; }, [cleared]);

  function start() { setBucket(50); setCleared([]); setTimeLeft(45); setPhase("playing"); }
  const scoop = useCallback(() => {
    if (phase !== "playing") return;
    const target = ROCKS.findIndex((position, index) => !clearedRef.current.includes(index) && Math.abs(position - bucketRef.current) < 7);
    if (target >= 0) setCleared((current) => {
      const next = [...current, target];
      if (next.length === ROCKS.length) setPhase("finished");
      return next;
    });
  }, [phase]);

  useEffect(() => {
    if (phase !== "playing") return;
    const held = new Set<string>();
    const down = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (["a", "d", "arrowleft", "arrowright"].includes(key)) { event.preventDefault(); held.add(key); }
      if ((event.code === "Space" || key === "enter") && !event.repeat) { event.preventDefault(); scoop(); }
    };
    const up = (event: KeyboardEvent) => held.delete(event.key.toLowerCase());
    const movement = window.setInterval(() => setBucket((position) => Math.min(94, Math.max(6, position + (Number(held.has("d") || held.has("arrowright")) - Number(held.has("a") || held.has("arrowleft"))) * 2))), 32);
    window.addEventListener("keydown", down, { passive: false }); window.addEventListener("keyup", up);
    return () => { window.clearInterval(movement); window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [phase, scoop]);

  useEffect(() => {
    if (phase !== "playing") return;
    const timer = window.setInterval(() => setTimeLeft((time) => { if (time <= 1) { setPhase("finished"); return 0; } return time - 1; }), 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  const success = cleared.length >= 5;

  return <main className="excavator-game" data-testid="excavator-game">
    <header><p>East River Works · LES</p><h1>Dig This!</h1><span>Operator: {turtleName}</span></header>
    <button className="excavator-exit" type="button" onClick={onExit}>← East Village</button>
    <section className="excavator-site" aria-label="Construction site">
      <div className="excavator-skyline" />
      <div className="excavator-ground">{ROCKS.map((position, index) => cleared.includes(index) ? null : <i key={position} style={{ left: `${position}%` }} />)}</div>
      <div className="excavator-machine" style={{ left: `${bucket}%` }}><span className="excavator-cab">🐢</span><span className="excavator-arm" /><span className="excavator-bucket" /></div>
    </section>
    <aside className="excavator-hud"><span><small>Time</small><strong>0:{String(timeLeft).padStart(2, "0")}</strong></span><span><small>Cleared</small><strong>{cleared.length} / {ROCKS.length}</strong></span></aside>
    {phase === "playing" ? <aside className="excavator-controls">A/D or arrows to drive · Space to scoop</aside> : null}
    {phase === "ready" ? <section className="excavator-overlay"><p>Hard hat shift</p><h2>Clear the work site</h2><span>Line up the bucket with debris and scoop at least five piles before time runs out.</span><button type="button" onClick={start}>Start excavator</button></section> : null}
    {phase === "finished" ? <section className="excavator-overlay"><p>{success ? "Site cleared" : "Shift over"}</p><h2>{cleared.length} piles removed</h2><span>{success ? "The East River crew can get back to work." : "A few stubborn piles are still in the way."}</span><div><button type="button" onClick={start}>Dig again</button><button type="button" onClick={onExit}>Return to LES</button></div></section> : null}
    <style jsx>{`.excavator-game{position:relative;width:100vw;height:100vh;overflow:hidden;color:#fff;background:#77a7b0;font-family:system-ui}.excavator-game header{position:absolute;z-index:3;top:28px;left:32px}.excavator-game header p{margin:0;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.excavator-game h1{margin:3px 0;font-size:48px;line-height:1}.excavator-game header span{font-weight:700}.excavator-exit{position:absolute;z-index:4;top:30px;right:30px;padding:12px 16px;border:0;border-radius:10px;font-weight:850}.excavator-site{position:absolute;inset:0}.excavator-skyline{position:absolute;inset:30% 0 31%;background:linear-gradient(90deg,#7e6658 0 10%,#9d765f 10% 22%,#665e59 22% 36%,#a47d61 36% 50%,#705e55 50% 66%,#9e7259 66% 82%,#645951 82%)}.excavator-ground{position:absolute;inset:69% 0 0;background:#8b6641;border-top:18px solid #b59665}.excavator-ground i{position:absolute;top:12px;width:58px;height:42px;transform:translateX(-50%);border-radius:50% 45% 35% 30%;background:#5a5149;box-shadow:17px 4px #6c5f51}.excavator-machine{position:absolute;top:57%;width:120px;height:90px;transform:translateX(-50%);transition:left .05s linear}.excavator-cab{position:absolute;left:10px;top:8px;width:58px;height:52px;display:grid;place-items:center;font-size:28px;background:#e7aa28;border:6px solid #5f4922;border-radius:9px}.excavator-arm{position:absolute;left:62px;top:25px;width:90px;height:12px;transform:rotate(20deg);transform-origin:left;background:#e7aa28;border:4px solid #6d5120}.excavator-bucket{position:absolute;left:142px;top:62px;width:32px;height:28px;background:#ad7a27;border-radius:3px 3px 16px 3px}.excavator-machine:after{content:"";position:absolute;left:0;top:63px;width:92px;height:25px;border:8px solid #292d29;border-radius:50%;background:#474a40}.excavator-hud{position:absolute;z-index:3;top:120px;left:32px;display:flex;gap:8px}.excavator-hud span{display:grid;min-width:80px;padding:10px 14px;background:#203b34;border-radius:10px}.excavator-hud small{text-transform:uppercase;opacity:.7;font-weight:800}.excavator-hud strong{font-size:22px}.excavator-controls{position:absolute;z-index:3;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 18px;background:#203b34;border-radius:12px;font-weight:800}.excavator-overlay{position:absolute;z-index:5;top:50%;left:50%;width:min(420px,80vw);transform:translate(-50%,-50%);padding:28px;text-align:center;color:#17362c;background:#fff8df;border-radius:20px;box-shadow:0 18px 60px #243c}.excavator-overlay p{margin:0;text-transform:uppercase;font-weight:900;letter-spacing:.12em}.excavator-overlay h2{margin:8px 0;font-size:34px}.excavator-overlay span{display:block;line-height:1.5}.excavator-overlay button{margin:18px 5px 0;padding:12px 18px;border:0;border-radius:10px;color:#fff;background:#255541;font-weight:850;cursor:pointer}`}</style>
  </main>;
}
