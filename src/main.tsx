import React from "react";
import ReactDOM from "react-dom/client";
import "@flairjs/client/theme.css";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./routes/router";
import { applyStoredThemePreference } from "./utils/theme";
import "./style.css";

applyStoredThemePreference();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
