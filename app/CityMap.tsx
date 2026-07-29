"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { CentralParkMap } from "./CentralParkMap";
import { ChelseaApartment } from "./ChelseaApartment";
import { ChelseaDistrict } from "./ChelseaDistrict";
import { HockeyGame } from "./HockeyGame";
import { PressureWashingGame } from "./PressureWashingGame";
import { SnowShovelingGame } from "./SnowShovelingGame";

type District = {
  id:
    | "central-park"
    | "midtown"
    | "chelsea"
    | "west-village"
    | "east-village-les"
    | "fidi";
  name: string;
  mapNote: string;
  focusX: string;
  focusY: string;
};

type Screen =
  | "apartment"
  | "chelsea"
  | "city"
  | "central-park"
  | "hockey"
  | "pressure-washing"
  | "snow-shoveling";
type MapReturn = "apartment" | "chelsea" | "central-park";
type ParkSpawn = "south-gate" | "frozen-pond" | "snow-crew";
type ChelseaSpawn = "apartment" | "pressure-washing";

const districts: District[] = [
  {
    id: "central-park",
    name: "Central Park",
    mapNote: "Always winter",
    focusX: "0vw",
    focusY: "14vh",
  },
  {
    id: "midtown",
    name: "Midtown",
    mapNote: "Bright center of the city",
    focusX: "0vw",
    focusY: "-4vh",
  },
  {
    id: "chelsea",
    name: "Chelsea",
    mapNote: "West-side streets and markets",
    focusX: "8vw",
    focusY: "-15vh",
  },
  {
    id: "west-village",
    name: "West Village",
    mapNote: "Winding streets by the river",
    focusX: "9vw",
    focusY: "-23vh",
  },
  {
    id: "east-village-les",
    name: "East Village / LES",
    mapNote: "Downtown east-side neighborhoods",
    focusX: "-8vw",
    focusY: "-23vh",
  },
  {
    id: "fidi",
    name: "FiDi",
    mapNote: "The harbor edge",
    focusX: "0vw",
    focusY: "-33vh",
  },
];

export function CityMap() {
  const [screen, setScreen] = useState<Screen>("apartment");
  const [mapReturn, setMapReturn] = useState<MapReturn | null>(null);
  const [parkSpawn, setParkSpawn] = useState<ParkSpawn>("south-gate");
  const [chelseaSpawn, setChelseaSpawn] =
    useState<ChelseaSpawn>("apartment");
  const [selectedId, setSelectedId] = useState<District["id"] | null>(null);
  const selectedDistrict =
    districts.find((district) => district.id === selectedId) ?? null;

  function openWorldMap(returnTo: MapReturn) {
    setMapReturn(returnTo);
    setSelectedId(null);
    setScreen("city");
  }

  function travelTo(destination: "chelsea" | "central-park") {
    setMapReturn(null);
    setSelectedId(null);
    if (destination === "chelsea") {
      setChelseaSpawn("apartment");
    }
    setScreen(destination);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (screen === "hockey" || screen === "snow-shoveling") {
          setParkSpawn(screen === "hockey" ? "frozen-pond" : "snow-crew");
          setScreen("central-park");
        } else if (screen === "pressure-washing") {
          setChelseaSpawn("pressure-washing");
          setScreen("chelsea");
        } else if (screen === "central-park") {
          setMapReturn("central-park");
          setSelectedId(null);
          setScreen("city");
        } else if (screen === "apartment") {
          setScreen("chelsea");
        } else if (screen === "chelsea") {
          setMapReturn("chelsea");
          setSelectedId(null);
          setScreen("city");
        } else if (selectedId) {
          setSelectedId(null);
        } else if (mapReturn) {
          setScreen(mapReturn);
          setMapReturn(null);
        } else {
          setSelectedId(null);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mapReturn, screen, selectedId]);

  const mapStyle = {
    "--focus-x": selectedDistrict?.focusX ?? "0vw",
    "--focus-y": selectedDistrict?.focusY ?? "0vh",
    "--focus-scale": selectedDistrict ? "1.62" : "1",
  } as CSSProperties;

  if (screen === "hockey") {
    return (
      <HockeyGame
        onExit={() => {
          setParkSpawn("frozen-pond");
          setScreen("central-park");
        }}
      />
    );
  }

  if (screen === "snow-shoveling") {
    return (
      <SnowShovelingGame
        onExit={() => {
          setParkSpawn("snow-crew");
          setScreen("central-park");
        }}
      />
    );
  }

  if (screen === "pressure-washing") {
    return (
      <PressureWashingGame
        onExit={() => {
          setChelseaSpawn("pressure-washing");
          setScreen("chelsea");
        }}
      />
    );
  }

  if (screen === "apartment") {
    return (
      <ChelseaApartment
        onExitToChelsea={() => {
          setChelseaSpawn("apartment");
          setScreen("chelsea");
        }}
        onOpenMap={() => openWorldMap("apartment")}
      />
    );
  }

  if (screen === "chelsea") {
    return (
      <ChelseaDistrict
        spawn={chelseaSpawn}
        onEnterApartment={() => setScreen("apartment")}
        onEnterPressureWashing={() => setScreen("pressure-washing")}
        onOpenMap={() => openWorldMap("chelsea")}
      />
    );
  }

  if (screen === "central-park") {
    return (
      <CentralParkMap
        spawn={parkSpawn}
        onReturnToCity={() => openWorldMap("central-park")}
        onEnterHockey={() => {
          setParkSpawn("frozen-pond");
          setScreen("hockey");
        }}
        onEnterShoveling={() => {
          setParkSpawn("snow-crew");
          setScreen("snow-shoveling");
        }}
      />
    );
  }

  return (
    <main
      className={`map-stage${selectedDistrict ? " is-focused" : ""}`}
      data-testid="city-map"
    >
      <header className="map-wordmark">
        <p>Turtle City</p>
        <h1>Map</h1>
      </header>

      <div className="water-label hudson-label" aria-hidden="true">
        Hudson River
      </div>
      <div className="water-label east-river-label" aria-hidden="true">
        East River
      </div>

      <div className="context-land context-new-jersey" aria-hidden="true">
        <span>JERSEY</span>
      </div>
      <div className="context-land context-queens" aria-hidden="true">
        <span>QUEENS</span>
      </div>
      <div className="context-land context-brooklyn" aria-hidden="true">
        <span>BROOKLYN</span>
      </div>

      <section className="map-world" style={mapStyle} aria-label="Manhattan map">
        <div className="island-shadow" aria-hidden="true" />
        <div className="manhattan-island">
          <div className="future-zone future-inwood">
            <span>UPTOWN</span>
          </div>
          <div className="future-zone future-harlem">
            <span>HARLEM</span>
          </div>

          <div className="future-zone future-upper-west">
            <span>UPPER WEST</span>
          </div>
          <div className="future-zone future-upper-east">
            <span>UPPER EAST</span>
          </div>

          {districts.map((district) => (
            <button
              key={district.id}
              type="button"
              className={`district district-${district.id}${
                district.id === selectedId ? " is-selected" : ""
              }`}
              aria-label={`Focus ${district.name}`}
              aria-pressed={district.id === selectedId}
              onClick={() => {
                if (district.id === "central-park") {
                  setParkSpawn("south-gate");
                  travelTo("central-park");
                } else {
                  setSelectedId(district.id);
                }
              }}
            >
              <span>{district.name}</span>
            </button>
          ))}

          <div className="future-zone future-murray-hill">
            <span>MURRAY HILL</span>
          </div>
          <div className="future-zone future-gramercy">
            <span>GRAMERCY</span>
          </div>
          <div className="future-zone future-soho">
            <span>SOHO</span>
          </div>
          <div className="future-zone future-tribeca">
            <span>TRIBECA</span>
          </div>
        </div>
      </section>

      <div className="map-key" aria-hidden={selectedDistrict !== null}>
        <span className="key-mark" />
        Select a district
      </div>

      {mapReturn && !selectedDistrict ? (
        <button
          type="button"
          className="map-close"
          onClick={() => {
            setScreen(mapReturn);
            setMapReturn(null);
          }}
        >
          <span aria-hidden="true">←</span>
          Back to where you were
        </button>
      ) : null}

      {selectedDistrict ? (
        <>
          <button
            type="button"
            className="city-return"
            onClick={() => setSelectedId(null)}
          >
            <span aria-hidden="true">←</span>
            City map
          </button>

          <section className="district-caption" aria-live="polite">
            <p>District overview</p>
            <h2>{selectedDistrict.name}</h2>
            <span>{selectedDistrict.mapNote}</span>
            {selectedDistrict.id === "chelsea" ? (
              <button
                type="button"
                className="district-enter"
                onClick={() => travelTo("chelsea")}
              >
                Visit Chelsea
              </button>
            ) : null}
          </section>
        </>
      ) : null}

      <div className="map-scale" aria-hidden="true">
        <span />
        <small>MANHATTAN · NOT TO SCALE</small>
      </div>
    </main>
  );
}
