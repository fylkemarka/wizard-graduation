import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { installTelemetry } from './telemetry.js';
import { ErrorBoundary, TelemetryBadge } from './TelemetryUI.jsx';

installTelemetry();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
      <TelemetryBadge />
    </ErrorBoundary>
  </React.StrictMode>
);
