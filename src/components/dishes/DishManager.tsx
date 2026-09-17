'use client';

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { Dish, Food, MealType, FrequencyType } from '@/types/database';
import NutritionFactLabel from '@/components/nutrition/NutritionFactLabel';
import RecipeDetailModal from '@/components/dishes/RecipeDetailModal';
import RecipeImportModal from '@/components/dishes/RecipeImportModal';
import BarcodeScannerModal from '@/components/scanner/BarcodeScannerModal';
import { STARTER_RECIPES } from '@/lib/data/starterRecipes';

export default function DishManager() {
  const { user, partner } = useAuth();
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);

  // Pestañas principales: 'my-dishes' o 'library'
  const [activeTab, setActiveTab] = useState<'my-dishes' | 'library'>('my-dishes');

  // Modal Ver Receta con Escalador y Pasos
  const [selectedRecipeForModal, setSelectedRecipeForModal] = useState<Dish | null>(null);

  // Modal Crear Platillo
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [dishName, setDishName] = useState('');
  const [dishDescription, setDishDescription] = useState('');
  const [dishCategory, setDishCategory] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack' | 'general'>('lunch');
  const [totalServings, setTotalServings] = useState(1);
  const [servingName, setServingName] = useState('porción (1 plato)');
  const [isShared, setIsShared] = useState(true);
  const [prepTime, setPrepTime] = useState<number>(10);
  const [cookTime, setCookTime] = useState<number>(15);
  const [instructionsText, setInstructionsText] = useState('');

  // Lista de ingredientes en creación
  const [ingredients, setIngredients] = useState<
    Array<{
      food_id: string | null;
      ingredient_name: string;
      amount_g: number;
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

  // Modal Hub de Importación de Recetas
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Modal Ver Tabla Nutrimental
  const [selectedDishForNutrition, setSelectedDishForNutrition] = useState<Dish | null>(null);

  // Modal Programar Frecuencia
  const [selectedDishForSchedule, setSelectedDishForSchedule] = useState<Dish | null>(null);
  const [freqType, setFreqType] = useState<FrequencyType>('weekdays');
  const [scheduleMealType, setScheduleMealType] = useState<MealType>('lunch');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [scheduleMsg, setScheduleMsg] = useState<string | null>(null);

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

  useEffect(() => {
    fetchDishes();
  }, []);

  const handleSearchFoods = async (q: string) => {
    setSearchFoodQuery(q);
    if (!q.trim()) {
      setFoodResults([]);
      return;
    }
    setSearchingFood(true);
    try {
      const res = await fetch(`/api/foods/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setFoodResults(data.foods || []);
      }
    } finally {
      setSearchingFood(false);
    }
  };

  const handleAddIngredientFromFood = (food: Food) => {
    const defaultGrams = food.serving_size_g || 100;
    const ratio = defaultGrams / (food.serving_size_g || 100);

    setIngredients((prev) => [
      ...prev,
      {
        food_id: food.id,
        ingredient_name: food.name,
        amount_g: defaultGrams,
        calories: Math.round(food.calories * ratio),
        protein_g: Number((food.protein_g * ratio).toFixed(1)),
        carbs_g: Number((food.carbs_g * ratio).toFixed(1)),
        fat_g: Number((food.fat_g * ratio).toFixed(1)),
        fiber_g: 0,
        sodium_mg: 0,
      },
    ]);
    setSearchFoodQuery('');
    setFoodResults([]);
  };

  const handleUpdateIngredientGrams = (index: number, newGrams: number) => {
    setIngredients((prev) => {
      const copy = [...prev];
      const item = copy[index];
      const factor = newGrams / (item.amount_g || 1);
      copy[index] = {
        ...item,
        amount_g: newGrams,
        calories: Math.round(item.calories * factor),
        protein_g: Number((item.protein_g * factor).toFixed(1)),
        carbs_g: Number((item.carbs_g * factor).toFixed(1)),
        fat_g: Number((item.fat_g * factor).toFixed(1)),
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
  const previewServings = Math.max(1, totalServings);

  const handleCreateDish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dishName.trim() || ingredients.length === 0) return;

    const instructions = instructionsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const res = await fetch('/api/dishes', {
        method: 'POST',
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
        setDishName('');
        setDishDescription('');
        setInstructionsText('');
        setIngredients([]);
      }
    } catch {
      // Ignorar
    }
  };

  const handleCloneTemplate = async (template: Dish) => {
    try {
      const res = await fetch('/api/dishes/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: template.id }),
      });

      if (res.ok) {
        await fetchDishes();
        setSelectedRecipeForModal(null);
        setActiveTab('my-dishes');
        alert(`¡"${template.name}" fue clonada con éxito a Mis Platillos!`);
      }
    } catch {
      // Ignorar
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
    if (!selectedDishForSchedule) return;
    try {
      const res = await fetch('/api/dishes/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dish_id: selectedDishForSchedule.id,
          meal_type: scheduleMealType,
          frequency_type: freqType,
          days_of_week: selectedDays,
          batch_total_servings: selectedDishForSchedule.total_servings,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setScheduleMsg(data.message);
        setTimeout(() => {
          setSelectedDishForSchedule(null);
          setScheduleMsg(null);
        }, 2000);
      }
    } catch {
      // Ignorar
    }
  };

  const handleLogPortionToday = async (dish: Dish, count = 1) => {
    try {
      const res = await fetch('/api/food-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: new Date().toISOString().split('T')[0],
          meal_type: dish.category === 'general' ? 'lunch' : dish.category,
          food_id: null,
          food_name: `${dish.name} (${count} ${dish.serving_name || 'porción'})`,
          amount_g: dish.total_weight_g ? Math.round((dish.total_weight_g / dish.total_servings) * count) : 250,
          calories: Math.round(dish.calories_per_serving * count),
          protein_g: Number((dish.protein_per_serving * count).toFixed(1)),
          carbs_g: Number((dish.carbs_per_serving * count).toFixed(1)),
          fat_g: Number((dish.fat_per_serving * count).toFixed(1)),
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
      {/* 1. Encabezado con Botones de Creación e Importación */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
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

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsImportOpen(true)}
              className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/50 dark:to-teal-950/50 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 hover:border-emerald-500 text-xs font-bold px-3 py-2 rounded-xl transition shadow-xs"
              title="Importar por URL, foto de libro, captura de redes, buscador público o texto"
            >
              <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Importar Receta</span>
            </button>

            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-2 rounded-xl shadow-xs transition shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Platillo</span>
            </button>
          </div>
        </div>

        {/* Pestañas: Mis Platillos vs Biblioteca Curada */}
        <div className="flex bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-2xl">
          <button
            onClick={() => setActiveTab('my-dishes')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'my-dishes'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-white'
            }`}
          >
            <ChefHat className="w-4 h-4" />
            <span>Mis Platillos ({dishes.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('library')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'library'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4 text-emerald-500" />
            <span>Biblioteca Curada ({STARTER_RECIPES.length})</span>
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
                Puedes explorar la pestaña <strong>&ldquo;Biblioteca Curada&rdquo;</strong> y clonar recetas deliciosas ya calculadas con 1 solo clic.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {dishes.map((dish) => (
                <div
                  key={dish.id}
                  className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3 hover:border-emerald-500/40 transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4
                          onClick={() => setSelectedRecipeForModal(dish)}
                          className="text-sm font-bold text-zinc-900 dark:text-white hover:text-emerald-600 cursor-pointer transition"
                        >
                          {dish.name}
                        </h4>
                        {dish.is_shared_with_partner && (
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
                        Rinde {dish.total_servings} porc.
                      </span>
                      <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                        {dish.total_calories} kcal totales
                      </span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-semibold flex items-center gap-0.5">
                        <span>Ver receta y escalador</span>
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>

                  {/* Botones de acción */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      onClick={() => setSelectedDishForNutrition(dish)}
                      className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition"
                    >
                      <Eye className="w-3.5 h-3.5 text-zinc-500" />
                      <span>Tabla Nutrimental</span>
                    </button>

                    <button
                      onClick={() => setSelectedDishForSchedule(dish)}
                      className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Programar</span>
                    </button>

                    <button
                      onClick={() => handleLogPortionToday(dish, 1)}
                      className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition ml-auto shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Comer 1 porción hoy</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* 3. PESTAÑA: BIBLIOTECA CURADA (STARTER RECIPES) */}
      {activeTab === 'library' && (
        <div className="space-y-3">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-2.5 text-xs text-emerald-800 dark:text-emerald-200">
            <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong className="font-bold">Recetas individuales listas:</strong> Cada receta está calculada por porción individual. Haz clic en cualquiera para ver los pasos, escalar a 2 o 4 porciones, o clonarla a tus platillos.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {STARTER_RECIPES.map((recipe) => (
              <div
                key={recipe.id}
                onClick={() => setSelectedRecipeForModal(recipe)}
                className="bg-white dark:bg-zinc-900 rounded-3xl p-4 sm:p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm hover:border-emerald-500 transition cursor-pointer flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded-full">
                      {recipe.category === 'breakfast'
                        ? 'Desayuno'
                        : recipe.category === 'lunch'
                        ? 'Comida'
                        : recipe.category === 'dinner'
                        ? 'Cena'
                        : 'Snack'}
                    </span>

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
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCloneTemplate(recipe);
                      }}
                      className="text-[11px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-xl font-bold transition flex items-center gap-1"
                      title="Clonar a Mis Platillos en 1 clic"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Clonar</span>
                    </button>

                    <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 flex items-center gap-0.5">
                      <span>Ver y Escalar</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </div>
            ))}
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
            setSelectedDishForSchedule(dish);
          }}
          onLogToday={handleLogPortionToday}
          onCloneTemplate={handleCloneTemplate}
        />
      )}

      {/* HUB DE IMPORTACIÓN DE RECETAS (5 MÉTODOS) */}
      <RecipeImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onRecipeImported={handleRecipeImported}
        onOpenLibraryTab={() => setActiveTab('library')}
      />

      {/* MODAL CREAR NUEVO PLATILLO MANUAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-5 max-h-[90vh] flex flex-col border border-zinc-200 dark:border-zinc-800 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <ChefHat className="w-5 h-5 text-emerald-500" />
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  Crear Nuevo Platillo / Receta
                </h3>
              </div>
              <button onClick={() => setIsCreateOpen(false)} className="text-zinc-400 hover:text-zinc-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDish} className="flex-1 overflow-y-auto py-4 space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Nombre del Platillo
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ej. Arroz con Pollo al Curry y Verduras"
                    value={dishName}
                    onChange={(e) => setDishName(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-zinc-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                      Categoría
                    </label>
                    <select
                      value={dishCategory}
                      onChange={(e) => setDishCategory(e.target.value as any)}
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2 text-xs text-zinc-900 dark:text-white"
                    >
                      <option value="breakfast">Desayuno</option>
                      <option value="lunch">Comida</option>
                      <option value="dinner">Cena</option>
                      <option value="snack">Snack</option>
                      <option value="general">General</option>
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
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2 text-xs text-zinc-900 dark:text-white font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                      Tiempo Prep (min)
                    </label>
                    <input
                      type="number"
                      value={prepTime}
                      onChange={(e) => setPrepTime(Number(e.target.value))}
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2 text-xs text-zinc-900 dark:text-white"
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
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2 text-xs text-zinc-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* SECCIÓN INGREDIENTES */}
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
                    Ingredientes ({ingredients.length})
                  </span>
                  <span className="text-xs text-zinc-400">Gramos por porción base</span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Buscar pechuga, arroz, aceite, avena..."
                      value={searchFoodQuery}
                      onChange={(e) => handleSearchFoods(e.target.value)}
                      className="flex-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2 text-xs text-zinc-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setIsBarcodeScannerOpen(true)}
                      title="Escanear código de barras del producto"
                      className="px-2.5 py-2 bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 rounded-xl text-xs font-semibold hover:bg-teal-100 transition flex items-center gap-1 shrink-0"
                    >
                      <Barcode className="w-4 h-4" />
                      <span className="hidden sm:inline">Código</span>
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
                          className="w-full p-2 text-left hover:bg-emerald-50 dark:hover:bg-emerald-950/30 flex justify-between items-center text-xs"
                        >
                          <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate pr-2">{f.name}</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 shrink-0">{f.calories} kcal/100g</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {ingredients.length > 0 && (
                  <div className="space-y-2">
                    {ingredients.map((ing, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-zinc-50 dark:bg-zinc-800/80 rounded-2xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-between text-xs"
                      >
                        <div className="flex-1 pr-2">
                          <span className="font-semibold text-zinc-900 dark:text-white block truncate">
                            {ing.ingredient_name}
                          </span>
                          <span className="text-[11px] text-zinc-400">
                            {ing.calories} kcal • P: {ing.protein_g}g • C: {ing.carbs_g}g • G: {ing.fat_g}g
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="1"
                              value={ing.amount_g}
                              onChange={(e) => handleUpdateIngredientGrams(idx, Number(e.target.value))}
                              className="w-16 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg p-1 text-center font-bold text-xs"
                            />
                            <span className="text-zinc-400 text-[10px]">g</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveIngredient(idx)}
                            className="text-zinc-400 hover:text-red-500 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* PASOS DE PREPARACIÓN */}
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block">
                  Pasos de Preparación (uno por renglón)
                </label>
                <textarea
                  rows={4}
                  placeholder={`1. Sazonar el pollo con sal y limón...
2. Saltear a fuego medio por 8 minutos...
3. Servir con la guarnición caliente...`}
                  value={instructionsText}
                  onChange={(e) => setInstructionsText(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-zinc-900 dark:text-white leading-relaxed"
                />
              </div>

              {/* RESUMEN EN VIVO POR PORCIÓN */}
              {ingredients.length > 0 && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-xs space-y-1">
                  <div className="flex justify-between font-bold text-emerald-800 dark:text-emerald-300">
                    <span>Resultado por porción:</span>
                    <span>{Math.round(previewTotalCals / previewServings)} kcal</span>
                  </div>
                  <div className="flex justify-between text-zinc-600 dark:text-zinc-400 text-[11px]">
                    <span>Proteína: {((previewTotalProt / previewServings)).toFixed(1)}g</span>
                    <span>Carbos: {((previewTotalCarbs / previewServings)).toFixed(1)}g</span>
                    <span>Grasas: {((previewTotalFat / previewServings)).toFixed(1)}g</span>
                  </div>
                </div>
              )}

              {partner && (
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="shareDish"
                    checked={isShared}
                    onChange={(e) => setIsShared(e.target.checked)}
                    className="rounded accent-emerald-600 w-4 h-4"
                  />
                  <label htmlFor="shareDish" className="text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    Compartir en el hogar para meal prep conjunto (roomie / duo)
                  </label>
                </div>
              )}

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-600 dark:text-zinc-400"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={ingredients.length === 0}
                  className="flex-2 py-2.5 rounded-xl bg-emerald-600 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-emerald-600/20"
                >
                  Guardar Platillo
                </button>
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
                  desc: `Distribuir las ${selectedDishForSchedule.total_servings} porciones en los próximos días hábiles.`,
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
                className="flex-2 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold shadow-md shadow-emerald-600/20"
              >
                Aplicar al Plan Semanal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ESCÁNER DE CÓDIGOS DE BARRAS (PARA INGREDIENTES) */}
      <BarcodeScannerModal
        isOpen={isBarcodeScannerOpen}
        onClose={() => setIsBarcodeScannerOpen(false)}
        onFoodSelected={(food) => {
          handleAddIngredientFromFood(food);
          setIsBarcodeScannerOpen(false);
        }}
      />
    </div>
  );
}
