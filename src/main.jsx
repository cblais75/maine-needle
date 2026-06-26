import React from "react";
import { createRoot } from "react-dom/client";
import MaineDashboard from "./MaineDashboard.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <MaineDashboard />
  </React.StrictMode>
);
