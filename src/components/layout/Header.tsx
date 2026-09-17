'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Users, LogOut, Copy, Check, Target, Smartphone } from 'lucide-react';
import InstallPromptModal from '@/components/pwa/InstallPromptModal';

export default function Header() {
  const { user, household, partner, activeGoal, logout } = useAuth();
  const [copied, setCopied] = useState(false);
  const [isInstallOpen, setIsInstallOpen] = useState(false);

  const copyInvite = () => {
    if (household?.invite_code) {
      navigator.clipboard.writeText(household.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getGoalLabel = (type?: string) => {
    switch (type) {
      case 'definition': return 'Definición';
      case 'recomposition': return 'Recomposición';
      case 'maintenance': return 'Mantenimiento';
      case 'bulking': return 'Volumen';
      default: return 'Meta';
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              D
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-zinc-900 dark:text-white leading-tight">
                  DuoCal
                </h1>
                {household && (
                  <button
                    onClick={copyInvite}
                    title={partner ? "Código de tu hogar compartido" : "Invitar a un compañero / roomie con este código"}
                    className="inline-flex items-center gap-1 text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-2 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
                  >
                    <Users className="w-3 h-3 text-emerald-500" />
                    <span>{household.invite_code}</span>
                    {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-zinc-400" />}
                  </button>
                )}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {partner ? `${user?.display_name} & ${partner.display_name}` : (user?.display_name || 'Usuario')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {activeGoal && (
              <div className="hidden sm:flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800/60 font-medium">
                <Target className="w-3.5 h-3.5" />
                <span>{getGoalLabel(activeGoal.goal_type)}: {activeGoal.calorie_target} kcal</span>
              </div>
            )}

            <button
              onClick={() => setIsInstallOpen(true)}
              title="Instalar DuoCal en tu celular / PWA"
              className="p-2 text-zinc-500 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition flex items-center gap-1 text-xs font-semibold"
            >
              <Smartphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden md:inline">Instalar App</span>
            </button>

            <button
              onClick={logout}
              title="Cerrar sesión"
              className="p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <InstallPromptModal isOpen={isInstallOpen} onClose={() => setIsInstallOpen(false)} />
    </>
  );
}
