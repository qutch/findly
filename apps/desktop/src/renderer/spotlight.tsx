import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SpotlightApp } from "./SpotlightApp";
import "./spotlight.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SpotlightApp />
  </StrictMode>,
);
