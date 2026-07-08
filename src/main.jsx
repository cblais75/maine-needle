import React from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import MaineDashboard from "./MaineDashboard.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <MaineDashboard />
    <Analytics />
  </React.StrictMode>
);
