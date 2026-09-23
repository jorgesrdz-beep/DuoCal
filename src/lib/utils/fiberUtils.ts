import { Food } from '@/types/database';
import { WHOLE_FOODS } from '@/lib/data/wholeFoods';

/**
 * Normaliza una cadena de texto para comparación:
 * minúsculas, sin acentos/diacríticos y sin paréntesis auxiliares.
 */
export function normalizeFoodText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
    .replace(/\(.*?\)/g, '') // Quitar paréntesis como (2 pzas) o (35 ml)
    .replace(/[^a-z0-9\s]/g, ' ') // Quitar signos de puntuación
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Diccionario de referencia rápida de fibra (g por 100g de alimento)
 * para alimentos e ingredientes comunes con aporte relevante de fibra.
 */
const COMMON_FIBER_MAP_PER_100G: Array<{ keywords: string[]; fiberPer100g: number }> = [
  { keywords: ['chia'], fiberPer100g: 34.4 },
  { keywords: ['linaza'], fiberPer100g: 27.3 },
  { keywords: ['almendra', 'almendras'], fiberPer100g: 12.5 },
  { keywords: ['avena'], fiberPer100g: 10.6 },
  { keywords: ['coco rallado', 'coco deshidratado'], fiberPer100g: 9.0 },
  { keywords: ['cacahuate', 'cacahuates', 'mani'], fiberPer100g: 8.5 },
  { keywords: ['lenteja', 'lentejas'], fiberPer100g: 7.9 },
  { keywords: ['garbanzo', 'garbanzos'], fiberPer100g: 7.6 },
  { keywords: ['nuez', 'nueces'], fiberPer100g: 6.7 },
  { keywords: ['aguacate', 'guacamole', 'avocado'], fiberPer100g: 6.7 },
  { keywords: ['frijol', 'frijoles'], fiberPer100g: 6.4 },
  { keywords: ['crema de cacahuate', 'crema de mani', 'mantequilla de mani'], fiberPer100g: 6.0 },
  { keywords: ['pan integral', 'tortilla de trigo integral'], fiberPer100g: 6.0 },
  { keywords: ['tortilla de maiz', 'tortilla maiz', 'tostada'], fiberPer100g: 5.0 },
  { keywords: ['frambuesa', 'frambuesas', 'zarzamora', 'zarzamoras'], fiberPer100g: 6.5 },
  { keywords: ['zanahoria', 'zanahorias'], fiberPer100g: 2.8 },
  { keywords: ['quinoa', 'quinua'], fiberPer100g: 2.8 },
  { keywords: ['brocoli'], fiberPer100g: 2.6 },
  { keywords: ['platano', 'banana', 'banano'], fiberPer100g: 2.6 },
  { keywords: ['manzana'], fiberPer100g: 2.4 },
  { keywords: ['arandano', 'arandanos', 'blueberry', 'blueberries'], fiberPer100g: 2.4 },
  { keywords: ['espinaca', 'espinacas'], fiberPer100g: 2.2 },
  { keywords: ['pimiento', 'pimiento morron', 'chile pimiento'], fiberPer100g: 2.1 },
  { keywords: ['fresa', 'fresas'], fiberPer100g: 2.0 },
  { keywords: ['arroz integral'], fiberPer100g: 1.8 },
  { keywords: ['cebolla'], fiberPer100g: 1.7 },
  { keywords: ['ejote', 'ejotes'], fiberPer100g: 2.7 },
  { keywords: ['naranja'], fiberPer100g: 2.4 },
  { keywords: ['kiwi'], fiberPer100g: 3.0 },
  { keywords: ['tomate', 'jitomate'], fiberPer100g: 1.2 },
  { keywords: ['calabacita', 'calabacin', 'zucchini'], fiberPer100g: 1.1 },
  { keywords: ['champinon', 'champinones', 'setas', 'hongo', 'hongos'], fiberPer100g: 1.0 },
  { keywords: ['pepino'], fiberPer100g: 0.5 },
  { keywords: ['arroz', 'arroz blanco'], fiberPer100g: 0.4 },
];

/**
 * Resuelve y calcula la fibra en gramos para un ingrediente específico.
 * 
 * Si el ingrediente ya cuenta con `fiber_g > 0`, se respeta su valor.
 * De lo contrario, busca en la lista de alimentos (base de datos o Whole Foods)
 * y finalmente en el diccionario de referencia de fibra.
 */
export function resolveIngredientFiber(
  ingredient: {
    food_id?: string | null;
    ingredient_name?: string | null;
    amount_g?: number | null;
    fiber_g?: number | null;
  },
  availableFoods?: Food[]
): number {
  const currentFiber = Number(ingredient.fiber_g);
  if (!isNaN(currentFiber) && currentFiber > 0) {
    return Number(currentFiber.toFixed(1));
  }

  const weight = Math.max(0, Number(ingredient.amount_g) || 100);
  if (weight === 0) return 0;

  // 1. Búsqueda por food_id en los alimentos disponibles
  if (ingredient.food_id) {
    const list = availableFoods && availableFoods.length > 0 ? availableFoods : WHOLE_FOODS;
    const found = list.find((f) => f.id === ingredient.food_id);
    if (found && Number(found.fiber_g) > 0) {
      const fiberPer100 = (Number(found.fiber_g) / (Number(found.serving_size_g) || 100)) * 100;
      return Number(((fiberPer100 * weight) / 100).toFixed(1));
    }
  }

  const rawName = ingredient.ingredient_name || '';
  if (!rawName.trim()) return 0;

  const normalized = normalizeFoodText(rawName);

  // 2. Búsqueda por nombre en WHOLE_FOODS y availableFoods
  const allFoods = [...(availableFoods || []), ...WHOLE_FOODS];
  for (const food of allFoods) {
    if (!food.fiber_g || Number(food.fiber_g) <= 0) continue;
    const normFood = normalizeFoodText(food.name);
    if (normFood && (normalized === normFood || normalized.includes(normFood) || normFood.includes(normalized))) {
      const fiberPer100 = (Number(food.fiber_g) / (Number(food.serving_size_g) || 100)) * 100;
      return Number(((fiberPer100 * weight) / 100).toFixed(1));
    }
  }

  // 3. Búsqueda en el diccionario de palabras clave comunes
  for (const entry of COMMON_FIBER_MAP_PER_100G) {
    for (const kw of entry.keywords) {
      if (normalized.includes(kw)) {
        return Number(((entry.fiberPer100g * weight) / 100).toFixed(1));
      }
    }
  }

  return 0;
}

/**
 * Resuelve y recalcula la fibra total y por porción de un platillo a partir
 * de sus ingredientes y valores previos.
 */
export function recalculateDishFiber(dish: {
  total_servings?: number | null;
  total_fiber_g?: number | null;
  fiber_per_serving?: number | null;
  ingredients?: Array<{
    food_id?: string | null;
    ingredient_name?: string | null;
    amount_g?: number | null;
    fiber_g?: number | null;
  }> | null;
}, availableFoods?: Food[]): {
  total_fiber_g: number;
  fiber_per_serving: number;
  ingredients: Array<any>;
} {
  const servings = Math.max(0.5, Number(dish.total_servings) || 1);
  const ings = dish.ingredients || [];

  let sumFiber = 0;
  const processedIngredients = ings.map((ing) => {
    const fiber = resolveIngredientFiber(ing, availableFoods);
    sumFiber += fiber;
    return {
      ...ing,
      fiber_g: fiber,
    };
  });

  let totalFiber = Number(sumFiber.toFixed(1));

  // Si los ingredientes sumaron 0 pero el platillo ya tenía fibra registrada previamente
  if (totalFiber === 0 && dish.total_fiber_g && Number(dish.total_fiber_g) > 0) {
    totalFiber = Number(Number(dish.total_fiber_g).toFixed(1));
  } else if (totalFiber === 0 && dish.fiber_per_serving && Number(dish.fiber_per_serving) > 0) {
    totalFiber = Number((Number(dish.fiber_per_serving) * servings).toFixed(1));
  }

  const fiberPerServing = Number((totalFiber / servings).toFixed(1));

  return {
    total_fiber_g: totalFiber,
    fiber_per_serving: fiberPerServing,
    ingredients: processedIngredients,
  };
}
