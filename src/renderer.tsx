import React from 'react';
import { createRoot } from 'react-dom/client';
import './renderer/index.css';
import { App } from './renderer/App';

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
