"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import "./SnowBrawlGame.css";
import { useSnowBrawlMultiplayer } from "@/lib/multiplayer/useSnowBrawlMultiplayer";
import { getTurtleImage, type TurtleVariant } from "@/lib/turtles";

type Props = { onExit: () => void };
type Impact = { id: number; team: string; type: string; x: number; y: number };
const WIDTH = 1200, HEIGHT = 700;

export function SnowBrawlGame({ onExit }: Props) {
  const { connect, disconnect, match, ready, rematch, sendInput, sessionId, solo, status } = useSnowBrawlMultiplayer();
  const keys = useRef(new Set<string>()); const aim = useRef({ x: 1, y: 0 }); const lastEvent = useRef(0); const [touch, setTouch] = useState({ x: 0, y: 0 }); const [impacts, setImpacts] = useState<Impact[]>([]);
  const me = match.players.find((p) => p.sessionId === sessionId);
  const hasRealRival = Boolean(me && match.players.some((p) => p.sessionId !== sessionId && p.userId !== me.userId && p.userId !== "bot"));
  const playerImages = useMemo(() => Object.fromEntries(match.players.map((p) => [p.variant, getTurtleImage(p.variant as TurtleVariant)])), [match.players]);

  useEffect(() => { void connect(); return disconnect; }, [connect, disconnect]);
  useEffect(() => {
    if (status !== "offline") return;
    const retry = window.setTimeout(() => void connect(), 2500);
    return () => window.clearTimeout(retry);
  }, [connect, status]);
  useEffect(() => {
    if (!match.eventId || match.eventId === lastEvent.current || match.eventType === "throw") return;
    lastEvent.current = match.eventId;
    const impact = { id: match.eventId, team: match.eventTeam, type: match.eventType, x: match.eventX, y: match.eventY };
    setImpacts((current) => [...current.slice(-5), impact]);
    const timeout = window.setTimeout(() => setImpacts((current) => current.filter((item) => item.id !== impact.id)), 650);
    return () => window.clearTimeout(timeout);
  }, [match.eventId, match.eventTeam, match.eventType, match.eventX, match.eventY]);
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD", "Space"].includes(e.code)) e.preventDefault(); keys.current.add(e.code); if (e.code === "Space" && !e.repeat) sendInput(0, 0, true, aim.current.x, aim.current.y); };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code); window.addEventListener("keydown", down); window.addEventListener("keyup", up); return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [sendInput]);
  useEffect(() => { const timer = window.setInterval(() => { const x = (keys.current.has("KeyD") || keys.current.has("ArrowRight") ? 1 : 0) - (keys.current.has("KeyA") || keys.current.has("ArrowLeft") ? 1 : 0) + touch.x; const y = (keys.current.has("KeyS") || keys.current.has("ArrowDown") ? 1 : 0) - (keys.current.has("KeyW") || keys.current.has("ArrowUp") ? 1 : 0) + touch.y; if (x || y) { const length = Math.hypot(x, y) || 1; aim.current = { x: x / length, y: y / length }; } sendInput(x, y, false, aim.current.x, aim.current.y); }, 50); return () => window.clearInterval(timer); }, [sendInput, touch]);

  const lobbyTitle = status === "connecting" ? "Finding the snowfield…" : status === "offline" ? "Snowfield unavailable" : match.players.length < 2 ? "Waiting for a rival" : "Teams are forming";
  return <main className="snow-brawl">
    <div className="snow-sky" /><div className="snowline-trees" aria-hidden="true">🌲　🌳　🌲　🌳　🌲　🌳　🌲　🌳</div>
    <header className="snow-brawl-title"><small>CENTRAL PARK • TURTLE CITY</small><h1>SNOW BRAWL</h1></header>
    <button className="snow-exit" onClick={onExit}>Leave park</button>
    <section className="snow-score" aria-label="Scoreboard"><b className="blue">BLUE {match.blueScore}</b><span>{Math.ceil(match.timeLeft)}s</span><b className="red">{match.redScore} RED</b></section>
    <div className={`snow-field ${impacts.some((impact) => impact.type === "knockout") ? "has-knockout" : ""}`}>
      <div className="park-lamp left" aria-hidden="true" /><div className="park-lamp right" aria-hidden="true" />
      <div className="team-zone blue">BLUE TURF</div><div className="team-zone red">RED TURF</div>
      <div className="snow-divider"><span>DON&apos;T CROSS!</span></div>
      {[160, 390, 620, 850, 1080].map((x) => <i key={x} className="snow-bank" style={{ left: `${x / WIDTH * 100}%` }} />)}
      {match.snowballs.map((ball) => <i key={ball.id} className={`flying-snowball ${ball.team}`} style={{ left: `${ball.x / WIDTH * 100}%`, top: `${ball.y / HEIGHT * 100}%` }} />)}
      {impacts.map((impact) => <div key={impact.id} className={`snow-impact ${impact.team} ${impact.type}`} style={{ left: `${impact.x / WIDTH * 100}%`, top: `${impact.y / HEIGHT * 100}%` }}>{impact.type === "knockout" ? "POOF!" : "SPLAT!"}</div>)}
      {match.players.map((p) => <div key={p.sessionId} className={`brawler ${p.team} ${p.facingX < -.1 ? "faces-left" : "faces-right"} ${p.knockedOut ? "is-out" : ""} ${p.invulnerable > 0 ? "is-hit" : ""} ${p.sessionId === sessionId ? "is-you" : ""}`} style={{ left: `${p.x / WIDTH * 100}%`, top: `${p.y / HEIGHT * 100}%` }}>
        {p.sessionId === sessionId && match.phase === "playing" && <><i className="aim-guide" style={{ transform: `rotate(${Math.atan2(p.facingY, p.facingX)}rad)` }} /><i className="throw-cooldown" style={{ background: `conic-gradient(#f2bf36 ${Math.max(0, 1 - p.cooldown / .72) * 360}deg, #17475755 0)` }} /></>}
        <div className="hearts">{"♥".repeat(p.hearts)}{"♡".repeat(3 - p.hearts)}</div><Image src={playerImages[p.variant]} alt="" width={62} height={62} /><strong>{p.sessionId === sessionId ? "YOU" : p.name}</strong>
      </div>)}
    </div>
    {match.phase === "countdown" && <div className="snow-countdown"><small>READY?</small><strong>{Math.max(1, Math.ceil(match.countdownLeft))}</strong></div>}
    {(match.phase === "lobby" || status !== "live") && <div className="snow-modal"><small>CHOOSE YOUR MATCH</small><h2>{lobbyTitle}</h2><p>Stay on your side of the line. Face a direction and pelt the other team until their hearts are gone.</p><div className="snow-howto"><span><kbd>WASD / ARROWS</kbd> Move & face</span><span><kbd>SPACE</kbd> Throw forward</span><span><b>♥ ♥ ♥</b> Last turtle standing</span></div>{status === "live" && <div className="snow-match-actions"><button disabled={!me || me.ready || match.players.length < 2} onClick={ready}>{me?.ready ? "Ready! Waiting…" : "Play multiplayer"}</button><button className="bot-match" disabled={!me || me.ready || hasRealRival} onClick={solo}>Play against bot</button></div>}{status === "offline" && <button onClick={() => void connect()}>Try again</button>}<p className="snow-roster">{match.players.map((p) => `${p.team === "blue" ? "🔵" : "🔴"} ${p.name}${p.ready ? " ✓" : ""}`).join("  ·  ") || "Connecting…"}</p></div>}
    {match.phase === "finished" && <div className="snow-modal"><small>FINAL WHISTLE</small><h2>{match.winner === "draw" ? "Snowy draw!" : `${match.winner.toUpperCase()} TEAM WINS!`}</h2><p>The Great Lawn has a new snowball champion.</p><button onClick={rematch}>{me?.ready ? "Waiting for rivals…" : "Rematch"}</button></div>}
    {match.phase === "playing" && <div className="snow-coach"><span>WASD / arrows to move & face</span><span>Space to throw forward</span></div>}
    <div className="snow-touch" aria-label="Touch controls"><div>{[[0,-1,"↑"],[-1,0,"←"],[0,1,"↓"],[1,0,"→"]].map(([x,y,label]) => <button key={label as string} onPointerDown={() => { setTouch({ x: x as number, y: y as number }); aim.current = { x: x as number, y: y as number }; }} onPointerUp={() => setTouch({ x: 0, y: 0 })} onPointerCancel={() => setTouch({ x: 0, y: 0 })}>{label}</button>)}</div><button className="throw" onClick={() => sendInput(0, 0, true, aim.current.x, aim.current.y)}>THROW</button></div>
  </main>;
}
