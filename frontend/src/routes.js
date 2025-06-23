// src/routes.js
import React from "react";
import App from "./App";               // keeps your context & AI agents

export const routes = [
    { path: "*", element: <App /> },
];

export default routes;