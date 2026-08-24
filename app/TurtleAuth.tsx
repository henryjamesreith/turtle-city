"use client";

import { useState, type FormEvent } from "react";

type TurtleAuthProps = {
  mode: "forgot-password" | "reset-password" | "sign-in" | "sign-up";
  onBack: () => void;
  onForgotPassword: () => void;
  onSubmit: (input: {
    email: string;
    password: string;
  }) => Promise<void>;
  onSwitchMode: () => void;
};

function friendlyAuthError(error: unknown) {
  if (!(error instanceof Error)) {
    return "Turtle City could not open your account. Please try again.";
  }

  const message = error.message.toLowerCase();

  if (message.includes("invalid login credentials")) {
    return "That email and password do not match.";
  }

  if (
    message.includes("already registered") ||
    message.includes("already been registered")
  ) {
    return "That email already has a turtle. Try signing in instead.";
  }

  if (message.includes("password")) {
    return "Use a password with at least 8 characters.";
  }

  return error.message;
}

export function TurtleAuth({
  mode,
  onBack,
  onForgotPassword,
  onSubmit,
  onSwitchMode,
}: TurtleAuthProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const isSignIn = mode === "sign-in";
  const isForgotPassword = mode === "forgot-password";
  const isResetPassword = mode === "reset-password";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isForgotPassword && password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await onSubmit({ email, password });
      if (isForgotPassword) {
        setResetEmailSent(true);
      }
    } catch (authError) {
      setError(friendlyAuthError(authError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-stage" data-testid={`turtle-${mode}`}>
      <button type="button" className="auth-back" onClick={onBack}>
        <span aria-hidden="true">←</span>
        Back
      </button>

      <section className="auth-card">
        <header>
          <p>
            {isForgotPassword || isResetPassword
              ? "Account recovery"
              : isSignIn
                ? "Welcome back"
                : "New resident"}
          </p>
          <h1>
            {isForgotPassword
              ? "Reset your password"
              : isResetPassword
                ? "Choose a new password"
                : isSignIn
                  ? "Find your turtle"
                  : "Create your account"}
          </h1>
          <span>
            {isForgotPassword
              ? "Enter your account email and we’ll send you a secure reset link."
              : isResetPassword
                ? "Use at least 8 characters. Then you’ll head straight back to your turtle."
                : isSignIn
              ? "Sign in and we’ll take you back to where you left off."
              : "Use an email and password so your turtle is never lost."}
          </span>
        </header>

        <form onSubmit={handleSubmit}>
          {!isResetPassword ? (
            <label htmlFor="auth-email">
              Email
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
          ) : null}

          {!isForgotPassword ? (
            <label htmlFor="auth-password">
              {isResetPassword ? "New password" : "Password"}
              <span className="auth-password-field">
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={isSignIn ? "current-password" : "new-password"}
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </span>
            </label>
          ) : null}

          {resetEmailSent ? (
            <p className="auth-success" role="status">
              Check your inbox. We sent a password reset link to {email}.
            </p>
          ) : null}

          {error ? (
            <p className="auth-error" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className="auth-primary"
            disabled={submitting || resetEmailSent}
          >
            {submitting
              ? isForgotPassword
                ? "Sending reset email…"
                : isResetPassword
                  ? "Saving password…"
                  : isSignIn
                ? "Finding your turtle…"
                : "Creating account…"
              : isForgotPassword
                ? resetEmailSent
                  ? "Reset email sent"
                  : "Send reset email"
                : isResetPassword
                  ? "Save new password"
                  : isSignIn
                    ? "Play"
                    : "Continue to your turtle"}
            <span aria-hidden="true">→</span>
          </button>
        </form>

        {!isResetPassword ? (
          <footer>
            {isForgotPassword ? (
              <>
                Remembered it?
                <button type="button" onClick={onBack}>
                  Sign in
                </button>
              </>
            ) : (
              <>
                <span>
                  {isSignIn ? "New to the city?" : "Already have a turtle?"}
                  <button type="button" onClick={onSwitchMode}>
                    {isSignIn ? "Create an account" : "Sign in"}
                  </button>
                </span>
                {isSignIn ? (
                  <button type="button" onClick={onForgotPassword}>
                    Forgot your password?
                  </button>
                ) : null}
              </>
            )}
          </footer>
        ) : null}
      </section>
    </main>
  );
}
