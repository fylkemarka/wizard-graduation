import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { installTelemetry } from './telemetry.js';
import { ErrorBoundary, TelemetryBadge } from './TelemetryUI.jsx';
import { installSeedFromUrl } from './devSeed.js';

// Must run before any module-level RNG (uid counters, etc.) and before render.
installSeedFromUrl();
installTelemetry();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
      <TelemetryBadge />
    </ErrorBoundary>
  </React.StrictMode>
);
