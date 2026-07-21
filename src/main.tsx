import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { PlatformStatusProvider } from './context/PlatformStatusContext';
import { PlayerProvider } from './context/PlayerContext';
import './index.css';
import './shell.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PlayerProvider>
      <PlatformStatusProvider>
        <App />
      </PlatformStatusProvider>
    </PlayerProvider>
  </React.StrictMode>,
);
