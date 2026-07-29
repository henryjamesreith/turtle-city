"use client";

import Image from "next/image";
import {
  useState,
  type FormEvent,
} from "react";
import {
  defaultTurtleAppearance,
  type TurtleAppearance,
} from "@/lib/persistence/playerPersistence";
import { turtleVariants } from "@/lib/turtles";

type TurtleOnboardingProps = {
  initialAppearance?: TurtleAppearance;
  initialName?: string;
  initialPersonality?: string;
  mode: "creator" | "welcome";
  onBack: () => void;
  onCreate: () => void;
  onPlay: () => void;
  onSave: (input: {
    appearance: TurtleAppearance;
    personality: string;
    turtleName: string;
  }) => Promise<void>;
  sessionLoading?: boolean;
};

function TurtlePreview({
  appearance,
  label,
}: {
  appearance: TurtleAppearance;
  label: string;
}) {
  return (
    <div
      className="turtle-preview"
      data-turtle-variant={appearance.variant}
      role="img"
      aria-label={label}
    >
      <span className="turtle-preview-shadow" aria-hidden="true" />
      <span className="turtle-preview-character" aria-hidden="true" />
    </div>
  );
}

export function TurtleOnboarding({
  initialAppearance = defaultTurtleAppearance,
  initialName = "",
  initialPersonality = "",
  mode,
  onBack,
  onCreate,
  onPlay,
  onSave,
  sessionLoading = false,
}: TurtleOnboardingProps) {
  const [appearance, setAppearance] =
    useState<TurtleAppearance>(initialAppearance);
  const [turtleName, setTurtleName] = useState(initialName);
  const [personality, setPersonality] = useState(initialPersonality);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = turtleName.trim();

    if (trimmedName.length < 2 || trimmedName.length > 20) {
      setError("Choose a name between 2 and 20 characters.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await onSave({
        appearance,
        personality: personality.trim(),
        turtleName: trimmedName,
      });
    } catch (saveError) {
      console.warn("Turtle City could not create this turtle.", saveError);
      setError("The city is having trouble moving you in. Please try again.");
      setSaving(false);
    }
  }

  if (mode === "welcome") {
    return (
      <main className="onboarding-stage" data-testid="turtle-welcome">
        <div className="onboarding-skyline" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>

        <section className="welcome-card">
          <header className="welcome-wordmark">
            <p>A small shell in a very big city</p>
            <h1>Turtle City</h1>
          </header>

          <div className="welcome-portrait">
            <TurtlePreview
              appearance={initialAppearance}
              label="A Turtle City resident"
            />
          </div>

          <div className="welcome-copy">
            <p className="welcome-kicker">
              New York is a hard place to be soft-shelled.
            </p>
            <h2>Find an apartment. Explore the city. Make it yours.</h2>
          </div>

          <div className="welcome-actions">
            <button
              type="button"
              className="onboarding-primary"
              disabled={sessionLoading}
              onClick={onPlay}
            >
              {sessionLoading ? "Opening Turtle City…" : "Play"}
              <span aria-hidden="true">→</span>
            </button>
            <button
              type="button"
              className="onboarding-secondary"
              disabled={sessionLoading}
              onClick={onCreate}
            >
              Create a turtle
            </button>
          </div>

          <p className="welcome-privacy">
            Play to continue, or create a turtle to start fresh.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="onboarding-stage creator-stage" data-testid="turtle-creator">
      <button type="button" className="creator-back" onClick={onBack}>
        <span aria-hidden="true">←</span>
        Back
      </button>

      <section className="creator-shell">
        <div className="creator-preview-panel">
          <header className="creator-wordmark">
            <p>Turtle City residency office</p>
            <h1>Create your turtle</h1>
          </header>

          <TurtlePreview
            appearance={appearance}
            label={`${turtleVariants.find((turtle) => turtle.id === appearance.variant)?.label ?? "Selected"} turtle preview`}
          />

          <div className="creator-address">
            <span>New home</span>
            <strong>Apartment 4B</strong>
            <small>Chelsea, Turtle City</small>
          </div>
        </div>

        <form className="creator-form" onSubmit={handleSubmit}>
          <div className="creator-field">
            <label htmlFor="turtle-name">What should we call you?</label>
            <input
              id="turtle-name"
              name="turtle-name"
              type="text"
              minLength={2}
              maxLength={20}
              autoComplete="off"
              placeholder="Myrtle"
              value={turtleName}
              onChange={(event) => setTurtleName(event.target.value)}
            />
            <small>{turtleName.length}/20</small>
          </div>

          <fieldset className="creator-options turtle-options">
            <legend>Choose your turtle</legend>
            <div>
              {turtleVariants.map((turtle) => (
                <button
                  key={turtle.id}
                  type="button"
                  className={
                    appearance.variant === turtle.id ? "is-selected" : ""
                  }
                  aria-pressed={appearance.variant === turtle.id}
                  onClick={() =>
                    setAppearance({ variant: turtle.id })
                  }
                >
                  <span className="creator-turtle-thumbnail" aria-hidden="true">
                    <Image
                      src={turtle.image}
                      alt=""
                      width={58}
                      height={62}
                      sizes="58px"
                    />
                  </span>
                  {turtle.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="creator-field personality-field">
            <label htmlFor="turtle-personality">
              Describe your personality <span>Optional</span>
            </label>
            <textarea
              id="turtle-personality"
              name="turtle-personality"
              maxLength={240}
              placeholder="Night owl, jazz fan, always knows the fastest subway route…"
              value={personality}
              onChange={(event) => setPersonality(event.target.value)}
            />
            <small>{personality.length}/240</small>
          </div>

          {error ? (
            <p className="creator-error" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className="onboarding-primary creator-submit"
            disabled={saving}
          >
            {saving ? "Getting the keys…" : "Move to Turtle City"}
            <span aria-hidden="true">→</span>
          </button>
        </form>
      </section>
    </main>
  );
}
