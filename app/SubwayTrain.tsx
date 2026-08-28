"use client";

import { subwayStations, type TransitDistrict } from "@/lib/world/subway";

type SubwayTrainProps = {
  onChooseStop: () => void;
  origin: TransitDistrict;
  turtleName: string;
};

export function SubwayTrain({
  onChooseStop,
  origin,
  turtleName,
}: SubwayTrainProps) {
  const station = subwayStations[origin];

  return (
    <main className="train-interior-stage" data-testid="subway-train">
      <div className="train-ceiling-lights" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <header className="train-route-header">
        <span className="subway-line-badge">T</span>
        <div>
          <p>Now leaving</p>
          <h1>{station.name}</h1>
        </div>
      </header>

      <section className="train-route-strip" aria-label="T train route">
        <span className="is-passed" />
        <span className="is-current" />
        <span />
        <span />
        <span />
        <div>
          <small>West Village</small>
          <small>Chelsea</small>
          <small>Midtown</small>
          <small>Central Park</small>
          <small>Choose stop</small>
        </div>
      </section>

      <div className="train-ad-panels" aria-hidden="true">
        <span>Visit the Shell Museum</span>
        <span>Stand clear of the closing doors</span>
      </div>

      <div className="train-windows" aria-hidden="true">
        <span />
        <span />
      </div>

      <div className="train-center-doors" aria-hidden="true">
        <span>
          <i />
        </span>
        <span>
          <i />
        </span>
      </div>

      <div className="train-benches" aria-hidden="true">
        <div>
          <span />
          <span />
          <span />
          <span />
        </div>
        <div>
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>

      <div className="train-poles" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <div className="train-rider">
        <span className="turtle-sprite" aria-hidden="true" />
        <span className="turtle-nameplate">{turtleName}</span>
      </div>

      <section className="train-map-card">
        <div>
          <span className="subway-line-badge">T</span>
          <p>Next stop</p>
          <strong>Choose destination</strong>
        </div>
        <button type="button" onClick={onChooseStop}>
          Open subway map
          <strong aria-hidden="true">→</strong>
        </button>
      </section>
    </main>
  );
}
