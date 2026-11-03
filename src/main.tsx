import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import App from "./app/App";
import { CONVEX_URL } from "./lib/config";
import "./index.css";

const root = createRoot(document.getElementById("root")!);

// Sans VITE_CONVEX_URL, le site reste affichable (mode aperçu) mais sans backend.
const convex = CONVEX_URL ? new ConvexReactClient(CONVEX_URL) : null;

const app = (
  <BrowserRouter>
    <App backendConnected={convex !== null} />
  </BrowserRouter>
);

root.render(
  <StrictMode>
    {convex ? <ConvexAuthProvider client={convex}>{app}</ConvexAuthProvider> : app}
  </StrictMode>,
);
