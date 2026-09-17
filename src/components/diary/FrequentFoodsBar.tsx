'use client';

import React, { useState, useEffect } from 'react';
import { FrequentItem } from '@/types/database';
import { Sparkles, Plus, Check } from 'lucide-react';

interface FrequentFoodsBarProps {
  selectedDate: string;
  onLogAdded: () => void;
}

export default function FrequentFoodsBar({ selectedDate, onLogAdded }: FrequentFoodsBarProps) {
  const [items, setItems] = useState<FrequentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [justLoggedId, setJustLoggedId] = useState<string | null>(null);

  const fetchFrequent = async () => {
    try {
      const res = await fetch('/api/food-logs/frequent');
      if (res.ok) {
        const data = await res.json();
        setItems(data.frequentItems || []);
      }
    } catch {
      // Ignorar
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFrequent();
  }, []);

  const handleQuickLog = async (item: FrequentItem) => {
    try {
      setJustLoggedId(item.id);
      const res = await fetch('/api/food-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          meal_type: item.meal_type,
          food_id: item.food_id || null,
          food_name: item.name,
          amount_g: item.amount_g,
          calories: item.calories,
          protein_g: item.protein_g,
          carbs_g: item.carbs_g,
          fat_g: item.fat_g,
        }),
      });

      if (res.ok) {
        onLogAdded();
        setTimeout(() => setJustLoggedId(null), 1500);
      } else {
        setJustLoggedId(null);
      }
    } catch {
      setJustLoggedId(null);
    }
  };

  if (loading || items.length === 0) return null;

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-3xl p-3.5 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-2">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-800 dark:text-zinc-200">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Registro en 1 toque (Comidas Frecuentes)</span>
        </div>
        <span className="text-[10px] text-zinc-400">Toca para añadir a hoy</span>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {items.map((item) => {
          const isSuccess = justLoggedId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleQuickLog(item)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-semibold border transition active:scale-95 ${
                isSuccess
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-zinc-50 dark:bg-zinc-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700 hover:border-emerald-300'
              }`}
            >
              {isSuccess ? (
                <Check className="w-3.5 h-3.5 text-white" />
              ) : (
                <Plus className="w-3.5 h-3.5 text-emerald-500" />
              )}
              <span className="truncate max-w-[140px]">{item.name}</span>
              <span className={`text-[10px] ${isSuccess ? 'text-emerald-100' : 'text-zinc-400'}`}>
                {item.calories} kcal
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
