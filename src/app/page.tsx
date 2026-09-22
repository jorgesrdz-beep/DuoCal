'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import Header from '@/components/layout/Header';
import BottomNav, { TabType } from '@/components/layout/BottomNav';
import AuthModal from '@/components/auth/AuthModal';
import WeeklyBalanceCard from '@/components/dashboard/WeeklyBalanceCard';
import DailyDiary from '@/components/diary/DailyDiary';
import DishManager from '@/components/dishes/DishManager';
import WeeklyPlanner from '@/components/planner/WeeklyPlanner';
import PhotoTracker from '@/components/photos/PhotoTracker';
import GoalManager from '@/components/goals/GoalManager';

export default function Home() {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<TabType>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-emerald-500/20 animate-pulse">
          D
        </div>
        <p className="text-xs text-zinc-400 mt-3 font-medium">Cargando DuoCal...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthModal />;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-lg w-full mx-auto px-4 pt-4 pb-20">
        {currentTab === 'dashboard' && <WeeklyBalanceCard />}
        {currentTab === 'diary' && <DailyDiary />}
        {currentTab === 'planner' && <WeeklyPlanner />}
        {currentTab === 'dishes' && <DishManager />}
        {currentTab === 'photos' && <PhotoTracker />}
        {currentTab === 'settings' && <GoalManager />}
      </main>

      <BottomNav currentTab={currentTab} onSelectTab={setCurrentTab} />
    </div>
  );
}
