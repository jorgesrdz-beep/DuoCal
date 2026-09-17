'use client';

import React, { useState, useEffect } from 'react';
import { Download, X, Share, PlusSquare, Smartphone, CheckCircle2 } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPromptModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detectar si ya está corriendo en modo standalone (instalada)
    const isRunningStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(isRunningStandalone);

    // Detectar iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // Evento nativo de instalación para Android / Chrome / Edge
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        onClose();
      }
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-emerald-500/20">
              D
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                Instalar DuoCal
              </h3>
              <p className="text-[11px] text-zinc-400">Modo App Nativa a pantalla completa</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isStandalone ? (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
              ¡DuoCal ya está instalada en tu dispositivo!
            </p>
            <p className="text-[11px] text-zinc-500">
              Estás disfrutando la experiencia a pantalla completa y sin barra de navegación.
            </p>
          </div>
        ) : isIOS ? (
          /* Instrucciones para iPhone / iPad en Safari */
          <div className="space-y-3">
            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
              Para instalar DuoCal en tu <strong>iPhone</strong> sin pasar por la App Store:
            </p>

            <div className="space-y-2 bg-zinc-50 dark:bg-zinc-800/60 p-3 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/60 text-xs">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  1
                </span>
                <span className="text-zinc-700 dark:text-zinc-300">
                  Toca el botón <strong>Compartir</strong> en la barra inferior de Safari{' '}
                  <Share className="w-3.5 h-3.5 inline text-blue-500 mx-0.5" />.
                </span>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  2
                </span>
                <span className="text-zinc-700 dark:text-zinc-300">
                  Baja en el menú y presiona{' '}
                  <strong>&ldquo;Agregar a pantalla de inicio&rdquo;</strong>{' '}
                  <PlusSquare className="w-3.5 h-3.5 inline text-zinc-700 dark:text-zinc-300 mx-0.5" />.
                </span>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  3
                </span>
                <span className="text-zinc-700 dark:text-zinc-300">
                  Toca <strong>&ldquo;Agregar&rdquo;</strong> en la esquina superior derecha. ¡Listo!
                </span>
              </div>
            </div>
          </div>
        ) : deferredPrompt ? (
          /* Botón 1-clic para Android / Chrome / Edge */
          <div className="space-y-3">
            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
              Instala DuoCal en tu celular o computadora para abrirla al instante desde tu pantalla de inicio, recibir notificaciones y usarla sin barra de navegador.
            </p>

            <button
              onClick={handleInstallClick}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20"
            >
              <Download className="w-4 h-4" />
              <span>Instalar en 1 Clic</span>
            </button>
          </div>
        ) : (
          /* Instrucciones genéricas para Android si no dispara antes */
          <div className="space-y-3">
            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
              En el menú de tu navegador (tres puntos ⋮ en la esquina superior), selecciona{' '}
              <strong>&ldquo;Instalar aplicación&rdquo;</strong> o{' '}
              <strong>&ldquo;Agregar a la pantalla principal&rdquo;</strong>.
            </p>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
