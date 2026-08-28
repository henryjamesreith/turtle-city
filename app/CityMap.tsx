"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { BikeRaceGame } from "./BikeRaceGame";
import { ChelseaDistrict3D } from "./ChelseaDistrict3D";
import { FallingItemsGame } from "./FallingItemsGame";
import { HockeyGame } from "./HockeyGame";
import { JazzClub } from "./JazzClub";
import {
  ChelseaApartment3D,
  SubwayPlatform3D,
  SubwayTrain3D,
} from "./InteriorScenes3D";
import {
  CentralParkDistrict3D,
  FidiDistrict3D,
  MidtownDistrict3D,
  WestVillageDistrict3D,
} from "./OtherDistricts3D";
import { PressureWashingGame } from "./PressureWashingGame";
import { RhythmGame } from "./RhythmGame";
import { ShellExpressGame } from "./ShellExpressGame";
import { SnowShovelingGame } from "./SnowShovelingGame";
import { TurtleAuth } from "./TurtleAuth";
import { TurtleOnboarding } from "./TurtleOnboarding";
import { TrashPickupGame } from "./TrashPickupGame";
import {
  defaultTurtleAppearance,
  getPersistedLocation,
  getTurtleAppearance,
  hasCompletedOnboarding,
  loadPlayerSnapshot,
  onPlayerPasswordRecovery,
  saveLastLocation,
  saveTurtleProfile,
  sendPlayerPasswordReset,
  signInPlayer,
  signOutPlayer,
  signUpPlayer,
  updatePlayerPassword,
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
  | "bike-race"
  | "chelsea"
  | "city"
  | "central-park"
  | "falling-items"
  | "fidi"
  | "hockey"
  | "jazz-club"
  | "midtown"
  | "pressure-washing"
  | "rhythm-game"
  | "shell-express"
  | "snow-shoveling"
  | "subway-platform"
  | "subway-train"
  | "trash-pickup"
  | "west-village";
type ParkSpawn = "south-gate" | "frozen-pond" | "snow-crew";
type ChelseaSpawn = "apartment" | "pressure-washing" | "subway";
type MidtownSpawn =
  | "falling-items"
  | "plaza"
  | "subway"
  | "trash-pickup";
type FidiSpawn = "delivery" | "harbor" | "subway";
type WestVillageSpawn =
  | "jazz-club"
  | "neighborhood"
  | "subway"
  | "waterfront";
type EntryMode = "auth" | "creator" | "game" | "welcome";
type AuthMode = "forgot-password" | "reset-password" | "sign-in" | "sign-up";

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
    screen === "fidi" ||
    screen === "midtown" ||
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
  const [authMode, setAuthMode] = useState<AuthMode>("sign-in");
  const [hasPlayerSession, setHasPlayerSession] = useState(false);
  const [playerIsAnonymous, setPlayerIsAnonymous] = useState(false);
  const [returningPlayer, setReturningPlayer] = useState(false);
  const [creatingFreshTurtle, setCreatingFreshTurtle] = useState(false);
  const [pendingTurtle, setPendingTurtle] = useState<{
    appearance: TurtleAppearance;
    personality: string;
    turtleName: string;
  } | null>(null);
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
  const [midtownSpawn, setMidtownSpawn] =
    useState<MidtownSpawn>("plaza");
  const [fidiSpawn, setFidiSpawn] = useState<FidiSpawn>("harbor");
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
    } else if (destination === "midtown") {
      setMidtownSpawn("subway");
    } else if (destination === "fidi") {
      setFidiSpawn("subway");
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

  async function completeTurtleCreation(input: {
    appearance: TurtleAppearance;
    personality: string;
    turtleName: string;
  }) {
    await saveTurtleProfile(input);
    await saveLastLocation("apartment");
    setTurtleName(input.turtleName);
    setTurtlePersonality(input.personality);
    setTurtleAppearance(input.appearance);
    setReturningPlayer(true);
    setHasPlayerSession(true);
    setPlayerIsAnonymous(false);
    setCreatingFreshTurtle(false);
    setPendingTurtle(null);
    applyTurtleAppearance(input.appearance);
    setScreen("apartment");
    setEntryMode("game");
  }

  useEffect(() => {
    return onPlayerPasswordRecovery(() => {
      setAuthMode("reset-password");
      setEntryMode("auth");
      setSessionLoading(false);
    });
  }, []);

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
        } else if (
          screen === "falling-items" ||
          screen === "trash-pickup"
        ) {
          setMidtownSpawn(
            screen === "falling-items" ? "falling-items" : "trash-pickup",
          );
          setScreen("midtown");
        } else if (screen === "shell-express") {
          setFidiSpawn("delivery");
          setScreen("fidi");
        } else if (screen === "pressure-washing") {
          setChelseaSpawn("pressure-washing");
          setScreen("chelsea");
        } else if (screen === "bike-race") {
          setWestVillageSpawn("waterfront");
          setScreen("west-village");
        } else if (screen === "rhythm-game") {
          setScreen("jazz-club");
        } else if (screen === "jazz-club") {
          setWestVillageSpawn("jazz-club");
          setScreen("west-village");
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
        onBack={() => {
          if (authMode === "forgot-password") {
            setAuthMode("sign-in");
          } else {
            setEntryMode(pendingTurtle ? "creator" : "welcome");
          }
        }}
        onForgotPassword={() => setAuthMode("forgot-password")}
        onSwitchMode={() =>
          setAuthMode((current) =>
            current === "sign-in" ? "sign-up" : "sign-in",
          )
        }
        onSubmit={async (credentials) => {
          if (authMode === "forgot-password") {
            await sendPlayerPasswordReset(credentials.email);
            return;
          }

          if (authMode === "reset-password") {
            await updatePlayerPassword(credentials.password);
            const snapshot = await loadPlayerSnapshot();

            if (!snapshot) {
              throw new Error("We could not load this turtle.");
            }

            const hasTurtle = applyPlayerSnapshot(snapshot);
            setEntryMode(hasTurtle ? "game" : "creator");
            return;
          }

          if (authMode === "sign-in") {
            await signInPlayer(credentials);
            const snapshot = await loadPlayerSnapshot();

            if (!snapshot) {
              throw new Error("We could not load this turtle.");
            }

            const hasTurtle = applyPlayerSnapshot(snapshot);
            setCreatingFreshTurtle(false);
            setPendingTurtle(null);
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
          if (pendingTurtle) {
            await completeTurtleCreation(pendingTurtle);
          } else {
            setEntryMode("creator");
          }
        }}
      />
    );
  }

  if (entryMode !== "game") {
    return (
      <TurtleOnboarding
        key={`${entryMode}-${pendingTurtle?.turtleName ?? turtleName}-${pendingTurtle?.appearance.variant ?? turtleAppearance.variant}`}
        mode={entryMode}
        sessionLoading={sessionLoading}
        initialName={
          pendingTurtle?.turtleName ?? (returningPlayer ? turtleName : "")
        }
        initialPersonality={
          pendingTurtle?.personality ??
          (returningPlayer ? turtlePersonality : "")
        }
        initialAppearance={pendingTurtle?.appearance ?? turtleAppearance}
        onBack={() => {
          setCreatingFreshTurtle(false);
          setPendingTurtle(null);
          setEntryMode("welcome");
        }}
        onPlay={() => {
          if (returningPlayer) {
            setEntryMode("game");
          } else {
            setCreatingFreshTurtle(false);
            setPendingTurtle(null);
            setAuthMode("sign-in");
            setEntryMode("auth");
          }
        }}
        onCreate={() => {
          setCreatingFreshTurtle(true);
          setPendingTurtle(null);
          setEntryMode("creator");
        }}
        onSave={async (input) => {
          if (creatingFreshTurtle || !hasPlayerSession || playerIsAnonymous) {
            setPendingTurtle(input);
            setAuthMode("sign-up");
            setEntryMode("auth");
            return;
          }

          await completeTurtleCreation(input);
        }}
      />
    );
  }

  if (screen === "subway-platform") {
    return (
      <SubwayPlatform3D
        origin={subwayOrigin}
        turtleName={turtleName}
        turtleVariant={turtleAppearance.variant}
        onExit={exitSubwayToOrigin}
        onBoard={() => setScreen("subway-train")}
      />
    );
  }

  if (screen === "subway-train") {
    return (
      <SubwayTrain3D
        origin={subwayOrigin}
        turtleName={turtleName}
        turtleVariant={turtleAppearance.variant}
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

  if (screen === "falling-items") {
    return (
      <FallingItemsGame
        turtleName={turtleName}
        onExit={() => {
          setMidtownSpawn("falling-items");
          setScreen("midtown");
        }}
      />
    );
  }

  if (screen === "trash-pickup") {
    return (
      <TrashPickupGame
        turtleName={turtleName}
        onExit={() => {
          setMidtownSpawn("trash-pickup");
          setScreen("midtown");
        }}
      />
    );
  }

  if (screen === "shell-express") {
    return (
      <ShellExpressGame
        turtleName={turtleName}
        onExit={() => {
          setFidiSpawn("delivery");
          setScreen("fidi");
        }}
      />
    );
  }

  if (screen === "bike-race") {
    return (
      <BikeRaceGame
        turtleName={turtleName}
        onExit={() => {
          setWestVillageSpawn("waterfront");
          setScreen("west-village");
        }}
      />
    );
  }

  if (screen === "jazz-club") {
    return (
      <JazzClub
        turtleName={turtleName}
        onExit={() => {
          setWestVillageSpawn("jazz-club");
          setScreen("west-village");
        }}
        onStartShow={() => setScreen("rhythm-game")}
      />
    );
  }

  if (screen === "rhythm-game") {
    return <RhythmGame onExit={() => setScreen("jazz-club")} />;
  }

  if (screen === "apartment") {
    return (
      <ChelseaApartment3D
        turtleName={turtleName}
        turtleVariant={turtleAppearance.variant}
        onExitToChelsea={() => {
          setChelseaSpawn("apartment");
          setScreen("chelsea");
        }}
      />
    );
  }

  if (screen === "chelsea") {
    return (
      <ChelseaDistrict3D
        turtleName={turtleName}
        turtleVariant={turtleAppearance.variant}
        spawn={chelseaSpawn}
        onEnterApartment={() => setScreen("apartment")}
        onEnterPressureWashing={() => setScreen("pressure-washing")}
        onEnterSubway={() => enterSubway("chelsea")}
      />
    );
  }

  if (screen === "central-park") {
    return (
      <CentralParkDistrict3D
        turtleName={turtleName}
        turtleVariant={turtleAppearance.variant}
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

  if (screen === "midtown") {
    return (
      <MidtownDistrict3D
        turtleName={turtleName}
        turtleVariant={turtleAppearance.variant}
        spawn={midtownSpawn}
        onEnterFallingItems={() => setScreen("falling-items")}
        onEnterTrashPickup={() => setScreen("trash-pickup")}
        onEnterSubway={() => enterSubway("midtown")}
      />
    );
  }

  if (screen === "fidi") {
    return (
      <FidiDistrict3D
        turtleName={turtleName}
        turtleVariant={turtleAppearance.variant}
        spawn={fidiSpawn}
        onEnterDelivery={() => setScreen("shell-express")}
        onEnterSubway={() => enterSubway("fidi")}
      />
    );
  }

  if (screen === "west-village") {
    return (
      <WestVillageDistrict3D
        turtleName={turtleName}
        turtleVariant={turtleAppearance.variant}
        spawn={westVillageSpawn}
        onEnterBikeRace={() => setScreen("bike-race")}
        onEnterJazzClub={() => setScreen("jazz-club")}
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
