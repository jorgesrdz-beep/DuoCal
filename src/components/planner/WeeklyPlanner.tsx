'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  Copy,
  Plus,
  ShoppingCart,
  Trash2,
  CheckSquare,
  Square,
  RefreshCw,
  Calendar,
  Check,
  CheckCircle2,
  Share2,
  PlusCircle,
  CheckCheck,
  Sparkles,
  X,
  Search,
  ChefHat,
  Apple,
  Edit3,
  Scale,
  Flame,
  Clock,
  BookOpen,
  Utensils,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
} from 'lucide-react';
import { MealType, ShoppingListItem, Dish, Food } from '@/types/database';
import { getWeekStartDate, getNextWeekStartDate, getSmartMealPrepWeekStartDate, formatWeekDateRange, getDayOfWeekName, shiftDateDays, getLocalDateString } from '@/lib/utils';
import { STARTER_RECIPES } from '@/lib/data/starterRecipes';
import RecipeDetailModal from '@/components/dishes/RecipeDetailModal';

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Desayuno',
  lunch: 'Comida',
  dinner: 'Cena',
  snack: 'Snacks',
};

export default function WeeklyPlanner() {
  const { activeGoal, household } = useAuth();
  const [weekStart, setWeekStart] = useState(() => getSmartMealPrepWeekStartDate());
  const [selectedDay, setSelectedDay] = useState(1); // 1 = Lunes
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modo pestaña: 'planner' o 'shopping'
  const [viewMode, setViewMode] = useState<'planner' | 'shopping'>('planner');
  const [shoppingList, setShoppingList] = useState<ShoppingListItem[]>([]);

  // Estados para Lista de Compras Interactiva en el Súper
  const [shoppingFilter, setShoppingFilter] = useState<'all' | 'pending' | 'in_cart'>('all');
  const [isAddCustomItemOpen, setIsAddCustomItemOpen] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemQty, setCustomItemQty] = useState('');
  const [customItemCategory, setCustomItemCategory] = useState('Abarrotes y Granos');
  const [copiedToast, setCopiedToast] = useState(false);
  const [isGeneratingShopping, setIsGeneratingShopping] = useState(false);
  const [shoppingToast, setShoppingToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Catálogo de platillos cargados
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loadingDishes, setLoadingDishes] = useState(false);
  const [selectedPlanDishForModal, setSelectedPlanDishForModal] = useState<Dish | null>(null);

  // Modal para añadir comida al plan (Selector Inteligente de Platillos)
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addMealType, setAddMealType] = useState<MealType>('lunch');
  const [plannerModalTab, setPlannerModalTab] = useState<'dishes' | 'foods' | 'manual'>('dishes');
  const [dishSearch, setDishSearch] = useState('');
  const [dishCategoryFilter, setDishCategoryFilter] = useState<'suggested' | 'all' | 'breakfast' | 'lunch' | 'dinner' | 'snack'>('suggested');
  const [dishServingsMap, setDishServingsMap] = useState<Record<string, number>>({});

  // Búsqueda de alimentos en catálogo individual
  const [foodSearchQuery, setFoodSearchQuery] = useState('');
  const [foodSearchResults, setFoodSearchResults] = useState<Food[]>([]);
  const [searchingFoods, setSearchingFoods] = useState(false);
  const [selectedFoodItem, setSelectedFoodItem] = useState<Food | null>(null);
  const [foodGrams, setFoodGrams] = useState(100);

  // Entrada manual rápida
  const [mealName, setMealName] = useState('');
  const [mealCalories, setMealCalories] = useState(450);
  const [mealProtein, setMealProtein] = useState(35);
  const [mealCarbs, setMealCarbs] = useState(45);
  const [mealFat, setMealFat] = useState(12);

  // Modal para duplicar día (Meal Prep)
  const [isDuplicateOpen, setIsDuplicateOpen] = useState(false);
  const [targetDays, setTargetDays] = useState<number[]>([2, 3, 4, 5]);
  const [selectedItemIdsToDuplicate, setSelectedItemIdsToDuplicate] = useState<string[]>([]);
  const [duplicateLoading, setDuplicateLoading] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [duplicateSuccess, setDuplicateSuccess] = useState<string | null>(null);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/meal-plans?week_start=${weekStart}`);
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchShoppingList = async () => {
    try {
      const res = await fetch(`/api/meal-plans/shopping-list?week_start=${weekStart}`);
      if (res.ok) {
        const data = await res.json();
        setShoppingList(data.items || []);
      }
    } catch {
      // Ignorar
    }
  };

  const fetchDishes = async () => {
    setLoadingDishes(true);
    try {
      const res = await fetch('/api/dishes');
      if (res.ok) {
        const data = await res.json();
        setDishes(data.dishes || []);
      }
    } catch {
      // Ignorar
    } finally {
      setLoadingDishes(false);
    }
  };

  useEffect(() => {
    fetchPlans();
    fetchShoppingList();
    fetchDishes();
  }, [weekStart]);

  // Platillos unificados (hogar + biblioteca de recetas de inicio)
  const combinedDishes = useMemo(() => {
    const map = new Map<string, Dish>();
    // Primero platillos guardados por el usuario o su hogar
    dishes.forEach((d) => {
      map.set(d.name.toLowerCase().trim(), d);
    });
    // Luego recetas de biblioteca
    STARTER_RECIPES.forEach((s) => {
      const key = s.name.toLowerCase().trim();
      if (!map.has(key)) {
        map.set(key, s);
      }
    });
    return Array.from(map.values());
  }, [dishes]);

  // Filtrado de platillos en el modal
  const filteredDishes = useMemo(() => {
    return combinedDishes.filter((dish) => {
      // Filtro por categoría o sugerencia
      if (dishCategoryFilter === 'suggested') {
        const matchesMeal = dish.category === addMealType || dish.category === 'general';
        if (!matchesMeal) return false;
      } else if (dishCategoryFilter !== 'all') {
        if (dish.category !== dishCategoryFilter) return false;
      }

      // Filtro por término de búsqueda
      if (dishSearch.trim()) {
        const q = dishSearch.toLowerCase().trim();
        const matchesName = dish.name.toLowerCase().includes(q);
        const matchesDesc = dish.description?.toLowerCase().includes(q);
        const matchesIng = dish.ingredients?.some((ing) =>
          ing.ingredient_name.toLowerCase().includes(q)
        );
        return matchesName || matchesDesc || matchesIng;
      }

      return true;
    });
  }, [combinedDishes, dishCategoryFilter, addMealType, dishSearch]);

  const getPortionsForDish = (dishId: string) => {
    return dishServingsMap[dishId] !== undefined ? dishServingsMap[dishId] : 1;
  };

  const setPortionsForDish = (dishId: string, count: number) => {
    setDishServingsMap((prev) => ({
      ...prev,
      [dishId]: Math.max(0.5, Math.min(6, Number(count.toFixed(1)))),
    }));
  };

  const handleAddDishToPlan = async (dish: Dish) => {
    const servings = getPortionsForDish(dish.id);
    const scaledCalories = Math.round(dish.calories_per_serving * servings);
    const scaledProtein = Number((dish.protein_per_serving * servings).toFixed(1));
    const scaledCarbs = Number((dish.carbs_per_serving * servings).toFixed(1));
    const scaledFat = Number((dish.fat_per_serving * servings).toFixed(1));

    const formattedName =
      servings === 1
        ? dish.name
        : `${dish.name} (${servings} ${servings === 1 ? 'porción' : 'porciones'})`;

    try {
      const res = await fetch('/api/meal-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          week_start_date: weekStart,
          day_of_week: selectedDay,
          meal_type: addMealType,
          food_id: dish.id,
          custom_name: formattedName,
          servings: servings,
          calories: scaledCalories,
          protein_g: scaledProtein,
          carbs_g: scaledCarbs,
          fat_g: scaledFat,
        }),
      });

      if (res.ok) {
        // Si es una plantilla de la biblioteca curada y no está en Mis Platillos,
        // la clonamos automáticamente para que el usuario pueda consultarla y escalarla desde Platillos
        if (dish.is_starter_template) {
          const alreadySaved = dishes.some(
            (d) => d.name.toLowerCase().trim() === dish.name.toLowerCase().trim()
          );
          if (!alreadySaved) {
            fetch('/api/dishes/templates', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ templateId: dish.id, servings: 1 }),
            })
              .then(() => fetchDishes())
              .catch(() => {});
          }
        }

        await fetchPlans();
        setIsAddOpen(false);
      }
    } catch {
      // Ignorar
    }
  };

  const handleOpenPlanRecipe = (item: any) => {
    const rawMealName = item.custom_name.trim();
    const baseMealName = rawMealName.replace(/\s*\(.*$/, '').trim().toLowerCase();

    const matched =
      dishes.find(
        (d) =>
          (item.food_id && d.id === item.food_id) ||
          d.name.toLowerCase().trim() === baseMealName ||
          d.name.toLowerCase().includes(baseMealName) ||
          baseMealName.includes(d.name.toLowerCase().trim())
      ) ||
      STARTER_RECIPES.find(
        (s) =>
          (item.food_id && s.id === item.food_id) ||
          s.name.toLowerCase().trim() === baseMealName ||
          s.name.toLowerCase().includes(baseMealName) ||
          baseMealName.includes(s.name.toLowerCase().trim())
      );

    if (matched) {
      setSelectedPlanDishForModal(matched);
    } else {
      const s = item.servings || 1;
      const cals = item.calories || 0;
      const prot = item.protein_g || 0;
      const carbs = item.carbs_g || 0;
      const fat = item.fat_g || 0;
      const fiber = item.fiber_g || 0;
      setSelectedPlanDishForModal({
        id: item.food_id || item.id,
        user_id: '',
        household_id: null,
        name: rawMealName.replace(/\s*\(.*$/, '').trim() || item.custom_name,
        description: null,
        category: (item.meal_type || 'general') as any,
        total_servings: s,
        total_weight_g: null,
        serving_name: 'porción',
        is_shared_with_partner: false,
        prep_time_minutes: 15,
        cook_time_minutes: 0,
        instructions: [
          'Preparar según tus cantidades planeadas.',
          'Consumir o empacar para meal prep refrigerando en recipiente hermético.'
        ],
        total_calories: cals,
        total_protein_g: prot,
        total_carbs_g: carbs,
        total_fat_g: fat,
        total_fiber_g: fiber,
        calories_per_serving: Math.round(cals / s),
        protein_per_serving: Number((prot / s).toFixed(1)),
        carbs_per_serving: Number((carbs / s).toFixed(1)),
        fat_per_serving: Number((fat / s).toFixed(1)),
        fiber_per_serving: Number((fiber / s).toFixed(1)),
        ingredients: [
          {
            id: 'fallback-ing',
            dish_id: item.food_id || item.id,
            food_id: null,
            ingredient_name: rawMealName,
            amount_g: s * 100,
            calories: cals,
            protein_g: prot,
            carbs_g: carbs,
            fat_g: fat,
            created_at: new Date().toISOString(),
          },
        ],
        created_at: new Date().toISOString(),
      });
    }
  };

  const plannerSearchAbortRef = useRef<AbortController | null>(null);
  const plannerSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearchFoodsInPlanner = (q: string) => {
    setFoodSearchQuery(q);

    if (plannerSearchTimeoutRef.current) {
      clearTimeout(plannerSearchTimeoutRef.current);
    }
    if (plannerSearchAbortRef.current) {
      plannerSearchAbortRef.current.abort();
      plannerSearchAbortRef.current = null;
    }

    if (!q.trim()) {
      setFoodSearchResults([]);
      setSearchingFoods(false);
      return;
    }

    setSearchingFoods(true);
    plannerSearchTimeoutRef.current = setTimeout(async () => {
      const controller = new AbortController();
      plannerSearchAbortRef.current = controller;

      try {
        const res = await fetch(`/api/foods/search?q=${encodeURIComponent(q.trim())}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setFoodSearchResults(data.foods || []);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          // Ignorar cancelaciones
        }
      } finally {
        if (plannerSearchAbortRef.current === controller) {
          setSearchingFoods(false);
        }
      }
    }, 220);
  };

  const handleAddFoodToPlan = async () => {
    if (!selectedFoodItem) return;
    const factor = foodGrams / (selectedFoodItem.serving_size_g || 100);
    const cals = Math.round(selectedFoodItem.calories * factor);
    const prot = Number((selectedFoodItem.protein_g * factor).toFixed(1));
    const carbs = Number((selectedFoodItem.carbs_g * factor).toFixed(1));
    const fat = Number((selectedFoodItem.fat_g * factor).toFixed(1));

    try {
      const res = await fetch('/api/meal-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          week_start_date: weekStart,
          day_of_week: selectedDay,
          meal_type: addMealType,
          food_id: selectedFoodItem.id,
          custom_name: `${selectedFoodItem.name} (${foodGrams}g)`,
          servings: 1,
          calories: cals,
          protein_g: prot,
          carbs_g: carbs,
          fat_g: fat,
        }),
      });

      if (res.ok) {
        await fetchPlans();
        setIsAddOpen(false);
        setSelectedFoodItem(null);
        setFoodSearchQuery('');
        setFoodSearchResults([]);
      }
    } catch {
      // Ignorar
    }
  };

  const handleAddMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mealName.trim()) return;

    try {
      const res = await fetch('/api/meal-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          week_start_date: weekStart,
          day_of_week: selectedDay,
          meal_type: addMealType,
          custom_name: mealName.trim(),
          servings: 1,
          calories: mealCalories,
          protein_g: mealProtein,
          carbs_g: mealCarbs,
          fat_g: mealFat,
        }),
      });

      if (res.ok) {
        await fetchPlans();
        setIsAddOpen(false);
        setMealName('');
      }
    } catch {
      // Ignorar
    }
  };

  const handleDeletePlan = async (id: string) => {
    try {
      await fetch(`/api/meal-plans?id=${id}`, { method: 'DELETE' });
      await fetchPlans();
    } catch {
      // Ignorar
    }
  };

  const handleOpenDuplicateModal = (presetItemId?: string | unknown) => {
    const currentDayPlans = plans.filter((p) => p.day_of_week === selectedDay);
    if (typeof presetItemId === 'string' && presetItemId) {
      setSelectedItemIdsToDuplicate([presetItemId]);
    } else {
      // Detección inteligente: filtrar aquellos platillos que NO están ya presentes en los otros días de la semana
      const uncopied = currentDayPlans.filter((p) => {
        const baseName = p.custom_name.replace(/\s*\(.*$/, '').trim().toLowerCase();
        const alreadyInOtherDays = plans.some(
          (other) =>
            other.day_of_week !== selectedDay &&
            other.custom_name.replace(/\s*\(.*$/, '').trim().toLowerCase().includes(baseName)
        );
        return !alreadyInOtherDays;
      });

      // Si hay platillos no copiados (como el recién añadido), sugerimos SOLO esos por defecto
      if (uncopied.length > 0) {
        setSelectedItemIdsToDuplicate(uncopied.map((p) => p.id));
      } else {
        // Si todos ya están o ninguno está, preseleccionamos todos
        setSelectedItemIdsToDuplicate(currentDayPlans.map((p) => p.id));
      }
    }
    // Por defecto sugerir los demás días entre semana (L-V) si es día de semana, o toda la semana
    const remainingWeekdays = [1, 2, 3, 4, 5].filter((d) => d !== selectedDay);
    setTargetDays(remainingWeekdays.length > 0 ? remainingWeekdays : [1, 2, 3, 4, 5, 6, 7].filter((d) => d !== selectedDay));
    setDuplicateError(null);
    setDuplicateSuccess(null);
    setIsDuplicateOpen(true);
  };

  const handleDuplicateToWeekdays = async () => {
    const currentDayPlans = plans.filter((p) => p.day_of_week === selectedDay);
    const validSelectedIds = currentDayPlans
      .filter((p) => selectedItemIdsToDuplicate.includes(p.id))
      .map((p) => p.id);

    if (targetDays.length === 0) {
      setDuplicateError('Por favor selecciona al menos un día destino.');
      return;
    }
    if (validSelectedIds.length === 0) {
      setDuplicateError('Selecciona al menos un platillo para duplicar.');
      return;
    }

    setDuplicateLoading(true);
    setDuplicateError(null);
    setDuplicateSuccess(null);

    try {
      const res = await fetch('/api/meal-plans/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          week_start_date: weekStart,
          source_day: selectedDay,
          target_days: targetDays,
          selected_item_ids: validSelectedIds,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setDuplicateError(data.error || 'Error al duplicar el plan.');
        return;
      }

      setDuplicateSuccess(data.message || '¡Plan replicado con éxito!');
      await fetchPlans();
      setTimeout(() => {
        setIsDuplicateOpen(false);
        setDuplicateSuccess(null);
      }, 700);
    } catch {
      setDuplicateError('Error de red al intentar duplicar el plan.');
    } finally {
      setDuplicateLoading(false);
    }
  };

  const handleToggleShopping = async (itemId: string, current: boolean) => {
    // Actualización optimista inmediata en la interfaz
    setShoppingList((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, is_purchased: !current } : i))
    );
    try {
      await fetch('/api/meal-plans/shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', item_id: itemId, is_purchased: !current }),
      });
    } catch {
      fetchShoppingList();
    }
  };

  const handleDeleteShoppingItem = async (itemId: string) => {
    setShoppingList((prev) => prev.filter((i) => i.id !== itemId));
    try {
      await fetch('/api/meal-plans/shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', item_id: itemId }),
      });
    } catch {
      fetchShoppingList();
    }
  };

  const handleClearPurchased = async () => {
    const ok = window.confirm('¿Deseas eliminar de la lista todos los productos ya marcados en el carrito?');
    if (!ok) return;
    setShoppingList((prev) => prev.filter((i) => !i.is_purchased));
    try {
      await fetch('/api/meal-plans/shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_purchased', week_start_date: weekStart }),
      });
    } catch {
      fetchShoppingList();
    }
  };

  const handleUncheckAll = async () => {
    setShoppingList((prev) => prev.map((i) => ({ ...i, is_purchased: false })));
    try {
      await fetch('/api/meal-plans/shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'uncheck_all', week_start_date: weekStart }),
      });
    } catch {
      fetchShoppingList();
    }
  };

  const handleAddCustomItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customItemName.trim()) return;

    try {
      const res = await fetch('/api/meal-plans/shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_name: customItemName.trim(),
          quantity_text: customItemQty.trim() || '1 unidad',
          category: customItemCategory,
          week_start_date: weekStart,
        }),
      });
      if (res.ok) {
        setCustomItemName('');
        setCustomItemQty('');
        setIsAddCustomItemOpen(false);
        fetchShoppingList();
      }
    } catch {
      // Ignorar
    }
  };

  const handleExportWhatsApp = () => {
    if (shoppingList.length === 0) return;

    const inCartCount = shoppingList.filter((i) => i.is_purchased).length;
    let text = `🛒 *Lista de Súper DuoCal*\n📅 Semana: ${weekStart}\n📊 En Carrito: ${inCartCount}/${shoppingList.length}\n\n`;

    const aisles = Array.from(new Set(shoppingList.map((i) => i.category || 'Otros')));
    for (const aisle of aisles) {
      const items = shoppingList.filter((i) => (i.category || 'Otros') === aisle);
      text += `*${aisle}*\n`;
      for (const item of items) {
        const checkbox = item.is_purchased ? '✅' : '▫️';
        text += `${checkbox} ${item.item_name} (${item.quantity_text})\n`;
      }
      text += '\n';
    }

    navigator.clipboard.writeText(text.trim());
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 3500);
  };

  const handleGenerateShoppingList = async () => {
    setIsGeneratingShopping(true);
    try {
      const res = await fetch('/api/meal-plans/shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_from_plan', week_start_date: weekStart }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchShoppingList();
        setShoppingToast({
          message: data.message || `¡Lista generada con éxito! Se consolidaron ${data.items?.length || 0} artículos.`,
          type: 'success',
        });
      } else {
        setShoppingToast({
          message: data.error || 'No se pudo generar la lista de compras.',
          type: 'error',
        });
      }
    } catch {
      setShoppingToast({
        message: 'Ocurrió un error al conectar con el servidor.',
        type: 'error',
      });
    } finally {
      setIsGeneratingShopping(false);
      setTimeout(() => setShoppingToast(null), 4000);
    }
  };

  const dayPlans = plans.filter((p) => p.day_of_week === selectedDay);
  const dayCals = dayPlans.reduce((sum, item) => sum + item.calories, 0);
  const targetCals = activeGoal?.calorie_target || 2000;

  return (
    <div className="space-y-5 pb-16">
      {/* Switcher entre Planificador y Lista de compras */}
      <div className="flex bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-2xl">
        <button
          onClick={() => setViewMode('planner')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            viewMode === 'planner'
              ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
              : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-white'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Plan Semanal</span>
        </button>
        <button
          onClick={() => setViewMode('shopping')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            viewMode === 'shopping'
              ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
              : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-white'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Lista de Compras ({shoppingList.length})</span>
        </button>
      </div>

      {viewMode === 'planner' ? (
        <div className="space-y-4">
          {/* Navegador de Semanas */}
          <div className="flex items-center justify-between bg-white dark:bg-zinc-900 p-2.5 px-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm text-xs">
            <button
              type="button"
              onClick={() => {
                setWeekStart(shiftDateDays(weekStart, -7));
              }}
              className="p-1.5 px-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-semibold transition flex items-center gap-1 active:scale-95"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Semana Anterior</span>
              <span className="sm:hidden">Anterior</span>
            </button>

            <div className="text-center">
              <span className="font-bold text-zinc-900 dark:text-white block text-xs sm:text-sm">
                {formatWeekDateRange(weekStart)}
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                {weekStart === getWeekStartDate()
                  ? 'Semana en curso'
                  : weekStart === getNextWeekStartDate()
                  ? '✨ Próxima semana (Meal Prep)'
                  : `Semana del ${weekStart}`}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setWeekStart(shiftDateDays(weekStart, 7));
              }}
              className="p-1.5 px-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-semibold transition flex items-center gap-1 active:scale-95"
            >
              <span className="hidden sm:inline">Semana Siguiente</span>
              <span className="sm:hidden">Siguiente</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Días de la semana (1 al 7) */}
          <div className="grid grid-cols-7 gap-1 bg-white dark:bg-zinc-900 p-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm text-center">
            {[1, 2, 3, 4, 5, 6, 7].map((dayIdx) => {
              const count = plans.filter((p) => p.day_of_week === dayIdx).length;
              const isSelected = selectedDay === dayIdx;
              const isWeekend = dayIdx >= 6;

              return (
                <button
                  key={dayIdx}
                  onClick={() => setSelectedDay(dayIdx)}
                  className={`py-2 px-1 rounded-xl transition flex flex-col items-center justify-center ${
                    isSelected
                      ? 'bg-emerald-600 text-white font-bold shadow-xs'
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                  }`}
                >
                  <span className="text-[10px] uppercase font-semibold">
                    {getDayOfWeekName(dayIdx).slice(0, 3)}
                  </span>
                  <span className={`text-[9px] mt-0.5 ${isSelected ? 'text-emerald-100' : 'text-zinc-400'}`}>
                    {count > 0 ? `${count} com.` : isWeekend ? 'Libre' : '0 com.'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Header del día seleccionado */}
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  {getDayOfWeekName(selectedDay)}
                </h3>
                {selectedDay >= 6 && (
                  <span className="text-[10px] bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium">
                    Fin de semana flexible
                  </span>
                )}
              </div>
              <span className="text-xs text-zinc-400">
                Planeado: {dayCals} kcal / Meta: {targetCals} kcal
              </span>
            </div>

            {/* Botón Duplicar día a entre semana */}
            <button
              onClick={() => handleOpenDuplicateModal()}
              className="flex items-center gap-1 text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 px-3 py-2 rounded-xl transition cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-emerald-500" />
              <span className="hidden sm:inline">Repetir en semana</span>
              <span className="sm:hidden">Repetir</span>
            </button>
          </div>

          {/* Lista de comidas planeadas del día */}
          <div className="space-y-3">
            {['breakfast', 'lunch', 'dinner', 'snack'].map((mType) => {
              const items = dayPlans.filter((p) => p.meal_type === mType);
              const label =
                mType === 'breakfast'
                  ? 'Desayuno'
                  : mType === 'lunch'
                  ? 'Comida'
                  : mType === 'dinner'
                  ? 'Cena'
                  : 'Snacks';

              return (
                <div
                  key={mType}
                  className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                      {label}
                    </span>
                    <button
                      onClick={() => {
                        setAddMealType(mType as MealType);
                        setPlannerModalTab('dishes');
                        setDishCategoryFilter('suggested');
                        setDishSearch('');
                        setSelectedFoodItem(null);
                        setIsAddOpen(true);
                      }}
                      className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Planear</span>
                    </button>
                  </div>

                  {items.length === 0 ? (
                    <p className="text-xs text-zinc-400 italic">Sin comida planeada.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 border border-transparent hover:border-emerald-500/30 transition text-xs gap-2"
                        >
                          <div
                            onClick={() => handleOpenPlanRecipe(item)}
                            className="flex-1 min-w-0 cursor-pointer group"
                            title="Haz clic para ver ingredientes, medidas y escalar receta"
                          >
                            <span className="font-semibold text-zinc-900 dark:text-white block truncate group-hover:text-emerald-600 transition">
                              {item.custom_name}
                            </span>
                            <span className="text-[10px] text-zinc-400">
                              {item.calories} kcal • P {item.protein_g}g • C {item.carbs_g}g • G {item.fat_g}g
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleOpenPlanRecipe(item)}
                              className="px-2.5 py-1 bg-emerald-100/80 hover:bg-emerald-200 dark:bg-emerald-950/70 dark:hover:bg-emerald-900 text-emerald-800 dark:text-emerald-300 font-bold rounded-lg text-[10px] flex items-center gap-1 transition shadow-2xs cursor-pointer"
                              title="Ver receta, cantidades para preparar e instrucciones de cocina"
                            >
                              <ChefHat className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>Cocinar</span>
                            </button>

                            <button
                              onClick={() => handleOpenDuplicateModal(item.id)}
                              className="p-1 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition cursor-pointer"
                              title="Repetir solo este platillo en otros días de la semana"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleDeletePlan(item.id)}
                              className="text-zinc-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition cursor-pointer"
                              title="Eliminar del plan"
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

          {/* Acceso rápido para autogenerar lista de compras desde la vista del plan */}
          <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/5 dark:from-emerald-950/40 dark:to-teal-950/20 border border-emerald-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-left w-full sm:w-auto">
              <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs shrink-0">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                  ¿Listo para hacer las compras de la semana?
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {shoppingList.length > 0
                    ? `Tienes ${shoppingList.length} artículos en la lista. Puedes autogenerar de nuevo para sincronizar.`
                    : 'Extrae automáticamente los ingredientes de la semana organizados por pasillo.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={async () => {
                  await handleGenerateShoppingList();
                  setViewMode('shopping');
                }}
                disabled={isGeneratingShopping}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-xs transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingShopping ? 'animate-spin' : ''}`} />
                <span>{isGeneratingShopping ? 'Consolidando...' : 'Autogenerar Carrito de Súper'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* PESTAÑA: LISTA DE COMPRAS EN EL SUPERMERCADO */
        <div className="space-y-4">
          {/* TOAST DE COPIADO A WHATSAPP */}
          {copiedToast && (
            <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 text-white dark:bg-emerald-600 px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold border border-zinc-700">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-white shrink-0" />
              <span>¡Lista copiada al portapapeles! Lista para pegar en WhatsApp 📲</span>
            </div>
          )}

          {/* TOAST DE NOTIFICACIÓN DE LISTA DE COMPRAS */}
          {shoppingToast && (
            <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold border transition-all ${
              shoppingToast.type === 'success'
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-900/20'
                : 'bg-red-600 text-white border-red-500 shadow-red-900/20'
            }`}>
              {shoppingToast.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-white shrink-0" />
              )}
              <span>{shoppingToast.message}</span>
            </div>
          )}

          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
            {/* Header de la Lista de Súper */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                  <ShoppingCart className="w-4 h-4 text-emerald-600" />
                  <span>Supermercado del Hogar</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Marca con checkbox lo que vas metiendo al carrito de compras
                </p>
              </div>

              {/* Botones de acción principales */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setIsAddCustomItemOpen(true)}
                  className="flex items-center gap-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold px-2.5 py-1.5 rounded-xl transition"
                  title="Agregar producto rápido al súper"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Producto</span>
                </button>

                <button
                  onClick={handleGenerateShoppingList}
                  disabled={isGeneratingShopping}
                  className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold px-3 py-1.5 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed shadow-xs active:scale-95"
                  title="Consolidar automáticamente desde lo planeado en la semana"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingShopping ? 'animate-spin text-emerald-600' : ''}`} />
                  <span>{isGeneratingShopping ? 'Generando...' : 'Autogenerar'}</span>
                </button>

                {shoppingList.length > 0 && (
                  <button
                    onClick={handleExportWhatsApp}
                    className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-xl shadow-xs transition"
                    title="Copiar lista formateada para WhatsApp"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </button>
                )}
              </div>
            </div>

            {/* BARRA DE PROGRESO DEL CARRITO DE COMPRAS */}
            {shoppingList.length > 0 && (
              (() => {
                const inCart = shoppingList.filter((i) => i.is_purchased).length;
                const total = shoppingList.length;
                const pct = Math.round((inCart / total) * 100);

                return (
                  <div className="bg-zinc-50 dark:bg-zinc-800/60 p-3.5 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/60 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                        <ShoppingCart className="w-3.5 h-3.5 text-emerald-500" />
                        <span>En el Carrito de Compras:</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                          {inCart} de {total} ({pct}%)
                        </span>
                      </div>
                    </div>

                    {/* Barra de progreso */}
                    <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-300 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    {/* Acciones de lote (Desmarcar / Limpiar) */}
                    <div className="flex items-center justify-between pt-1 text-[11px] text-zinc-400">
                      <span>
                        {pct === 100
                          ? '🎉 ¡Completaste todos los productos de la lista!'
                          : `${total - inCart} artículo(s) faltantes por encontrar`}
                      </span>
                      <div className="flex items-center gap-3">
                        {inCart > 0 && (
                          <>
                            <button
                              onClick={handleUncheckAll}
                              className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                            >
                              Desmarcar todos
                            </button>
                            <span>•</span>
                            <button
                              onClick={handleClearPurchased}
                              className="text-red-500 hover:text-red-600 font-medium"
                            >
                              Limpiar comprados
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()
            )}

            {/* FILTROS DE VISTA (TODOS / PENDIENTES / EN EL CARRITO) */}
            {shoppingList.length > 0 && (
              <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl text-xs">
                {[
                  { key: 'all', label: `Todos (${shoppingList.length})` },
                  {
                    key: 'pending',
                    label: `Pendientes (${shoppingList.filter((i) => !i.is_purchased).length})`,
                  },
                  {
                    key: 'in_cart',
                    label: `En Carrito (${shoppingList.filter((i) => i.is_purchased).length})`,
                  },
                ].map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setShoppingFilter(f.key as any)}
                    className={`flex-1 py-1.5 rounded-lg font-semibold transition ${
                      shoppingFilter === f.key
                        ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}

            {/* LISTADO DE PRODUCTOS AGRUPADOS POR PASILLO */}
            {shoppingList.length === 0 ? (
              <div className="text-center py-10 px-4 text-zinc-400 text-xs">
                <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30 text-emerald-500" />
                <p className="font-bold text-sm text-zinc-700 dark:text-zinc-200">
                  Tu lista de compras está vacía
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto leading-relaxed">
                  Autogenera los ingredientes consolidados de tus platillos del plan semanal o agrega productos individuales directamente.
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <button
                    onClick={handleGenerateShoppingList}
                    disabled={isGeneratingShopping}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingShopping ? 'animate-spin' : ''}`} />
                    <span>{isGeneratingShopping ? 'Extrayendo ingredientes...' : 'Autogenerar desde el Plan Semanal'}</span>
                  </button>
                  <button
                    onClick={() => setIsAddCustomItemOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold rounded-xl transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Agregar producto manual</span>
                  </button>
                </div>
              </div>
            ) : (
              (() => {
                const filteredList =
                  shoppingFilter === 'pending'
                    ? shoppingList.filter((i) => !i.is_purchased)
                    : shoppingFilter === 'in_cart'
                    ? shoppingList.filter((i) => i.is_purchased)
                    : shoppingList;

                if (filteredList.length === 0) {
                  return (
                    <div className="text-center py-6 text-zinc-400 text-xs italic">
                      {shoppingFilter === 'pending'
                        ? '¡No tienes artículos pendientes! Todo está en el carrito.'
                        : 'Aún no has marcado ningún producto en el carrito.'}
                    </div>
                  );
                }

                const aisles = Array.from(new Set(filteredList.map((i) => i.category || 'Otros')));

                return (
                  <div className="space-y-4 pt-1">
                    {aisles.map((aisle) => {
                      const aisleItems = filteredList.filter(
                        (i) => (i.category || 'Otros') === aisle
                      );
                      const inCartCount = aisleItems.filter((i) => i.is_purchased).length;

                      return (
                        <div key={aisle} className="space-y-2">
                          <div className="flex items-center justify-between px-1">
                            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              <span>{aisle}</span>
                            </span>
                            <span className="text-[10px] text-zinc-400 font-medium">
                              {inCartCount}/{aisleItems.length} en carrito
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            {aisleItems.map((item) => (
                              <div
                                key={item.id}
                                className={`p-3 rounded-2xl border transition flex items-center justify-between text-xs select-none ${
                                  item.is_purchased
                                    ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40 text-zinc-400'
                                    : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white font-medium hover:border-emerald-400'
                                }`}
                              >
                                {/* Checkbox interactivo + Nombre */}
                                <div
                                  onClick={() => handleToggleShopping(item.id, item.is_purchased)}
                                  className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                                >
                                  <button
                                    type="button"
                                    className="shrink-0 transition-transform active:scale-90"
                                  >
                                    {item.is_purchased ? (
                                      <CheckSquare className="w-5 h-5 text-emerald-500 shrink-0" />
                                    ) : (
                                      <Square className="w-5 h-5 text-zinc-300 dark:text-zinc-600 hover:text-emerald-500 shrink-0" />
                                    )}
                                  </button>

                                  <span
                                    className={`truncate text-xs ${
                                      item.is_purchased
                                        ? 'line-through text-zinc-400 dark:text-zinc-500'
                                        : 'font-semibold text-zinc-900 dark:text-zinc-100'
                                    }`}
                                  >
                                    {item.item_name}
                                  </span>
                                </div>

                                {/* Cantidad + Eliminar */}
                                <div className="flex items-center gap-2 shrink-0 ml-2">
                                  <span
                                    className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                                      item.is_purchased
                                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                                        : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900'
                                    }`}
                                  >
                                    {item.quantity_text}
                                  </span>

                                  <button
                                    onClick={() => handleDeleteShoppingItem(item.id)}
                                    className="p-1 text-zinc-300 hover:text-red-500 transition"
                                    title="Eliminar de la lista"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            )}
          </div>
        </div>
      )}

      {/* MODAL AGREGAR PRODUCTO RÁPIDO AL SÚPER */}
      {isAddCustomItemOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleAddCustomItem}
            className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between pb-1">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                <PlusCircle className="w-4 h-4 text-emerald-600" />
                <span>Agregar Producto al Súper</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddCustomItemOpen(false)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 block mb-1">
                Nombre del producto
              </label>
              <input
                type="text"
                required
                autoFocus
                placeholder="ej. Aceite de oliva, Aguacates, Sal"
                value={customItemName}
                onChange={(e) => setCustomItemName(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-zinc-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-zinc-500 block mb-1">Cantidad / Unidad</label>
                <input
                  type="text"
                  placeholder="ej. 500 ml, 4 piezas"
                  value={customItemQty}
                  onChange={(e) => setCustomItemQty(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-zinc-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-zinc-500 block mb-1">Pasillo / Categoría</label>
                <select
                  value={customItemCategory}
                  onChange={(e) => setCustomItemCategory(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-zinc-900 dark:text-white"
                >
                  <option value="Carnicería y Proteínas">Carnicería y Proteínas</option>
                  <option value="Frutas y Verduras">Frutas y Verduras</option>
                  <option value="Lácteos y Refrigerados">Lácteos y Refrigerados</option>
                  <option value="Abarrotes y Granos">Abarrotes y Granos</option>
                  <option value="Condimentos y Aceites">Condimentos y Aceites</option>
                  <option value="Limpieza y Hogar">Limpieza y Hogar</option>
                  <option value="Otros">Otros</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddCustomItemOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-600 dark:text-zinc-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold shadow-md shadow-emerald-600/20"
              >
                Agregar al Súper
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL DUPLICAR DÍA (Patrón Meal Prep / Replicar plan) */}
      {isDuplicateOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-2xl">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                  <Copy className="w-4 h-4 text-emerald-500" />
                  <span>Meal Prep: Duplicar {getDayOfWeekName(selectedDay)}</span>
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Copia el desayuno, comida, cena y snacks de este día:
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDuplicateOpen(false)}
                className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Selección de comidas a duplicar */}
            {(() => {
              const currentDayPlans = plans.filter((p) => p.day_of_week === selectedDay);

              if (currentDayPlans.length === 0) {
                return (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl mb-4">
                    <div className="flex items-start gap-2">
                      <span className="text-base leading-none">⚠️</span>
                      <div className="text-xs">
                        <span className="font-bold text-amber-800 dark:text-amber-200 block">
                          Sin comidas planeadas
                        </span>
                        <p className="text-zinc-600 dark:text-zinc-300 text-[11px] mt-0.5">
                          El {getDayOfWeekName(selectedDay)} aún no tiene alimentos asignados. Agrega platillos a este día antes de duplicarlo para tu Meal Prep.
                        </p>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div className="mb-4 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-500 font-semibold">Platillos a copiar:</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedItemIdsToDuplicate(currentDayPlans.map((p) => p.id));
                          setDuplicateError(null);
                        }}
                        className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold hover:underline cursor-pointer"
                      >
                        Todos ({currentDayPlans.length})
                      </button>
                      <span className="text-zinc-300 dark:text-zinc-700">•</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedItemIdsToDuplicate([]);
                          setDuplicateError(null);
                        }}
                        className="text-[10px] text-zinc-400 hover:underline cursor-pointer"
                      >
                        Ninguno
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
                    {currentDayPlans.map((p) => {
                      const isChecked = selectedItemIdsToDuplicate.includes(p.id);
                      const mealLabel =
                        p.meal_type === 'breakfast'
                          ? 'Desayuno'
                          : p.meal_type === 'lunch'
                          ? 'Comida'
                          : p.meal_type === 'dinner'
                          ? 'Cena'
                          : 'Snack';

                      const baseName = p.custom_name.replace(/\s*\(.*$/, '').trim().toLowerCase();
                      const otherDays = [
                        ...new Set(
                          plans
                            .filter(
                              (other) =>
                                other.day_of_week !== selectedDay &&
                                other.custom_name.replace(/\s*\(.*$/, '').trim().toLowerCase().includes(baseName)
                            )
                            .map((other) => other.day_of_week)
                        ),
                      ];

                      return (
                        <div
                          key={p.id}
                          onClick={() => {
                            setSelectedItemIdsToDuplicate((prev) =>
                              prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                            );
                            setDuplicateError(null);
                          }}
                          className={`flex items-center justify-between p-2.5 rounded-2xl border text-xs cursor-pointer transition select-none ${
                            isChecked
                              ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-600 shadow-2xs'
                              : 'bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200/70 dark:border-zinc-700/60 opacity-60 hover:opacity-90'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-1">
                            <div
                              className={`w-4 h-4 rounded-md border flex items-center justify-center transition shrink-0 ${
                                isChecked
                                  ? 'bg-emerald-600 border-emerald-600 text-white'
                                  : 'border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900'
                              }`}
                            >
                              {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                            <div className="truncate">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-zinc-900 dark:text-white truncate">
                                  {p.custom_name}
                                </span>
                                {otherDays.length > 0 ? (
                                  <span className="text-[9px] bg-zinc-200/80 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 px-1.5 py-0.2 rounded-full font-medium shrink-0">
                                    Ya en {otherDays.length} {otherDays.length === 1 ? 'día' : 'días'}
                                  </span>
                                ) : (
                                  <span className="text-[9px] bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 rounded-full font-bold shrink-0">
                                    ✨ Nuevo (sin repetir)
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-zinc-400">
                                {mealLabel} • {p.calories} kcal • P {p.protein_g}g
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Mensajes de error o éxito */}
            {duplicateError && (
              <div className="p-2.5 mb-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-xl text-red-700 dark:text-red-300 text-xs">
                {duplicateError}
              </div>
            )}
            {duplicateSuccess && (
              <div className="p-2.5 mb-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{duplicateSuccess}</span>
              </div>
            )}

            {/* Botones de selección rápida */}
            <div className="flex items-center gap-1.5 mb-2.5">
              <span className="text-[11px] text-zinc-400 font-medium">Días destino:</span>
              <div className="flex items-center gap-1 ml-auto">
                <button
                  type="button"
                  onClick={() => setTargetDays([1, 2, 3, 4, 5].filter((d) => d !== selectedDay))}
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition cursor-pointer"
                >
                  Lunes-Viernes
                </button>
                <button
                  type="button"
                  onClick={() => setTargetDays([1, 2, 3, 4, 5, 6, 7].filter((d) => d !== selectedDay))}
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition cursor-pointer"
                >
                  Toda la sem.
                </button>
                <button
                  type="button"
                  onClick={() => setTargetDays([])}
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition cursor-pointer"
                >
                  Limpiar
                </button>
              </div>
            </div>

            {/* Lista dinámica de todos los días de la semana excepto el día fuente actual */}
            <div className="space-y-1.5 mb-5 max-h-56 overflow-y-auto pr-0.5">
              {[
                { day: 1, label: 'Lunes' },
                { day: 2, label: 'Martes' },
                { day: 3, label: 'Miércoles' },
                { day: 4, label: 'Jueves' },
                { day: 5, label: 'Viernes' },
                { day: 6, label: 'Sábado' },
                { day: 7, label: 'Domingo' },
              ]
                .filter((item) => item.day !== selectedDay)
                .map(({ day, label }) => {
                  const checked = targetDays.includes(day);
                  const isWeekend = day >= 6;

                  // Ver si el día destino ya tiene los platillos seleccionados
                  const currentDayPlans = plans.filter((p) => p.day_of_week === selectedDay);
                  const selectedDishes = currentDayPlans.filter((p) =>
                    selectedItemIdsToDuplicate.includes(p.id)
                  );
                  const targetDayPlans = plans.filter((p) => p.day_of_week === day);
                  const alreadyHasDishes =
                    selectedDishes.length > 0 &&
                    selectedDishes.every((sd) => {
                      const baseName = sd.custom_name.replace(/\s*\(.*$/, '').trim().toLowerCase();
                      return targetDayPlans.some((tp) =>
                        tp.custom_name.toLowerCase().includes(baseName)
                      );
                    });

                  return (
                    <div
                      key={day}
                      onClick={() => {
                        setTargetDays((prev) =>
                          prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
                        );
                        setDuplicateError(null);
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-2xl border transition cursor-pointer text-xs select-none ${
                        checked
                          ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
                          : 'bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200/80 dark:border-zinc-700/60 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-4 h-4 rounded-md border flex items-center justify-center transition shrink-0 ${
                            checked
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900'
                          }`}
                        >
                          {checked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span className="text-zinc-900 dark:text-white font-medium">{label}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {alreadyHasDishes && (
                          <span className="text-[9px] bg-zinc-200/80 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 rounded font-medium">
                            Ya planeado aquí
                          </span>
                        )}
                        {isWeekend && (
                          <span className="text-[9px] bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-medium">
                            Fin de semana
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Botones de acción */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsDuplicateOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={
                  duplicateLoading ||
                  targetDays.length === 0 ||
                  plans.filter((p) => p.day_of_week === selectedDay && selectedItemIdsToDuplicate.includes(p.id)).length === 0
                }
                onClick={handleDuplicateToWeekdays}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {duplicateLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Replicando...</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>
                      {(() => {
                        const count = plans.filter(
                          (p) => p.day_of_week === selectedDay && selectedItemIdsToDuplicate.includes(p.id)
                        ).length;
                        return `Repetir ${count} ${count === 1 ? 'platillo' : 'platillos'}`;
                      })()}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INTELIGENTE DE SELECCIÓN DE PLATILLOS Y ALIMENTOS AL PLAN */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden">
            {/* Header del Modal */}
            <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-zinc-50/70 dark:bg-zinc-800/40">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 px-2.5 py-0.5 rounded-full">
                    {MEAL_LABELS[addMealType]}
                  </span>
                  <span className="text-xs text-zinc-400 font-medium">
                    {getDayOfWeekName(selectedDay)}
                  </span>
                </div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white mt-1">
                  Planear {MEAL_LABELS[addMealType]}
                </h3>
                <p className="text-xs text-zinc-400">
                  Elige un platillo de tu recetario para usar macros reales y nutrición exacta.
                </p>
              </div>
              <button
                onClick={() => setIsAddOpen(false)}
                className="w-8 h-8 rounded-full bg-zinc-200/60 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Pestañas de Selección */}
            <div className="flex border-b border-zinc-200 dark:border-zinc-800 px-4 pt-2 gap-1.5 shrink-0 bg-white dark:bg-zinc-900 text-xs font-semibold">
              <button
                onClick={() => setPlannerModalTab('dishes')}
                className={`flex items-center gap-1.5 pb-2.5 px-3 border-b-2 transition ${
                  plannerModalTab === 'dishes'
                    ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                }`}
              >
                <ChefHat className="w-3.5 h-3.5" />
                <span>Mis Platillos ({combinedDishes.length})</span>
              </button>
              <button
                onClick={() => {
                  setPlannerModalTab('foods');
                  if (foodSearchResults.length === 0) {
                    handleSearchFoodsInPlanner('');
                  }
                }}
                className={`flex items-center gap-1.5 pb-2.5 px-3 border-b-2 transition ${
                  plannerModalTab === 'foods'
                    ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                }`}
              >
                <Apple className="w-3.5 h-3.5" />
                <span>Alimentos Sueltos</span>
              </button>
              <button
                onClick={() => setPlannerModalTab('manual')}
                className={`flex items-center gap-1.5 pb-2.5 px-3 border-b-2 transition ${
                  plannerModalTab === 'manual'
                    ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Entrada Rápida</span>
              </button>
            </div>

            {/* CUERPO DEL MODAL */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* PESTAÑA 1: PLATILLOS Y RECETAS */}
              {plannerModalTab === 'dishes' && (
                <div className="space-y-3">
                  {/* Buscador de platillos */}
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Buscar por nombre o ingrediente..."
                      value={dishSearch}
                      onChange={(e) => setDishSearch(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 text-xs bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-hidden focus:border-emerald-500"
                    />
                    {dishSearch && (
                      <button
                        onClick={() => setDishSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Filtros de Categoría */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-medium no-scrollbar">
                    <button
                      onClick={() => setDishCategoryFilter('suggested')}
                      className={`px-2.5 py-1 rounded-full shrink-0 transition ${
                        dishCategoryFilter === 'suggested'
                          ? 'bg-emerald-600 text-white font-bold'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200'
                      }`}
                    >
                      ⭐ Sugeridos para {MEAL_LABELS[addMealType]}
                    </button>
                    <button
                      onClick={() => setDishCategoryFilter('all')}
                      className={`px-2.5 py-1 rounded-full shrink-0 transition ${
                        dishCategoryFilter === 'all'
                          ? 'bg-emerald-600 text-white font-bold'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200'
                      }`}
                    >
                      Todos ({combinedDishes.length})
                    </button>
                    <button
                      onClick={() => setDishCategoryFilter('breakfast')}
                      className={`px-2.5 py-1 rounded-full shrink-0 transition ${
                        dishCategoryFilter === 'breakfast'
                          ? 'bg-emerald-600 text-white font-bold'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200'
                      }`}
                    >
                      🍳 Desayunos
                    </button>
                    <button
                      onClick={() => setDishCategoryFilter('lunch')}
                      className={`px-2.5 py-1 rounded-full shrink-0 transition ${
                        dishCategoryFilter === 'lunch'
                          ? 'bg-emerald-600 text-white font-bold'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200'
                      }`}
                    >
                      🥗 Comidas
                    </button>
                    <button
                      onClick={() => setDishCategoryFilter('dinner')}
                      className={`px-2.5 py-1 rounded-full shrink-0 transition ${
                        dishCategoryFilter === 'dinner'
                          ? 'bg-emerald-600 text-white font-bold'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200'
                      }`}
                    >
                      🍲 Cenas
                    </button>
                    <button
                      onClick={() => setDishCategoryFilter('snack')}
                      className={`px-2.5 py-1 rounded-full shrink-0 transition ${
                        dishCategoryFilter === 'snack'
                          ? 'bg-emerald-600 text-white font-bold'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200'
                      }`}
                    >
                      🥑 Snacks
                    </button>
                  </div>

                  {/* Lista de platillos */}
                  {filteredDishes.length === 0 ? (
                    <div className="text-center py-8 px-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-700">
                      <ChefHat className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        No hay platillos en esta categoría
                      </p>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Prueba seleccionando &quot;Todos&quot; o busca por otro término.
                      </p>
                      <button
                        onClick={() => {
                          setDishCategoryFilter('all');
                          setDishSearch('');
                        }}
                        className="mt-3 text-xs font-bold text-emerald-600 hover:underline inline-flex items-center gap-1"
                      >
                        <span>Ver todos los platillos ({combinedDishes.length})</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {filteredDishes.map((dish) => {
                        const currentServings = getPortionsForDish(dish.id);
                        const scaledCalories = Math.round(dish.calories_per_serving * currentServings);
                        const scaledProtein = Number((dish.protein_per_serving * currentServings).toFixed(1));
                        const scaledCarbs = Number((dish.carbs_per_serving * currentServings).toFixed(1));
                        const scaledFat = Number((dish.fat_per_serving * currentServings).toFixed(1));
                        const scaledFiber = dish.fiber_per_serving
                          ? Number((dish.fiber_per_serving * currentServings).toFixed(1))
                          : 0;

                        return (
                          <div
                            key={dish.id}
                            className="bg-white dark:bg-zinc-800/70 p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-700/80 shadow-xs hover:border-emerald-500/50 transition flex flex-col gap-2.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-bold text-zinc-900 dark:text-white">
                                    {dish.name}
                                  </span>
                                  {dish.is_starter_template ? (
                                    <span className="text-[9px] bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-300 px-1.5 py-0.5 rounded font-medium">
                                      Biblioteca
                                    </span>
                                  ) : (
                                    <span className="text-[9px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded font-medium">
                                      Mi Hogar
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                                  <span>Porción base: {dish.serving_name || '1 porción'}</span>
                                  {dish.prep_time_minutes ? (
                                    <span>• ⏱️ {dish.prep_time_minutes} min</span>
                                  ) : null}
                                </div>
                              </div>
                            </div>

                            {/* Desglose de Macros Reales y Factuales */}
                            <div className="flex items-center gap-2 flex-wrap text-[11px] bg-zinc-50 dark:bg-zinc-900/60 p-2 rounded-xl">
                              <span className="font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                                <Flame className="w-3.5 h-3.5" />
                                {scaledCalories} kcal
                              </span>
                              <span className="text-zinc-500 dark:text-zinc-400">
                                🥩 P: <strong className="text-zinc-800 dark:text-zinc-200">{scaledProtein}g</strong>
                              </span>
                              <span className="text-zinc-500 dark:text-zinc-400">
                                🍞 C: <strong className="text-zinc-800 dark:text-zinc-200">{scaledCarbs}g</strong>
                              </span>
                              <span className="text-zinc-500 dark:text-zinc-400">
                                🥑 G: <strong className="text-zinc-800 dark:text-zinc-200">{scaledFat}g</strong>
                              </span>
                              {scaledFiber > 0 && (
                                <span className="text-zinc-500 dark:text-zinc-400">
                                  🥦 Fibra: <strong className="text-zinc-800 dark:text-zinc-200">{scaledFiber}g</strong>
                                </span>
                              )}
                            </div>

                            {/* Selector de Porciones y Botón de Añadir */}
                            <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-700/50">
                              <div className="flex items-center gap-1">
                                <span className="text-[11px] text-zinc-400 font-medium mr-1">Porciones:</span>
                                {[0.5, 1, 1.5, 2].map((pVal) => (
                                  <button
                                    key={pVal}
                                    type="button"
                                    onClick={() => setPortionsForDish(dish.id, pVal)}
                                    className={`px-2 py-1 text-[10px] font-bold rounded-lg transition ${
                                      currentServings === pVal
                                        ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                                        : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200'
                                    }`}
                                  >
                                    {pVal}x
                                  </button>
                                ))}
                              </div>

                              <button
                                type="button"
                                onClick={() => handleAddDishToPlan(dish)}
                                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1 shadow-sm shadow-emerald-600/20"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Agregar</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* PESTAÑA 2: CATÁLOGO DE ALIMENTOS INDIVIDUALES */}
              {plannerModalTab === 'foods' && (
                <div className="space-y-3">
                  {/* Buscador de alimentos sueltos */}
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Buscar alimento suelto (ej. Manzana, Plátano, Huevo, Avena)..."
                      value={foodSearchQuery}
                      onChange={(e) => handleSearchFoodsInPlanner(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 text-xs bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-hidden focus:border-emerald-500"
                    />
                    {foodSearchQuery && (
                      <button
                        type="button"
                        onClick={() => handleSearchFoodsInPlanner('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Chips rápidos de sugerencias y básicos */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-medium no-scrollbar">
                    <button
                      type="button"
                      onClick={() => handleSearchFoodsInPlanner('')}
                      className={`px-2.5 py-1 rounded-full shrink-0 transition ${
                        !foodSearchQuery
                          ? 'bg-emerald-600 text-white font-bold'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200'
                      }`}
                    >
                      ⭐ Populares
                    </button>
                    {[
                      { label: '🍎 Manzana', q: 'manzana' },
                      { label: '🍌 Plátano', q: 'plátano' },
                      { label: '🍓 Fresas', q: 'fresas' },
                      { label: '🥑 Aguacate', q: 'aguacate' },
                      { label: '🥚 Huevo', q: 'huevo' },
                      { label: '🍗 Pollo', q: 'pechuga de pollo' },
                      { label: '🥣 Avena', q: 'avena' },
                      { label: '🍚 Arroz', q: 'arroz' },
                      { label: '🐟 Atún', q: 'atún' },
                      { label: '🥛 Yogurt', q: 'yogurt' },
                    ].map((chip) => (
                      <button
                        key={chip.q}
                        type="button"
                        onClick={() => handleSearchFoodsInPlanner(chip.q)}
                        className={`px-2.5 py-1 rounded-full shrink-0 transition ${
                          foodSearchQuery.toLowerCase() === chip.q
                            ? 'bg-emerald-600 text-white font-bold'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200'
                        }`}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>

                  {selectedFoodItem ? (
                    <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-zinc-900 dark:text-white block">
                              {selectedFoodItem.name}
                            </span>
                            <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded font-semibold">
                              {selectedFoodItem.brand || 'Alimento Natural'}
                            </span>
                          </div>
                          <span className="text-[10px] text-zinc-400 mt-0.5 block">
                            Base: {selectedFoodItem.serving_size_g}g ({selectedFoodItem.calories} kcal)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedFoodItem(null)}
                          className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 font-semibold"
                        >
                          Cambiar
                        </button>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
                          Cantidad a planear (gramos):
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="1"
                            max="2000"
                            value={foodGrams}
                            onChange={(e) => setFoodGrams(Number(e.target.value))}
                            className="w-24 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl p-2 text-xs font-bold text-zinc-900 dark:text-white"
                          />
                          <div className="flex gap-1">
                            {[50, 100, 150, 200].map((g) => (
                              <button
                                key={g}
                                type="button"
                                onClick={() => setFoodGrams(g)}
                                className={`px-2 py-1 text-[10px] font-bold rounded-lg transition ${
                                  foodGrams === g
                                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                                    : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                                }`}
                              >
                                {g}g
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Macros calculados para este alimento */}
                      {(() => {
                        const factor = foodGrams / (selectedFoodItem.serving_size_g || 100);
                        const cals = Math.round(selectedFoodItem.calories * factor);
                        const prot = Number((selectedFoodItem.protein_g * factor).toFixed(1));
                        const carbs = Number((selectedFoodItem.carbs_g * factor).toFixed(1));
                        const fat = Number((selectedFoodItem.fat_g * factor).toFixed(1));

                        return (
                          <div className="flex items-center justify-between pt-2 border-t border-emerald-200/60 dark:border-emerald-800/40">
                            <div className="text-xs text-zinc-600 dark:text-zinc-300 font-semibold">
                              <span className="text-emerald-600 dark:text-emerald-400 font-black mr-2">
                                {cals} kcal
                              </span>
                              <span>P: {prot}g • C: {carbs}g • G: {fat}g</span>
                            </div>
                            <button
                              type="button"
                              onClick={handleAddFoodToPlan}
                              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-sm"
                            >
                              Agregar al Plan
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-60 overflow-y-auto pr-0.5">
                      {searchingFoods ? (
                        <p className="text-xs text-zinc-400 py-4 text-center">Buscando en catálogo...</p>
                      ) : foodSearchResults.length > 0 ? (
                        foodSearchResults.map((food) => {
                          const isNatural = food.is_verified || food.source === 'manual';
                          return (
                            <button
                              key={food.id}
                              type="button"
                              onClick={() => {
                                setSelectedFoodItem(food);
                                setFoodGrams(food.serving_size_g || 100);
                              }}
                              className="w-full text-left p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/70 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/60 hover:border-emerald-500/50 transition flex items-center justify-between text-xs group"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-zinc-900 dark:text-white">
                                    {food.name}
                                  </span>
                                  {isNatural ? (
                                    <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded font-semibold">
                                      {food.brand || 'Alimento Natural'}
                                    </span>
                                  ) : (
                                    <span className="text-[9px] bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 px-1.5 py-0.5 rounded">
                                      {food.brand || 'Envasado'}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                                    {food.calories} kcal
                                  </span>
                                  <span>•</span>
                                  <span>P: <strong className="text-zinc-700 dark:text-zinc-300">{food.protein_g}g</strong></span>
                                  <span>C: <strong className="text-zinc-700 dark:text-zinc-300">{food.carbs_g}g</strong></span>
                                  <span>G: <strong className="text-zinc-700 dark:text-zinc-300">{food.fat_g}g</strong></span>
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-emerald-500 transition shrink-0 ml-2" />
                            </button>
                          );
                        })
                      ) : (
                        <div className="text-center py-6 text-zinc-400 text-xs">
                          No se encontraron alimentos para &quot;{foodSearchQuery}&quot;.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* PESTAÑA 3: ENTRADA RÁPIDA MANUAL */}
              {plannerModalTab === 'manual' && (
                <form onSubmit={handleAddMeal} className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
                      Nombre del platillo o alimento
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="ej. Pechuga asada con verduras"
                      value={mealName}
                      onChange={(e) => setMealName(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2 text-xs text-zinc-900 dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-zinc-500 block mb-0.5">Calorías (kcal)</label>
                      <input
                        type="number"
                        value={mealCalories}
                        onChange={(e) => setMealCalories(Number(e.target.value))}
                        className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-1.5 text-zinc-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-zinc-500 block mb-0.5">Proteína (g)</label>
                      <input
                        type="number"
                        value={mealProtein}
                        onChange={(e) => setMealProtein(Number(e.target.value))}
                        className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-1.5 text-zinc-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-zinc-500 block mb-0.5">Carbohidratos (g)</label>
                      <input
                        type="number"
                        value={mealCarbs}
                        onChange={(e) => setMealCarbs(Number(e.target.value))}
                        className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-1.5 text-zinc-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-zinc-500 block mb-0.5">Grasas (g)</label>
                      <input
                        type="number"
                        value={mealFat}
                        onChange={(e) => setMealFat(Number(e.target.value))}
                        className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-1.5 text-zinc-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAddOpen(false)}
                      className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-500"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold shadow-md shadow-emerald-600/20"
                    >
                      Guardar en Plan
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL VER DETALLE DE RECETA Y ESCALADO DIRECTO DESDE EL PLAN */}
      {selectedPlanDishForModal && (
        <RecipeDetailModal
          dish={selectedPlanDishForModal}
          onClose={() => setSelectedPlanDishForModal(null)}
          onLogToday={async (dish, count) => {
            try {
              const todayStr = getLocalDateString();
              await fetch('/api/food-logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  date: todayStr,
                  meal_type: dish.category === 'general' ? 'lunch' : (dish.category as MealType),
                  food_name: `${dish.name} (${count} ${dish.serving_name || 'porción'})`,
                  calories: Math.round(dish.calories_per_serving * count),
                  protein_g: Number((dish.protein_per_serving * count).toFixed(1)),
                  carbs_g: Number((dish.carbs_per_serving * count).toFixed(1)),
                  fat_g: Number((dish.fat_per_serving * count).toFixed(1)),
                  fiber_g: Number(((dish.fiber_per_serving || 0) * count).toFixed(1)),
                  servings: count,
                }),
              });
              setSelectedPlanDishForModal(null);
            } catch {
              // Ignorar
            }
          }}
          onCloneTemplate={async (dish, customServings) => {
            try {
              await fetch('/api/dishes/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ templateId: dish.id, servings: customServings || 1 }),
              });
              await fetchDishes();
            } catch {
              // Ignorar
            }
          }}
        />
      )}
    </div>
  );
}
