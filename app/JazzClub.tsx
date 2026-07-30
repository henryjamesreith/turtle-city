"use client";

type JazzClubProps = {
  onExit: () => void;
  onStartShow: () => void;
  turtleName: string;
};

export function JazzClub({
  onExit,
  onStartShow,
  turtleName,
}: JazzClubProps) {
  return (
    <main className="jazz-club-stage" data-testid="jazz-club">
      <header className="jazz-club-title">
        <p>West Village · downstairs</p>
        <h1>Cellar Note</h1>
      </header>

      <button type="button" className="jazz-club-exit" onClick={onExit}>
        <span aria-hidden="true">←</span>
        Street
      </button>

      <div className="jazz-brick-wall" aria-hidden="true" />
      <div className="jazz-ceiling-pipes" aria-hidden="true">
        <span />
        <span />
      </div>

      <section className="jazz-stage" aria-label="Cellar Note stage">
        <div className="jazz-stage-sign">
          <small>Live tonight</small>
          <strong>OPEN SHELL SESSION</strong>
        </div>
        <span className="jazz-drum-kit" aria-hidden="true" />
        <span className="jazz-upright-bass" aria-hidden="true" />
        <span className="jazz-microphone" aria-hidden="true" />
        <button type="button" onClick={onStartShow}>
          Join the band
        </button>
      </section>

      <aside className="jazz-bar" aria-label="Cellar Note bar">
        <strong>THE BACK BAR</strong>
        <span />
        <span />
        <span />
      </aside>

      <div className="jazz-tables" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <div className="jazz-audience" aria-hidden="true">
        <span className="is-olive" />
        <span className="is-coral" />
        <span className="is-blue" />
      </div>

      <div className="jazz-club-player">
        <span className="turtle-sprite" aria-hidden="true" />
        <span className="turtle-nameplate">{turtleName}</span>
      </div>

      <aside className="jazz-show-card">
        <p>Open shell session</p>
        <h2>Take the stage</h2>
        <span>Play an original five-lane rhythm set with the house band.</span>
        <button type="button" onClick={onStartShow}>
          Play the set
        </button>
      </aside>
    </main>
  );
}
