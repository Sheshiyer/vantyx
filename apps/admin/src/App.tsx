import { useEffect, useState } from "react";
import { getMe, logout, type Me } from "./api";
import { AdminApp } from "./AdminApp";
import { LoginScreen } from "./components/LoginScreen";
import { ActivateScreen } from "./components/ActivateScreen";
import { ResetScreen } from "./components/ResetScreen";
import { identify } from "./lib/telemetry";

type Gate =
  | { status: "checking" }
  | { status: "activate"; token: string }
  | { status: "reset"; token?: string }
  | { status: "login" }
  | { status: "in"; me: Me };

export function App() {
  const [gate, setGate] = useState<Gate>({ status: "checking" });

  function refresh() {
    setGate({ status: "checking" });
    getMe()
      .then((me) => {
        if (me) identify(me.email);
        setGate(me ? { status: "in", me } : { status: "login" });
      })
      .catch(() => setGate({ status: "login" }));
  }

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (token && window.location.pathname.includes("/reset")) {
      setGate({ status: "reset", token });
      return;
    }
    if (token) {
      setGate({ status: "activate", token });
      return;
    }
    refresh();
  }, []);

  async function signOut() {
    await logout();
    setGate({ status: "login" });
  }

  function toLogin() {
    window.history.replaceState({}, "", "/admin/");
    setGate({ status: "login" });
  }

  if (gate.status === "checking") {
    return <div className="flex h-full items-center justify-center text-sm text-white/50">…</div>;
  }
  if (gate.status === "activate") {
    return (
      <ActivateScreen
        token={gate.token}
        onDone={() => {
          window.history.replaceState({}, "", "/admin/");
          refresh();
        }}
      />
    );
  }
  if (gate.status === "reset") {
    return (
      <ResetScreen
        token={gate.token}
        onDone={() => {
          window.history.replaceState({}, "", "/admin/");
          refresh();
        }}
        onBackToLogin={toLogin}
      />
    );
  }
  if (gate.status === "login") {
    return <LoginScreen onDone={refresh} onForgot={() => setGate({ status: "reset" })} />;
  }
  return <AdminApp email={gate.me.email} onSignOut={signOut} />;
}
