'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Plus, Trash2, Pencil, Search, ChevronLeft, ChevronRight, Check, X, Droplets, Calendar, ChefHat, CheckCheck, Utensils, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { MealType, Food, Dish } from '@/types/database';
import FrequentFoodsBar from '@/components/diary/FrequentFoodsBar';
import RecipeDetailModal from '@/components/dishes/RecipeDetailModal';
import { STARTER_RECIPES } from '@/lib/data/starterRecipes';
import { calculateFuzzyScore } from '@/lib/utils/fuzzySearch';
import { getLocalDateString, shiftDateDays, formatDateToYYYYMMDD } from '@/lib/utils';

const DAY_NAMES_ES: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
};

export function getFoodUnitInfo(food: Food) {
  const name = (food.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const rawUnit = (food.serving_unit || '').toLowerCase().trim();

  // Si tiene unidad definida como rebanada, pieza, rebanadas, etc.
  if (rawUnit && rawUnit !== 'g' && rawUnit !== 'gramo' && rawUnit !== 'gramos' && rawUnit !== 'ml') {
    const isRebanada = rawUnit.includes('rebanada');
    const isTortilla = rawUnit.includes('tortilla');
    const isHuevo = rawUnit.includes('huevo') || rawUnit.includes('pieza') || rawUnit.includes('pza');
    const singular = isRebanada ? 'rebanada' : (isTortilla ? 'tortilla' : (isHuevo ? 'pieza' : rawUnit));
    const plural = isRebanada ? 'rebanadas' : (isTortilla ? 'tortillas' : (isHuevo ? 'piezas' : `${singular}s`));
    const unitGrams = food.serving_size_g || 30;

    return {
      isPieceBased: true,
      unitName: singular,
      pluralUnitName: plural,
      unitGrams,
      options: [
        { label: `1 ${singular}`, grams: unitGrams },
        { label: `2 ${plural}`, grams: unitGrams * 2 },
        { label: `3 ${plural}`, grams: unitGrams * 3 },
        { label: `4 ${plural}`, grams: unitGrams * 4 },
      ],
    };
  }

  // Si por nombre es pan de caja, rebanada, bolillo
  if (name.includes('pan') || name.includes('rebanada') || name.includes('tostada') || name.includes('tortilla')) {
    const isTostada = name.includes('tostada');
    const isTortilla = name.includes('tortilla');
    const isBolillo = name.includes('bolillo') || name.includes('telera');

    let singular = 'rebanada';
    let plural = 'rebanadas';
    let unitGrams = 30;

    if (isTostada) {
      singular = 'tostada';
      plural = 'tostadas';
      unitGrams = 12;
    } else if (isTortilla) {
      singular = 'tortilla';
      plural = 'tortillas';
      unitGrams = 25;
    } else if (isBolillo) {
      singular = 'pieza';
      plural = 'piezas';
      unitGrams = 60;
    }

    return {
      isPieceBased: true,
      unitName: singular,
      pluralUnitName: plural,
      unitGrams,
      options: [
        { label: `1 ${singular}`, grams: unitGrams },
        { label: `2 ${plural}`, grams: unitGrams * 2 },
        { label: `3 ${plural}`, grams: unitGrams * 3 },
        { label: `4 ${plural}`, grams: unitGrams * 4 },
      ],
    };
  }

  // Si por nombre es huevo
  if (name.includes('huevo')) {
    const unitGrams = 50;
    return {
      isPieceBased: true,
      unitName: 'pieza',
      pluralUnitName: 'piezas',
      unitGrams,
      options: [
        { label: '1 pza', grams: unitGrams },
        { label: '2 pzas', grams: unitGrams * 2 },
        { label: '3 pzas', grams: unitGrams * 3 },
        { label: '4 pzas', grams: unitGrams * 4 },
      ],
    };
  }

  // Alimento por peso en gramos (carnes, quesos, cereales, etc.)
  const baseG = food.serving_size_g || 100;
  return {
    isPieceBased: false,
    unitName: 'g',
    pluralUnitName: 'g',
    unitGrams: baseG,
    options: [
      { label: `${Math.round(baseG * 0.5)}g`, grams: Math.round(baseG * 0.5) },
      { label: `${baseG}g`, grams: baseG },
      { label: `${Math.round(baseG * 1.5)}g`, grams: Math.round(baseG * 1.5) },
      { label: `${Math.round(baseG * 2)}g`, grams: Math.round(baseG * 2) },
    ],
  };
}

export default function DailyDiary() {
  const { user, activeGoal } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateString());
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    const handleTzChange = () => {
      setSelectedDate(getLocalDateString());
    };
    window.addEventListener('duo_calories_timezone_changed', handleTzChange);
    return () => window.removeEventListener('duo_calories_timezone_changed', handleTzChange);
  }, []);
  const [totals, setTotals] = useState({ calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 });
  const [waterIntake, setWaterIntake] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const today = getLocalDateString();
        const legacy = localStorage.getItem(`duocal_water_${today}`);
        if (legacy !== null && !isNaN(parseInt(legacy, 10))) return parseInt(legacy, 10);
      } catch {}
    }
    return 0;
  });
  const [isWaterModalOpen, setIsWaterModalOpen] = useState(false);
  const [customWaterInput, setCustomWaterInput] = useState('');
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
  const [isSavingFoodLog, setIsSavingFoodLog] = useState(false);
  const [saveLogError, setSaveLogError] = useState<string | null>(null);

  // Platillos guardados y platillo seleccionado para registrar
  const [savedDishes, setSavedDishes] = useState<any[]>([]);
  const [selectedDish, setSelectedDish] = useState<any | null>(null);
  const [dishPortionCount, setDishPortionCount] = useState(1);

  // Comidas planeadas para la semana y para el día actual desde el Plan Semanal
  const [weeklyPlans, setWeeklyPlans] = useState<any[]>([]);
  const [plannedMealsForDay, setPlannedMealsForDay] = useState<any[]>([]);
  const [isLoggingAllPlanned, setIsLoggingAllPlanned] = useState(false);
  const [loggingPlannedId, setLoggingPlannedId] = useState<string | null>(null);
  const [deletingPlannedId, setDeletingPlannedId] = useState<string | null>(null);
  const [selectedPlannedDishForModal, setSelectedPlannedDishForModal] = useState<Dish | null>(null);

  // Modal para editar / ajustar registro existente
  const [editingLog, setEditingLog] = useState<any | null>(null);
  const [editMealType, setEditMealType] = useState<MealType>('lunch');
  const [editAmountGrams, setEditAmountGrams] = useState<number>(100);
  const [isUpdatingLog, setIsUpdatingLog] = useState(false);
  const [editLogError, setEditLogError] = useState<string | null>(null);

  // Platillos guardados filtrados por búsqueda difusa o por categoría sugerida
  const matchingDishes = useMemo(() => {
    if (!searchQuery.trim()) {
      const categorized = savedDishes.filter(
        (d) => d.category === activeMealType || d.category === 'general'
      );
      return categorized.length > 0 ? categorized : savedDishes;
    }
    return savedDishes
      .map((d) => {
        const nameScore = calculateFuzzyScore(d.name, searchQuery);
        const descScore = d.description ? calculateFuzzyScore(d.description, searchQuery) : { matches: false, score: 0 };
        const matches = nameScore.matches || descScore.matches;
        const score = Math.max(nameScore.score, descScore.score);
        return { dish: d, score, matches };
      })
      .filter((item) => item.matches && item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.dish);
  }, [savedDishes, searchQuery, activeMealType]);

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

  const fetchPlannedMeals = async (date: string) => {
    try {
      const { dayOfWeek, weekStart } = getPlanDateInfo(date);
      const res = await fetch(`/api/meal-plans?week_start=${weekStart}`);
      if (res.ok) {
        const data = await res.json();
        const allPlans = data.plans || [];
        setWeeklyPlans(allPlans);
        const forDay = allPlans.filter((p: any) => p.day_of_week === dayOfWeek);
        setPlannedMealsForDay(forDay);
      } else {
        setWeeklyPlans([]);
        setPlannedMealsForDay([]);
      }
    } catch {
      setWeeklyPlans([]);
      setPlannedMealsForDay([]);
    }
  };

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

  const handleLogPlannedMeal = async (planned: any, mealType: MealType) => {
    setLoggingPlannedId(planned.id);
    try {
      const baseName = (planned.custom_name || '').replace(/\s*\(.*$/, '').trim().toLowerCase();
      const matchedDish = savedDishes.find(
        (d) => d.name.toLowerCase().trim() === baseName || baseName.includes(d.name.toLowerCase().trim())
      );
      const servings = planned.servings || 1;
      const resolvedFiber =
        planned.fiber_g !== undefined && planned.fiber_g !== null && Number(planned.fiber_g) > 0
          ? Number((Number(planned.fiber_g) * servings).toFixed(1))
          : matchedDish
          ? Number(((matchedDish.fiber_per_serving || 0) * servings).toFixed(1))
          : 0;

      const res = await fetch('/api/food-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          meal_type: mealType,
          food_id: planned.food_id || null,
          food_name: planned.custom_name,
          amount_g: planned.servings ? Math.round(planned.servings * 250) : 250,
          calories: planned.calories,
          protein_g: planned.protein_g,
          carbs_g: planned.carbs_g,
          fat_g: planned.fat_g,
          fiber_g: resolvedFiber,
        }),
      });
      if (res.ok) {
        await fetchLogs(selectedDate);
      }
    } catch {
      // Ignorar
    } finally {
      setLoggingPlannedId(null);
    }
  };

  const handleRemovePlannedMeal = async (planId: string) => {
    setDeletingPlannedId(planId);
    try {
      const res = await fetch(`/api/meal-plans?id=${planId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setWeeklyPlans((prev) => prev.filter((p) => p.id !== planId));
        setPlannedMealsForDay((prev) => prev.filter((p) => p.id !== planId));
      }
    } catch {
      // Ignorar
    } finally {
      setDeletingPlannedId(null);
    }
  };

  // Determina qué comidas planeadas del día quedan pendientes por consumir/registrar.
  // Permite detección inteligente entre tiempos de comida (cross-meal): si planeaste un platillo para la cena
  // pero lo consumiste/registraste en la comida (almuerzo) o viceversa, detecta que ya se consumió
  // y no te lo vuelve a sugerir repetido en otro horario del mismo día.
  const getUnloggedPlannedMeals = (plannedList: any[], dailyLogs: any[]) => {
    const availableLogs = [...dailyLogs];

    const matchesPlan = (plan: any, log: any) => {
      const planBase = (plan.custom_name || '').replace(/\s*\(.*$/, '').trim().toLowerCase();
      const logBase = (log.food_name || '').replace(/\s*\(.*$/, '').trim().toLowerCase();
      if (!planBase || !logBase) return false;
      return (
        logBase === planBase ||
        logBase.includes(planBase) ||
        planBase.includes(logBase) ||
        (plan.food_id && log.food_id && plan.food_id === log.food_id)
      );
    };

    // 1. Prioridad: emparejar con el mismo meal_type (ej. comida planeada registrada en comida)
    const pendingAfterExact: any[] = [];
    for (const plan of plannedList) {
      const exactIndex = availableLogs.findIndex(
        (log) => log.meal_type === plan.meal_type && matchesPlan(plan, log)
      );
      if (exactIndex !== -1) {
        availableLogs.splice(exactIndex, 1);
      } else {
        pendingAfterExact.push(plan);
      }
    }

    // 2. Emparejamiento flexible / cruzado: si no está en su horario planeado pero sí fue consumido hoy en otro horario
    const finalPending: any[] = [];
    for (const plan of pendingAfterExact) {
      const crossIndex = availableLogs.findIndex((log) => matchesPlan(plan, log));
      if (crossIndex !== -1) {
        availableLogs.splice(crossIndex, 1);
      } else {
        finalPending.push(plan);
      }
    }

    return finalPending;
  };

  const handleLogAllPlanned = async () => {
    const unlogged = getUnloggedPlannedMeals(plannedMealsForDay, logs);
    if (unlogged.length === 0) return;

    setIsLoggingAllPlanned(true);
    try {
      for (const item of unlogged) {
        const baseName = (item.custom_name || '').replace(/\s*\(.*$/, '').trim().toLowerCase();
        const matchedDish = savedDishes.find(
          (d) => d.name.toLowerCase().trim() === baseName || baseName.includes(d.name.toLowerCase().trim())
        );
        const servings = item.servings || 1;
        const resolvedFiber =
          item.fiber_g !== undefined && item.fiber_g !== null && Number(item.fiber_g) > 0
            ? Number((Number(item.fiber_g) * servings).toFixed(1))
            : matchedDish
            ? Number(((matchedDish.fiber_per_serving || 0) * servings).toFixed(1))
            : 0;

        await fetch('/api/food-logs', {
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
            fiber_g: resolvedFiber,
          }),
        });
      }
      await fetchLogs(selectedDate);
    } catch {
      // Ignorar
    } finally {
      setIsLoggingAllPlanned(false);
    }
  };

  const handleOpenPlannedRecipe = (planned: any) => {
    const rawMealName = planned.custom_name.trim();
    const baseMealName = rawMealName.replace(/\s*\(.*$/, '').trim().toLowerCase();

    const matched =
      savedDishes.find(
        (d) =>
          (planned.food_id && d.id === planned.food_id) ||
          d.name.toLowerCase().trim() === baseMealName ||
          d.name.toLowerCase().includes(baseMealName) ||
          baseMealName.includes(d.name.toLowerCase().trim())
      ) ||
      STARTER_RECIPES.find(
        (s) =>
          (planned.food_id && s.id === planned.food_id) ||
          s.name.toLowerCase().trim() === baseMealName ||
          s.name.toLowerCase().includes(baseMealName) ||
          baseMealName.includes(s.name.toLowerCase().trim())
      );

    if (matched) {
      setSelectedPlannedDishForModal(matched);
    }
  };

  useEffect(() => {
    fetchLogs(selectedDate);
    fetchPlannedMeals(selectedDate);
    fetchDishes();

    // 1. Carga optimista inmediata de localStorage
    let localSaved: number | null = null;
    if (typeof window !== 'undefined') {
      const userKey = user?.id ? `duocal_water_${user.id}_${selectedDate}` : null;
      const legacyKey = `duocal_water_${selectedDate}`;
      const saved = (userKey ? localStorage.getItem(userKey) : null) || localStorage.getItem(legacyKey);
      if (saved !== null && !isNaN(parseInt(saved, 10))) {
        localSaved = parseInt(saved, 10);
        setWaterIntake(localSaved);
      } else {
        setWaterIntake(0);
      }
    }

    // 2. Sincronización autoritativa desde el servidor (/api/water)
    fetch(`/api/water?date=${selectedDate}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;

        const serverWater = typeof data.water_ml === 'number' ? data.water_ml : null;
        const hasServerRecord = data.has_record === true;

        if (hasServerRecord && serverWater !== null) {
          // El servidor tiene registro confirmado (incluso si el usuario registró explícitamente 0)
          setWaterIntake(serverWater);
          if (typeof window !== 'undefined') {
            const key = user?.id ? `duocal_water_${user.id}_${selectedDate}` : `duocal_water_${selectedDate}`;
            localStorage.setItem(key, String(serverWater));
            localStorage.setItem(`duocal_water_${selectedDate}`, String(serverWater));
          }
        } else if (!hasServerRecord) {
          // El servidor aún no tiene registro para este día
          // Si en localStorage ya tenemos agua acumulada > 0, PRESERVARLA y respaldarla en el servidor
          if (localSaved !== null && localSaved > 0) {
            setWaterIntake(localSaved);
            fetch('/api/water', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ date: selectedDate, water_ml: localSaved }),
            }).catch(() => {});
          } else if (serverWater !== null && serverWater > 0) {
            setWaterIntake(serverWater);
            if (typeof window !== 'undefined') {
              const key = user?.id ? `duocal_water_${user.id}_${selectedDate}` : `duocal_water_${selectedDate}`;
              localStorage.setItem(key, String(serverWater));
              localStorage.setItem(`duocal_water_${selectedDate}`, String(serverWater));
            }
          }
        }
      })
      .catch(() => {});
  }, [selectedDate, user?.id]);

  const handleAdjustWater = async (delta: number) => {
    // Tomar el valor más reciente de localStorage o memoria para evitar cierres obsoletos en clics rápidos
    let currentWater = waterIntake;
    if (typeof window !== 'undefined') {
      const userKey = user?.id ? `duocal_water_${user.id}_${selectedDate}` : null;
      const legacyKey = `duocal_water_${selectedDate}`;
      const saved = (userKey ? localStorage.getItem(userKey) : null) || localStorage.getItem(legacyKey);
      if (saved !== null && !isNaN(parseInt(saved, 10))) {
        currentWater = Math.max(currentWater, parseInt(saved, 10));
      }
    }

    const updated = Math.max(0, currentWater + delta);
    setWaterIntake(updated);

    if (typeof window !== 'undefined') {
      const key = user?.id ? `duocal_water_${user.id}_${selectedDate}` : `duocal_water_${selectedDate}`;
      localStorage.setItem(key, String(updated));
      localStorage.setItem(`duocal_water_${selectedDate}`, String(updated));
    }

    try {
      await fetch('/api/water', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, water_ml: updated }),
      });
    } catch {
      // Ignorar error de red puntual
    }
  };

  const handleSetExactWater = async (amount: number) => {
    const safeAmount = Math.max(0, Math.round(amount));
    setWaterIntake(safeAmount);

    if (typeof window !== 'undefined') {
      const key = user?.id ? `duocal_water_${user.id}_${selectedDate}` : `duocal_water_${selectedDate}`;
      localStorage.setItem(key, String(safeAmount));
      localStorage.setItem(`duocal_water_${selectedDate}`, String(safeAmount));
    }

    try {
      await fetch('/api/water', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, water_ml: safeAmount }),
      });
    } catch {
      // Ignorar error de red puntual
    }
    setIsWaterModalOpen(false);
  };

  const changeDate = (days: number) => {
    setSelectedDate((prev) => shiftDateDays(prev, days));
  };

  const searchAbortRef = useRef<AbortController | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearch = (query: string) => {
    setSearchQuery(query);

    // Cancelar debounce previo si el usuario sigue tecleando
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Cancelar cualquier petición HTTP que esté en vuelo
    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
      searchAbortRef.current = null;
    }

    if (!query.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      const controller = new AbortController();
      searchAbortRef.current = controller;

      try {
        const res = await fetch(`/api/foods/search?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.foods || []);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          // Solamente ignorar cancelaciones intencionales
        }
      } finally {
        if (searchAbortRef.current === controller) {
          setSearching(false);
        }
      }
    }, 220);
  };

  const clearSearch = () => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (searchAbortRef.current) searchAbortRef.current.abort();
    setSearchQuery('');
    setSearchResults([]);
    setSearching(false);
  };

  const handleSelectFood = (food: Food) => {
    setSelectedFood(food);
    const unitInfo = getFoodUnitInfo(food);
    setAmountGrams(unitInfo.unitGrams);
    setSaveLogError(null);
  };

  const handleSaveLog = async () => {
    if (!selectedFood) return;

    setIsSavingFoodLog(true);
    setSaveLogError(null);

    const ratio = amountGrams / (selectedFood.serving_size_g || 100);
    const calories = Math.round(selectedFood.calories * ratio);
    const protein_g = Number((selectedFood.protein_g * ratio).toFixed(1));
    const carbs_g = Number((selectedFood.carbs_g * ratio).toFixed(1));
    const fat_g = Number((selectedFood.fat_g * ratio).toFixed(1));
    const fiber_g = Number((((selectedFood as any).fiber_g || 0) * ratio).toFixed(1));

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
          fiber_g,
        }),
      });

      if (res.ok) {
        await fetchLogs(selectedDate);
        setIsModalOpen(false);
        setSelectedFood(null);
        setSearchQuery('');
        setSearchResults([]);
      } else {
        const errData = await res.json();
        setSaveLogError(errData.error || 'Error al guardar el registro.');
      }
    } catch (err: any) {
      setSaveLogError(err.message || 'Error de conexión al registrar.');
    } finally {
      setIsSavingFoodLog(false);
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
    const fiber_g = Number(((selectedDish.fiber_per_serving || 0) * count).toFixed(1));
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
          fiber_g,
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

  const handleOpenEditLog = (log: any) => {
    setEditingLog(log);
    setEditMealType(log.meal_type || 'lunch');
    setEditAmountGrams(log.amount_g || 100);
    setEditLogError(null);
  };

  const handleSaveEditLog = async () => {
    if (!editingLog) return;
    setIsUpdatingLog(true);
    setEditLogError(null);
    try {
      const originalAmount = editingLog.amount_g || 1;
      const ratio = editAmountGrams > 0 ? editAmountGrams / originalAmount : 1;
      const payload = {
        id: editingLog.id,
        meal_type: editMealType,
        amount_g: editAmountGrams,
        calories: Math.round(editingLog.calories * ratio),
        protein_g: Number((editingLog.protein_g * ratio).toFixed(1)),
        carbs_g: Number((editingLog.carbs_g * ratio).toFixed(1)),
        fat_g: Number((editingLog.fat_g * ratio).toFixed(1)),
        fiber_g: Number(((editingLog.fiber_g || 0) * ratio).toFixed(1)),
      };
      const res = await fetch('/api/food-logs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al actualizar el registro');
      }
      setEditingLog(null);
      await fetchLogs(selectedDate);
    } catch (err: any) {
      setEditLogError(err.message || 'Error al actualizar');
    } finally {
      setIsUpdatingLog(false);
    }
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

  const allUnloggedPlanned = getUnloggedPlannedMeals(plannedMealsForDay, logs);

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
          {selectedDate === getLocalDateString() ? (
            <span className="block text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
              • Hoy
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setSelectedDate(getLocalDateString())}
              className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-bold hover:underline cursor-pointer"
              title="Volver a la fecha de hoy"
            >
              <span>Día seleccionado</span>
              <span className="bg-amber-100 dark:bg-amber-950/80 px-1.5 py-0.5 rounded-full text-[10px] text-amber-700 dark:text-amber-300">
                Volver a Hoy ↩
              </span>
            </button>
          )}
        </div>

        <button
          onClick={() => changeDate(1)}
          className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition text-zinc-600 dark:text-zinc-300"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Barra de Acceso Rápido en 1 Toque (Platillos Programados en la Semana) */}
      <FrequentFoodsBar
        selectedDate={selectedDate}
        weeklyPlans={weeklyPlans}
        currentLogs={logs}
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
              Llevas {totals.fiber_g || 0}g (Rango óptimo: 30–35g)
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

          {/* Registro de Agua con 1-Toque (+250ml, +500ml) y entrada exacta */}
          <div className="bg-sky-50/50 dark:bg-sky-950/20 p-3 rounded-2xl border border-sky-200/50 dark:border-sky-800/40 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center text-xs mb-0.5">
                <span className="font-bold text-sky-800 dark:text-sky-300 text-[11px] flex items-center gap-1">
                  <Droplets className="w-3.5 h-3.5 text-sky-500" />
                  <span>Hidratación</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCustomWaterInput(String(waterIntake));
                    setIsWaterModalOpen(true);
                  }}
                  className="font-black text-sky-700 dark:text-sky-300 text-xs hover:bg-sky-100 dark:hover:bg-sky-900/60 px-1.5 py-0.5 rounded-md flex items-center gap-1 transition cursor-pointer"
                  title="Haz clic para ingresar o corregir una cantidad exacta de agua"
                >
                  <span>{waterIntake} ml</span>
                  <Pencil className="w-2.5 h-2.5 opacity-60" />
                </button>
              </div>
              <span className="text-[10px] text-zinc-400 block mb-1.5">
                Basal {targetWater} ml (+500ml si entrenas)
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="w-full bg-sky-100 dark:bg-sky-900/40 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-sky-500 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, (waterIntake / targetWater) * 100)}%` }}
                />
              </div>

              <div className="flex items-center justify-between pt-0.5 flex-wrap gap-1">
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
                    className="w-6 h-6 rounded-lg bg-sky-100 dark:bg-sky-900/60 hover:bg-sky-200 text-sky-700 dark:text-sky-300 text-xs font-bold flex items-center justify-center disabled:opacity-30 transition cursor-pointer"
                    title="Restar 250 ml (1 vaso)"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustWater(250)}
                    className="px-2 h-6 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold flex items-center justify-center transition shadow-xs cursor-pointer"
                    title="Sumar 250 ml (1 vaso)"
                  >
                    +250ml
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustWater(500)}
                    className="px-2 h-6 rounded-lg bg-sky-100 dark:bg-sky-900/50 hover:bg-sky-200 dark:hover:bg-sky-800 text-sky-800 dark:text-sky-200 text-[11px] font-bold flex items-center justify-center transition cursor-pointer"
                    title="Sumar 500 ml (1 botella o shaker)"
                  >
                    +500ml
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Banner de Comidas Planeadas del Plan Semanal para este día */}
      {(() => {
        if (allUnloggedPlanned.length === 0) return null;

        return (
          <div className="bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/10 dark:from-emerald-950/40 dark:to-teal-950/20 border border-emerald-500/30 rounded-3xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3 w-full sm:w-auto text-left">
              <div className="p-2.5 bg-emerald-600 text-white rounded-2xl shadow-xs shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-900 dark:text-white">
                  Tienes {allUnloggedPlanned.length} comida{allUnloggedPlanned.length === 1 ? '' : 's'} planeada{allUnloggedPlanned.length === 1 ? '' : 's'} para hoy
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {allUnloggedPlanned.map((p) => p.custom_name.replace(/\s*\(.*$/, '')).join(', ')}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogAllPlanned}
              disabled={isLoggingAllPlanned}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition shrink-0"
            >
              <CheckCheck className="w-4 h-4" />
              <span>{isLoggingAllPlanned ? 'Registrando...' : 'Registrar'}</span>
            </button>
          </div>
        );
      })()}

      {/* 3. Secciones por Comida */}
      <div className="space-y-4">
        {meals.map((meal) => {
          const mealLogs = logs.filter((l) => l.meal_type === meal.type);
          const mealCals = mealLogs.reduce((sum, item) => sum + item.calories, 0);
          const unloggedPlanned = allUnloggedPlanned.filter((p) => p.meal_type === meal.type);

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

              {/* Tarjeta de comida planeada si existe en el Plan Semanal y aún no ha sido registrada */}
              {unloggedPlanned.length > 0 && (
                <div className="space-y-2 mb-3">
                  {unloggedPlanned.map((planned) => {
                    return (
                      <div
                        key={planned.id}
                        className="bg-emerald-50/70 dark:bg-emerald-950/30 border-2 border-emerald-500/40 rounded-2xl p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-extrabold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Planeado en tu Plan Semanal:</span>
                          </span>
                          <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 rounded-md font-bold">
                            {planned.calories} kcal
                          </span>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white dark:bg-zinc-800/90 p-2.5 rounded-xl border border-emerald-200/80 dark:border-emerald-800/60">
                          <div
                            className="min-w-0 flex-1 cursor-pointer"
                            onClick={() => handleOpenPlannedRecipe(planned)}
                            title="Ver receta, medidas y preparación"
                          >
                            <p className="text-xs font-bold text-zinc-900 dark:text-white hover:text-emerald-600 transition truncate">
                              {planned.custom_name}
                            </p>
                            <p className="text-[11px] text-zinc-400">
                              P: {planned.protein_g}g • C: {planned.carbs_g}g • G: {planned.fat_g}g
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => handleLogPlannedMeal(planned, meal.type)}
                              disabled={loggingPlannedId === planned.id}
                              className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs transition disabled:opacity-50"
                              title="Registrar directamente a tu diario con 1 clic"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{loggingPlannedId === planned.id ? 'Registrando...' : 'Registrar'}</span>
                            </button>

                            <button
                              onClick={() => handleOpenPlannedRecipe(planned)}
                              className="p-1.5 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-200 rounded-xl text-xs transition"
                              title="Ver preparación, medidas e ingredientes"
                            >
                              <ChefHat className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRemovePlannedMeal(planned.id)}
                              disabled={deletingPlannedId === planned.id}
                              className="p-1.5 bg-zinc-100 dark:bg-zinc-700 hover:bg-red-50 dark:hover:bg-red-950/60 hover:text-red-600 dark:hover:text-red-400 text-zinc-400 rounded-xl text-xs transition disabled:opacity-50"
                              title="Quitar esta comida planeada"
                            >
                              {deletingPlannedId === planned.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
                              ) : (
                                <X className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {mealLogs.length === 0 && unloggedPlanned.length === 0 ? (
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
                          {log.fiber_g ? ` • Fibra: ${log.fiber_g}g` : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        <span className="font-bold text-zinc-900 dark:text-white mr-1">
                          {log.calories} kcal
                        </span>
                        <button
                          onClick={() => handleOpenEditLog(log)}
                          className="text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition p-1.5"
                          title="Ajustar porción o mover a otra comida"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteLog(log.id)}
                          className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition p-1.5"
                          title="Eliminar registro"
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
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  Añadir a {meals.find((m) => m.type === activeMealType)?.label}
                </h3>
                <span className="text-xs text-zinc-400">
                  Platillos de tu plan semanal o búsqueda de alimentos
                </span>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setSelectedFood(null);
                  setSelectedDish(null);
                  clearSearch();
                }}
                className="p-1 text-zinc-400 hover:text-zinc-800 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* CUERPO PRINCIPAL DEL MODAL */}
            {!selectedFood && !selectedDish ? (
              <div className="flex-1 overflow-y-auto py-2 space-y-4 pr-0.5">
                {/* 1. SECCIÓN PRINCIPAL: PLATILLOS DEL PLAN SEMANAL (DEDUPLICADOS) */}
                {(() => {
                  const { dayOfWeek: selectedDayOfWeek } = getPlanDateInfo(selectedDate);
                  const isToday = selectedDate === getLocalDateString();

                  // Helper: verificar si este platillo ya fue registrado en esta comida hoy
                  const isItemAlreadyLogged = (name: string) => {
                    const base = name.replace(/\s*\(.*$/, '').trim().toLowerCase();
                    return logs.some(
                      (l) =>
                        l.meal_type === activeMealType &&
                        (l.food_name.toLowerCase().includes(base) || base.includes(l.food_name.toLowerCase().trim()))
                    );
                  };

                  // 1. Platillo planeado específicamente para este día y esta comida (excluyendo si ya se registró)
                  const plannedForThisDay = weeklyPlans.filter(
                    (p) =>
                      Number(p.day_of_week) === Number(selectedDayOfWeek) &&
                      p.meal_type === activeMealType &&
                      !isItemAlreadyLogged(p.custom_name)
                  );

                  // Evitar cualquier duplicación por nombre de platillo
                  const shownNames = new Set(
                    plannedForThisDay.map((p) => p.custom_name.trim().toLowerCase())
                  );

                  // 2. Otros platillos únicos de la semana (DEDUPLICADOS por nombre y excluyendo si ya se registraron)
                  const otherUniquePlans: any[] = [];
                  const seenNames = new Set<string>();

                  // Primero otros días para esta misma comida (ej. tu meal prep habitual de Desayuno/Cena)
                  weeklyPlans
                    .filter(
                      (p) =>
                        p.meal_type === activeMealType &&
                        Number(p.day_of_week) !== Number(selectedDayOfWeek) &&
                        !isItemAlreadyLogged(p.custom_name)
                    )
                    .forEach((p) => {
                      const norm = p.custom_name.trim().toLowerCase();
                      if (!shownNames.has(norm) && !seenNames.has(norm)) {
                        seenNames.add(norm);
                        otherUniquePlans.push(p);
                      }
                    });

                  // Si hoy no hay nada planeado y tampoco otros días para esta comida, ver de otras comidas no registradas
                  if (plannedForThisDay.length === 0 && otherUniquePlans.length === 0) {
                    weeklyPlans
                      .filter((p) => !isItemAlreadyLogged(p.custom_name))
                      .forEach((p) => {
                        const norm = p.custom_name.trim().toLowerCase();
                        if (!shownNames.has(norm) && !seenNames.has(norm)) {
                          seenNames.add(norm);
                          otherUniquePlans.push(p);
                        }
                      });
                  }

                  const hasAnyPlanned = plannedForThisDay.length > 0 || otherUniquePlans.length > 0;
                  if (!hasAnyPlanned) return null;

                  return (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                          <span>
                            {plannedForThisDay.length > 0
                              ? `Planeado para ${isToday ? 'hoy' : 'este día'}`
                              : 'Sugerido de tu Plan Semanal'}
                          </span>
                        </span>
                      </div>

                      {/* Tarjeta del día actual (1 sola tarjeta) */}
                      {plannedForThisDay.length > 0 && (
                        <div className="space-y-2">
                          {plannedForThisDay.map((plannedItem) => (
                            <div
                              key={plannedItem.id}
                              className="bg-emerald-50/70 dark:bg-emerald-950/30 border-2 border-emerald-500/40 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-xs"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tight bg-emerald-600 text-white">
                                    {isToday ? 'Hoy' : 'Este día'}
                                  </span>
                                  <span className="text-[10px] text-zinc-400 font-medium">
                                    {plannedItem.calories} kcal
                                  </span>
                                </div>
                                <span className="text-xs font-bold text-zinc-900 dark:text-white truncate block">
                                  {plannedItem.custom_name}
                                </span>
                                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">
                                  P: {plannedItem.protein_g}g • C: {plannedItem.carbs_g}g • G: {plannedItem.fat_g}g
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  handleLogPlannedMeal(plannedItem, activeMealType);
                                  setIsModalOpen(false);
                                }}
                                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl text-xs font-bold shrink-0 shadow-xs transition flex items-center gap-1"
                                title="Registrar a esta comida con 1 clic"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Registrar</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Si hoy no había nada pero hay en otros días: sugerir de forma inteligente con badge 'DE TU PLAN' */}
                      {plannedForThisDay.length === 0 && otherUniquePlans.length > 0 && (
                        <div className="space-y-2">
                          {otherUniquePlans.map((plannedItem) => (
                            <div
                              key={plannedItem.id}
                              className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-800 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-xs"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tight bg-emerald-600 text-white">
                                    De tu Plan
                                  </span>
                                  <span className="text-[10px] text-zinc-400 font-medium">
                                    {plannedItem.calories} kcal • Meal prep habitual
                                  </span>
                                </div>
                                <span className="text-xs font-bold text-zinc-900 dark:text-white truncate block">
                                  {plannedItem.custom_name}
                                </span>
                                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">
                                  P: {plannedItem.protein_g}g • C: {plannedItem.carbs_g}g • G: {plannedItem.fat_g}g
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  handleLogPlannedMeal(plannedItem, activeMealType);
                                  setIsModalOpen(false);
                                }}
                                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl text-xs font-bold shrink-0 shadow-xs transition flex items-center gap-1"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Registrar</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Ver otros platillos distintos de la semana (desplegable) */}
                      {plannedForThisDay.length > 0 && otherUniquePlans.length > 0 && (
                        <details className="group pt-1">
                          <summary className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 cursor-pointer hover:underline list-none flex items-center gap-1">
                            <span>+ Ver otros platillos distintos de la semana ({otherUniquePlans.length})</span>
                          </summary>
                          <div className="space-y-1.5 mt-2">
                            {otherUniquePlans.map((otherItem) => (
                              <div
                                key={otherItem.id}
                                className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1 mb-0.5">
                                    <span className="px-1 py-0.2 rounded text-[8px] font-bold bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 uppercase">
                                      De tu Plan
                                    </span>
                                    <span className="text-[10px] text-zinc-400">{otherItem.calories} kcal</span>
                                  </div>
                                  <p className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">{otherItem.custom_name}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleLogPlannedMeal(otherItem, activeMealType);
                                    setIsModalOpen(false);
                                  }}
                                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-[11px] shrink-0"
                                >
                                  Añadir
                                </button>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  );
                })()}

                {/* 2. SECCIÓN: BUSCADOR UNIVERSAL (PLATILLOS Y ALIMENTOS) */}
                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                      ¿Comiste otra cosa?
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      Busca en tus platillos o ingredientes
                    </span>
                  </div>

                  <div className="relative">
                    <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Buscar platillo o alimento (ej. pollo, arroz, avena)..."
                      value={searchQuery}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl pl-9 pr-8 py-2 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-zinc-400"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={clearSearch}
                        className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* RESULTADOS UNIFICADOS O LISTA DE TUS PLATILLOS */}
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
                    {searching && (
                      <p className="text-xs text-zinc-400 text-center py-3">Buscando alimentos...</p>
                    )}

                    {/* Si hay texto de búsqueda, mostrar platillos guardados coincidentes primero */}
                    {searchQuery.trim() && matchingDishes.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block px-1">
                          Tus Platillos ({matchingDishes.length})
                        </span>
                        {matchingDishes.map((d) => {
                          const isAlreadyLogged = logs.some(
                            (l) =>
                              l.meal_type === activeMealType &&
                              l.food_name.toLowerCase().includes(d.name.toLowerCase().trim())
                          );

                          return (
                            <button
                              key={d.id}
                              type="button"
                              onClick={() => {
                                setSelectedDish(d);
                                setDishPortionCount(1);
                              }}
                              className="w-full text-left p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-zinc-200 dark:border-zinc-700/60 transition flex justify-between items-center"
                            >
                              <div className="pr-2 truncate">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                                    {d.name}
                                  </span>
                                  {isAlreadyLogged && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 shrink-0">
                                      ✓ Registrado
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-zinc-500 block truncate">
                                  Por {d.serving_name}: P {d.protein_per_serving}g • C {d.carbs_per_serving}g • G {d.fat_per_serving}g
                                </span>
                              </div>
                              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                                {d.calories_per_serving} kcal
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Alimentos de la base de datos coincidentes */}
                    {searchQuery.trim() && searchResults.length > 0 && (
                      <div className="space-y-1 pt-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block px-1">
                          Alimentos Básicos ({searchResults.length})
                        </span>
                        {searchResults.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => handleSelectFood(f)}
                            className="w-full text-left p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 border border-zinc-200 dark:border-zinc-700/60 transition flex justify-between items-center"
                          >
                            <div className="pr-2 truncate">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="text-[9px] font-medium bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-1.5 py-0.2 rounded-md uppercase">
                                  Alimento
                                </span>
                                <span className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                                  {f.name}
                                </span>
                              </div>
                              <span className="text-[10px] text-zinc-400 block truncate">
                                {f.brand ? `${f.brand} • ` : ''}Por 100g: P {f.protein_g}g • C {f.carbs_g}g • G {f.fat_g}g
                              </span>
                            </div>
                            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 shrink-0">
                              {f.calories} kcal
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Sin resultados tras buscar */}
                    {searchQuery.trim() && !searching && matchingDishes.length === 0 && searchResults.length === 0 && (
                      <div className="p-4 text-center text-zinc-400 text-xs bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-700/60">
                        No se encontraron platillos ni alimentos con "{searchQuery}".
                      </div>
                    )}

                    {/* Si no hay búsqueda escrita: mostrar tus platillos guardados listos para 1 clic */}
                    {!searchQuery.trim() && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block px-1">
                          Tus Platillos Guardados ({savedDishes.length})
                        </span>
                        {savedDishes.length === 0 ? (
                          <div className="text-center py-4 text-zinc-400 text-xs bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-700/60">
                            <p>Aún no tienes platillos guardados en tu catálogo.</p>
                            <p className="text-[11px] text-zinc-500 mt-0.5">Escribe arriba para buscar cualquier alimento o regístralos en "Platillos".</p>
                          </div>
                        ) : (
                          matchingDishes.map((d) => {
                            const isAlreadyLogged = logs.some(
                              (l) =>
                                l.meal_type === activeMealType &&
                                l.food_name.toLowerCase().includes(d.name.toLowerCase().trim())
                            );

                            return (
                              <button
                                key={d.id}
                                type="button"
                                onClick={() => {
                                  setSelectedDish(d);
                                  setDishPortionCount(1);
                                }}
                                className="w-full text-left p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-zinc-200 dark:border-zinc-700/60 transition flex justify-between items-center"
                              >
                                <div className="pr-2 truncate">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                                      {d.name}
                                    </span>
                                    {isAlreadyLogged && (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 shrink-0">
                                        ✓ Registrado
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-zinc-500 block truncate">
                                    Por {d.serving_name}: P {d.protein_per_serving}g • C {d.carbs_per_serving}g • G {d.fat_per_serving}g
                                  </span>
                                </div>
                                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                                  {d.calories_per_serving} kcal
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {/* MODO 2: CONFIGURAR PORCIONES DEL PLATILLO SELECCIONADO */}
            {selectedDish && (
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

            {/* Configurar gramos para alimento simple */}
            {selectedFood && (
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
                    {(() => {
                      const unitInfo = getFoodUnitInfo(selectedFood);
                      const pieceCount = unitInfo.isPieceBased
                        ? (amountGrams / unitInfo.unitGrams).toFixed(1).replace('.0', '')
                        : null;

                      return (
                        <>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                              Cantidad a registrar
                            </label>
                            <span className="text-[11px] text-zinc-500 font-medium">
                              {unitInfo.isPieceBased
                                ? `1 ${unitInfo.unitName} ≈ ${unitInfo.unitGrams}g`
                                : `Porción base: ${unitInfo.unitGrams}g`}
                            </span>
                          </div>

                          {/* Botones de selección rápida */}
                          <div className="grid grid-cols-4 gap-1.5 mb-2.5">
                            {unitInfo.options.map((opt) => {
                              const isSelected = amountGrams === opt.grams;
                              return (
                                <button
                                  key={opt.label}
                                  type="button"
                                  onClick={() => setAmountGrams(opt.grams)}
                                  className={`py-1.5 px-1 rounded-xl text-xs font-bold border transition text-center ${
                                    isSelected
                                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                      : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>

                          <div className="relative">
                            <input
                              type="number"
                              value={amountGrams}
                              onChange={(e) => setAmountGrams(Math.max(1, Number(e.target.value)))}
                              className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-base font-bold text-zinc-900 dark:text-white text-center"
                            />
                            <span className="absolute right-3.5 top-2.5 text-xs text-zinc-400 font-medium pointer-events-none">
                              gramos {pieceCount && unitInfo.isPieceBased ? `(${pieceCount} ${Number(pieceCount) === 1 ? unitInfo.unitName : unitInfo.pluralUnitName})` : ''}
                            </span>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Cálculo dinámico resultante */}
                  <div className="grid grid-cols-5 gap-1.5 mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-700 text-center">
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
                    <div>
                      <span className="text-[10px] text-zinc-400 block">🌾 Fibra</span>
                      <span className="text-xs font-bold text-teal-600 dark:text-teal-400">
                        {(((selectedFood.fiber_g || 0) * amountGrams) / (selectedFood.serving_size_g || 100)).toFixed(1)}g
                      </span>
                    </div>
                  </div>
                </div>

                {saveLogError && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{saveLogError}</span>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFood(null);
                      setSaveLogError(null);
                    }}
                    className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-600 dark:text-zinc-300"
                  >
                    Volver
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveLog}
                    disabled={isSavingFoodLog}
                    className="flex-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 transition"
                  >
                    {isSavingFoodLog ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Registrando...</span>
                      </>
                    ) : (
                      <span>Confirmar y Registrar</span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}


      {/* MODAL VER RECETA, INGREDIENTES Y ESCALADO DE COMIDA PLANEADA */}
      {selectedPlannedDishForModal && (
        <RecipeDetailModal
          dish={selectedPlannedDishForModal}
          onClose={() => setSelectedPlannedDishForModal(null)}
          onLogToday={(dish, count) => {
            handleLogPlannedMeal(
              {
                custom_name: `${dish.name} (${count} ${dish.serving_name || 'porción'})`,
                calories: Math.round(dish.calories_per_serving * count),
                protein_g: Number((dish.protein_per_serving * count).toFixed(1)),
                carbs_g: Number((dish.carbs_per_serving * count).toFixed(1)),
                fat_g: Number((dish.fat_per_serving * count).toFixed(1)),
                servings: count,
              },
              dish.category === 'general' ? 'lunch' : (dish.category as MealType)
            );
            setSelectedPlannedDishForModal(null);
          }}
        />
      )}

      {/* MODAL: AJUSTAR ALIMENTO / CAMBIAR COMIDA O CANTIDAD */}
      {editingLog && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Encabezado */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-emerald-500" />
                  Ajustar Alimento
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-1">
                  {editingLog.food_name}
                </p>
              </div>
              <button
                onClick={() => setEditingLog(null)}
                className="p-1 text-zinc-400 hover:text-zinc-800 dark:hover:text-white rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error si ocurre */}
            {editLogError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editLogError}</span>
              </div>
            )}

            {/* 1. Mover a otro tiempo de comida */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                Mover a tiempo de comida:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {meals.map((m) => {
                  const isSelected = editMealType === m.type;
                  const icons: Record<MealType, string> = {
                    breakfast: '🍳',
                    lunch: '🍛',
                    dinner: '🥣',
                    snack: '🍎',
                  };
                  return (
                    <button
                      key={m.type}
                      type="button"
                      onClick={() => setEditMealType(m.type)}
                      className={`p-2.5 rounded-xl text-xs font-medium border flex items-center gap-2 transition text-left ${
                        isSelected
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-semibold shadow-sm'
                          : 'bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
                      }`}
                    >
                      <span className="text-base">{icons[m.type]}</span>
                      <span className="truncate">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Cantidad en gramos */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Cantidad registrada
                </label>
                <span className="text-[11px] text-zinc-400">
                  Gramos (g)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditAmountGrams((prev) => Math.max(10, prev - 25))}
                  className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition flex items-center justify-center shrink-0"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  max="5000"
                  value={editAmountGrams || ''}
                  onChange={(e) => setEditAmountGrams(Math.max(1, Number(e.target.value) || 0))}
                  className="flex-1 text-center py-2 px-3 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setEditAmountGrams((prev) => prev + 25)}
                  className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition flex items-center justify-center shrink-0"
                >
                  +
                </button>
              </div>
            </div>

            {/* 3. Previsualización de macros recalculados */}
            {(() => {
              const origAmount = editingLog.amount_g || 1;
              const ratio = editAmountGrams > 0 ? editAmountGrams / origAmount : 1;
              const calcCals = Math.round(editingLog.calories * ratio);
              const calcProt = Number((editingLog.protein_g * ratio).toFixed(1));
              const calcCarbs = Number((editingLog.carbs_g * ratio).toFixed(1));
              const calcFat = Number((editingLog.fat_g * ratio).toFixed(1));
              const calcFiber = Number(((editingLog.fiber_g || 0) * ratio).toFixed(1));

              return (
                <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800/60">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                      Aporte recalculado:
                    </span>
                    <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                      {calcCals} kcal
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 text-center text-[10px]">
                    <div className="p-1.5 bg-white dark:bg-zinc-800 rounded-lg">
                      <span className="text-zinc-400 block">Prot</span>
                      <span className="font-bold text-zinc-800 dark:text-zinc-200">{calcProt}g</span>
                    </div>
                    <div className="p-1.5 bg-white dark:bg-zinc-800 rounded-lg">
                      <span className="text-zinc-400 block">Carb</span>
                      <span className="font-bold text-zinc-800 dark:text-zinc-200">{calcCarbs}g</span>
                    </div>
                    <div className="p-1.5 bg-white dark:bg-zinc-800 rounded-lg">
                      <span className="text-zinc-400 block">Grasa</span>
                      <span className="font-bold text-zinc-800 dark:text-zinc-200">{calcFat}g</span>
                    </div>
                    <div className="p-1.5 bg-white dark:bg-zinc-800 rounded-lg">
                      <span className="text-zinc-400 block">Fibra</span>
                      <span className="font-bold text-zinc-800 dark:text-zinc-200">{calcFiber}g</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Acciones */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingLog(null)}
                className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEditLog}
                disabled={isUpdatingLog}
                className="flex-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 transition"
              >
                {isUpdatingLog ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <span>Guardar Cambios</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para ingresar cantidad exacta de agua / presets rápidos */}
      {isWaterModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 max-w-sm w-full border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-100 dark:bg-sky-900/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                  <Droplets className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Registrar Hidratación</h3>
                  <span className="text-[11px] text-zinc-400">
                    Fecha: {selectedDate === getLocalDateString() ? 'Hoy' : selectedDate}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsWaterModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Input manual */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Cantidad de agua acumulada (ml):
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  max="15000"
                  step="50"
                  value={customWaterInput}
                  onChange={(e) => setCustomWaterInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const parsed = Number(customWaterInput);
                      if (!isNaN(parsed)) {
                        handleSetExactWater(parsed);
                      }
                    }
                  }}
                  placeholder="ej. 2500"
                  className="flex-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-zinc-900 dark:text-white focus:outline-emerald-500"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    const parsed = Number(customWaterInput);
                    if (!isNaN(parsed)) {
                      handleSetExactWater(parsed);
                    }
                  }}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
                >
                  Guardar
                </button>
              </div>
            </div>

            {/* Presets rápidos */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                Atajos y Presets:
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSetExactWater(targetWater)}
                  className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 hover:bg-sky-100 dark:hover:bg-sky-900/60 transition text-left text-xs cursor-pointer"
                >
                  <span className="font-bold text-sky-800 dark:text-sky-300 block">🎯 Meta ({targetWater} ml)</span>
                  <span className="text-[10px] text-sky-600 dark:text-sky-400">Meta calculada completa</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSetExactWater(2000)}
                  className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-750 transition text-left text-xs cursor-pointer"
                >
                  <span className="font-bold text-zinc-800 dark:text-zinc-200 block">🥤 2,000 ml</span>
                  <span className="text-[10px] text-zinc-400">2 Litros estándar</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAdjustWater(500)}
                  className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-750 transition text-left text-xs cursor-pointer"
                >
                  <span className="font-bold text-zinc-800 dark:text-zinc-200 block">+500 ml</span>
                  <span className="text-[10px] text-zinc-400">1 Botella / shaker</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAdjustWater(1000)}
                  className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-750 transition text-left text-xs cursor-pointer"
                >
                  <span className="font-bold text-zinc-800 dark:text-zinc-200 block">+1,000 ml</span>
                  <span className="text-[10px] text-zinc-400">1 Termo grande</span>
                </button>
              </div>

              <div className="pt-2 flex justify-between items-center text-xs">
                <button
                  type="button"
                  onClick={() => handleSetExactWater(0)}
                  className="text-zinc-400 hover:text-red-500 text-[11px] transition cursor-pointer"
                >
                  Reiniciar a 0 ml
                </button>
                <button
                  type="button"
                  onClick={() => setIsWaterModalOpen(false)}
                  className="text-zinc-500 dark:text-zinc-400 font-semibold cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
