import React from 'react';
import { createRoot } from 'react-dom/client';
import './renderer/index.css';
import { App } from './renderer/App';
import { ErrorBoundary } from './renderer/components/error-boundary';

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
