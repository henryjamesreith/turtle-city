"use client";

import { useEffect, useRef, useState } from "react";

type GameHandle = {
  destroy: (removeCanvas?: boolean) => void;
};

export function TurtleCityGame() {
  const gameHostRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let game: GameHandle | undefined;
    let cancelled = false;

    async function startGame() {
      const { createTurtleCityGame } = await import(
        "../game/createTurtleCityGame"
      );

      if (cancelled || !gameHostRef.current) {
        return;
      }

      game = createTurtleCityGame(gameHostRef.current, () => {
        setIsLoading(false);
      });
    }

    void startGame();

    return () => {
      cancelled = true;
      game?.destroy(true);
    };
  }, []);

  return (
    <main className="game-page">
      <section className="game-shell" aria-label="Turtle City game prototype">
        <header className="game-header">
          <div className="wordmark">
            <span className="wordmark-shell" aria-hidden="true">
              TC
            </span>
            <div>
              <p className="eyebrow">A New York-ish turtle world</p>
              <h1>Turtle City</h1>
            </div>
          </div>
          <div className="room-status" aria-label="Current location">
            <span className="status-dot" aria-hidden="true" />
            Central Park · Permanent winter
          </div>
        </header>

        <div className="game-frame">
          <div
            ref={gameHostRef}
            className="game-host"
            data-testid="turtle-city-game"
          />
          {isLoading ? (
            <div className="game-loading" role="status">
              <span className="loading-turtle" aria-hidden="true">
                🐢
              </span>
              <strong>Clearing the paths…</strong>
              <span>Central Park is opening</span>
            </div>
          ) : null}
        </div>

        <footer className="game-footer">
          <p>
            <kbd>WASD</kbd> or <kbd>Arrow keys</kbd> to move
          </p>
          <p>
            <kbd>E</kbd> to explore and enter activities
          </p>
          <p className="prototype-note">
            Early playable · Nothing is saved yet
          </p>
        </footer>
      </section>
    </main>
  );
}
