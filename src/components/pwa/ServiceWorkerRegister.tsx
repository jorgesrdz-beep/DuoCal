'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            console.log('[DuoCal PWA] Service Worker registrado con éxito:', reg.scope);
          })
          .catch((err) => {
            console.warn('[DuoCal PWA] Error al registrar Service Worker:', err);
          });
      });
    }
  }, []);

  return null;
}
