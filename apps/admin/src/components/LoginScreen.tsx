import { useState, type FormEvent } from "react";
import { login } from "../api";
import { AuthCard, Field, Submit } from "./AuthUi";
import { Turnstile, useTurnstileSiteKey } from "./Turnstile";

export function LoginScreen({ onDone, onForgot }: { onDone: () => void; onForgot: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const siteKey = useTurnstileSiteKey();
  const [token, setToken] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (siteKey && !token) return setError("Please complete the verification.");
    setBusy(true);
    setError("");
    try {
      await login(email, password, token || undefined);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Sign in" subtitle="Manage your 360° tour">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Email" type="email" value={email} onChange={setEmail} autoFocus />
        <Field label="Password" type="password" value={password} onChange={setPassword} />
        <Turnstile siteKey={siteKey} onToken={setToken} />
        {error && <p className="text-xs text-rose-300">{error}</p>}
        <Submit busy={busy} label="Sign in" />
        <button
          type="button"
          onClick={onForgot}
          className="block w-full pt-1 text-center text-xs text-white/50 transition-colors hover:text-white/80"
        >
          Forgot your password?
        </button>
      </form>
    </AuthCard>
  );
}
