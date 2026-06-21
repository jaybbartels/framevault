import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import MobileApp from "./MobileApp.jsx";

// Simple path-based routing - no router library needed.
// /mobile (and any path starting with /mobile) loads the mobile-optimized UI.
// Everything else loads the existing desktop UI, completely unchanged.
const isMobileRoute = window.location.pathname.startsWith("/mobile");

const Root = isMobileRoute ? MobileApp : App;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
