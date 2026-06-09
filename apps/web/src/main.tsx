import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RootProviders } from "@/app/providers";
import "@/styles.css";

const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error("Unable to mount web app: #root was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <RootProviders />
  </StrictMode>,
);
