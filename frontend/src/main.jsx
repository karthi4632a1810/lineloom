import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./styles/clinical-curator.css";
import "./styles/nexaflow-theme.css";
import "./styles/nexaflow-flat.css";
import "./styles/live-queue.css";
import "./styles/infographic-charts.css";
import "./styles/token-create-invoice.css";
import "./styles/overview-modernize.css";
import "./styles/token-detail-modernize.css";
import "./styles/live-queue-modernize.css";
import "./styles/completed-queue-modernize.css";
import "./styles/modernize-blue-theme.css";
import "./styles/patient-records-modernize.css";
import "./styles/infographic-modernize.css";

document.body.classList.add("cc-theme");
if (localStorage.getItem("nexaflow_theme") === "dark") {
  document.documentElement.classList.add("dark");
  document.body.classList.add("dark");
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
