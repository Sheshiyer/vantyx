import { useState, type FormEvent } from "react";
import { activate } from "../api";
import { AuthCard, Field, Submit } from "./AuthUi";

export function ActivateScreen({ token, onDone }: { token: string; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setBusy(true);
    setError("");
    try {
      await activate(token, password);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Activation failed");
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Set your password" subtitle="Activate your Vantyx access">
      <form onSubmit={submit} className="space-y-3">
        <Field label="New password" type="password" value={password} onChange={setPassword} autoFocus />
        <Field label="Confirm password" type="password" value={confirm} onChange={setConfirm} />
        {error && <p className="text-xs text-rose-300">{error}</p>}
        <Submit busy={busy} label="Set password & continue" />
      </form>
    </AuthCard>
  );
}
