'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Plus, Trash2, Search, Camera, ChevronLeft, ChevronRight, Check, Sparkles, X, Droplets, Barcode } from 'lucide-react';
import { MealType, Food } from '@/types/database';
import FrequentFoodsBar from '@/components/diary/FrequentFoodsBar';
import BarcodeScannerModal from '@/components/scanner/BarcodeScannerModal';

export default function DailyDiary() {
  const { activeGoal } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [logs, setLogs] = useState<any[]>([]);
  const [totals, setTotals] = useState({ calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 });
  const [waterIntake, setWaterIntake] = useState(0);
  const [loading, setLoading] = useState(true);

  // Modal de búsqueda / añadir comida
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeMealType, setActiveMealType] = useState<MealType>('lunch');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Food[]>([]);
  const [searching, setSearching] = useState(false);

  // Alimento seleccionado para registrar
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [amountGrams, setAmountGrams] = useState(100);

  // Modo pestaña dentro del modal: 'food' o 'dish'
  const [modalTab, setModalTab] = useState<'food' | 'dish'>('food');
  const [savedDishes, setSavedDishes] = useState<any[]>([]);
  const [selectedDish, setSelectedDish] = useState<any | null>(null);
  const [dishPortionCount, setDishPortionCount] = useState(1);

  // Modo Escáner de Etiqueta con IA
  const [isAiScannerOpen, setIsAiScannerOpen] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);

  // Modo Escáner de Códigos de Barras (OpenFoodFacts)
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);

  const fetchLogs = async (date: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/food-logs?date=${date}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setTotals(data.totals || { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 });
      }
    } catch {
      // Ignorar
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(selectedDate);
    fetchDishes();
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`duocal_water_${selectedDate}`);
      setWaterIntake(saved ? parseInt(saved, 10) : 0);
    }
  }, [selectedDate]);

  const handleAdjustWater = (delta: number) => {
    setWaterIntake((prev) => {
      const updated = Math.max(0, prev + delta);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`duocal_water_${selectedDate}`, String(updated));
      }
      return updated;
    });
  };

  const changeDate = (days: number) => {
    const current = new Date(selectedDate + 'T00:00:00');
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/foods/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.foods || []);
      }
    } finally {
      setSearching(false);
    }
  };

  const handleSelectFood = (food: Food) => {
    setSelectedFood(food);
    setAmountGrams(food.serving_size_g || 100);
  };

  const handleSaveLog = async () => {
    if (!selectedFood) return;

    const ratio = amountGrams / (selectedFood.serving_size_g || 100);
    const calories = Math.round(selectedFood.calories * ratio);
    const protein_g = Number((selectedFood.protein_g * ratio).toFixed(1));
    const carbs_g = Number((selectedFood.carbs_g * ratio).toFixed(1));
    const fat_g = Number((selectedFood.fat_g * ratio).toFixed(1));

    try {
      const res = await fetch('/api/food-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          meal_type: activeMealType,
          food_id: selectedFood.id,
          food_name: selectedFood.name + (selectedFood.brand ? ` (${selectedFood.brand})` : ''),
          amount_g: amountGrams,
          calories,
          protein_g,
          carbs_g,
          fat_g,
        }),
      });

      if (res.ok) {
        await fetchLogs(selectedDate);
        setIsModalOpen(false);
        setSelectedFood(null);
        setSearchQuery('');
        setSearchResults([]);
      }
    } catch {
      // Manejar error
    }
  };

  const fetchDishes = async () => {
    try {
      const res = await fetch('/api/dishes');
      if (res.ok) {
        const data = await res.json();
        setSavedDishes(data.dishes || []);
      }
    } catch {
      // Ignorar
    }
  };

  const handleSaveDishLog = async () => {
    if (!selectedDish) return;
    const count = Number(dishPortionCount) || 1;
    const calories = Math.round(selectedDish.calories_per_serving * count);
    const protein_g = Number((selectedDish.protein_per_serving * count).toFixed(1));
    const carbs_g = Number((selectedDish.carbs_per_serving * count).toFixed(1));
    const fat_g = Number((selectedDish.fat_per_serving * count).toFixed(1));
    const amount_g = selectedDish.total_weight_g
      ? Math.round((selectedDish.total_weight_g / selectedDish.total_servings) * count)
      : Math.round(250 * count);

    try {
      const res = await fetch('/api/food-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          meal_type: activeMealType,
          food_id: null,
          food_name: `${selectedDish.name} (${count} ${selectedDish.serving_name || 'porción'})`,
          amount_g,
          calories,
          protein_g,
          carbs_g,
          fat_g,
        }),
      });

      if (res.ok) {
        await fetchLogs(selectedDate);
        setIsModalOpen(false);
        setSelectedDish(null);
      }
    } catch {
      // Ignorar
    }
  };

  const handleDeleteLog = async (id: string) => {
    try {
      await fetch(`/api/food-logs?id=${id}`, { method: 'DELETE' });
      await fetchLogs(selectedDate);
    } catch {
      // Ignorar
    }
  };

  // Manejo de foto de tabla nutrimental
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setAiAnalyzing(true);
      try {
        const res = await fetch('/api/vision/nutrition-label', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64 }),
        });
        if (res.ok) {
          const result = await res.json();
          setAiResult(result.data);
        }
      } finally {
        setAiAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmAiFood = () => {
    if (!aiResult) return;
    const food: Food = {
      id: 'f-ai-' + Math.random().toString(36).substring(2, 7),
      user_id: null,
      name: aiResult.product_name || 'Alimento reconocido',
      brand: 'Escaneado por IA',
      serving_size_g: Number(aiResult.serving_size_g) || 100,
      serving_unit: 'g',
      calories: Number(aiResult.calories) || 0,
      protein_g: Number(aiResult.protein_g) || 0,
      carbs_g: Number(aiResult.carbs_g) || 0,
      fat_g: Number(aiResult.fat_g) || 0,
      source: 'ai_label',
      barcode: null,
      is_verified: true,
      created_at: new Date().toISOString(),
    };
    setIsAiScannerOpen(false);
    setSelectedFood(food);
    setAmountGrams(food.serving_size_g);
  };

  const meals: { type: MealType; label: string }[] = [
    { type: 'breakfast', label: 'Desayuno' },
    { type: 'lunch', label: 'Comida / Almuerzo' },
    { type: 'dinner', label: 'Cena' },
    { type: 'snack', label: 'Snacks / Colaciones' },
  ];

  const targetCals = activeGoal?.calorie_target || 2000;
  const targetProt = activeGoal?.protein_target_g || 140;
  const targetCarbs = activeGoal?.carbs_target_g || 200;
  const targetFat = activeGoal?.fat_target_g || 65;
  const targetFiber = activeGoal?.fiber_target_g || 30;
  const targetWater = activeGoal?.water_target_ml || 2500;

  return (
    <div className="space-y-5 pb-16">
      {/* 1. Selector de fecha */}
      <div className="flex items-center justify-between bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <button
          onClick={() => changeDate(-1)}
          className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition text-zinc-600 dark:text-zinc-300"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="text-center">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-transparent text-sm font-bold text-zinc-900 dark:text-white border-0 text-center cursor-pointer focus:outline-none"
          />
          <span className="block text-[11px] text-zinc-400">
            {selectedDate === new Date().toISOString().split('T')[0] ? 'Hoy' : 'Día seleccionado'}
          </span>
        </div>

        <button
          onClick={() => changeDate(1)}
          className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition text-zinc-600 dark:text-zinc-300"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Barra de Acceso Rápido en 1 Toque (Comidas Frecuentes) */}
      <FrequentFoodsBar
        selectedDate={selectedDate}
        onLogAdded={() => fetchLogs(selectedDate)}
      />

      {/* 2. Resumen de Macros del Día */}
      <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3">
        {/* Calorías del Día */}
        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <div>
              <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
                Calorías de Hoy
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-black text-zinc-900 dark:text-white">
                  Llevo {totals.calories}
                </span>
                <span className="text-xs text-zinc-400 font-semibold">de {targetCals} kcal</span>
              </div>
            </div>
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                totals.calories <= targetCals
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
              }`}
            >
              {targetCals - totals.calories >= 0
                ? `Te faltan ${targetCals - totals.calories} kcal`
                : `Exceso de +${totals.calories - targetCals} kcal`}
            </span>
          </div>

          <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden mt-2">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                totals.calories <= targetCals ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
              style={{ width: `${Math.min(100, (totals.calories / targetCals) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-zinc-400 mt-1 font-medium">
            <span>0 kcal</span>
            <span>{Math.round((totals.calories / targetCals) * 100)}% consumido</span>
            <span>Meta {targetCals} kcal</span>
          </div>
        </div>

        {/* Barras de Macronutrientes Principales (P, C, G) */}
        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          {/* Proteína */}
          <div className="bg-zinc-50 dark:bg-zinc-800/40 p-2.5 rounded-2xl border border-zinc-200/60 dark:border-zinc-700/60">
            <div className="flex justify-between text-xs mb-0.5">
              <span className="font-bold text-zinc-700 dark:text-zinc-300 text-[11px]">Proteína</span>
              <span className="font-black text-blue-600 dark:text-blue-400 text-xs">{totals.protein_g}g</span>
            </div>
            <span className="text-[10px] text-zinc-400 block mb-1">
              de {targetProt}g ({Math.round((totals.protein_g / targetProt) * 100)}%)
            </span>
            <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-1.5 rounded-full overflow-hidden mb-1">
              <div
                className="bg-blue-500 h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, (totals.protein_g / targetProt) * 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium block truncate">
              {targetProt - totals.protein_g > 0
                ? `Faltan ${(targetProt - totals.protein_g).toFixed(1)}g`
                : `+${(totals.protein_g - targetProt).toFixed(1)}g extra`}
            </span>
          </div>

          {/* Carbohidratos */}
          <div className="bg-zinc-50 dark:bg-zinc-800/40 p-2.5 rounded-2xl border border-zinc-200/60 dark:border-zinc-700/60">
            <div className="flex justify-between text-xs mb-0.5">
              <span className="font-bold text-zinc-700 dark:text-zinc-300 text-[11px]">Carbos</span>
              <span className="font-black text-amber-600 dark:text-amber-400 text-xs">{totals.carbs_g}g</span>
            </div>
            <span className="text-[10px] text-zinc-400 block mb-1">
              de {targetCarbs}g ({Math.round((totals.carbs_g / targetCarbs) * 100)}%)
            </span>
            <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-1.5 rounded-full overflow-hidden mb-1">
              <div
                className="bg-amber-500 h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, (totals.carbs_g / targetCarbs) * 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium block truncate">
              {targetCarbs - totals.carbs_g > 0
                ? `Faltan ${(targetCarbs - totals.carbs_g).toFixed(1)}g`
                : `+${(totals.carbs_g - targetCarbs).toFixed(1)}g extra`}
            </span>
          </div>

          {/* Grasas */}
          <div className="bg-zinc-50 dark:bg-zinc-800/40 p-2.5 rounded-2xl border border-zinc-200/60 dark:border-zinc-700/60">
            <div className="flex justify-between text-xs mb-0.5">
              <span className="font-bold text-zinc-700 dark:text-zinc-300 text-[11px]">Grasas</span>
              <span className="font-black text-rose-600 dark:text-rose-400 text-xs">{totals.fat_g}g</span>
            </div>
            <span className="text-[10px] text-zinc-400 block mb-1">
              de {targetFat}g ({Math.round((totals.fat_g / targetFat) * 100)}%)
            </span>
            <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-1.5 rounded-full overflow-hidden mb-1">
              <div
                className="bg-rose-500 h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, (totals.fat_g / targetFat) * 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium block truncate">
              {targetFat - totals.fat_g > 0
                ? `Faltan ${(targetFat - totals.fat_g).toFixed(1)}g`
                : `+${(totals.fat_g - targetFat).toFixed(1)}g extra`}
            </span>
          </div>
        </div>

        {/* Fila de Salud Clínica: Fibra Dietética & Registro de Agua */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          {/* Fibra Dietética */}
          <div className="bg-teal-50/50 dark:bg-teal-950/20 p-3 rounded-2xl border border-teal-200/50 dark:border-teal-800/40">
            <div className="flex justify-between items-center text-xs mb-0.5">
              <span className="font-bold text-teal-800 dark:text-teal-300 text-[11px]">🌾 Fibra Dietética</span>
              <span className="font-black text-teal-700 dark:text-teal-300 text-xs">
                {totals.fiber_g || 0}g
              </span>
            </div>
            <span className="text-[10px] text-zinc-400 block mb-1.5">
              Llevas {totals.fiber_g || 0}g de {targetFiber}g recomendados
            </span>
            <div className="w-full bg-teal-100 dark:bg-teal-900/40 h-2 rounded-full overflow-hidden mb-1">
              <div
                className="bg-teal-600 dark:bg-teal-400 h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, ((totals.fiber_g || 0) / targetFiber) * 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-teal-700 dark:text-teal-300 font-semibold block">
              {targetFiber - (totals.fiber_g || 0) > 0
                ? `Faltan ${(targetFiber - (totals.fiber_g || 0)).toFixed(1)}g para la meta`
                : '¡Meta de fibra lograda hoy! 🎉'}
            </span>
          </div>

          {/* Registro de Agua con 1-Toque (+250ml) */}
          <div className="bg-sky-50/50 dark:bg-sky-950/20 p-3 rounded-2xl border border-sky-200/50 dark:border-sky-800/40 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center text-xs mb-0.5">
                <span className="font-bold text-sky-800 dark:text-sky-300 text-[11px] flex items-center gap-1">
                  <Droplets className="w-3.5 h-3.5 text-sky-500" />
                  <span>Hidratación</span>
                </span>
                <span className="font-black text-sky-700 dark:text-sky-300 text-xs">
                  {waterIntake} ml
                </span>
              </div>
              <span className="text-[10px] text-zinc-400 block mb-1.5">
                Llevas {waterIntake} de {targetWater} ml ({Math.round((waterIntake / targetWater) * 100)}%)
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="w-full bg-sky-100 dark:bg-sky-900/40 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-sky-500 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, (waterIntake / targetWater) * 100)}%` }}
                />
              </div>

              <div className="flex items-center justify-between pt-0.5">
                <span className="text-[10px] text-sky-700 dark:text-sky-300 font-medium">
                  {targetWater - waterIntake > 0
                    ? `Faltan ${targetWater - waterIntake} ml`
                    : '¡Meta completada! 💧'}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleAdjustWater(-250)}
                    disabled={waterIntake <= 0}
                    className="w-6 h-6 rounded-lg bg-sky-100 dark:bg-sky-900/60 hover:bg-sky-200 text-sky-700 dark:text-sky-300 text-xs font-bold flex items-center justify-center disabled:opacity-30 transition"
                    title="Restar 250 ml (1 vaso)"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustWater(250)}
                    className="px-2 h-6 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center justify-center transition shadow-xs"
                    title="Sumar 250 ml (1 vaso)"
                  >
                    +250ml
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Secciones por Comida */}
      <div className="space-y-4">
        {meals.map((meal) => {
          const mealLogs = logs.filter((l) => l.meal_type === meal.type);
          const mealCals = mealLogs.reduce((sum, item) => sum + item.calories, 0);

          return (
            <div
              key={meal.type}
              className="bg-white dark:bg-zinc-900 rounded-3xl p-4 border border-zinc-200 dark:border-zinc-800 shadow-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-white">{meal.label}</h4>
                  <span className="text-xs text-zinc-400 font-medium">{mealCals} kcal</span>
                </div>

                <button
                  onClick={() => {
                    setActiveMealType(meal.type);
                    setIsModalOpen(true);
                  }}
                  className="flex items-center gap-1 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Añadir</span>
                </button>
              </div>

              {mealLogs.length === 0 ? (
                <p className="text-xs text-zinc-400 italic py-1">Sin alimentos registrados aún.</p>
              ) : (
                <div className="space-y-2">
                  {mealLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-2.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl text-xs"
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200 block truncate">
                          {log.food_name}
                        </span>
                        <span className="text-zinc-400 text-[11px]">
                          {log.amount_g}g • P: {log.protein_g}g • C: {log.carbs_g}g • G: {log.fat_g}g
                        </span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-bold text-zinc-900 dark:text-white">
                          {log.calories} kcal
                        </span>
                        <button
                          onClick={() => handleDeleteLog(log.id)}
                          className="text-zinc-400 hover:text-red-500 transition p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* MODAL: BUSCADOR DE ALIMENTOS / SCANNER */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-5 max-h-[85vh] flex flex-col border border-zinc-200 dark:border-zinc-800 shadow-2xl">
            {/* Header del modal */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  Añadir a {meals.find((m) => m.type === activeMealType)?.label}
                </h3>
                <span className="text-xs text-zinc-400">
                  Open Food Facts, catálogo propio o escaneo con IA
                </span>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setSelectedFood(null);
                }}
                className="p-1 text-zinc-400 hover:text-zinc-800 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selector de tipo: Alimento Simple vs Platillos Guardados */}
            <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-2xl mb-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setModalTab('food');
                  setSelectedDish(null);
                  setSelectedFood(null);
                }}
                className={`flex-1 py-1.5 rounded-xl font-bold transition ${
                  modalTab === 'food'
                    ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                Alimento Simple / Búsqueda
              </button>
              <button
                type="button"
                onClick={() => {
                  setModalTab('dish');
                  setSelectedFood(null);
                  setSelectedDish(null);
                  fetchDishes();
                }}
                className={`flex-1 py-1.5 rounded-xl font-bold transition ${
                  modalTab === 'dish'
                    ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                Platillos Preparados ({savedDishes.length})
              </button>
            </div>

            {/* MODO 1: ALIMENTOS SIMPLES */}
            {modalTab === 'food' && (
              <>
                {!selectedFood ? (
                  <div className="flex-1 overflow-y-auto py-2 space-y-3">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                        <input
                          type="text"
                          placeholder="Buscar pollo, arroz, yogur, avena..."
                          value={searchQuery}
                          onChange={(e) => handleSearch(e.target.value)}
                          className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <button
                        onClick={() => setIsBarcodeScannerOpen(true)}
                        title="Escanear código de barras con cámara"
                        className="flex items-center gap-1.5 px-3 py-2 bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 rounded-xl text-xs font-semibold hover:bg-teal-100 transition shrink-0"
                      >
                        <Barcode className="w-4 h-4" />
                        <span>Código</span>
                      </button>

                      <button
                        onClick={() => setIsAiScannerOpen(true)}
                        title="Escanear tabla con foto"
                        className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold hover:bg-emerald-100 transition shrink-0"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Foto IA</span>
                      </button>
                    </div>

                    {searching && (
                      <p className="text-xs text-zinc-400 text-center py-4">Buscando alimentos...</p>
                    )}

                    {searchResults.length > 0 && (
                      <div className="space-y-1.5">
                        {searchResults.map((f) => (
                          <button
                            key={f.id}
                            onClick={() => handleSelectFood(f)}
                            className="w-full text-left p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-zinc-200 dark:border-zinc-700/60 transition flex justify-between items-center"
                          >
                            <div className="pr-2">
                              <span className="text-xs font-semibold text-zinc-900 dark:text-white block">
                                {f.name}
                              </span>
                              <span className="text-[11px] text-zinc-400">
                                {f.brand ? `${f.brand} • ` : ''}Por 100g: P {f.protein_g}g • C {f.carbs_g}g • G {f.fat_g}g
                              </span>
                            </div>
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                              {f.calories} kcal
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </>
            )}

            {/* MODO 2: PLATILLOS PREPARADOS */}
            {modalTab === 'dish' && (
              <>
                {!selectedDish ? (
                  <div className="flex-1 overflow-y-auto py-2 space-y-2">
                    {savedDishes.length === 0 ? (
                      <div className="text-center py-8 text-zinc-400 text-xs">
                        <p>No hay platillos creados todavía.</p>
                        <p className="mt-1 text-zinc-500">Ve a la pestaña &ldquo;Platillos&rdquo; para crear tu primera receta compuesta.</p>
                      </div>
                    ) : (
                      savedDishes.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => {
                            setSelectedDish(d);
                            setDishPortionCount(1);
                          }}
                          className="w-full text-left p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-zinc-200 dark:border-zinc-700/60 transition flex justify-between items-center"
                        >
                          <div className="pr-2">
                            <span className="text-xs font-bold text-zinc-900 dark:text-white block">
                              {d.name}
                            </span>
                            <span className="text-[11px] text-zinc-500">
                              Por {d.serving_name}: P {d.protein_per_serving}g • C {d.carbs_per_serving}g • G {d.fat_per_serving}g
                            </span>
                          </div>
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                            {d.calories_per_serving} kcal
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                ) : (
                  /* Configurar porciones del platillo seleccionado */
                  <div className="py-4 space-y-4">
                    <div className="p-4 bg-zinc-50 dark:bg-zinc-800/80 rounded-2xl border border-zinc-200 dark:border-zinc-700">
                      <span className="text-xs font-bold text-zinc-900 dark:text-white block">
                        {selectedDish.name}
                      </span>
                      <span className="text-[11px] text-zinc-500 block mt-0.5">
                        Base: {selectedDish.calories_per_serving} kcal por {selectedDish.serving_name}
                      </span>

                      <div className="mt-4">
                        <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                          Número de porciones a consumir:
                        </label>
                        <div className="flex gap-2 items-center">
                          {[0.5, 1, 1.5, 2].map((frac) => (
                            <button
                              key={frac}
                              type="button"
                              onClick={() => setDishPortionCount(frac)}
                              className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition ${
                                dishPortionCount === frac
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                              }`}
                            >
                              {frac}x
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Macros resultantes */}
                      <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-700 text-center">
                        <div>
                          <span className="text-[10px] text-zinc-400 block">Calorías</span>
                          <span className="text-xs font-bold text-emerald-500">
                            {Math.round(selectedDish.calories_per_serving * dishPortionCount)} kcal
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-400 block">Proteína</span>
                          <span className="text-xs font-bold text-blue-500">
                            {(selectedDish.protein_per_serving * dishPortionCount).toFixed(1)}g
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-400 block">Carbos</span>
                          <span className="text-xs font-bold text-amber-500">
                            {(selectedDish.carbs_per_serving * dishPortionCount).toFixed(1)}g
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-400 block">Grasas</span>
                          <span className="text-xs font-bold text-rose-500">
                            {(selectedDish.fat_per_serving * dishPortionCount).toFixed(1)}g
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedDish(null)}
                        className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-600 dark:text-zinc-300"
                      >
                        Volver
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveDishLog}
                        className="flex-2 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold shadow-md shadow-emerald-600/20"
                      >
                        Registrar {dishPortionCount} Porción(es)
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Configurar gramos para alimento simple */}
            {modalTab === 'food' && selectedFood && (
              /* Configurar gramos y registrar */
              <div className="py-4 space-y-4">
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/80 rounded-2xl border border-zinc-200 dark:border-zinc-700">
                  <span className="text-xs font-bold text-zinc-900 dark:text-white block">
                    {selectedFood.name}
                  </span>
                  {selectedFood.brand && (
                    <span className="text-[11px] text-zinc-400 block">{selectedFood.brand}</span>
                  )}

                  <div className="mt-4">
                    <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                      Cantidad en gramos
                    </label>
                    <input
                      type="number"
                      value={amountGrams}
                      onChange={(e) => setAmountGrams(Math.max(1, Number(e.target.value)))}
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-base font-bold text-zinc-900 dark:text-white text-center"
                    />
                  </div>

                  {/* Cálculo dinámico resultante */}
                  <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-700 text-center">
                    <div>
                      <span className="text-[10px] text-zinc-400 block">Calorías</span>
                      <span className="text-xs font-bold text-emerald-500">
                        {Math.round((selectedFood.calories * amountGrams) / (selectedFood.serving_size_g || 100))} kcal
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-400 block">Proteína</span>
                      <span className="text-xs font-bold text-blue-500">
                        {((selectedFood.protein_g * amountGrams) / (selectedFood.serving_size_g || 100)).toFixed(1)}g
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-400 block">Carbos</span>
                      <span className="text-xs font-bold text-amber-500">
                        {((selectedFood.carbs_g * amountGrams) / (selectedFood.serving_size_g || 100)).toFixed(1)}g
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-400 block">Grasas</span>
                      <span className="text-xs font-bold text-rose-500">
                        {((selectedFood.fat_g * amountGrams) / (selectedFood.serving_size_g || 100)).toFixed(1)}g
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedFood(null)}
                    className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-600 dark:text-zinc-300"
                  >
                    Volver
                  </button>
                  <button
                    onClick={handleSaveLog}
                    className="flex-2 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold shadow-md shadow-emerald-600/20"
                  >
                    Confirmar y Registrar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL ESPECÍFICO: RECONOCIMIENTO DE TABLA NUTRIMENTAL CON IA (Fase 5) */}
      {isAiScannerOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-500" />
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                  Escáner de Tabla Nutrimental
                </h3>
              </div>
              <button
                onClick={() => setIsAiScannerOpen(false)}
                className="text-zinc-400 hover:text-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-500 mb-4">
              Sube una foto de la etiqueta del producto. La IA extraerá automáticamente calorías y macronutrientes para tu confirmación o ajuste.
            </p>

            <label className="block w-full border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl p-6 text-center cursor-pointer hover:border-emerald-500 transition mb-4">
              <Camera className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
              <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200 block">
                Seleccionar o tomar foto de etiqueta
              </span>
              <span className="text-[11px] text-zinc-400 block mt-1">Formatos JPG, PNG</span>
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>

            {aiAnalyzing && (
              <div className="py-4 text-center">
                <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-zinc-500">Analizando información con Gemini Vision...</p>
              </div>
            )}

            {aiResult && !aiAnalyzing && (
              <div className="space-y-3 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700">
                <span className="text-xs font-bold text-emerald-600 block">Datos extraídos (edita si es necesario):</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-zinc-400 block">Nombre</label>
                    <input
                      type="text"
                      value={aiResult.product_name || ''}
                      onChange={(e) => setAiResult({ ...aiResult, product_name: e.target.value })}
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg p-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 block">Calorías (kcal)</label>
                    <input
                      type="number"
                      value={aiResult.calories || 0}
                      onChange={(e) => setAiResult({ ...aiResult, calories: Number(e.target.value) })}
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg p-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 block">Proteína (g)</label>
                    <input
                      type="number"
                      value={aiResult.protein_g || 0}
                      onChange={(e) => setAiResult({ ...aiResult, protein_g: Number(e.target.value) })}
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg p-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 block">Carbohidratos (g)</label>
                    <input
                      type="number"
                      value={aiResult.carbs_g || 0}
                      onChange={(e) => setAiResult({ ...aiResult, carbs_g: Number(e.target.value) })}
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg p-1.5"
                    />
                  </div>
                </div>

                <button
                  onClick={handleConfirmAiFood}
                  className="w-full py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-500 transition"
                >
                  Usar este alimento
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL ESCÁNER DE CÓDIGOS DE BARRAS (OPEN FOOD FACTS) */}
      <BarcodeScannerModal
        isOpen={isBarcodeScannerOpen}
        onClose={() => setIsBarcodeScannerOpen(false)}
        defaultMealType={activeMealType}
        onFoodLogged={() => fetchLogs(selectedDate)}
      />
    </div>
  );
}
