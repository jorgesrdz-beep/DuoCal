'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  ChefHat,
  Plus,
  Trash2,
  Calendar,
  Users,
  Sparkles,
  Scale,
  X,
  Clock,
  Check,
  ArrowRight,
  Eye,
  BookOpen,
  Copy,
  FileText,
  Flame,
  Barcode,
  Loader2,
  Pencil,
  Search,
  Package,
  Camera,
} from 'lucide-react';
import { Dish, Food, MealType, FrequencyType } from '@/types/database';
import NutritionFactLabel from '@/components/nutrition/NutritionFactLabel';
import RecipeDetailModal from '@/components/dishes/RecipeDetailModal';
import RecipeImportModal from '@/components/dishes/RecipeImportModal';
import BarcodeScannerModal from '@/components/scanner/BarcodeScannerModal';
import { STARTER_RECIPES } from '@/lib/data/starterRecipes';
import { getWeekStartDate, getNextWeekStartDate, getSmartMealPrepWeekStartDate, formatWeekDateRange, getLocalDateString } from '@/lib/utils';
export function estimatePieceWeight(name: string): number {
  const n = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (n.includes('tomate') || n.includes('jitomate')) return 120; // 1 jitomate huaje/saladette mediano ≈ 120g
  if (n.includes('zanahoria')) return 70; // 1 zanahoria mediana ≈ 70g
  if (n.includes('calabacita') || n.includes('calabacin')) return 100; // 1 calabacita mediana ≈ 100g
  if (n.includes('nopal')) return 100; // 1 penca mediana ≈ 100g
  if (n.includes('huevo')) return 50; // 1 huevo mediano ≈ 50g
  if (n.includes('cebolla')) return 150; // 1 cebolla mediana ≈ 150g
  if (n.includes('ajo')) return 5; // 1 diente de ajo ≈ 5g
  if (n.includes('papa') || n.includes('patata')) return 150; // 1 papa mediana ≈ 150g
  if (n.includes('aguacate') || n.includes('palta')) return 150; // 1 aguacate mediano ≈ 150g
  if (n.includes('limon')) return 40; // 1 limón mediano ≈ 40g
  if (n.includes('platano') || n.includes('banana')) return 120; // 1 plátano mediano ≈ 120g
  if (n.includes('manzana')) return 180; // 1 manzana mediana ≈ 180g
  if (n.includes('naranja')) return 180; // 1 naranja mediana ≈ 180g
  if (n.includes('tortilla')) return 30; // 1 tortilla de maíz ≈ 30g
  if (n.includes('chipotle') && (n.includes('lata') || n.includes('costena'))) return 130;
  return 100; // Estándar
}

export function calculateGramsFromUnit(quantity: number, unit: 'g' | 'kg' | 'pza', pieceWeight = 100): number {
  if (unit === 'kg') return Math.round(quantity * 1000);
  if (unit === 'pza') return Math.round(quantity * pieceWeight);
  return Math.round(quantity);
}

export default function DishManager() {
  const { user, partner } = useAuth();
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);

  // Pestañas principales: 'my-dishes', 'pantry' o 'library'
  const [activeTab, setActiveTab] = useState<'my-dishes' | 'pantry' | 'library'>('my-dishes');
  const [weeklyPlans, setWeeklyPlans] = useState<any[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);

  // Despensa de Ingredientes Personalizados
  const [customFoods, setCustomFoods] = useState<Food[]>([]);
  const [loadingCustomFoods, setLoadingCustomFoods] = useState(false);
  const [pantrySearchQuery, setPantrySearchQuery] = useState('');
  const [isPantryFoodModalOpen, setIsPantryFoodModalOpen] = useState(false);

  // Formulario de Ingrediente en Despensa
  const [pantryName, setPantryName] = useState('');
  const [pantryBrand, setPantryBrand] = useState('');
  const [pantryServingSize, setPantryServingSize] = useState<number>(100);
  const [pantryServingUnit, setPantryServingUnit] = useState<string>('g');
  const [pantryCalories, setPantryCalories] = useState<number | ''>('');
  const [pantryProtein, setPantryProtein] = useState<number | ''>('');
  const [pantryCarbs, setPantryCarbs] = useState<number | ''>('');
  const [pantryFat, setPantryFat] = useState<number | ''>('');
  const [pantryFiber, setPantryFiber] = useState<number | ''>('');
  const [pantryBarcode, setPantryBarcode] = useState<string | null>(null);
  const [barcodeScannerTarget, setBarcodeScannerTarget] = useState<'pantry' | 'recipe'>('pantry');
  const [editingPantryFoodId, setEditingPantryFoodId] = useState<string | null>(null);
  const [pantryCategoryFilter, setPantryCategoryFilter] = useState<string>('all');
  const [savingPantryFood, setSavingPantryFood] = useState(false);
  const [pantryError, setPantryError] = useState<string | null>(null);

  // Modal Ver Receta con Escalador y Pasos
  const [selectedRecipeForModal, setSelectedRecipeForModal] = useState<Dish | null>(null);

  // Modal Crear / Editar Platillo
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingDishId, setEditingDishId] = useState<string | null>(null);
  const [dishName, setDishName] = useState('');
  const [dishDescription, setDishDescription] = useState('');
  const [dishCategory, setDishCategory] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack' | 'general'>('lunch');
  const [totalServings, setTotalServings] = useState(1);
  const [servingName, setServingName] = useState('porción (1 plato)');
  const [isShared, setIsShared] = useState(true);
  const [prepTime, setPrepTime] = useState<number>(10);
  const [cookTime, setCookTime] = useState<number>(15);
  const [instructionsText, setInstructionsText] = useState('');
  const [isSavingDish, setIsSavingDish] = useState(false);
  const [createDishError, setCreateDishError] = useState<string | null>(null);

  // Lista de ingredientes en creación
  const [ingredients, setIngredients] = useState<
    Array<{
      food_id: string | null;
      ingredient_name: string;
      amount_g: number;
      unit?: 'g' | 'kg' | 'pza';
      unit_quantity?: number;
      piece_weight_g?: number;
      base_100g?: {
        calories: number;
        protein_g: number;
        carbs_g: number;
        fat_g: number;
        fiber_g: number;
      };
      calories: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
      fiber_g: number;
      sodium_mg: number;
      aisle_category?: 'Carnicería y Proteínas' | 'Frutas y Verduras' | 'Abarrotes y Granos' | 'Lácteos y Refrigerados' | 'Condimentos y Aceites' | 'Otros';
    }>
  >([]);

  // Buscador de ingredientes
  const [searchFoodQuery, setSearchFoodQuery] = useState('');
  const [foodResults, setFoodResults] = useState<Food[]>([]);
  const [searchingFood, setSearchingFood] = useState(false);

  // Formulario para registrar ingrediente personalizado
  const [isAddingCustomFood, setIsAddingCustomFood] = useState(false);
  const [customFoodName, setCustomFoodName] = useState('');
  const [customFoodBrand, setCustomFoodBrand] = useState('');
  const [customFoodCals, setCustomFoodCals] = useState<number | ''>('');
  const [customFoodProt, setCustomFoodProt] = useState<number | ''>('');
  const [customFoodCarbs, setCustomFoodCarbs] = useState<number | ''>('');
  const [customFoodFat, setCustomFoodFat] = useState<number | ''>('');
  const [customFoodFiber, setCustomFoodFiber] = useState<number | ''>('');
  const [customFoodGramsForDish, setCustomFoodGramsForDish] = useState<number>(100);
  const [savingCustomFood, setSavingCustomFood] = useState(false);
  const [customFoodError, setCustomFoodError] = useState<string | null>(null);

  // Modal Hub de Importación de Recetas
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Modal Ver Tabla Nutrimental
  const [selectedDishForNutrition, setSelectedDishForNutrition] = useState<Dish | null>(null);

  // Modal Programar Frecuencia
  const [selectedDishForSchedule, setSelectedDishForSchedule] = useState<Dish | null>(null);
  const [scheduleTargetWeek, setScheduleTargetWeek] = useState(() => getSmartMealPrepWeekStartDate());
  const [scheduleBatchServings, setScheduleBatchServings] = useState<number>(6);
  const [scheduleAlsoForPartner, setScheduleAlsoForPartner] = useState(false);
  const [freqType, setFreqType] = useState<FrequencyType>('meal_prep_batch');
  const [scheduleMealType, setScheduleMealType] = useState<MealType>('lunch');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [scheduleMsg, setScheduleMsg] = useState<string | null>(null);
  const [isApplyingSchedule, setIsApplyingSchedule] = useState(false);
  const [scheduleSuccess, setScheduleSuccess] = useState(false);

  const handleOpenScheduleModal = (dish: Dish) => {
    setSelectedDishForSchedule(dish);
    setScheduleTargetWeek(getSmartMealPrepWeekStartDate());
    const half = Math.ceil((dish.total_servings || 2) / 2);
    setScheduleBatchServings(partner ? half : Math.min(6, dish.total_servings || 1));
    setScheduleAlsoForPartner(false);
    setFreqType('meal_prep_batch');
    setScheduleMsg(null);
    setScheduleSuccess(false);
  };

  const fetchDishes = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dishes');
      if (res.ok) {
        const data = await res.json();
        setDishes(data.dishes || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchWeeklyPlans = async () => {
    setLoadingPlans(true);
    try {
      const currentMonday = getWeekStartDate();
      const res = await fetch(`/api/meal-plans?week_start=${currentMonday}`);
      if (res.ok) {
        const data = await res.json();
        setWeeklyPlans(data.plans || []);
      }
    } catch {
      // Ignorar
    } finally {
      setLoadingPlans(false);
    }
  };

  const fetchCustomFoods = async () => {
    setLoadingCustomFoods(true);
    try {
      const res = await fetch('/api/foods');
      if (res.ok) {
        const data = await res.json();
        const allFoods = data.foods || [];
        const userFoods = allFoods.filter((f: Food) => f.user_id !== null || f.source === 'manual');
        setCustomFoods(userFoods.length > 0 ? userFoods : allFoods);
      }
    } catch {
      // Ignorar
    } finally {
      setLoadingCustomFoods(false);
    }
  };

  useEffect(() => {
    fetchDishes();
    fetchWeeklyPlans();
    fetchCustomFoods();
  }, []);

  // Helper para categorizar alimentos
  const getFoodCategoryKey = (f: Food): string => {
    const normalize = (str: string) =>
      (str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    const n = normalize(f.name);
    const b = normalize(f.brand || '');
    const rawCat = ((f as any).category || '').toLowerCase();

    // 1. Lácteos (Quesos, yogures, leches, requesón, cottage)
    if (
      n.includes('queso') ||
      b.includes('queso') ||
      n.includes('lacteo') ||
      b.includes('lacteo') ||
      n.includes('yogurt') ||
      b.includes('yogurt') ||
      n.includes('yoghurt') ||
      b.includes('yoghurt') ||
      n.includes('cottage') ||
      b.includes('cottage') ||
      n.includes('requeson') ||
      b.includes('requeson') ||
      n.includes('leche') ||
      b.includes('leche') ||
      rawCat === 'lacteos'
    ) {
      return 'lacteos';
    }

    // 2. Si tiene categoría explícita válida preasignada
    if (rawCat && ['proteinas', 'carbohidratos', 'verduras', 'frutas', 'lacteos', 'grasas'].includes(rawCat)) {
      return rawCat;
    }

    // 3. Reglas semánticas por palabras clave (sin acentos)
    if (b.includes('fruta') || n.includes('fruta') || n.includes('manzana') || n.includes('platano') || n.includes('fresa') || n.includes('uva') || n.includes('naranja') || n.includes('limon') || n.includes('mora') || n.includes('arandano') || n.includes('papaya') || n.includes('mango') || n.includes('pina')) return 'frutas';
    if (b.includes('verdura') || n.includes('verdura') || n.includes('lechuga') || n.includes('espinaca') || n.includes('brocoli') || n.includes('calabac') || n.includes('jitomate') || n.includes('tomate') || n.includes('pepino') || n.includes('zanahoria') || n.includes('cebolla') || n.includes('champi') || n.includes('pimiento') || n.includes('apio')) return 'verduras';
    if (n.includes('huevo') || n.includes('pollo') || n.includes('pavo') || n.includes('res') || n.includes('atun') || n.includes('salmon') || n.includes('pescado') || n.includes('carne') || n.includes('cerdo') || n.includes('camaron') || n.includes('tofu') || n.includes('jamon') || n.includes('proteina')) return 'proteinas';
    if (n.includes('arroz') || n.includes('avena') || n.includes('pan') || n.includes('tortilla') || n.includes('pasta') || n.includes('papa') || n.includes('camote') || n.includes('frijol') || n.includes('lenteja') || n.includes('cereal') || n.includes('galleta')) return 'carbohidratos';
    if (n.includes('aguacate') || n.includes('aceite') || n.includes('nuez') || n.includes('nueces') || n.includes('almendra') || n.includes('cacahuate') || n.includes('mantequilla') || n.includes('chia') || n.includes('semilla')) return 'grasas';

    return 'otros';
  };

  const handleEditPantryFood = (food: Food) => {
    setEditingPantryFoodId(food.id);
    setPantryName(food.name || '');
    setPantryBrand(food.brand || '');
    setPantryServingSize(food.serving_size_g || 100);
    setPantryServingUnit(food.serving_unit || 'g');
    setPantryCalories(food.calories);
    setPantryProtein(food.protein_g);
    setPantryCarbs(food.carbs_g);
    setPantryFat(food.fat_g);
    setPantryFiber(food.fiber_g !== undefined ? food.fiber_g : '');
    setPantryBarcode(food.barcode || null);
    setPantryError(null);
    setIsPantryFoodModalOpen(true);
  };

  const filteredPantryFoods = useMemo(() => {
    return customFoods.filter((f) => {
      // Filtro por categoría
      if (pantryCategoryFilter !== 'all') {
        if (pantryCategoryFilter === 'custom') {
          // Mis productos / marcas registradas
          const isCustom = f.user_id !== null || f.source === 'manual' || Boolean(f.barcode);
          if (!isCustom) return false;
        } else {
          const cat = getFoodCategoryKey(f);
          if (cat !== pantryCategoryFilter) return false;
        }
      }

      // Filtro por texto
      if (!pantrySearchQuery.trim()) return true;
      const q = pantrySearchQuery.toLowerCase().trim();
      return (
        f.name.toLowerCase().includes(q) ||
        (f.brand && f.brand.toLowerCase().includes(q)) ||
        (f.barcode && f.barcode === q)
      );
    });
  }, [customFoods, pantrySearchQuery, pantryCategoryFilter]);

  const handleSavePantryFood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pantryName.trim()) {
      setPantryError('El nombre del alimento es requerido.');
      return;
    }
    if (pantryCalories === '' || Number(pantryCalories) < 0) {
      setPantryError('Ingresa las calorías por porción.');
      return;
    }

    setSavingPantryFood(true);
    setPantryError(null);

    try {
      const method = editingPantryFoodId ? 'PUT' : 'POST';
      const body: any = {
        id: editingPantryFoodId || undefined,
        name: pantryName.trim(),
        brand: pantryBrand.trim() || null,
        serving_size_g: Number(pantryServingSize) || 100,
        serving_unit: pantryServingUnit || 'g',
        calories: Number(pantryCalories),
        protein_g: Number(pantryProtein) || 0,
        carbs_g: Number(pantryCarbs) || 0,
        fat_g: Number(pantryFat) || 0,
        fiber_g: Number(pantryFiber) || 0,
        barcode: pantryBarcode || null,
      };
      if (!editingPantryFoodId) {
        body.source = 'manual';
      }

      const res = await fetch('/api/foods', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        await fetchCustomFoods();
        setIsPantryFoodModalOpen(false);
        setEditingPantryFoodId(null);
        setPantryName('');
        setPantryBrand('');
        setPantryServingSize(100);
        setPantryServingUnit('g');
        setPantryCalories('');
        setPantryProtein('');
        setPantryCarbs('');
        setPantryFat('');
        setPantryFiber('');
        setPantryBarcode(null);
        setPantryError(null);
      } else {
        const err = await res.json().catch(() => ({}));
        setPantryError(err.error || 'No se pudo guardar el ingrediente');
      }
    } catch (err: any) {
      setPantryError(err.message || 'Error de conexión');
    } finally {
      setSavingPantryFood(false);
    }
  };

  const handleDeletePantryFood = async (id: string, name: string) => {
    if (!window.confirm(`¿Deseas eliminar "${name}" de tu despensa?`)) return;
    try {
      const res = await fetch(`/api/foods?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchCustomFoods();
      }
    } catch {
      // Ignorar
    }
  };

  const plannedMealsThisWeek = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        custom_name: string;
        planItem: any;
        days: number[];
        matchedDish: Dish | null;
        isSavedInMyDishes: boolean;
      }
    >();

    for (const plan of weeklyPlans) {
      const rawName = plan.custom_name?.trim() || '';
      const baseName = rawName.replace(/\s*\(.*$/, '').trim().toLowerCase();
      if (!baseName) continue;

      const myMatch = dishes.find(
        (d) =>
          (plan.food_id && d.id === plan.food_id) ||
          d.name.toLowerCase().trim() === baseName ||
          d.name.toLowerCase().includes(baseName) ||
          baseName.includes(d.name.toLowerCase().trim())
      );

      const starterMatch = STARTER_RECIPES.find(
        (s) =>
          (plan.food_id && s.id === plan.food_id) ||
          s.name.toLowerCase().trim() === baseName ||
          s.name.toLowerCase().includes(baseName) ||
          baseName.includes(s.name.toLowerCase().trim())
      );

      const matched = myMatch || starterMatch || null;

      if (!map.has(baseName)) {
        map.set(baseName, {
          key: baseName,
          custom_name: rawName.replace(/\s*\(.*$/, '').trim(),
          planItem: plan,
          days: [plan.day_of_week],
          matchedDish: matched,
          isSavedInMyDishes: !!myMatch,
        });
      } else {
        const entry = map.get(baseName)!;
        if (!entry.days.includes(plan.day_of_week)) {
          entry.days.push(plan.day_of_week);
        }
      }
    }

    return Array.from(map.values());
  }, [weeklyPlans, dishes]);

  const handleOpenPlannedMealModal = (entry: {
    key: string;
    custom_name: string;
    planItem: any;
    days: number[];
    matchedDish: Dish | null;
    isSavedInMyDishes: boolean;
  }) => {
    if (entry.matchedDish) {
      setSelectedRecipeForModal(entry.matchedDish);
    } else {
      const p = entry.planItem;
      const s = p.servings || 1;
      const cals = p.calories || 0;
      const prot = p.protein_g || 0;
      const carbs = p.carbs_g || 0;
      const fat = p.fat_g || 0;
      const fiber = p.fiber_g || 0;

      setSelectedRecipeForModal({
        id: p.food_id || p.id,
        user_id: '',
        household_id: null,
        name: entry.custom_name,
        description: null,
        category: (p.meal_type || 'general') as any,
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
            dish_id: p.food_id || p.id,
            food_id: null,
            ingredient_name: entry.custom_name,
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

  const foodSearchAbortRef = useRef<AbortController | null>(null);
  const foodSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearchFoods = (q: string) => {
    setSearchFoodQuery(q);

    if (foodSearchTimeoutRef.current) {
      clearTimeout(foodSearchTimeoutRef.current);
    }
    if (foodSearchAbortRef.current) {
      foodSearchAbortRef.current.abort();
      foodSearchAbortRef.current = null;
    }

    if (!q.trim()) {
      setFoodResults([]);
      setSearchingFood(false);
      return;
    }

    setSearchingFood(true);
    foodSearchTimeoutRef.current = setTimeout(async () => {
      const controller = new AbortController();
      foodSearchAbortRef.current = controller;

      try {
        const res = await fetch(`/api/foods/search?q=${encodeURIComponent(q.trim())}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setFoodResults(data.foods || []);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          // Ignorar cancelaciones
        }
      } finally {
        if (foodSearchAbortRef.current === controller) {
          setSearchingFood(false);
        }
      }
    }, 220);
  };

  const handleAddIngredientFromFood = (food: Food) => {
    const pieceWeight = estimatePieceWeight(food.name);
    const isPieceFriendly = /(tomate|jitomate|zanahoria|calabac|huevo|aguacate|limon|platano|manzana|naranja|cebolla|papa)/i.test(food.name);
    const initialUnit: 'g' | 'kg' | 'pza' = isPieceFriendly ? 'pza' : 'g';
    const initialQty = isPieceFriendly ? 1 : (food.serving_size_g || 100);
    const calculatedGrams = isPieceFriendly ? pieceWeight : initialQty;
    const ratio = calculatedGrams / (food.serving_size_g || 100);

    const b100 = {
      calories: Math.round((food.calories / (food.serving_size_g || 100)) * 100),
      protein_g: Number(((food.protein_g / (food.serving_size_g || 100)) * 100).toFixed(1)),
      carbs_g: Number(((food.carbs_g / (food.serving_size_g || 100)) * 100).toFixed(1)),
      fat_g: Number(((food.fat_g / (food.serving_size_g || 100)) * 100).toFixed(1)),
      fiber_g: Number((((food.fiber_g || 0) / (food.serving_size_g || 100)) * 100).toFixed(1)),
    };

    setIngredients((prev) => [
      ...prev,
      {
        food_id: food.id,
        ingredient_name: food.name,
        amount_g: calculatedGrams,
        unit: initialUnit,
        unit_quantity: initialQty,
        piece_weight_g: pieceWeight,
        base_100g: b100,
        calories: Math.round(food.calories * ratio),
        protein_g: Number((food.protein_g * ratio).toFixed(1)),
        carbs_g: Number((food.carbs_g * ratio).toFixed(1)),
        fat_g: Number((food.fat_g * ratio).toFixed(1)),
        fiber_g: Number((((food.fiber_g || 0) * ratio)).toFixed(1)),
        sodium_mg: 0,
      },
    ]);
    setSearchFoodQuery('');
    setFoodResults([]);
  };

  const handleSaveAndAddCustomFood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customFoodName.trim()) {
      setCustomFoodError('El nombre del ingrediente es obligatorio.');
      return;
    }
    if (customFoodCals === '' || Number(customFoodCals) < 0) {
      setCustomFoodError('Ingresa las calorías por cada 100g.');
      return;
    }

    setSavingCustomFood(true);
    setCustomFoodError(null);

    const cals100 = Number(customFoodCals) || 0;
    const prot100 = Number(customFoodProt) || 0;
    const carbs100 = Number(customFoodCarbs) || 0;
    const fat100 = Number(customFoodFat) || 0;
    const fiber100 = Number(customFoodFiber) || 0;
    const grams = Math.max(1, Number(customFoodGramsForDish) || 100);
    const ratio = grams / 100;

    try {
      // 1. Guardar en base de datos / catálogo de alimentos permanente
      const res = await fetch('/api/foods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customFoodName.trim(),
          brand: customFoodBrand.trim() || null,
          serving_size_g: 100,
          serving_unit: 'g',
          calories: cals100,
          protein_g: prot100,
          carbs_g: carbs100,
          fat_g: fat100,
          fiber_g: fiber100,
          source: 'manual',
        }),
      });

      let savedFoodId: string | null = null;
      if (res.ok) {
        const data = await res.json();
        if (data.food?.id) {
          savedFoodId = data.food.id;
        }
      }

      // 2. Agregar directamente a la lista de ingredientes de la receta
      const displayName = customFoodName.trim() + (customFoodBrand.trim() ? ` (${customFoodBrand.trim()})` : '');
      const pieceWeight = estimatePieceWeight(displayName);
      const b100 = {
        calories: cals100,
        protein_g: prot100,
        carbs_g: carbs100,
        fat_g: fat100,
        fiber_g: fiber100,
      };

      setIngredients((prev) => [
        ...prev,
        {
          food_id: savedFoodId,
          ingredient_name: displayName,
          amount_g: grams,
          unit: 'g',
          unit_quantity: grams,
          piece_weight_g: pieceWeight,
          base_100g: b100,
          calories: Math.round(cals100 * ratio),
          protein_g: Number((prot100 * ratio).toFixed(1)),
          carbs_g: Number((carbs100 * ratio).toFixed(1)),
          fat_g: Number((fat100 * ratio).toFixed(1)),
          fiber_g: Number((fiber100 * ratio).toFixed(1)),
          sodium_mg: 0,
        },
      ]);

      // 3. Limpiar y cerrar formulario
      setIsAddingCustomFood(false);
      setCustomFoodName('');
      setCustomFoodBrand('');
      setCustomFoodCals('');
      setCustomFoodProt('');
      setCustomFoodCarbs('');
      setCustomFoodFat('');
      setCustomFoodFiber('');
      setCustomFoodGramsForDish(100);
    } catch (err: any) {
      setCustomFoodError(err.message || 'Error al registrar el ingrediente');
    } finally {
      setSavingCustomFood(false);
    }
  };

  const handleUpdateIngredientQuantity = (index: number, newQty: number) => {
    setIngredients((prev) => {
      const copy = [...prev];
      const item = copy[index];
      const unit = item.unit || 'g';
      const pieceWeight = item.piece_weight_g || estimatePieceWeight(item.ingredient_name);
      const safeQty = Math.max(0.01, Number(newQty) || 0);
      const calculatedGrams = Math.max(1, calculateGramsFromUnit(safeQty, unit, pieceWeight));

      const b100 = item.base_100g || {
        calories: Math.round((item.calories / (item.amount_g || 1)) * 100),
        protein_g: Number(((item.protein_g / (item.amount_g || 1)) * 100).toFixed(1)),
        carbs_g: Number(((item.carbs_g / (item.amount_g || 1)) * 100).toFixed(1)),
        fat_g: Number(((item.fat_g / (item.amount_g || 1)) * 100).toFixed(1)),
        fiber_g: Number(((item.fiber_g / (item.amount_g || 1)) * 100).toFixed(1)),
      };

      const factor = calculatedGrams / 100;
      copy[index] = {
        ...item,
        unit_quantity: safeQty,
        amount_g: calculatedGrams,
        calories: Math.round(b100.calories * factor),
        protein_g: Number((b100.protein_g * factor).toFixed(1)),
        carbs_g: Number((b100.carbs_g * factor).toFixed(1)),
        fat_g: Number((b100.fat_g * factor).toFixed(1)),
        fiber_g: Number((b100.fiber_g * factor).toFixed(1)),
      };
      return copy;
    });
  };

  const handleUpdateIngredientUnit = (index: number, newUnit: 'g' | 'kg' | 'pza') => {
    setIngredients((prev) => {
      const copy = [...prev];
      const item = copy[index];
      const pieceWeight = item.piece_weight_g || estimatePieceWeight(item.ingredient_name);
      let newQty = item.unit_quantity !== undefined ? item.unit_quantity : item.amount_g;

      if (newUnit === 'kg') {
        newQty = Number((item.amount_g / 1000).toFixed(2));
      } else if (newUnit === 'pza') {
        newQty = Math.max(1, Math.round(item.amount_g / pieceWeight));
      } else {
        newQty = item.amount_g;
      }

      const calculatedGrams = Math.max(1, calculateGramsFromUnit(newQty, newUnit, pieceWeight));
      const b100 = item.base_100g || {
        calories: Math.round((item.calories / (item.amount_g || 1)) * 100),
        protein_g: Number(((item.protein_g / (item.amount_g || 1)) * 100).toFixed(1)),
        carbs_g: Number(((item.carbs_g / (item.amount_g || 1)) * 100).toFixed(1)),
        fat_g: Number(((item.fat_g / (item.amount_g || 1)) * 100).toFixed(1)),
        fiber_g: Number(((item.fiber_g / (item.amount_g || 1)) * 100).toFixed(1)),
      };
      const factor = calculatedGrams / 100;

      copy[index] = {
        ...item,
        unit: newUnit,
        unit_quantity: newQty,
        amount_g: calculatedGrams,
        calories: Math.round(b100.calories * factor),
        protein_g: Number((b100.protein_g * factor).toFixed(1)),
        carbs_g: Number((b100.carbs_g * factor).toFixed(1)),
        fat_g: Number((b100.fat_g * factor).toFixed(1)),
        fiber_g: Number((b100.fiber_g * factor).toFixed(1)),
      };
      return copy;
    });
  };

  const handleRemoveIngredient = (index: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  // Cálculo en vivo de la receta en creación
  const previewTotalCals = ingredients.reduce((sum, i) => sum + i.calories, 0);
  const previewTotalProt = ingredients.reduce((sum, i) => sum + i.protein_g, 0);
  const previewTotalCarbs = ingredients.reduce((sum, i) => sum + i.carbs_g, 0);
  const previewTotalFat = ingredients.reduce((sum, i) => sum + i.fat_g, 0);
  const previewTotalFiber = ingredients.reduce((sum, i) => sum + (i.fiber_g || 0), 0);
  const previewServings = Math.max(1, totalServings);
  const previewTotalWeightGrams = ingredients.reduce((sum, i) => sum + (i.amount_g || 0), 0);
  const previewServingWeightGrams = Math.round(previewTotalWeightGrams / previewServings);

  const handleOpenNewDish = () => {
    setEditingDishId(null);
    setDishName('');
    setDishDescription('');
    setDishCategory('lunch');
    setTotalServings(1);
    setServingName('porción (1 plato)');
    setIsShared(true);
    setPrepTime(10);
    setCookTime(15);
    setInstructionsText('');
    setIngredients([]);
    setCreateDishError(null);
    setIsCreateOpen(true);
  };

  const handleEditDish = (dish: Dish) => {
    setEditingDishId(dish.id);
    setDishName(dish.name);
    setDishDescription(dish.description || '');
    setDishCategory((dish.category as any) || 'lunch');
    setTotalServings(dish.total_servings || 1);
    setServingName(dish.serving_name || 'porción (1 plato)');
    setIsShared(dish.is_shared_with_partner ?? true);
    setPrepTime(dish.prep_time_minutes || 10);
    setCookTime(dish.cook_time_minutes || 15);
    setInstructionsText(Array.isArray(dish.instructions) ? dish.instructions.join('\n') : '');

    const mapped = (dish.ingredients || []).map((ing) => {
      const amount = ing.amount_g || 100;
      const cals = ing.calories || 0;
      const prot = ing.protein_g || 0;
      const carbs = ing.carbs_g || 0;
      const fat = ing.fat_g || 0;
      const fiber = (ing as any).fiber_g || 0;
      const ratio = amount > 0 ? 100 / amount : 1;
      const pieceWeight = estimatePieceWeight(ing.ingredient_name);

      return {
        food_id: ing.food_id || null,
        ingredient_name: ing.ingredient_name,
        amount_g: amount,
        unit: 'g' as const,
        unit_quantity: amount,
        piece_weight_g: pieceWeight,
        base_100g: {
          calories: Math.round(cals * ratio),
          protein_g: Number((prot * ratio).toFixed(1)),
          carbs_g: Number((carbs * ratio).toFixed(1)),
          fat_g: Number((fat * ratio).toFixed(1)),
          fiber_g: Number((fiber * ratio).toFixed(1)),
        },
        calories: cals,
        protein_g: prot,
        carbs_g: carbs,
        fat_g: fat,
        fiber_g: fiber,
        sodium_mg: 0,
        aisle_category: (ing as any).aisle_category,
      };
    });

    setIngredients(mapped);
    setCreateDishError(null);
    setIsCreateOpen(true);
  };

  const handleUsePantryFoodInDish = (food: Food) => {
    handleOpenNewDish();
    handleAddIngredientFromFood(food);
  };

  const handleCreateDish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dishName.trim()) {
      setCreateDishError('Por favor ingresa un nombre para el platillo.');
      return;
    }
    if (ingredients.length === 0) {
      setCreateDishError('Agrega al menos un ingrediente a la receta.');
      return;
    }

    setCreateDishError(null);
    setIsSavingDish(true);

    const instructions = instructionsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const url = editingDishId ? `/api/dishes/${editingDishId}` : '/api/dishes';
      const method = editingDishId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: dishName.trim(),
          description: dishDescription.trim() || null,
          category: dishCategory,
          total_servings: totalServings,
          serving_name: servingName.trim() || 'porción',
          is_shared_with_partner: isShared,
          prep_time_minutes: prepTime,
          cook_time_minutes: cookTime,
          instructions: instructions.length > 0 ? instructions : undefined,
          ingredients,
        }),
      });

      if (res.ok) {
        await fetchDishes();
        setIsCreateOpen(false);
        setEditingDishId(null);
        setDishName('');
        setDishDescription('');
        setInstructionsText('');
        setIngredients([]);
        setCreateDishError(null);
      } else {
        const data = await res.json().catch(() => ({}));
        setCreateDishError(data.error || (editingDishId ? 'No se pudo actualizar el platillo' : 'No se pudo guardar el platillo'));
      }
    } catch (err: any) {
      setCreateDishError(err.message || 'Error de conexión al guardar el platillo');
    } finally {
      setIsSavingDish(false);
    }
  };

  const handleCloneTemplate = async (template: Dish, customServings?: number) => {
    try {
      const portions = customServings || template.total_servings || 1;
      const res = await fetch('/api/dishes/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: template.id,
          servings: portions,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        await fetchDishes();
        if (data.dish) {
          setSelectedRecipeForModal(data.dish);
        } else {
          setSelectedRecipeForModal(null);
        }
        setActiveTab('my-dishes');
      } else {
        const data = await res.json();
        alert(`Error al clonar: ${data.error || 'No se pudo clonar la receta'}`);
      }
    } catch {
      // Ignorar
    }
  };

  const handleCookFromLibrary = async (recipe: Dish) => {
    try {
      const existing = dishes.find(
        (d) => d.name.toLowerCase().trim() === recipe.name.toLowerCase().trim()
      );

      if (existing) {
        setSelectedRecipeForModal(existing);
        return;
      }

      // Si no existe aún en Mis Platillos, hacerla suya automáticamente clonándola
      const res = await fetch('/api/dishes/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: recipe.id,
          servings: recipe.total_servings || 1,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        await fetchDishes();
        setSelectedRecipeForModal(data.dish || recipe);
      } else {
        setSelectedRecipeForModal(recipe);
      }
    } catch {
      setSelectedRecipeForModal(recipe);
    }
  };

  const handleRecipeImported = (data: any) => {
    setDishName(data.name || 'Receta Importada');
    setDishDescription(data.description || '');
    setDishCategory(data.category || 'lunch');
    setTotalServings(data.total_servings || 1);
    setPrepTime(data.prep_time_minutes || 10);
    setCookTime(data.cook_time_minutes || 15);
    if (data.instructions && Array.isArray(data.instructions)) {
      setInstructionsText(data.instructions.join('\n'));
    }
    if (data.ingredients && Array.isArray(data.ingredients)) {
      setIngredients(
        data.ingredients.map((ing: any) => ({
          food_id: null,
          ingredient_name: ing.ingredient_name,
          amount_g: ing.amount_g || 100,
          calories: ing.calories || 100,
          protein_g: ing.protein_g || 5,
          carbs_g: ing.carbs_g || 10,
          fat_g: ing.fat_g || 2,
          fiber_g: 0,
          sodium_mg: 0,
          aisle_category: ing.aisle_category,
        }))
      );
    }
    setIsCreateOpen(true);
  };

  const handleDeleteDish = async (id: string) => {
    const ok = window.confirm('¿Deseas eliminar este platillo?');
    if (!ok) return;
    try {
      await fetch(`/api/dishes/${id}`, { method: 'DELETE' });
      await fetchDishes();
    } catch {
      // Ignorar
    }
  };

  const handleConfirmSchedule = async () => {
    if (!selectedDishForSchedule || isApplyingSchedule) return;
    setIsApplyingSchedule(true);
    setScheduleMsg(null);
    setScheduleSuccess(false);

    try {
      const res = await fetch('/api/dishes/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dish_id: selectedDishForSchedule.id,
          meal_type: scheduleMealType,
          frequency_type: freqType,
          days_of_week: selectedDays,
          batch_total_servings: freqType === 'meal_prep_batch' ? scheduleBatchServings : selectedDishForSchedule.total_servings,
          week_start_date: scheduleTargetWeek,
          also_for_partner: scheduleAlsoForPartner,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setScheduleSuccess(true);
        setScheduleMsg(data.message || '¡Plan semanal actualizado!');
        await fetchWeeklyPlans();
        setTimeout(() => {
          setSelectedDishForSchedule(null);
          setScheduleMsg(null);
          setScheduleSuccess(false);
        }, 1200);
      } else {
        const errData = await res.json().catch(() => ({}));
        setScheduleMsg(errData.error || 'No se pudo aplicar la programación.');
      }
    } catch {
      setScheduleMsg('Error de conexión al programar frecuencia.');
    } finally {
      setIsApplyingSchedule(false);
    }
  };

  const handleLogPortionToday = async (dish: Dish, count = 1) => {
    try {
      const res = await fetch('/api/food-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: getLocalDateString(),
          meal_type: dish.category === 'general' ? 'lunch' : dish.category,
          food_id: null,
          food_name: `${dish.name} (${count} ${dish.serving_name || 'porción'})`,
          amount_g: dish.total_weight_g ? Math.round((dish.total_weight_g / dish.total_servings) * count) : 250,
          calories: Math.round(dish.calories_per_serving * count),
          protein_g: Number((dish.protein_per_serving * count).toFixed(1)),
          carbs_g: Number((dish.carbs_per_serving * count).toFixed(1)),
          fat_g: Number((dish.fat_per_serving * count).toFixed(1)),
          fiber_g: Number(((dish.fiber_per_serving || 0) * count).toFixed(1)),
        }),
      });
      if (res.ok) {
        setSelectedRecipeForModal(null);
        alert(`¡Registrado con éxito ${count} porción(es) de "${dish.name}" en tu Diario de hoy!`);
      }
    } catch {
      // Ignorar
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* 1. Encabezado y Navegación */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-emerald-500" />
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">
              Cocina & Recetario
            </h3>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Platillos con ingredientes, pasos de preparación y porciones escalables
          </p>
        </div>

        {/* Pestañas: Mis Platillos vs Despensa vs Biblioteca */}
        <div className="flex bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-2xl gap-1">
          <button
            onClick={() => setActiveTab('my-dishes')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'my-dishes'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-white'
            }`}
          >
            <ChefHat className="w-4 h-4" />
            <span>Mis Platillos ({dishes.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('pantry')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'pantry'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-white'
            }`}
          >
            <Package className="w-4 h-4 text-emerald-500" />
            <span>Despensa & Ingredientes ({customFoods.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('library')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'library'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4 text-teal-500" />
            <span>Biblioteca ({STARTER_RECIPES.length})</span>
          </button>
        </div>

        {/* Botones de acción justo abajo de las 3 pestañas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800/80">
          <button
            onClick={handleOpenNewDish}
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2.5 px-3 rounded-xl shadow-xs transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Platillo</span>
          </button>

          <button
            onClick={() => {
              setPantryName('');
              setPantryBrand('');
              setPantryCalories('');
              setPantryProtein('');
              setPantryCarbs('');
              setPantryFat('');
              setPantryFiber('');
              setPantryError(null);
              setIsPantryFoodModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold py-2.5 px-3 rounded-xl transition shadow-xs active:scale-95"
            title="Registrar un alimento o ingrediente individual en tu despensa (ej. marca específica de queso, jamón o corte de carne)"
          >
            <Package className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>+ Ingrediente en Despensa</span>
          </button>

          <button
            onClick={() => setIsImportOpen(true)}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/50 dark:to-teal-950/50 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 hover:border-emerald-500 text-xs font-bold py-2.5 px-3 rounded-xl transition shadow-xs active:scale-95"
            title="Importar por URL, foto de libro, captura de redes, buscador público o texto"
          >
            <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Importar Receta</span>
          </button>
        </div>
      </div>

      {/* 2. PESTAÑA: MIS PLATILLOS */}
      {activeTab === 'my-dishes' && (
        <>
          {dishes.length === 0 ? (
            <div className="text-center py-10 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 text-zinc-400 text-xs">
              <ChefHat className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="font-semibold text-zinc-700 dark:text-zinc-300">Aún no tienes platillos propios</p>
              <p className="mt-1">
                Puedes explorar la pestaña <strong>&ldquo;Biblioteca&rdquo;</strong> y clonar recetas ya calculadas con 1 solo clic.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {dishes.map((dish) => {
                return (
                  <div
                    key={dish.id}
                    className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3 hover:border-emerald-500/40 transition"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4
                            onClick={() => setSelectedRecipeForModal(dish)}
                            className="text-sm font-bold text-zinc-900 dark:text-white hover:text-emerald-600 cursor-pointer transition"
                          >
                            {dish.name}
                          </h4>
                          {partner && dish.is_shared_with_partner && (
                            <span className="text-[10px] font-medium bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 px-2 py-0.5 rounded-full border border-teal-200 dark:border-teal-800 flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              <span>Compartido</span>
                            </span>
                          )}
                        </div>
                        {dish.description && (
                          <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{dish.description}</p>
                        )}
                      </div>

                    <button
                      onClick={() => handleDeleteDish(dish.id)}
                      className="text-zinc-400 hover:text-red-500 p-1 transition"
                      title="Eliminar platillo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Tarjeta de Macros por Porción vs Receta Completa */}
                  <div
                    onClick={() => setSelectedRecipeForModal(dish)}
                    className="grid grid-cols-2 gap-2 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-2xl border border-zinc-200/60 dark:border-zinc-700/60 text-xs cursor-pointer hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition"
                  >
                    <div>
                      <span className="text-[10px] text-zinc-400 uppercase font-semibold block">
                        Por {dish.serving_name}
                      </span>
                      <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                        {dish.calories_per_serving} kcal
                      </span>
                      <div className="text-[11px] text-zinc-500 mt-0.5">
                        P: <strong className="text-zinc-800 dark:text-zinc-200">{dish.protein_per_serving}g</strong> • C: {dish.carbs_per_serving}g • G: {dish.fat_per_serving}g
                      </div>
                    </div>

                    <div className="border-l border-zinc-200 dark:border-zinc-700 pl-3 flex flex-col justify-center">
                      <span className="text-[10px] text-zinc-400 uppercase font-semibold block">
                        Rinde {dish.total_servings} porc. {dish.total_weight_g ? `(~${Math.round(dish.total_weight_g / (dish.total_servings || 1))}g)` : ''}
                      </span>
                      <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                        {dish.total_calories} kcal totales
                      </span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-semibold flex items-center gap-0.5">
                        <ChefHat className="w-3 h-3 text-emerald-500" />
                        <span>Ver receta y cocinar</span>
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>

                  {/* Botones de acción (Opción 2: Flujo principal + Iconos compactos a la derecha) */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    {/* Acciones principales de flujo */}
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <button
                        onClick={() => setSelectedRecipeForModal(dish)}
                        className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-xs active:scale-95"
                        title="Ver receta, ingredientes escalados e instrucciones para cocinar"
                      >
                        <ChefHat className="w-3.5 h-3.5" />
                        <span>Cocinar</span>
                      </button>

                      <button
                        onClick={() => handleOpenScheduleModal(dish)}
                        className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition"
                        title="Programar para Meal Prep o días específicos"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Programar</span>
                      </button>

                      <button
                        onClick={() => handleLogPortionToday(dish, 1)}
                        className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:border-emerald-300 transition active:scale-95"
                        title="Registrar 1 porción consumida en el diario de hoy"
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Comer hoy</span>
                      </button>
                    </div>

                    {/* Herramientas compactas a la derecha */}
                    <div className="flex items-center gap-1 shrink-0 ml-auto">
                      <button
                        onClick={() => handleEditDish(dish)}
                        className="p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400"
                        title="Editar ingredientes, marcas o porciones"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setSelectedDishForNutrition(dish)}
                        className="p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400"
                        title="Ver tabla nutrimental detallada"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          )}
        </>
      )}

      {/* 2.5 PESTAÑA: DESPENSA & INGREDIENTES */}
      {activeTab === 'pantry' && (
        <div className="space-y-4">

          {/* Buscador de despensa */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar en tu despensa por nombre o marca (ej. Queso Panela, FUD, San Rafael, Wild Fork)..."
              value={pantrySearchQuery}
              onChange={(e) => setPantrySearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
            />
            {pantrySearchQuery && (
              <button
                onClick={() => setPantrySearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Chips de filtro por categoría */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {[
              { key: 'all', label: '🌟 Todos', count: customFoods.length },
              { key: 'proteinas', label: '🥩 Proteínas', count: customFoods.filter(f => getFoodCategoryKey(f) === 'proteinas').length },
              { key: 'carbohidratos', label: '🌾 Carbos', count: customFoods.filter(f => getFoodCategoryKey(f) === 'carbohidratos').length },
              { key: 'verduras', label: '🥦 Verduras', count: customFoods.filter(f => getFoodCategoryKey(f) === 'verduras').length },
              { key: 'frutas', label: '🍎 Frutas', count: customFoods.filter(f => getFoodCategoryKey(f) === 'frutas').length },
              { key: 'lacteos', label: '🧀 Lácteos', count: customFoods.filter(f => getFoodCategoryKey(f) === 'lacteos').length },
              { key: 'grasas', label: '🥑 Grasas', count: customFoods.filter(f => getFoodCategoryKey(f) === 'grasas').length },
              { key: 'custom', label: '🏷️ Mis Registros', count: customFoods.filter(f => f.user_id !== null || f.source === 'manual' || Boolean(f.barcode)).length },
            ].map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => {
                  setPantryCategoryFilter((prev) => (prev === cat.key ? 'all' : cat.key));
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 border cursor-pointer select-none active:scale-95 ${
                  pantryCategoryFilter === cat.key
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                <span>{cat.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold flex items-center gap-1 ${
                  pantryCategoryFilter === cat.key
                    ? 'bg-emerald-700 text-white'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                }`}>
                  <span>{cat.count}</span>
                  {pantryCategoryFilter === cat.key && cat.key !== 'all' && (
                    <span className="text-[10px] opacity-80 hover:opacity-100 font-bold ml-0.5" title="Quitar filtro">✕</span>
                  )}
                </span>
              </button>
            ))}
          </div>

          {/* Listado de alimentos */}
          {loadingCustomFoods ? (
            <div className="text-center py-12 text-xs text-zinc-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
              <span>Cargando despensa...</span>
            </div>
          ) : filteredPantryFoods.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-3">
              <Package className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-700" />
              <div>
                <p className="font-bold text-zinc-700 dark:text-zinc-300 text-sm">
                  {pantrySearchQuery
                    ? 'No se encontraron alimentos con esa búsqueda'
                    : pantryCategoryFilter !== 'all'
                    ? 'No hay ingredientes en esta categoría'
                    : 'Aún no tienes ingredientes personalizados en tu despensa'}
                </p>
                <p className="text-xs text-zinc-500 mt-1 max-w-md mx-auto">
                  {pantrySearchQuery
                    ? 'Prueba con otro término o registra este alimento como un nuevo ingrediente.'
                    : pantryCategoryFilter !== 'all'
                    ? 'Puedes quitar el filtro para ver toda tu despensa o registrar un nuevo producto.'
                    : 'Agrega alimentos con sus macros exactos para personalizar tus recetas y sustituir ingredientes genéricos por tus marcas preferidas.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {pantryCategoryFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setPantryCategoryFilter('all')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-bold transition"
                  >
                    <span>Quitar filtro</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setPantryName(pantrySearchQuery);
                    setPantryBrand('');
                    setPantryCalories('');
                    setPantryProtein('');
                    setPantryCarbs('');
                    setPantryFat('');
                    setPantryFiber('');
                    setPantryError(null);
                    setIsPantryFoodModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-xs transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Registrar &ldquo;{pantrySearchQuery || 'Nuevo Ingrediente'}&rdquo;</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredPantryFoods.map((food) => (
                <div
                  key={food.id}
                  className="bg-white dark:bg-zinc-900 rounded-3xl p-4 sm:p-5 border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between space-y-3.5 hover:border-emerald-500/40 transition"
                >
                  {/* Encabezado: Nombre completo (sin truncar) + Botones Editar / Eliminar */}
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="font-bold text-sm text-zinc-900 dark:text-white leading-snug break-words flex-1">
                      {food.name}
                    </h4>

                    <div className="flex items-center gap-1 shrink-0 -mt-1 -mr-1">
                      <button
                        type="button"
                        onClick={() => handleEditPantryFood(food)}
                        className="p-1.5 rounded-xl text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition cursor-pointer"
                        title="Personalizar marca o macros"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeletePantryFood(food.id, food.name)}
                        className="p-1.5 rounded-xl text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 transition cursor-pointer"
                        title="Eliminar ingrediente de la despensa"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Subtítulo: Etiqueta/Marca + Porción Base + Código de barras */}
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    {food.brand && (
                      <span className="text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/60">
                        {food.brand}
                      </span>
                    )}
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Porción base: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{food.serving_size_g}{food.serving_unit || 'g'}</span>
                    </span>
                    {food.barcode && (
                      <span className="text-[10px] text-zinc-400 font-mono flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-md">
                        <Barcode className="w-3 h-3 text-zinc-400" />
                        {food.barcode}
                      </span>
                    )}
                  </div>

                  {/* Información Nutrimental: 3 arriba y 2 abajo centradas */}
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 p-2 sm:p-2.5 rounded-2xl border border-zinc-100 dark:border-zinc-800/80 space-y-1.5">
                    {/* Fila 1: 3 columnas (Calorías, Proteína, Carbos) */}
                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      <div className="bg-white dark:bg-zinc-900/70 py-1.5 px-1 rounded-xl border border-zinc-100 dark:border-zinc-800/60 shadow-2xs">
                        <span className="text-[8.5px] sm:text-[9px] text-zinc-400 dark:text-zinc-400 uppercase font-bold tracking-tight block whitespace-nowrap">
                          Calorías
                        </span>
                        <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm block">
                          {food.calories} <span className="text-[8px] font-normal text-zinc-400">kcal</span>
                        </span>
                      </div>

                      <div className="bg-white dark:bg-zinc-900/70 py-1.5 px-1 rounded-xl border border-zinc-100 dark:border-zinc-800/60 shadow-2xs">
                        <span className="text-[8.5px] sm:text-[9px] text-zinc-400 dark:text-zinc-400 uppercase font-bold tracking-tight block whitespace-nowrap">
                          Proteína
                        </span>
                        <span className="font-bold text-blue-600 dark:text-blue-400 text-xs sm:text-sm block">
                          {food.protein_g}g
                        </span>
                      </div>

                      <div className="bg-white dark:bg-zinc-900/70 py-1.5 px-1 rounded-xl border border-zinc-100 dark:border-zinc-800/60 shadow-2xs">
                        <span className="text-[8.5px] sm:text-[9px] text-zinc-400 dark:text-zinc-400 uppercase font-bold tracking-tight block whitespace-nowrap">
                          Carbos
                        </span>
                        <span className="font-bold text-amber-600 dark:text-amber-400 text-xs sm:text-sm block">
                          {food.carbs_g}g
                        </span>
                      </div>
                    </div>

                    {/* Fila 2: 2 columnas centradas (Grasa, Fibra) */}
                    <div className="flex justify-center gap-1.5 text-center">
                      <div className="w-[32%] bg-white dark:bg-zinc-900/70 py-1.5 px-1 rounded-xl border border-zinc-100 dark:border-zinc-800/60 shadow-2xs">
                        <span className="text-[8.5px] sm:text-[9px] text-zinc-400 dark:text-zinc-400 uppercase font-bold tracking-tight block whitespace-nowrap">
                          Grasas
                        </span>
                        <span className="font-bold text-rose-500 text-xs sm:text-sm block">
                          {food.fat_g}g
                        </span>
                      </div>

                      <div className="w-[32%] bg-white dark:bg-zinc-900/70 py-1.5 px-1 rounded-xl border border-zinc-100 dark:border-zinc-800/60 shadow-2xs">
                        <span className="text-[8.5px] sm:text-[9px] text-zinc-400 dark:text-zinc-400 uppercase font-bold tracking-tight block whitespace-nowrap">
                          Fibra
                        </span>
                        <span className="font-bold text-teal-600 dark:text-teal-400 text-xs sm:text-sm block">
                          {Number((food as any).fiber_g || 0)}g
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Botón de acción: Full width y anclado al fondo */}
                  <div className="pt-1 mt-auto">
                    <button
                      type="button"
                      onClick={() => handleUsePantryFoodInDish(food)}
                      className="w-full py-2.5 px-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-600 text-emerald-700 dark:text-emerald-300 hover:text-white border border-emerald-200 dark:border-emerald-800/60 hover:border-emerald-600 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-[0.99]"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar a platillo</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. PESTAÑA: BIBLIOTECA (STARTER RECIPES) */}
      {activeTab === 'library' && (
        <div className="space-y-3">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-2.5 text-xs text-emerald-800 dark:text-emerald-200">
            <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong className="font-bold">Recetas listas para cocinar:</strong> Cada receta está calculada por porción individual. Puedes tocar <strong>Cocinar</strong> para ver los pasos y escalar porciones, o clonarla a tus platillos.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {STARTER_RECIPES.map((recipe) => {
              const isAlreadyInMyDishes = dishes.some(
                (d) => d.name.toLowerCase().trim() === recipe.name.toLowerCase().trim()
              );

              return (
                <div
                  key={recipe.id}
                  onClick={() => handleCookFromLibrary(recipe)}
                  className="bg-white dark:bg-zinc-900 rounded-3xl p-4 sm:p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm hover:border-emerald-500 transition cursor-pointer flex flex-col justify-between space-y-3"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded-full">
                          {recipe.category === 'breakfast'
                            ? 'Desayuno'
                            : recipe.category === 'lunch'
                            ? 'Comida'
                            : recipe.category === 'dinner'
                            ? 'Cena'
                            : 'Snack'}
                        </span>
                        {isAlreadyInMyDishes && (
                          <span className="text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/60">
                            ✓ En tus platillos
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                        {recipe.prep_time_minutes !== undefined && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {recipe.prep_time_minutes + (recipe.cook_time_minutes || 0)} min
                          </span>
                        )}
                      </div>
                    </div>

                    <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
                      {recipe.name}
                    </h4>
                    <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2 leading-relaxed">
                      {recipe.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs">
                    <div className="flex items-baseline gap-2">
                      <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                        {recipe.calories_per_serving} kcal
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        P: <strong className="text-zinc-700 dark:text-zinc-300">{recipe.protein_per_serving}g</strong> • C: {recipe.carbs_per_serving}g • G: {recipe.fat_per_serving}g
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isAlreadyInMyDishes && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCloneTemplate(recipe);
                          }}
                          className="text-[11px] bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 px-2.5 py-1.5 rounded-xl font-bold transition flex items-center gap-1"
                          title="Guardar en Mis Platillos sin abrir"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Clonar</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCookFromLibrary(recipe);
                        }}
                        className="text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1 shadow-xs active:scale-95"
                        title="Cocinar (la agrega a Mis Platillos y abre el escalador)"
                      >
                        <ChefHat className="w-3.5 h-3.5" />
                        <span>Cocinar</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL DETALLE DE RECETA / ESCALADOR DINÁMICO */}
      {selectedRecipeForModal && (
        <RecipeDetailModal
          dish={selectedRecipeForModal}
          onClose={() => setSelectedRecipeForModal(null)}
          onSchedule={selectedRecipeForModal.is_starter_template ? undefined : (dish) => {
            setSelectedRecipeForModal(null);
            handleOpenScheduleModal(dish);
          }}
          onLogToday={handleLogPortionToday}
          onCloneTemplate={handleCloneTemplate}
          onEdit={(dish) => {
            setSelectedRecipeForModal(null);
            handleEditDish(dish);
          }}
        />
      )}

      {/* HUB DE IMPORTACIÓN DE RECETAS (5 MÉTODOS) */}
      <RecipeImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onRecipeImported={handleRecipeImported}
        onOpenLibraryTab={() => setActiveTab('library')}
      />

      {/* MODAL CREAR NUEVO PLATILLO MANUAL / EDITAR */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-4xl rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden">
            {/* Header fijo */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <ChefHat className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                    {editingDishId ? 'Editar Platillo / Receta' : 'Crear Nuevo Platillo / Receta'}
                  </h3>
                  <p className="text-xs text-zinc-400 hidden sm:block">
                    {editingDishId
                      ? 'Modifica ingredientes, porciones o preparación de este platillo'
                      : 'Calcula automáticamente los macros y porciones de tu preparación'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCreateOpen(false);
                  setEditingDishId(null);
                }}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido con formulario organizado en 2 columnas */}
            <form onSubmit={handleCreateDish} className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col justify-between">
              <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Columna Izquierda: Datos de la Receta y Pasos */}
                <div className="lg:col-span-6 space-y-4">
                  <div>
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Nombre del Platillo *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="ej. Arroz con Pollo al Curry y Verduras"
                      value={dishName}
                      onChange={(e) => setDishName(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-zinc-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                        Categoría
                      </label>
                      <select
                        value={dishCategory}
                        onChange={(e) => setDishCategory(e.target.value as any)}
                        className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-zinc-900 dark:text-white outline-none"
                      >
                        <option value="breakfast">🍳 Desayuno</option>
                        <option value="lunch">🥗 Comida</option>
                        <option value="dinner">🍲 Cena</option>
                        <option value="snack">🥑 Snack</option>
                        <option value="general">🍽️ General</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                        Porciones Base
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={totalServings}
                        onChange={(e) => setTotalServings(Math.max(1, Number(e.target.value)))}
                        className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-zinc-900 dark:text-white font-bold outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                        Tiempo Prep (min)
                      </label>
                      <input
                        type="number"
                        value={prepTime}
                        onChange={(e) => setPrepTime(Number(e.target.value))}
                        className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-zinc-900 dark:text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                        Tiempo Cocción (min)
                      </label>
                      <input
                        type="number"
                        value={cookTime}
                        onChange={(e) => setCookTime(Number(e.target.value))}
                        className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-zinc-900 dark:text-white outline-none"
                      />
                    </div>
                  </div>

                  {/* PASOS DE PREPARACIÓN */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                        Pasos de Preparación
                      </label>
                      <span className="text-[11px] text-zinc-400">Uno por renglón</span>
                    </div>
                    <textarea
                      rows={5}
                      placeholder={`1. Sazonar el pollo con sal y limón...
2. Saltear a fuego medio por 8 minutos...
3. Servir con la guarnición caliente...`}
                      value={instructionsText}
                      onChange={(e) => setInstructionsText(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 text-xs text-zinc-900 dark:text-white leading-relaxed resize-none outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {partner && (
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="shareDish"
                        checked={isShared}
                        onChange={(e) => setIsShared(e.target.checked)}
                        className="rounded accent-emerald-600 w-4 h-4 cursor-pointer"
                      />
                      <label htmlFor="shareDish" className="text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
                        Compartir en el hogar para meal prep conjunto (roomie / duo)
                      </label>
                    </div>
                  )}
                </div>

                {/* Columna Derecha: Ingredientes y Resumen en Vivo */}
                <div className="lg:col-span-6 space-y-4 flex flex-col justify-between">
                  {/* SECCIÓN INGREDIENTES */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
                        Ingredientes ({ingredients.length})
                      </span>
                      <span className="text-xs text-zinc-400">Gramos de la receta completa</span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Buscar pechuga, arroz, aceite, avena..."
                          value={searchFoodQuery}
                          onChange={(e) => handleSearchFoods(e.target.value)}
                          className="flex-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={() => setIsBarcodeScannerOpen(true)}
                          title="Escanear código de barras del producto"
                          className="px-3 py-2 bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 rounded-xl text-xs font-semibold hover:bg-teal-100 transition flex items-center gap-1.5 shrink-0"
                        >
                          <Barcode className="w-4 h-4" />
                          <span className="hidden sm:inline">Código</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingCustomFood(!isAddingCustomFood);
                            if (!isAddingCustomFood && searchFoodQuery.trim()) {
                              setCustomFoodName(searchFoodQuery.trim());
                            }
                          }}
                          title="Registrar nuevo ingrediente con sus macros"
                          className={`px-3 py-2 border rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shrink-0 ${
                            isAddingCustomFood
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
                          }`}
                        >
                          <Plus className="w-4 h-4" />
                          <span className="hidden sm:inline">Nuevo</span>
                        </button>
                      </div>

                      {searchingFood && <p className="text-[11px] text-zinc-400 italic">Buscando alimento...</p>}

                      {foodResults.length > 0 && (
                        <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl max-h-40 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-700 shadow-md">
                          {foodResults.map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => handleAddIngredientFromFood(f)}
                              className="w-full p-2.5 text-left hover:bg-emerald-50 dark:hover:bg-emerald-950/30 flex justify-between items-center text-xs transition"
                            >
                              <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate pr-2">{f.name}</span>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400 shrink-0">{f.calories} kcal/100g</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {!searchingFood && searchFoodQuery.trim().length > 1 && foodResults.length === 0 && !isAddingCustomFood && (
                        <div className="p-2.5 bg-zinc-50 dark:bg-zinc-800/70 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl text-xs flex items-center justify-between">
                          <span className="text-zinc-500 dark:text-zinc-400 text-[11px]">¿No encuentras "{searchFoodQuery}"?</span>
                          <button
                            type="button"
                            onClick={() => {
                              setCustomFoodName(searchFoodQuery.trim());
                              setIsAddingCustomFood(true);
                            }}
                            className="font-bold text-emerald-600 dark:text-emerald-400 text-[11px] hover:underline"
                          >
                            + Registrar ingrediente nuevo
                          </button>
                        </div>
                      )}

                      {/* Formulario desplegable para dar de alta nuevo ingrediente */}
                      {isAddingCustomFood && (
                        <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-950/40 border-2 border-emerald-500/40 rounded-2xl space-y-3 animate-in fade-in zoom-in-95 duration-150">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                              Registrar nuevo ingrediente
                            </span>
                            <button
                              type="button"
                              onClick={() => setIsAddingCustomFood(false)}
                              className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-1"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="col-span-2 sm:col-span-1">
                              <label className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 block mb-0.5">
                                Nombre del ingrediente *
                              </label>
                              <input
                                type="text"
                                placeholder="ej. Pan de masa madre, Queso oaxaca"
                                value={customFoodName}
                                onChange={(e) => setCustomFoodName(e.target.value)}
                                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-1.5 text-xs text-zinc-900 dark:text-white outline-none"
                              />
                            </div>
                            <div className="col-span-2 sm:col-span-1">
                              <label className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 block mb-0.5">
                                Marca o variedad (opcional)
                              </label>
                              <input
                                type="text"
                                placeholder="ej. Artesanal, Lala, Kirkland"
                                value={customFoodBrand}
                                onChange={(e) => setCustomFoodBrand(e.target.value)}
                                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-1.5 text-xs text-zinc-900 dark:text-white outline-none"
                              />
                            </div>
                          </div>

                          <div>
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                              Valores nutrimentales por cada 100 gramos:
                            </span>
                            <div className="grid grid-cols-5 gap-1.5 text-center">
                              <div>
                                <span className="text-[9px] text-zinc-400 block">Kcal *</span>
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={customFoodCals}
                                  onChange={(e) => setCustomFoodCals(e.target.value === '' ? '' : Number(e.target.value))}
                                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-1 text-xs text-center font-bold text-emerald-600 outline-none"
                                />
                              </div>
                              <div>
                                <span className="text-[9px] text-zinc-400 block">Prot (g)</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  placeholder="0"
                                  value={customFoodProt}
                                  onChange={(e) => setCustomFoodProt(e.target.value === '' ? '' : Number(e.target.value))}
                                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-1 text-xs text-center font-bold text-blue-500 outline-none"
                                />
                              </div>
                              <div>
                                <span className="text-[9px] text-zinc-400 block">Carb (g)</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  placeholder="0"
                                  value={customFoodCarbs}
                                  onChange={(e) => setCustomFoodCarbs(e.target.value === '' ? '' : Number(e.target.value))}
                                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-1 text-xs text-center font-bold text-amber-500 outline-none"
                                />
                              </div>
                              <div>
                                <span className="text-[9px] text-zinc-400 block">Grasa (g)</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  placeholder="0"
                                  value={customFoodFat}
                                  onChange={(e) => setCustomFoodFat(e.target.value === '' ? '' : Number(e.target.value))}
                                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-1 text-xs text-center font-bold text-rose-500 outline-none"
                                />
                              </div>
                              <div>
                                <span className="text-[9px] text-zinc-400 block">Fibra (g)</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  placeholder="0"
                                  value={customFoodFiber}
                                  onChange={(e) => setCustomFoodFiber(e.target.value === '' ? '' : Number(e.target.value))}
                                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-1 text-xs text-center font-bold text-teal-600 outline-none"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-zinc-600 dark:text-zinc-400">Usar en receta:</span>
                              <div className="flex items-center bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-2.5 py-1 shadow-xs focus-within:ring-2 focus-within:ring-emerald-500">
                                <input
                                  type="number"
                                  min="1"
                                  value={customFoodGramsForDish}
                                  onChange={(e) => setCustomFoodGramsForDish(Math.max(1, Number(e.target.value)))}
                                  className="w-16 bg-transparent text-right font-bold text-xs text-zinc-900 dark:text-white outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <span className="text-zinc-400 text-[11px] font-semibold ml-1 select-none">g</span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={handleSaveAndAddCustomFood}
                              disabled={savingCustomFood || !customFoodName.trim() || customFoodCals === ''}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl text-xs font-bold shadow-sm transition disabled:opacity-50 flex items-center gap-1"
                            >
                              {savingCustomFood ? (
                                <span>Guardando...</span>
                              ) : (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Guardar y Agregar</span>
                                </>
                              )}
                            </button>
                          </div>

                          {customFoodError && (
                            <p className="text-[11px] text-red-500 font-medium">{customFoodError}</p>
                          )}
                        </div>
                      )}
                    </div>

                    {ingredients.length > 0 ? (
                      <div className="max-h-[220px] overflow-y-auto overflow-x-hidden space-y-2 pr-1">
                        {ingredients.map((ing, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 bg-zinc-50 dark:bg-zinc-800/80 rounded-2xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-between text-xs"
                          >
                            <div className="flex-1 pr-2 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-zinc-900 dark:text-white truncate" title={ing.ingredient_name}>
                                  {ing.ingredient_name}
                                </span>
                                {ing.unit && ing.unit !== 'g' && (
                                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/70 px-1.5 py-0.5 rounded-md">
                                    ≈ {ing.amount_g}g
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-zinc-400 block mt-0.5">
                                {ing.calories} kcal • P: {ing.protein_g}g • C: {ing.carbs_g}g • G: {ing.fat_g}g
                                {ing.fiber_g ? ` • Fibra: ${ing.fiber_g}g` : ''}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <div className="flex items-center bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-2 py-1 shadow-xs focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500 transition">
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={ing.unit_quantity !== undefined ? ing.unit_quantity : (ing.unit === 'kg' ? Number((ing.amount_g / 1000).toFixed(2)) : ing.amount_g)}
                                  onChange={(e) => handleUpdateIngredientQuantity(idx, e.target.value === '' ? 0 : Number(e.target.value))}
                                  className="w-16 bg-transparent text-right font-bold text-xs text-zinc-900 dark:text-white outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <select
                                  value={ing.unit || 'g'}
                                  onChange={(e) => handleUpdateIngredientUnit(idx, e.target.value as 'g' | 'kg' | 'pza')}
                                  className="bg-transparent text-zinc-600 dark:text-zinc-300 text-xs font-semibold ml-1 cursor-pointer outline-none border-l border-zinc-200 dark:border-zinc-700 pl-1 py-0.5 hover:text-emerald-600 dark:hover:text-emerald-400"
                                >
                                  <option value="g" className="dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100">g</option>
                                  <option value="kg" className="dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100">kg</option>
                                  <option value="pza" className="dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100">pza</option>
                                </select>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveIngredient(idx)}
                                className="text-zinc-400 hover:text-red-500 p-1.5 transition rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700/50"
                                title="Quitar ingrediente"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl text-center text-xs text-zinc-400">
                        Agrega ingredientes con el buscador o escáner
                      </div>
                    )}
                  </div>

                  {/* RESUMEN EN VIVO POR PORCIÓN */}
                  {ingredients.length > 0 && (
                    <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50/50 dark:from-emerald-950/40 dark:to-teal-950/20 rounded-2xl border border-emerald-500/30 text-xs space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-bold text-emerald-800 dark:text-emerald-300 text-xs block">
                            Resultado por porción ({totalServings} {totalServings === 1 ? 'porción' : 'porciones'} en total):
                          </span>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="inline-flex items-center gap-1 bg-emerald-100/80 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-lg text-[11px] font-bold">
                              ⚖️ ~{previewServingWeightGrams} g por porción
                            </span>
                            <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                              (de {(previewTotalWeightGrams / 1000).toFixed(2)} kg de receta cruda)
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 block leading-tight">
                            {Math.round(previewTotalCals / previewServings)} kcal
                          </span>
                          <span className="text-[10px] text-zinc-400 block">por porción</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-2 text-center pt-2 border-t border-emerald-500/20 text-[11px]">
                        <div className="bg-white/70 dark:bg-zinc-800/70 p-1.5 rounded-xl">
                          <span className="text-zinc-400 block text-[10px]">Proteína</span>
                          <span className="font-bold text-blue-500">{(previewTotalProt / previewServings).toFixed(1)}g</span>
                        </div>
                        <div className="bg-white/70 dark:bg-zinc-800/70 p-1.5 rounded-xl">
                          <span className="text-zinc-400 block text-[10px]">Carbos</span>
                          <span className="font-bold text-amber-500">{(previewTotalCarbs / previewServings).toFixed(1)}g</span>
                        </div>
                        <div className="bg-white/70 dark:bg-zinc-800/70 p-1.5 rounded-xl">
                          <span className="text-zinc-400 block text-[10px]">Grasas</span>
                          <span className="font-bold text-rose-500">{(previewTotalFat / previewServings).toFixed(1)}g</span>
                        </div>
                        <div className="bg-white/70 dark:bg-zinc-800/70 p-1.5 rounded-xl">
                          <span className="text-zinc-400 block text-[10px]">🌾 Fibra</span>
                          <span className="font-bold text-teal-600 dark:text-teal-400">{(previewTotalFiber / previewServings).toFixed(1)}g</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* FOOTER FIJO CON ALERTAS Y BOTONES */}
              <div className="p-4 sm:p-5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/80 shrink-0 space-y-3">
                {createDishError && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                    <span className="font-bold">Error:</span> {createDishError}
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreateOpen(false);
                      setEditingDishId(null);
                    }}
                    className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={ingredients.length === 0 || !dishName.trim() || isSavingDish}
                    className="flex-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2"
                  >
                    {isSavingDish ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>{editingDishId ? 'Actualizando Platillo...' : 'Guardando Platillo...'}</span>
                      </>
                    ) : (
                      <span>{editingDishId ? 'Actualizar Platillo' : 'Guardar Platillo'}</span>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL VER TABLA NUTRIMENTAL */}
      {selectedDishForNutrition && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-2xl relative">
            <button
              onClick={() => setSelectedDishForNutrition(null)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-800 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="pt-2">
              <NutritionFactLabel
                name={selectedDishForNutrition.name}
                servingSizeText={`1 ${selectedDishForNutrition.serving_name}`}
                servingsPerContainer={selectedDishForNutrition.total_servings}
                calories={selectedDishForNutrition.calories_per_serving}
                proteinG={selectedDishForNutrition.protein_per_serving}
                carbsG={selectedDishForNutrition.carbs_per_serving}
                fatG={selectedDishForNutrition.fat_per_serving}
                fiberG={selectedDishForNutrition.fiber_per_serving}
                totalCalories={selectedDishForNutrition.total_calories}
                totalProteinG={selectedDishForNutrition.total_protein_g}
                totalCarbsG={selectedDishForNutrition.total_carbs_g}
                totalFatG={selectedDishForNutrition.total_fat_g}
                totalFiberG={selectedDishForNutrition.total_fiber_g}
              />
            </div>
          </div>
        </div>
      )}

      {/* MODAL PROGRAMAR FRECUENCIA DE CONSUMO */}
      {selectedDishForSchedule && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                  Programar Frecuencia de Consumo
                </h3>
                <p className="text-xs text-zinc-400 truncate max-w-xs">
                  {selectedDishForSchedule.name}
                </p>
              </div>
              <button
                onClick={() => setSelectedDishForSchedule(null)}
                className="text-zinc-400 hover:text-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selector de Semana Destino */}
            <div className="bg-zinc-50 dark:bg-zinc-800/60 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-700/80 space-y-2">
              <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">
                ¿Para qué semana es este Meal Prep?
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setScheduleTargetWeek(getNextWeekStartDate())}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                    scheduleTargetWeek === getNextWeekStartDate()
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm font-bold'
                      : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
                  }`}
                >
                  <span className="block text-xs font-bold">✨ Próxima Semana</span>
                  <span className={`text-[10px] block mt-0.5 ${scheduleTargetWeek === getNextWeekStartDate() ? 'text-emerald-100' : 'text-zinc-400'}`}>
                    {formatWeekDateRange(getNextWeekStartDate())}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleTargetWeek(getWeekStartDate())}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                    scheduleTargetWeek === getWeekStartDate()
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm font-bold'
                      : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
                  }`}
                >
                  <span className="block text-xs font-bold">📅 Esta Semana</span>
                  <span className={`text-[10px] block mt-0.5 ${scheduleTargetWeek === getWeekStartDate() ? 'text-emerald-100' : 'text-zinc-400'}`}>
                    {formatWeekDateRange(getWeekStartDate())}
                  </span>
                </button>
              </div>
            </div>

            {/* Opciones de Frecuencia */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block">
                ¿Con qué patrón deseas consumirlo?
              </label>

              {[
                {
                  id: 'weekdays',
                  label: '🗓️ Lunes a Viernes Fijo',
                  desc: 'Asigna 1 porción diaria entre semana; deja libre sábado y domingo.',
                },
                {
                  id: 'meal_prep_batch',
                  label: '🍱 Lote Meal Prep',
                  desc: `Distribuir ${scheduleBatchServings} porciones para ti (de ${selectedDishForSchedule.total_servings} cocinadas).`,
                },
                {
                  id: 'specific_days',
                  label: '🎯 Días Específicos',
                  desc: 'Elige qué días de la semana comerlo (ej. Lun, Mié, Vie).',
                },
                {
                  id: 'daily',
                  label: '🔄 Todos los días (7 días)',
                  desc: 'Lunes a Domingo.',
                },
              ].map((opt) => (
                <div
                  key={opt.id}
                  onClick={() => setFreqType(opt.id as FrequencyType)}
                  className={`p-3 rounded-2xl border transition cursor-pointer text-xs ${
                    freqType === opt.id
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 font-semibold'
                      : 'bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700'
                  }`}
                >
                  <span className="block text-zinc-900 dark:text-white">{opt.label}</span>
                  <span className="text-[11px] text-zinc-500 font-normal">{opt.desc}</span>
                </div>
              ))}
            </div>

            {freqType === 'meal_prep_batch' && (
              <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/80 rounded-2xl border border-zinc-200 dark:border-zinc-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-zinc-900 dark:text-white block">
                      ¿Cuántas porciones son para ti?
                    </span>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Olla completa: {selectedDishForSchedule.total_servings} porciones totales
                    </span>
                  </div>

                  <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl p-1 shadow-xs">
                    <button
                      type="button"
                      onClick={() => setScheduleBatchServings((prev) => Math.max(1, prev - 1))}
                      className="w-7 h-7 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center font-bold text-sm text-zinc-700 dark:text-zinc-300 transition"
                    >
                      -
                    </button>
                    <span className="w-8 text-center text-xs font-black text-emerald-600 dark:text-emerald-400">
                      {scheduleBatchServings}
                    </span>
                    <button
                      type="button"
                      onClick={() => setScheduleBatchServings((prev) => Math.min(selectedDishForSchedule.total_servings, prev + 1))}
                      className="w-7 h-7 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center font-bold text-sm text-zinc-700 dark:text-zinc-300 transition"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-500/20 text-[11px] text-emerald-800 dark:text-emerald-300 space-y-1">
                  <span>
                    🍽️ Se programarán <strong>{scheduleBatchServings} porciones para ti</strong> en tus próximos días hábiles (Lunes a {['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][Math.min(7, scheduleBatchServings)]}).
                  </span>
                  {selectedDishForSchedule.total_servings > scheduleBatchServings && (
                    <span className="block text-zinc-600 dark:text-zinc-400">
                      Las otras <strong>{selectedDishForSchedule.total_servings - scheduleBatchServings} porciones</strong> quedan para la otra persona o para congelar.
                    </span>
                  )}
                </div>

                {partner && (
                  <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={scheduleAlsoForPartner}
                      onChange={(e) => setScheduleAlsoForPartner(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-xs text-zinc-700 dark:text-zinc-300 font-medium">
                      Programar también {Math.min(scheduleBatchServings, selectedDishForSchedule.total_servings - scheduleBatchServings)} porciones en el plan de <strong>{partner.display_name}</strong>
                    </span>
                  </label>
                )}
              </div>
            )}

            {freqType === 'specific_days' && (
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-2xl">
                <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 block mb-2">
                  Selecciona los días:
                </span>
                <div className="flex gap-1.5 justify-between">
                  {[
                    { d: 1, label: 'L' },
                    { d: 2, label: 'M' },
                    { d: 3, label: 'X' },
                    { d: 4, label: 'J' },
                    { d: 5, label: 'V' },
                    { d: 6, label: 'S' },
                    { d: 7, label: 'D' },
                  ].map(({ d, label }) => {
                    const active = selectedDays.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          setSelectedDays((prev) =>
                            active ? prev.filter((x) => x !== d) : [...prev, d]
                          );
                        }}
                        className={`w-9 h-9 rounded-xl font-bold text-xs transition ${
                          active
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white dark:bg-zinc-900 text-zinc-500 border border-zinc-200 dark:border-zinc-700'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                Tiempo de comida a asignar
              </label>
              <select
                value={scheduleMealType}
                onChange={(e) => setScheduleMealType(e.target.value as MealType)}
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2 text-xs text-zinc-900 dark:text-white"
              >
                <option value="breakfast">Desayuno</option>
                <option value="lunch">Comida / Almuerzo</option>
                <option value="dinner">Cena</option>
                <option value="snack">Snack</option>
              </select>
            </div>

            {scheduleMsg && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 font-semibold text-center">
                {scheduleMsg}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedDishForSchedule(null)}
                className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-500"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmSchedule}
                disabled={isApplyingSchedule || scheduleSuccess}
                className="flex-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-80 disabled:cursor-not-allowed text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition"
              >
                {isApplyingSchedule ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Aplicando al plan...</span>
                  </>
                ) : scheduleSuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>¡Aplicado con éxito!</span>
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4" />
                    <span>Aplicar al Plan Semanal</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR ALIMENTO EN DESPENSA */}
      {isPantryFoodModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden animate-in fade-in duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                    {editingPantryFoodId ? 'Personalizar / Editar Ingrediente' : 'Registrar Ingrediente en Despensa'}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {editingPantryFoodId
                      ? 'Asigna tu marca favorita o escanea el empaque para actualizar macros'
                      : 'Guarda la marca o producto exacto para usarlo en tus recetas y diario'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsPantryFoodModalOpen(false);
                  setEditingPantryFoodId(null);
                  setPantryBarcode(null);
                }}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSavePantryFood} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {/* Acceso Rápido: Escanear Código de Barras */}
              <div className="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-xl shrink-0">
                    <Barcode className="w-5 h-5" />
                  </div>
                  <div className="text-xs">
                    <span className="font-bold text-zinc-900 dark:text-white block">
                      ¿Tiene código de barras?
                    </span>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block truncate">
                      Escanéalo para autocompletar nombre, marca y macros
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setBarcodeScannerTarget('pantry');
                    setIsBarcodeScannerOpen(true);
                  }}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl text-xs font-bold shrink-0 shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Escanear</span>
                </button>
              </div>

              {pantryBarcode && (
                <div className="flex items-center justify-between px-3 py-1.5 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-xl text-[11px] text-emerald-800 dark:text-emerald-300">
                  <span className="flex items-center gap-1.5 font-mono">
                    <Barcode className="w-3.5 h-3.5 text-emerald-600" />
                    Código detectado: <strong>{pantryBarcode}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setPantryBarcode(null)}
                    className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 ml-2"
                  >
                    ✕
                  </button>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Nombre del Alimento o Ingrediente *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Queso Panela, Pechuga de Pavo, Asado de Tira CAB"
                  value={pantryName}
                  onChange={(e) => setPantryName(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                    Marca (opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="ej. FUD, Lala, San Rafael, Wild Fork"
                    value={pantryBrand}
                    onChange={(e) => setPantryBrand(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                    Porción Base
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="1"
                      value={pantryServingSize}
                      onChange={(e) => setPantryServingSize(Math.max(1, Number(e.target.value)))}
                      className="w-20 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-zinc-900 dark:text-white font-bold outline-none"
                    />
                    <select
                      value={pantryServingUnit}
                      onChange={(e) => setPantryServingUnit(e.target.value)}
                      className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-zinc-900 dark:text-white outline-none"
                    >
                      <option value="g">gramos (g)</option>
                      <option value="ml">mililitros (ml)</option>
                      <option value="pza">pieza (pza)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Macros */}
              <div className="bg-zinc-50 dark:bg-zinc-800/60 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-700/80 space-y-3">
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">
                  Información Nutrimental por {pantryServingSize} {pantryServingUnit}
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block mb-1">
                      Calorías (kcal) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      placeholder="ej. 240"
                      value={pantryCalories}
                      onChange={(e) => setPantryCalories(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2 text-xs font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-blue-600 dark:text-blue-400 block mb-1">
                      Proteína (g)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder="0"
                      value={pantryProtein}
                      onChange={(e) => setPantryProtein(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2 text-xs font-bold text-blue-600 dark:text-blue-400 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-amber-600 dark:text-amber-400 block mb-1">
                      Carbs (g)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder="0"
                      value={pantryCarbs}
                      onChange={(e) => setPantryCarbs(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2 text-xs font-bold text-amber-600 dark:text-amber-400 outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-rose-500 block mb-1">
                      Grasa (g)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder="0"
                      value={pantryFat}
                      onChange={(e) => setPantryFat(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2 text-xs font-bold text-rose-500 outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                </div>

                <div className="pt-1 max-w-[200px]">
                  <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 block mb-1">
                    🌾 Fibra dietética (g)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="0"
                    value={pantryFiber}
                    onChange={(e) => setPantryFiber(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2 text-xs font-bold text-teal-600 dark:text-teal-400 outline-none"
                  />
                </div>
              </div>

              {pantryError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-700 dark:text-red-300">
                  {pantryError}
                </div>
              )}

              {/* Botones de acción */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsPantryFoodModalOpen(false);
                    setEditingPantryFoodId(null);
                    setPantryBarcode(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPantryFood || !pantryName.trim() || pantryCalories === ''}
                  className="flex-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2"
                >
                  {savingPantryFood ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{editingPantryFoodId ? 'Guardando Cambios...' : 'Guardando en Despensa...'}</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{editingPantryFoodId ? 'Guardar Cambios' : 'Guardar en Despensa'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ESCÁNER DE CÓDIGOS DE BARRAS (PARA DESPENSA Y RECETAS) */}
      <BarcodeScannerModal
        isOpen={isBarcodeScannerOpen}
        onClose={() => setIsBarcodeScannerOpen(false)}
        onFoodSelected={(food) => {
          if (barcodeScannerTarget === 'pantry') {
            setPantryName(food.name || '');
            setPantryBrand(food.brand || '');
            setPantryServingSize(food.serving_size_g || 100);
            setPantryServingUnit(food.serving_unit || 'g');
            setPantryCalories(food.calories);
            setPantryProtein(food.protein_g);
            setPantryCarbs(food.carbs_g);
            setPantryFat(food.fat_g);
            setPantryFiber(Number((food as any).fiber_g || 0));
            setPantryBarcode(food.barcode || null);
            setIsPantryFoodModalOpen(true);
          } else {
            handleAddIngredientFromFood(food);
          }
          setIsBarcodeScannerOpen(false);
        }}
      />
    </div>
  );
}
