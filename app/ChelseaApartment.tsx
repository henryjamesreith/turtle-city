"use client";

import { useEffect, useRef, useState } from "react";

type ChelseaApartmentProps = {
  onExitToChelsea: () => void;
  onOpenMap: () => void;
};

const movementKeys = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "w",
  "a",
  "s",
  "d",
  "W",
  "A",
  "S",
  "D",
]);

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function ChelseaApartment({
  onExitToChelsea,
  onOpenMap,
}: ChelseaApartmentProps) {
  const roomRef = useRef<HTMLElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const [nearDoor, setNearDoor] = useState(false);

  useEffect(() => {
    const pressed = new Set<string>();
    const position = { x: 0, y: 0 };
    let initialized = false;
    let isNearDoor = false;
    let animationFrame = 0;
    let previousTime = performance.now();

    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable ||
          event.target.tagName === "INPUT" ||
          event.target.tagName === "TEXTAREA" ||
          event.target.tagName === "SELECT")
      ) {
        return;
      }

      if (event.key === "Enter" && isNearDoor && !event.repeat) {
        event.preventDefault();
        onExitToChelsea();
      } else if (movementKeys.has(event.key)) {
        event.preventDefault();
        pressed.add(event.key.toLowerCase());
      } else if (event.key === "Shift") {
        pressed.add("shift");
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      pressed.delete(event.key.toLowerCase());
    }

    function clearInput() {
      pressed.clear();
    }

    function update(time: number) {
      const room = roomRef.current;
      const player = playerRef.current;

      if (!room || !player) {
        animationFrame = requestAnimationFrame(update);
        return;
      }

      const roomWidth = room.offsetWidth;
      const roomHeight = room.offsetHeight;

      if (!initialized) {
        position.x = roomWidth * 0.54;
        position.y = roomHeight * 0.78;
        initialized = true;
      }

      const elapsed = Math.min((time - previousTime) / 1000, 0.05);
      previousTime = time;
      const horizontal =
        Number(pressed.has("arrowright") || pressed.has("d")) -
        Number(pressed.has("arrowleft") || pressed.has("a"));
      const vertical =
        Number(pressed.has("arrowdown") || pressed.has("s")) -
        Number(pressed.has("arrowup") || pressed.has("w"));
      const magnitude = Math.hypot(horizontal, vertical) || 1;
      const speed = pressed.has("shift") ? 560 : 320;

      position.x = clamp(
        position.x + (horizontal / magnitude) * speed * elapsed,
        roomWidth * 0.09,
        roomWidth * 0.91,
      );
      position.y = clamp(
        position.y + (vertical / magnitude) * speed * elapsed,
        roomHeight * 0.61,
        roomHeight * 0.9,
      );

      const doorX = roomWidth * 0.145;
      const doorY = roomHeight * 0.72;
      const nextNearDoor =
        Math.hypot(position.x - doorX, position.y - doorY) <
        Math.max(120, roomWidth * 0.09);

      isNearDoor = nextNearDoor;
      setNearDoor((current) =>
        current === nextNearDoor ? current : nextNearDoor,
      );

      if (horizontal < 0) {
        player.dataset.facing = "left";
      } else if (horizontal > 0) {
        player.dataset.facing = "right";
      }

      player.style.transform = `translate3d(${position.x - 55}px, ${
        position.y - 124
      }px, 0)`;
      animationFrame = requestAnimationFrame(update);
    }

    window.addEventListener("keydown", handleKeyDown, { passive: false });
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", clearInput);
    animationFrame = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", clearInput);
    };
  }, [onExitToChelsea]);

  return (
    <main className="apartment-stage" data-testid="chelsea-apartment">
      <header className="apartment-title">
        <p>Chelsea · Apartment 4B</p>
        <h1>Your apartment</h1>
        <span>Starter condition · needs work</span>
      </header>

      <button type="button" className="apartment-map-button" onClick={onOpenMap}>
        City map
      </button>

      <p className="sr-only">
        Move around the apartment with the arrow keys or W, A, S, and D. Press
        Enter near the door to go outside.
      </p>

      <section
        className="apartment-room"
        ref={roomRef}
        aria-label="Run-down starter apartment in Chelsea"
      >
        <div
          className="apartment-back-wall"
          data-upgrade-slot="walls"
          data-tier="starter"
          aria-hidden="true"
        >
          <span className="apartment-water-stain" />
          <span className="apartment-wall-crack crack-one" />
          <span className="apartment-wall-crack crack-two" />
          <span className="apartment-peeling-paper paper-one" />
          <span className="apartment-peeling-paper paper-two" />
        </div>
        <div className="apartment-left-wall" aria-hidden="true" />
        <div className="apartment-right-wall" aria-hidden="true" />
        <div
          className="apartment-floor"
          data-upgrade-slot="floor"
          data-tier="starter"
          aria-hidden="true"
        />

        <button
          type="button"
          className="apartment-door"
          aria-label="Leave apartment and go outside to Chelsea"
          onClick={onExitToChelsea}
        >
          <span>4B</span>
        </button>

        <div
          className="apartment-window"
          data-upgrade-slot="window"
          data-tier="starter"
          aria-hidden="true"
        >
          <span className="apartment-window-view" />
          <span className="apartment-crooked-blind" />
          <span className="apartment-window-tape" />
        </div>

        <div
          className="apartment-kitchenette"
          data-upgrade-slot="kitchen"
          data-tier="starter"
          aria-hidden="true"
        >
          <span className="apartment-cabinet cabinet-top" />
          <span className="apartment-sink" />
          <span className="apartment-counter" />
          <span className="apartment-cabinet cabinet-bottom" />
          <span className="apartment-pipe" />
          <span className="apartment-lonely-lettuce" />
        </div>

        <div
          className="apartment-radiator"
          data-upgrade-slot="heating"
          data-tier="starter"
          aria-hidden="true"
        >
          {Array.from({ length: 6 }, (_, index) => (
            <span key={index} />
          ))}
        </div>

        <div
          className="apartment-bed"
          data-upgrade-slot="bed"
          data-tier="starter"
          aria-hidden="true"
        >
          <span className="apartment-bed-frame" />
          <span className="apartment-mattress" />
          <span className="apartment-pillow" />
        </div>

        <div
          className="apartment-crate-table"
          data-upgrade-slot="furniture"
          data-tier="starter"
          aria-hidden="true"
        >
          <span />
        </div>
        <div className="apartment-boxes" data-upgrade-slot="storage" data-tier="starter" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="apartment-trash-bag" aria-hidden="true" />

        <div
          className="apartment-bare-bulb"
          data-upgrade-slot="lighting"
          data-tier="starter"
          aria-hidden="true"
        >
          <span />
        </div>

        <div className={`apartment-door-zone${nearDoor ? " is-nearby" : ""}`} aria-hidden="true">
          <span />
        </div>

        <div
          className="apartment-player"
          ref={playerRef}
          role="img"
          aria-label="Turtle City player character in their apartment"
          data-facing="left"
        >
          <span />
        </div>
      </section>

      {nearDoor ? (
        <aside className="apartment-exit-prompt" aria-live="polite">
          <div>
            <strong>Apartment door</strong>
            <small>Go outside to Chelsea</small>
          </div>
          <button type="button" onClick={onExitToChelsea}>
            Leave
          </button>
        </aside>
      ) : null}
    </main>
  );
}
