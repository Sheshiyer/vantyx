import { createRoot } from "react-dom/client";
import { App } from "./App";
import { installErrorTracking } from "./lib/telemetry";
import "./index.css";

installErrorTracking("viewer");

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

// No StrictMode: Pannellum holds a WebGL context and double-invoked mount effects
// would init/destroy/init the viewer, which it doesn't tolerate well.
createRoot(root).render(<App />);
