import { useState, type FormEvent } from "react";
import { login } from "../api";
import { AuthCard, Field, Submit } from "./AuthUi";

export function LoginScreen({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email, password);
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
        {error && <p className="text-xs text-rose-300">{error}</p>}
        <Submit busy={busy} label="Sign in" />
      </form>
    </AuthCard>
  );
}
