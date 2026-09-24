'use client';

import React, { useState, useEffect } from 'react';
import { MealType } from '@/types/database';
import { CalendarDays, Plus, Check } from 'lucide-react';
import { getLocalDateString, formatDateToYYYYMMDD } from '@/lib/utils';

interface FrequentFoodsBarProps {
  selectedDate: string;
  weeklyPlans?: any[];
  currentLogs?: any[];
  onLogAdded: () => void;
}

const DAY_NAMES: Record<number, string> = {
  1: 'Lun',
  2: 'Mar',
  3: 'Mié',
  4: 'Jue',
  5: 'Vie',
  6: 'Sáb',
  7: 'Dom',
};

const MEAL_SHORT_NAMES: Record<MealType, string> = {
  breakfast: 'Des',
  lunch: 'Com',
  dinner: 'Cen',
  snack: 'Snk',
};

export default function FrequentFoodsBar({
  selectedDate,
  weeklyPlans: propWeeklyPlans,
  currentLogs = [],
  onLogAdded,
}: FrequentFoodsBarProps) {
  const [internalPlans, setInternalPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [justLoggedId, setJustLoggedId] = useState<string | null>(null);

  function getPlanDateInfo(dateStr: string) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const jsDay = date.getDay();
    const dayOfWeek = jsDay === 0 ? 7 : jsDay;
    const diff = d - jsDay + (jsDay === 0 ? -6 : 1);
    const monday = new Date(y, m - 1, diff);
    const weekStart = formatDateToYYYYMMDD(monday);
    return { dayOfWeek, weekStart };
  }

  const { dayOfWeek: selectedDayOfWeek, weekStart } = getPlanDateInfo(selectedDate);

  useEffect(() => {
    if (propWeeklyPlans !== undefined) return;
    let isMounted = true;
    setLoading(true);
    fetch(`/api/meal-plans?week_start=${weekStart}`)
      .then((res) => (res.ok ? res.json() : { plans: [] }))
      .then((data) => {
        if (isMounted) {
          setInternalPlans(data.plans || []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [weekStart, propWeeklyPlans]);

  const plansToUse = propWeeklyPlans !== undefined ? propWeeklyPlans : internalPlans;

  // Ordenar y deduplicar: primero los platillos del día seleccionado, luego otros platillos distintos de la semana
  const todayPlans = plansToUse.filter((p) => p.day_of_week === selectedDayOfWeek);
  const todayNames = new Set(todayPlans.map((p) => p.custom_name.trim().toLowerCase()));

  const otherUniquePlans: any[] = [];
  const seenOtherNames = new Set<string>();

  plansToUse
    .filter((p) => p.day_of_week !== selectedDayOfWeek)
    .forEach((p) => {
      const norm = p.custom_name.trim().toLowerCase();
      if (!todayNames.has(norm) && !seenOtherNames.has(norm)) {
        seenOtherNames.add(norm);
        otherUniquePlans.push(p);
      }
    });

  const sortedPlans = [...todayPlans, ...otherUniquePlans];

  const isAlreadyLogged = (item: any) => {
    const cleanName = item.custom_name.replace(/\s*\(.*$/, '').trim().toLowerCase();
    return currentLogs.some((l) => {
      const logName = l.food_name.toLowerCase();
      const matches = logName.includes(cleanName) || cleanName.includes(logName.replace(/\s*\(.*$/, '').trim());
      return matches;
    });
  };

  const handleQuickLog = async (item: any) => {
    try {
      setJustLoggedId(item.id);
      const res = await fetch('/api/food-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          meal_type: item.meal_type,
          food_id: item.food_id || null,
          food_name: item.custom_name,
          amount_g: item.servings ? Math.round(item.servings * 250) : 250,
          calories: item.calories,
          protein_g: item.protein_g,
          carbs_g: item.carbs_g,
          fat_g: item.fat_g,
          fiber_g: item.fiber_g || 0,
        }),
      });

      if (res.ok) {
        onLogAdded();
        setTimeout(() => setJustLoggedId(null), 1800);
      } else {
        setJustLoggedId(null);
      }
    } catch {
      setJustLoggedId(null);
    }
  };

  const isToday = selectedDate === getLocalDateString();

  if (loading && sortedPlans.length === 0) {
    return null;
  }

  if (sortedPlans.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-3.5 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-800 dark:text-zinc-200">
            <CalendarDays className="w-3.5 h-3.5 text-emerald-500" />
            <span>Platillos programados en la semana</span>
          </div>
          <span className="text-[10px] text-zinc-400">Plan Semanal</span>
        </div>
        <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-700/60 text-center text-xs text-zinc-400">
          Aún no tienes platillos programados esta semana. Agrégalos en tu pestaña <strong className="text-zinc-600 dark:text-zinc-300">Plan Semanal</strong> para tenerlos aquí con 1 toque.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-3xl p-3.5 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-2">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-800 dark:text-zinc-200">
          <CalendarDays className="w-3.5 h-3.5 text-emerald-500" />
          <span>Platillos programados en la semana</span>
        </div>
        <span className="text-[10px] text-zinc-400">
          Toca para jalar a {isToday ? 'hoy' : 'este día'}
        </span>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {sortedPlans.map((item) => {
          const isJustAdded = justLoggedId === item.id;
          const isLogged = isAlreadyLogged(item);
          const isSelectedDay = item.day_of_week === selectedDayOfWeek;
          const cleanName = item.custom_name.replace(/\s*\(.*$/, '').trim();
          const dayLabel = isSelectedDay ? (isToday ? 'Hoy' : 'Este día') : DAY_NAMES[item.day_of_week] || 'Día';
          const mealShort = MEAL_SHORT_NAMES[item.meal_type as MealType] || item.meal_type;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleQuickLog(item)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-semibold border transition active:scale-95 ${
                isJustAdded
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : isLogged
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border-emerald-300/80 dark:border-emerald-800/60'
                  : 'bg-zinc-50 dark:bg-zinc-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700 hover:border-emerald-300'
              }`}
              title={
                isLogged
                  ? `Ya registrado para hoy. Toca para registrar otra porción.`
                  : `Toca para jalar y registrar en ${item.meal_type}`
              }
            >
              {isJustAdded ? (
                <Check className="w-3.5 h-3.5 text-white animate-bounce" />
              ) : isLogged ? (
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Plus className="w-3.5 h-3.5 text-emerald-500" />
              )}

              {/* Tag de Día y Comida */}
              <span
                className={`px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tight ${
                  isJustAdded
                    ? 'bg-white/20 text-white'
                    : isSelectedDay
                    ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200'
                    : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
                }`}
              >
                {dayLabel} • {mealShort}
              </span>

              <span className="truncate max-w-[130px]">{cleanName}</span>

              <span
                className={`text-[10px] ${
                  isJustAdded
                    ? 'text-emerald-100'
                    : isLogged
                    ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                    : 'text-zinc-400'
                }`}
              >
                {item.calories} kcal
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
