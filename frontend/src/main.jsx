/**
 * src/main.jsx
 *
 * React application entry point.
 * StrictMode enabled — highlights potential issues in development
 * (double-renders effects, deprecated API usage etc.)
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
