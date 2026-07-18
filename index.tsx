import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

const updateSW = registerSW({
  onNeedRefresh() {
    // Automatically update in background for PWA
    updateSW(true);
  },
  onOfflineReady() {
    console.log('التطبيق جاهز للعمل بدون إنترنت');
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
