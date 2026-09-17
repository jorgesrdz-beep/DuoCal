'use client';

import React from 'react';
import { Home, Utensils, ChefHat, CalendarDays, Camera, Settings } from 'lucide-react';

export type TabType = 'dashboard' | 'diary' | 'dishes' | 'planner' | 'photos' | 'settings';

interface BottomNavProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
}

export default function BottomNav({ currentTab, onSelectTab }: BottomNavProps) {
  const tabs: { id: TabType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Resumen', icon: Home },
    { id: 'diary', label: 'Diario', icon: Utensils },
    { id: 'dishes', label: 'Platillos', icon: ChefHat },
    { id: 'planner', label: 'Plan', icon: CalendarDays },
    { id: 'photos', label: 'Fotos', icon: Camera },
    { id: 'settings', label: 'Ajustes', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-lg border-t border-zinc-200 dark:border-zinc-800 pb-safe">
      <div className="max-w-md mx-auto grid grid-cols-6 py-1 px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition ${
                isActive
                  ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                  : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${isActive ? 'stroke-[2.4px]' : 'stroke-[1.8px]'}`} />
              <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-full">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
