"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { CentralParkMap } from "./CentralParkMap";
import { ChelseaApartment } from "./ChelseaApartment";
import { ChelseaDistrict } from "./ChelseaDistrict";
import { HockeyGame } from "./HockeyGame";
import { PressureWashingGame } from "./PressureWashingGame";
import { SnowShovelingGame } from "./SnowShovelingGame";
import { SubwayPlatform } from "./SubwayPlatform";
import { SubwayTrain } from "./SubwayTrain";
import { TurtleAuth } from "./TurtleAuth";
import { TurtleOnboarding } from "./TurtleOnboarding";
import { WestVillageDistrict } from "./WestVillageDistrict";
import {
  defaultTurtleAppearance,
  getPersistedLocation,
  getTurtleAppearance,
  hasCompletedOnboarding,
  loadPlayerSnapshot,
  saveLastLocation,
  saveTurtleProfile,
  signInPlayer,
  signOutPlayer,
  signUpPlayer,
  type PlayerSnapshot,
  type PersistedLocation,
  type TurtleAppearance,
} from "@/lib/persistence/playerPersistence";
import { getTurtleImage } from "@/lib/turtles";
import {
  isTransitDistrict,
  subwayStations,
  type TransitDistrict,
} from "@/lib/world/subway";

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
  | "snow-shoveling"
  | "subway-platform"
  | "subway-train"
  | "west-village";
type ParkSpawn = "south-gate" | "frozen-pond" | "snow-crew";
type ChelseaSpawn = "apartment" | "pressure-washing" | "subway";
type WestVillageSpawn = "neighborhood" | "subway";
type EntryMode = "auth" | "creator" | "game" | "welcome";

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

function isPersistedScreen(screen: Screen): screen is PersistedLocation {
  return (
    screen === "apartment" ||
    screen === "chelsea" ||
    screen === "central-park" ||
    screen === "west-village"
  );
}

function applyTurtleAppearance(appearance: TurtleAppearance) {
  document.documentElement.dataset.turtleVariant = appearance.variant;
}

export function CityMap() {
  const [screen, setScreen] = useState<Screen>("apartment");
  const [entryMode, setEntryMode] = useState<EntryMode>("welcome");
  const [persistenceReady, setPersistenceReady] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [authMode, setAuthMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [hasPlayerSession, setHasPlayerSession] = useState(false);
  const [playerIsAnonymous, setPlayerIsAnonymous] = useState(false);
  const [returningPlayer, setReturningPlayer] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [turtleName, setTurtleName] = useState("");
  const [turtlePersonality, setTurtlePersonality] = useState("");
  const [turtleAppearance, setTurtleAppearance] =
    useState<TurtleAppearance>(defaultTurtleAppearance);
  const [subwayOrigin, setSubwayOrigin] =
    useState<TransitDistrict>("chelsea");
  const [parkSpawn, setParkSpawn] = useState<ParkSpawn>("south-gate");
  const [chelseaSpawn, setChelseaSpawn] =
    useState<ChelseaSpawn>("apartment");
  const [westVillageSpawn, setWestVillageSpawn] =
    useState<WestVillageSpawn>("neighborhood");
  const [selectedId, setSelectedId] = useState<District["id"] | null>(null);
  const selectedDistrict =
    districts.find((district) => district.id === selectedId) ?? null;

  function enterSubway(origin: TransitDistrict) {
    setSubwayOrigin(origin);
    setSelectedId(null);
    setScreen("subway-platform");
  }

  const arriveInDistrict = useCallback((destination: TransitDistrict) => {
    setSelectedId(null);
    setSubwayOrigin(destination);

    if (destination === "central-park") {
      setParkSpawn("south-gate");
    } else if (destination === "chelsea") {
      setChelseaSpawn("subway");
    } else {
      setWestVillageSpawn("subway");
    }

    setScreen(destination);
  }, []);

  const exitSubwayToOrigin = useCallback(() => {
    arriveInDistrict(subwayOrigin);
  }, [arriveInDistrict, subwayOrigin]);

  const applyPlayerSnapshot = useCallback((snapshot: PlayerSnapshot) => {
    const appearance = getTurtleAppearance(snapshot.profile);
    const hasTurtle = hasCompletedOnboarding(snapshot);

    setScreen(getPersistedLocation(snapshot));
    setTurtleAppearance(appearance);
    setTurtleName(snapshot.profile.turtle_name ?? "");
    setTurtlePersonality(snapshot.profile.personality ?? "");
    setReturningPlayer(hasTurtle);
    setHasPlayerSession(true);
    setPlayerIsAnonymous(snapshot.isAnonymous);
    applyTurtleAppearance(appearance);

    return hasTurtle;
  }, []);

  function clearLocalPlayer() {
    setReturningPlayer(false);
    setHasPlayerSession(false);
    setPlayerIsAnonymous(false);
    setTurtleName("");
    setTurtlePersonality("");
    setTurtleAppearance(defaultTurtleAppearance);
    applyTurtleAppearance(defaultTurtleAppearance);
    setSelectedId(null);
    setScreen("apartment");
  }

  async function logOutCurrentPlayer() {
    setLogoutLoading(true);
    setLogoutError("");

    try {
      await signOutPlayer();
      clearLocalPlayer();
      setShowLogoutConfirm(false);
      setEntryMode("welcome");
    } catch (error) {
      console.warn("Turtle City could not log out.", error);
      setLogoutError("We could not log out. Please try again.");
    } finally {
      setLogoutLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    void loadPlayerSnapshot()
      .then((snapshot) => {
        if (!cancelled && snapshot) {
          applyPlayerSnapshot(snapshot);
        }
      })
      .catch((error) => {
        console.warn("Turtle City persistence is unavailable.", error);
      })
      .finally(() => {
        if (!cancelled) {
          setPersistenceReady(true);
          setSessionLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applyPlayerSnapshot]);

  useEffect(() => {
    if (
      !persistenceReady ||
      entryMode !== "game" ||
      !isPersistedScreen(screen)
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void saveLastLocation(screen).catch((error) => {
        console.warn("Turtle City could not save the current location.", error);
      });
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [entryMode, persistenceReady, screen]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (entryMode !== "game") {
        return;
      }

      if (event.key === "Escape") {
        if (screen === "hockey" || screen === "snow-shoveling") {
          setParkSpawn(screen === "hockey" ? "frozen-pond" : "snow-crew");
          setScreen("central-park");
        } else if (screen === "pressure-washing") {
          setChelseaSpawn("pressure-washing");
          setScreen("chelsea");
        } else if (screen === "apartment") {
          setScreen("chelsea");
        } else if (screen === "subway-platform") {
          exitSubwayToOrigin();
        } else if (screen === "subway-train") {
          setScreen("subway-platform");
        } else if (screen === "city" && selectedId) {
          setSelectedId(null);
        } else if (screen === "city") {
          setSelectedId(null);
          setScreen("subway-train");
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [entryMode, exitSubwayToOrigin, screen, selectedId]);

  const mapStyle = {
    "--focus-x": selectedDistrict?.focusX ?? "0vw",
    "--focus-y": selectedDistrict?.focusY ?? "0vh",
    "--focus-scale": selectedDistrict ? "1.62" : "1",
  } as CSSProperties;

  if (entryMode === "auth") {
    return (
      <TurtleAuth
        key={authMode}
        mode={authMode}
        onBack={() => setEntryMode("welcome")}
        onSwitchMode={() =>
          setAuthMode((current) =>
            current === "sign-in" ? "sign-up" : "sign-in",
          )
        }
        onSubmit={async (credentials) => {
          if (authMode === "sign-in") {
            await signInPlayer(credentials);
            const snapshot = await loadPlayerSnapshot();

            if (!snapshot) {
              throw new Error("We could not load this turtle.");
            }

            const hasTurtle = applyPlayerSnapshot(snapshot);
            setEntryMode(hasTurtle ? "game" : "creator");
            return;
          }

          if (hasPlayerSession) {
            await signOutPlayer();
            clearLocalPlayer();
          }

          await signUpPlayer(credentials);

          const snapshot = await loadPlayerSnapshot();
          if (!snapshot) {
            throw new Error("We could not prepare your new turtle.");
          }

          applyPlayerSnapshot(snapshot);
          setEntryMode("creator");
        }}
      />
    );
  }

  if (entryMode !== "game") {
    return (
      <TurtleOnboarding
        key={`${entryMode}-${turtleName}-${turtleAppearance.variant}`}
        mode={entryMode}
        sessionLoading={sessionLoading}
        initialName={returningPlayer ? turtleName : ""}
        initialPersonality={returningPlayer ? turtlePersonality : ""}
        initialAppearance={turtleAppearance}
        onBack={() => setEntryMode("welcome")}
        onPlay={() => {
          if (returningPlayer) {
            setEntryMode("game");
          } else if (hasPlayerSession && !playerIsAnonymous) {
            setEntryMode("creator");
          } else {
            setAuthMode("sign-in");
            setEntryMode("auth");
          }
        }}
        onCreate={() => {
          setAuthMode("sign-up");
          setEntryMode("auth");
        }}
        onSave={async (input) => {
          await saveTurtleProfile(input);
          await saveLastLocation("apartment");
          setTurtleName(input.turtleName);
          setTurtlePersonality(input.personality);
          setTurtleAppearance(input.appearance);
          setReturningPlayer(true);
          setHasPlayerSession(true);
          setPlayerIsAnonymous(false);
          applyTurtleAppearance(input.appearance);
          setScreen("apartment");
          setEntryMode("game");
        }}
      />
    );
  }

  if (screen === "subway-platform") {
    return (
      <SubwayPlatform
        origin={subwayOrigin}
        turtleName={turtleName}
        onExit={exitSubwayToOrigin}
        onBoard={() => setScreen("subway-train")}
      />
    );
  }

  if (screen === "subway-train") {
    return (
      <SubwayTrain
        origin={subwayOrigin}
        turtleName={turtleName}
        onChooseStop={() => {
          setSelectedId(null);
          setScreen("city");
        }}
      />
    );
  }

  if (screen === "hockey") {
    return (
      <HockeyGame
        turtleName={turtleName}
        turtleImage={getTurtleImage(turtleAppearance.variant)}
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
        turtleName={turtleName}
        turtleImage={getTurtleImage(turtleAppearance.variant)}
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
        turtleName={turtleName}
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
        turtleName={turtleName}
        onExitToChelsea={() => {
          setChelseaSpawn("apartment");
          setScreen("chelsea");
        }}
      />
    );
  }

  if (screen === "chelsea") {
    return (
      <ChelseaDistrict
        turtleName={turtleName}
        spawn={chelseaSpawn}
        onEnterApartment={() => setScreen("apartment")}
        onEnterPressureWashing={() => setScreen("pressure-washing")}
        onEnterSubway={() => enterSubway("chelsea")}
      />
    );
  }

  if (screen === "central-park") {
    return (
      <CentralParkMap
        turtleName={turtleName}
        spawn={parkSpawn}
        onEnterSubway={() => enterSubway("central-park")}
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

  if (screen === "west-village") {
    return (
      <WestVillageDistrict
        turtleName={turtleName}
        spawn={westVillageSpawn}
        onEnterSubway={() => enterSubway("west-village")}
      />
    );
  }

  return (
    <main
      className={`map-stage${selectedDistrict ? " is-focused" : ""}`}
      data-testid="city-map"
    >
      <header className="map-wordmark">
        <p>T train · onboard map</p>
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
              onClick={() => setSelectedId(district.id)}
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
        Choose your stop
      </div>

      <div className="map-toolbar">
        {!selectedDistrict ? (
          <button
            type="button"
            className="map-close"
            onClick={() => setScreen("subway-train")}
          >
            <span aria-hidden="true">←</span>
            Back to train
          </button>
        ) : null}

        {selectedDistrict ? (
          <button
            type="button"
            className="city-return"
            onClick={() => setSelectedId(null)}
          >
            <span aria-hidden="true">←</span>
            City map
          </button>
        ) : null}

        <button
          type="button"
          className="map-logout"
          onClick={() => {
            setLogoutError("");
            setShowLogoutConfirm(true);
          }}
        >
          <span aria-hidden="true">↻</span>
          Log out
        </button>
      </div>

      {selectedDistrict ? (
        <>
          <section className="district-caption" aria-live="polite">
            <p>District overview</p>
            <h2>{selectedDistrict.name}</h2>
            <span>{selectedDistrict.mapNote}</span>
            {isTransitDistrict(selectedDistrict.id) &&
            selectedDistrict.id !== subwayOrigin ? (
              <button
                type="button"
                className="district-enter"
                onClick={() => {
                  if (isTransitDistrict(selectedDistrict.id)) {
                    arriveInDistrict(selectedDistrict.id);
                  }
                }}
              >
                Ride to {subwayStations[selectedDistrict.id].name}
              </button>
            ) : (
              <small className="district-transit-note">
                {selectedDistrict.id === subwayOrigin
                  ? "You boarded here."
                  : "No station is open here yet."}
              </small>
            )}
          </section>
        </>
      ) : null}

      <div className="map-scale" aria-hidden="true">
        <span />
        <small>MANHATTAN · NOT TO SCALE</small>
      </div>

      {showLogoutConfirm ? (
        <section
          className="logout-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-title"
        >
          <p>Leaving Turtle City?</p>
          <h2 id="logout-title">Log out</h2>
          <span>
            {playerIsAnonymous
              ? `${turtleName} is not connected to an email account. If you log out, this turtle cannot be recovered.`
              : `You can sign back in as ${turtleName} anytime with your email and password.`}
          </span>
          {logoutError ? (
            <strong role="alert">{logoutError}</strong>
          ) : null}
          <div>
            <button
              type="button"
              onClick={() => setShowLogoutConfirm(false)}
              disabled={logoutLoading}
            >
              Keep playing
            </button>
            <button
              type="button"
              onClick={() => void logOutCurrentPlayer()}
              disabled={logoutLoading}
            >
              {logoutLoading ? "Logging out…" : "Log out"}
            </button>
          </div>
        </section>
      ) : null}
    </main>
  );
}
