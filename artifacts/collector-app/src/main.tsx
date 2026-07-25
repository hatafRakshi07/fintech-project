import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Ensure demo token & user are pre-set so no login screen is required
if (!localStorage.getItem("auth_token")) {
  localStorage.setItem("auth_token", "demo-presentation-token");
}
if (!localStorage.getItem("collector_user")) {
  localStorage.setItem("collector_user", JSON.stringify({ id: 1, username: "collector1", name: "Senior Collector", role: "collector" }));
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
