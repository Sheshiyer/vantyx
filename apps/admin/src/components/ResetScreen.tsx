import { useState, type FormEvent } from "react";
import { requestReset, resetPassword } from "../api";
import { AuthCard, Field, Submit } from "./AuthUi";
import { Turnstile, useTurnstileSiteKey } from "./Turnstile";

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full pt-1 text-center text-xs text-white/50 transition-colors hover:text-white/80"
    >
      Back to sign in
    </button>
  );
}

/** No token → ask for an email and send a reset link. With a token → set the new password. */
export function ResetScreen({
  token,
  onDone,
  onBackToLogin,
}: {
  token?: string;
  onDone: () => void;
  onBackToLogin: () => void;
}) {
  const siteKey = useTurnstileSiteKey();
  const [tsToken, setTsToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // --- request mode ---
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<{ link?: string } | null>(null);

  async function submitRequest(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await requestReset(email);
      setSent({ link: res.resetUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the reset link");
    } finally {
      setBusy(false);
    }
  }

  // --- confirm mode ---
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  async function submitConfirm(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    if (siteKey && !tsToken) return setError("Please complete the verification.");
    setBusy(true);
    setError("");
    try {
      await resetPassword(token!, password, tsToken || undefined);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
      setBusy(false);
    }
  }

  if (token) {
    return (
      <AuthCard title="Choose a new password" subtitle="Set a new password for your account">
        <form onSubmit={submitConfirm} className="space-y-3">
          <Field label="New password" type="password" value={password} onChange={setPassword} autoFocus />
          <Field label="Confirm password" type="password" value={confirm} onChange={setConfirm} />
          <Turnstile siteKey={siteKey} onToken={setTsToken} />
          {error && <p className="text-xs text-rose-300">{error}</p>}
          <Submit busy={busy} label="Update password & continue" />
          <BackLink onClick={onBackToLogin} />
        </form>
      </AuthCard>
    );
  }

  if (sent) {
    return (
      <AuthCard title="Check your email" subtitle="If that account exists, a reset link is on its way.">
        {sent.link && (
          <p className="mb-3 break-all text-xs text-white/60">
            No mail provider is configured, so here's the link:{" "}
            <a href={sent.link} className="text-indigo-300 underline">
              reset password
            </a>
          </p>
        )}
        <BackLink onClick={onBackToLogin} />
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Reset your password" subtitle="We'll email you a link to set a new one">
      <form onSubmit={submitRequest} className="space-y-3">
        <Field label="Email" type="email" value={email} onChange={setEmail} autoFocus />
        {error && <p className="text-xs text-rose-300">{error}</p>}
        <Submit busy={busy} label="Send reset link" />
        <BackLink onClick={onBackToLogin} />
      </form>
    </AuthCard>
  );
}
