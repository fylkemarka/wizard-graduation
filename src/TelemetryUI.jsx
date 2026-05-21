import React, { useEffect, useState } from 'react';
import { getStats, exportAllSessions, clearTelemetry, logError } from './telemetry.js';

// React error boundary — wraps <App /> in main.jsx. Logs the error to
// telemetry and shows a recovery card so the player isn't staring at a
// blank page.
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    logError(error, { source: 'react-error-boundary', componentStack: info?.componentStack });
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ padding: '32px', maxWidth: 720, margin: '0 auto', fontFamily: 'monospace' }}>
        <h1 style={{ fontSize: 24, color: '#fda4af', marginBottom: 12 }}>The spell unravelled.</h1>
        <p style={{ color: '#e5e7eb', marginBottom: 16 }}>
          The game hit an error and recovered. The error has been logged. You can
          export your session data and reload to keep playing.
        </p>
        <pre style={{ background: '#1f2937', color: '#fca5a5', padding: 12, borderRadius: 6, overflowX: 'auto', fontSize: 12 }}>
          {String(this.state.error?.message || this.state.error)}
        </pre>
        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <button onClick={() => exportAllSessions()} style={btnStyle}>Export telemetry JSON</button>
          <button onClick={() => window.location.reload()} style={btnStyle}>Reload</button>
        </div>
      </div>
    );
  }
}

const btnStyle = {
  padding: '8px 14px',
  background: '#374151',
  color: '#e5e7eb',
  border: '1px solid #4b5563',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 13,
};

// Fixed-position telemetry status badge. Always visible in the bottom-
// right corner. Click to expand into a panel with export / clear /
// session info.
export function TelemetryBadge() {
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState(getStats());

  useEffect(() => {
    // Poll the in-memory buffer every second — cheaper than an event bus
    // for a debug badge.
    const id = setInterval(() => setStats(getStats()), 1000);
    return () => clearInterval(id);
  }, []);

  const hasError = stats.errors > 0;
  return (
    <div style={{
      position: 'fixed',
      bottom: 12,
      right: 12,
      zIndex: 9999,
      fontFamily: 'monospace',
      fontSize: 11,
      pointerEvents: 'auto',
    }}>
      {open && (
        <div style={{
          background: 'rgba(17, 24, 39, 0.96)',
          color: '#e5e7eb',
          border: `1px solid ${hasError ? '#ef4444' : '#374151'}`,
          borderRadius: 8,
          padding: 12,
          marginBottom: 6,
          width: 280,
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: 6, color: '#fde68a' }}>Telemetry</div>
          <div style={{ marginBottom: 4 }}>Session: <span style={{ color: '#93c5fd' }}>{(stats.sessionId || '').slice(-8)}</span></div>
          <div style={{ marginBottom: 4 }}>Events: <span style={{ color: '#86efac' }}>{stats.events}</span></div>
          <div style={{ marginBottom: 10, color: hasError ? '#fca5a5' : '#9ca3af' }}>Errors: {stats.errors}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button onClick={() => exportAllSessions()} style={btnStyle}>Export JSON</button>
            <button onClick={() => { if (confirm('Clear all telemetry sessions?')) clearTelemetry(); }} style={btnStyle}>Clear All</button>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen(o => !o)}
        title={hasError ? `${stats.errors} error(s) logged` : `${stats.events} events recorded`}
        style={{
          background: hasError ? '#7f1d1d' : 'rgba(17, 24, 39, 0.85)',
          color: hasError ? '#fecaca' : '#9ca3af',
          border: `1px solid ${hasError ? '#ef4444' : '#374151'}`,
          borderRadius: 16,
          padding: '4px 10px',
          cursor: 'pointer',
          fontFamily: 'monospace',
          fontSize: 11,
        }}>
        {hasError ? `⚠ ${stats.errors} err` : `● ${stats.events} ev`}
      </button>
    </div>
  );
}
