import React from "react";
import { createRoot } from "react-dom/client";
import MaineDashboard from "./MaineDashboard.jsx";
import { Analytics } from "@vercel/analytics/react";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <MaineDashboard />
    <Analytics />
  </React.StrictMode>
);
