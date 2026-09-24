import { Profile, Household, Goal, Food, MealPlanItem, FoodLog, HealthMetric, ShoppingListItem, PhotoComparison, Dish, DishIngredient, ConsumptionSchedule, WaterLog } from '@/types/database';
import { hashPin } from '@/lib/auth/pin';
import { WHOLE_FOODS } from '@/lib/data/wholeFoods';
import { STARTER_RECIPES } from '@/lib/data/starterRecipes';

export interface InMemoryDB {
  households: Household[];
  profiles: (Profile & { pin_hash: string; session_token?: string })[];
  goals: Goal[];
  foods: Food[];
  meal_plans: MealPlanItem[];
  food_logs: FoodLog[];
  health_metrics: HealthMetric[];
  shopping_list_items: ShoppingListItem[];
  photo_comparisons: PhotoComparison[];
  dishes: Dish[];
  dish_ingredients: DishIngredient[];
  consumption_schedules: ConsumptionSchedule[];
  water_logs: WaterLog[];
}

import { isServiceRoleConfigured, supabaseAdmin } from '@/lib/supabase/admin';

// Global variable for development hot-reloads
const globalForDb = global as unknown as { duoCalDb?: InMemoryDB };

export async function getDb(): Promise<InMemoryDB> {
  if (isServiceRoleConfigured) {
    try {
      const [
        { data: households },
        { data: profiles },
        { data: goals },
        { data: foods },
        { data: meal_plans },
        { data: food_logs },
        { data: health_metrics },
        { data: shopping_list_items },
        { data: photo_comparisons },
        { data: dishes },
        { data: dish_ingredients },
        { data: consumption_schedules },
      ] = await Promise.all([
        supabaseAdmin.from('households').select('*'),
        supabaseAdmin.from('profiles').select('*'),
        supabaseAdmin.from('goals').select('*'),
        supabaseAdmin.from('foods').select('*'),
        supabaseAdmin.from('meal_plans').select('*'),
        supabaseAdmin.from('food_logs').select('*'),
        supabaseAdmin.from('health_metrics').select('*'),
        supabaseAdmin.from('shopping_list_items').select('*'),
        supabaseAdmin.from('photo_comparisons').select('*'),
        supabaseAdmin.from('dishes').select('*'),
        supabaseAdmin.from('dish_ingredients').select('*'),
        supabaseAdmin.from('consumption_schedules').select('*'),
      ]);

      const mergedFoods: Food[] = [...WHOLE_FOODS];
      if (foods && Array.isArray(foods)) {
        for (const f of foods) {
          const idx = mergedFoods.findIndex((wf) => wf.id === f.id || wf.name.toLowerCase().trim() === f.name.toLowerCase().trim());
          if (idx !== -1) {
            const wfFiber = mergedFoods[idx].fiber_g;
            mergedFoods[idx] = {
              ...mergedFoods[idx],
              ...f,
              fiber_g: (f.fiber_g !== undefined && f.fiber_g !== null && Number(f.fiber_g) > 0)
                ? Number(f.fiber_g)
                : (wfFiber !== undefined ? wfFiber : (f.fiber_g || 0)),
            };
          } else {
            mergedFoods.push(f);
          }
        }
      }

      const hydratedDishes = (dishes || []).map((d) => ({
        ...d,
        ingredients: (dish_ingredients || []).filter((di) => di.dish_id === d.id),
      }));

      let liveWaterLogs: WaterLog[] = [];
      try {
        const { data: waterLogs, error: waterErr } = await supabaseAdmin.from('water_logs').select('*');
        if (!waterErr && waterLogs) {
          liveWaterLogs = waterLogs;
        }
      } catch {
        // Fallback resiliente si la tabla aún no se ha creado en Supabase
      }

      return {
        households: households || [],
        profiles: profiles || [],
        goals: goals || [],
        foods: mergedFoods,
        meal_plans: meal_plans || [],
        food_logs: food_logs || [],
        health_metrics: health_metrics || [],
        shopping_list_items: shopping_list_items || [],
        photo_comparisons: photo_comparisons || [],
        dishes: hydratedDishes,
        dish_ingredients: dish_ingredients || [],
        consumption_schedules: consumption_schedules || [],
        water_logs: liveWaterLogs,
      };
    } catch (err) {
      console.error('Error fetching live data from Supabase:', err);
    }
  }

  if (!globalForDb.duoCalDb) {
    globalForDb.duoCalDb = {
      households: [],
      profiles: [],
      goals: [],
      foods: [
        {
          id: 'f-1',
          user_id: null,
          name: 'Pechuga de pollo a la plancha',
          brand: 'Genérico',
          serving_size_g: 100,
          serving_unit: 'g',
          calories: 165,
          protein_g: 31,
          carbs_g: 0,
          fat_g: 3.6,
          source: 'manual',
          barcode: null,
          is_verified: true,
          created_at: new Date().toISOString(),
        },
        {
          id: 'f-2',
          user_id: null,
          name: 'Arroz blanco cocido',
          brand: 'Genérico',
          serving_size_g: 100,
          serving_unit: 'g',
          calories: 130,
          protein_g: 2.7,
          carbs_g: 28,
          fat_g: 0.3,
          source: 'manual',
          barcode: null,
          is_verified: true,
          created_at: new Date().toISOString(),
        },
        {
          id: 'f-3',
          user_id: null,
          name: 'Huevos enteros (2 piezas)',
          brand: 'San Juan',
          serving_size_g: 100,
          serving_unit: 'g',
          calories: 143,
          protein_g: 12.6,
          carbs_g: 0.7,
          fat_g: 9.5,
          source: 'manual',
          barcode: '750100000001',
          is_verified: true,
          created_at: new Date().toISOString(),
        },
        {
          id: 'f-4',
          user_id: null,
          name: 'Avena en hojuelas',
          brand: 'Quaker',
          serving_size_g: 40,
          serving_unit: 'g',
          calories: 150,
          protein_g: 5,
          carbs_g: 27,
          fat_g: 2.5,
          source: 'openfoodfacts',
          barcode: '750100000002',
          is_verified: true,
          created_at: new Date().toISOString(),
        },
        {
          id: 'food-quaker-platano-nuez',
          user_id: null,
          name: 'Avena Sin Azúcar Plátano Y Nuez',
          brand: 'Quaker',
          serving_size_g: 40,
          serving_unit: 'g',
          calories: 363, // 145 kcal por sobre (40g)
          protein_g: 12.5, // 5.0g por sobre
          carbs_g: 58.0, // 23.2g por sobre
          fat_g: 9.0, // 3.6g por sobre
          fiber_g: 8.0, // 3.2g por sobre
          source: 'openfoodfacts',
          barcode: '7500478039616',
          is_verified: true,
          created_at: new Date().toISOString(),
        },
        {
          id: 'food-quaker-arandano',
          user_id: null,
          name: 'Avena Integral Instant Sabor Sin Azúcar Arándano',
          brand: 'Quaker',
          serving_size_g: 40,
          serving_unit: 'g',
          calories: 323, // 129 kcal por sobre (40g)
          protein_g: 12.0, // 4.8g por sobre
          carbs_g: 56.5, // 22.6g por sobre
          fat_g: 5.5, // 2.2g por sobre
          fiber_g: 7.5, // 3.0g por sobre
          source: 'openfoodfacts',
          barcode: '7500478039630',
          is_verified: true,
          created_at: new Date().toISOString(),
        },
        {
          id: 'food-quaker-manzana-canela',
          user_id: null,
          name: 'Avena Integral Instant Sabor Sin Azúcar Manzana y Canela',
          brand: 'Quaker',
          serving_size_g: 40,
          serving_unit: 'g',
          calories: 325, // 130 kcal por sobre (40g)
          protein_g: 12.0, // 4.8g por sobre
          carbs_g: 57.5, // 23.0g por sobre
          fat_g: 5.5, // 2.2g por sobre
          fiber_g: 7.8, // 3.1g por sobre
          source: 'openfoodfacts',
          barcode: '7500478039623',
          is_verified: true,
          created_at: new Date().toISOString(),
        },
        {
          id: 'f-5',
          user_id: null,
          name: 'Yogurt Griego sin azúcar',
          brand: 'Chobani / Fage',
          serving_size_g: 150,
          serving_unit: 'g',
          calories: 90,
          protein_g: 15,
          carbs_g: 5,
          fat_g: 0,
          source: 'manual',
          barcode: '750100000003',
          is_verified: true,
          created_at: new Date().toISOString(),
        },
      ],
      meal_plans: [],
      food_logs: [],
      health_metrics: [],
      shopping_list_items: [],
      photo_comparisons: [],
      water_logs: [],
      dishes: [
        {
          id: 'd0000000-0000-0000-0000-000000000001',
          user_id: null,
          household_id: null,
          name: 'Bowl de Pollo, Arroz y Aguacate (Meal Prep)',
          description: 'Guisado de pechuga con especias y arroz al vapor, dividido en 4 porciones iguales.',
          category: 'lunch',
          total_servings: 4,
          total_weight_g: 1200,
          serving_name: 'recipiente (300g)',
          is_shared_with_partner: true,
          is_starter_template: true,
          total_calories: 1840,
          total_protein_g: 196,
          total_carbs_g: 140,
          total_fat_g: 44,
          total_fiber_g: 16,
          calories_per_serving: 460,
          protein_per_serving: 49,
          carbs_per_serving: 35,
          fat_per_serving: 11,
          fiber_per_serving: 4,
          created_at: new Date().toISOString(),
        },
        {
          id: 'd0000000-0000-0000-0000-000000000002',
          user_id: null,
          household_id: null,
          name: 'Overnight Oats con Proteína y Berries',
          description: 'Avena reposada en yogurt griego con proteína y frutos rojos.',
          category: 'breakfast',
          total_servings: 2,
          total_weight_g: 500,
          serving_name: 'frasco (250g)',
          is_shared_with_partner: true,
          is_starter_template: true,
          total_calories: 680,
          total_protein_g: 58,
          total_carbs_g: 74,
          total_fat_g: 12,
          total_fiber_g: 10,
          calories_per_serving: 340,
          protein_per_serving: 29,
          carbs_per_serving: 37,
          fat_per_serving: 6,
          fiber_per_serving: 5,
          created_at: new Date().toISOString(),
        },
      ],
      dish_ingredients: [
        {
          id: 'da000000-0000-0000-0000-000000000001',
          dish_id: 'd0000000-0000-0000-0000-000000000001',
          food_id: 'f-1',
          ingredient_name: 'Pechuga de pollo a la plancha',
          amount_g: 600,
          calories: 990,
          protein_g: 186,
          carbs_g: 0,
          fat_g: 21.6,
          fiber_g: 0,
          sodium_mg: 420,
          created_at: new Date().toISOString(),
        },
        {
          id: 'da000000-0000-0000-0000-000000000002',
          dish_id: 'd0000000-0000-0000-0000-000000000001',
          food_id: 'f-2',
          ingredient_name: 'Arroz blanco cocido',
          amount_g: 500,
          calories: 650,
          protein_g: 13.5,
          carbs_g: 140,
          fat_g: 1.5,
          fiber_g: 3,
          sodium_mg: 15,
          created_at: new Date().toISOString(),
        },
        {
          id: 'da000000-0000-0000-0000-000000000003',
          dish_id: 'd0000000-0000-0000-0000-000000000001',
          food_id: null,
          ingredient_name: 'Aguacate Hass',
          amount_g: 100,
          calories: 200,
          protein_g: 2,
          carbs_g: 9,
          fat_g: 18,
          fiber_g: 7,
          sodium_mg: 7,
          created_at: new Date().toISOString(),
        },
        {
          id: 'da000000-0000-0000-0000-000000000004',
          dish_id: 'd0000000-0000-0000-0000-000000000002',
          food_id: 'f-4',
          ingredient_name: 'Avena en hojuelas',
          amount_g: 80,
          calories: 300,
          protein_g: 10,
          carbs_g: 54,
          fat_g: 5,
          fiber_g: 8,
          sodium_mg: 4,
          created_at: new Date().toISOString(),
        },
        {
          id: 'da000000-0000-0000-0000-000000000005',
          dish_id: 'd0000000-0000-0000-0000-000000000002',
          food_id: 'f-5',
          ingredient_name: 'Yogurt Griego sin azúcar',
          amount_g: 300,
          calories: 180,
          protein_g: 30,
          carbs_g: 10,
          fat_g: 0,
          fiber_g: 0,
          sodium_mg: 100,
          created_at: new Date().toISOString(),
        },
      ],
      consumption_schedules: [],
    };
  }

  // Sincronizar y asegurar alimentos verificados de Avena Quaker en memoria
  const quakerVerifiedItems: Food[] = [
    {
      id: 'food-quaker-platano-nuez',
      user_id: null,
      name: 'Avena Sin Azúcar Plátano Y Nuez',
      brand: 'Quaker',
      serving_size_g: 40,
      serving_unit: 'g',
      calories: 363, // 145 kcal por sobre (40g)
      protein_g: 12.5, // 5.0g
      carbs_g: 58.0, // 23.2g
      fat_g: 9.0, // 3.6g
      fiber_g: 8.0, // 3.2g
      source: 'openfoodfacts',
      barcode: '7500478039616',
      is_verified: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'food-quaker-arandano',
      user_id: null,
      name: 'Avena Integral Instant Sabor Sin Azúcar Arándano',
      brand: 'Quaker',
      serving_size_g: 40,
      serving_unit: 'g',
      calories: 323, // 129 kcal por sobre (40g)
      protein_g: 12.0, // 4.8g
      carbs_g: 56.5, // 22.6g
      fat_g: 5.5, // 2.2g
      fiber_g: 7.5, // 3.0g
      source: 'openfoodfacts',
      barcode: '7500478039630',
      is_verified: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'food-quaker-manzana-canela',
      user_id: null,
      name: 'Avena Integral Instant Sabor Sin Azúcar Manzana y Canela',
      brand: 'Quaker',
      serving_size_g: 40,
      serving_unit: 'g',
      calories: 325, // 130 kcal por sobre (40g)
      protein_g: 12.0, // 4.8g
      carbs_g: 57.5, // 23.0g
      fat_g: 5.5, // 2.2g
      fiber_g: 7.8, // 3.1g
      source: 'openfoodfacts',
      barcode: '7500478039623',
      is_verified: true,
      created_at: new Date().toISOString(),
    },
  ];

  for (const qItem of quakerVerifiedItems) {
    const existingIdx = globalForDb.duoCalDb.foods.findIndex(
      (f) => f.barcode === qItem.barcode || f.id === qItem.id
    );
    if (existingIdx !== -1) {
      globalForDb.duoCalDb.foods[existingIdx] = {
        ...globalForDb.duoCalDb.foods[existingIdx],
        ...qItem,
      };
    } else {
      globalForDb.duoCalDb.foods.push(qItem);
    }
  }

  // Corregir logs existentes de estas avenas en el diario si no tenían fibra registrada
  for (const log of globalForDb.duoCalDb.food_logs) {
    const nameLower = (log.food_name || '').toLowerCase();
    if (nameLower.includes('avena')) {
      if (
        nameLower.includes('platano') ||
        nameLower.includes('plátano') ||
        log.food_id === 'food-quaker-platano-nuez' ||
        log.food_id?.includes('7500478039616')
      ) {
        if (!log.fiber_g || log.fiber_g === 0) log.fiber_g = 3.2;
        if (log.calories <= 75 && log.amount_g >= 35) {
          log.calories = 145;
          log.protein_g = 5.0;
          log.carbs_g = 23.2;
          log.fat_g = 3.6;
        }
      } else if (
        nameLower.includes('arandano') ||
        nameLower.includes('arándano') ||
        log.food_id === 'food-quaker-arandano' ||
        log.food_id?.includes('7500478039630')
      ) {
        if (!log.fiber_g || log.fiber_g === 0) log.fiber_g = 3.0;
        if (log.calories <= 35 && log.amount_g >= 35) {
          log.calories = 129;
          log.protein_g = 4.8;
          log.carbs_g = 22.6;
          log.fat_g = 2.2;
        }
      } else if (
        nameLower.includes('manzana') ||
        log.food_id === 'food-quaker-manzana-canela' ||
        log.food_id?.includes('7500478039623')
      ) {
        if (!log.fiber_g || log.fiber_g === 0) log.fiber_g = 3.1;
        if (log.calories <= 35 && log.amount_g >= 35) {
          log.calories = 130;
          log.protein_g = 4.8;
          log.carbs_g = 23.0;
          log.fat_g = 2.2;
        }
      }
    }
  }

  // Sincronizar platillos base (incluyendo los bowls de yogur griego con avena) en dishes y dish_ingredients
  for (const starter of STARTER_RECIPES) {
    const existingDishIdx = globalForDb.duoCalDb.dishes.findIndex(
      (d) => d.id === starter.id || d.name.toLowerCase().trim() === starter.name.toLowerCase().trim()
    );
    if (existingDishIdx === -1) {
      globalForDb.duoCalDb.dishes.push(starter);
      if (starter.ingredients && Array.isArray(starter.ingredients)) {
        for (const ing of starter.ingredients) {
          if (!globalForDb.duoCalDb.dish_ingredients.some((di) => di.id === ing.id)) {
            globalForDb.duoCalDb.dish_ingredients.push(ing);
          }
        }
      }
    } else {
      globalForDb.duoCalDb.dishes[existingDishIdx] = {
        ...globalForDb.duoCalDb.dishes[existingDishIdx],
        ...starter,
      };
      if (starter.ingredients && Array.isArray(starter.ingredients)) {
        for (const ing of starter.ingredients) {
          const ingIdx = globalForDb.duoCalDb.dish_ingredients.findIndex((di) => di.id === ing.id);
          if (ingIdx !== -1) {
            globalForDb.duoCalDb.dish_ingredients[ingIdx] = ing;
          } else {
            globalForDb.duoCalDb.dish_ingredients.push(ing);
          }
        }
      }
    }
  }

  return globalForDb.duoCalDb;
}

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const SUPABASE_ALLOWED_COLUMNS: Record<string, string[]> = {
  profiles: [
    'id', 'household_id', 'username', 'pin_hash', 'display_name', 'age', 'gender',
    'height_cm', 'current_weight_kg', 'activity_level', 'share_photos_with_partner',
    'webhook_token', 'failed_login_attempts', 'locked_until', 'session_token', 'created_at', 'updated_at'
  ],
  goals: [
    'id', 'user_id', 'goal_type', 'start_date', 'end_date', 'suggested_duration_weeks',
    'tdee_calculated', 'calorie_target', 'deficit_surplus_pct', 'protein_target_g',
    'carbs_target_g', 'fat_target_g', 'fiber_target_g', 'water_target_ml',
    'initial_weight_kg', 'is_active', 'notes', 'created_at'
  ],
  foods: [
    'id', 'user_id', 'name', 'brand', 'serving_size_g', 'serving_unit',
    'calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'source', 'barcode',
    'is_verified', 'created_at'
  ],
  dishes: [
    'id', 'user_id', 'household_id', 'name', 'description', 'category',
    'total_servings', 'total_weight_g', 'serving_name', 'is_shared_with_partner',
    'total_calories', 'total_protein_g', 'total_carbs_g', 'total_fat_g', 'total_fiber_g',
    'calories_per_serving', 'protein_per_serving', 'carbs_per_serving', 'fat_per_serving', 'fiber_per_serving',
    'prep_time_minutes', 'cook_time_minutes', 'instructions', 'is_starter_template', 'created_at'
  ],
  dish_ingredients: [
    'id', 'dish_id', 'food_id', 'ingredient_name', 'amount_g', 'calories',
    'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sodium_mg', 'aisle_category', 'created_at'
  ],
  meal_plans: [
    'id', 'user_id', 'week_start_date', 'day_of_week', 'meal_type', 'food_id',
    'custom_name', 'servings', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'created_at'
  ],
  food_logs: [
    'id', 'user_id', 'date', 'meal_type', 'food_id', 'food_name',
    'amount_g', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'created_at'
  ],
  shopping_list_items: [
    'id', 'household_id', 'week_start_date', 'item_name', 'quantity_text', 'category', 'is_purchased', 'created_at'
  ],
  water_logs: [
    'id', 'user_id', 'date', 'water_ml', 'created_at', 'updated_at'
  ],
};

function filterForSupabase(table: string, obj: any): any {
  const allowed = SUPABASE_ALLOWED_COLUMNS[table];
  if (!allowed) return obj;
  const filtered: Record<string, any> = {};
  for (const key of allowed) {
    if (key in obj && obj[key] !== undefined) {
      filtered[key] = obj[key];
    }
  }
  return filtered;
}

export async function insertRow(table: string, row: any): Promise<void> {
  const db = await getDb();
  if ((db as any)[table]) {
    const list = (db as any)[table];
    const existingIdx = list.findIndex((x: any) => x.id === row.id);
    if (existingIdx !== -1) {
      list[existingIdx] = row;
    } else {
      list.unshift(row);
    }
  }
  if (isServiceRoleConfigured) {
    const payload = filterForSupabase(table, row);
    const { error } = await supabaseAdmin.from(table).upsert(payload);
    if (error) {
      console.error(`Error upserting into Supabase ${table}:`, error);
      throw new Error(`Error al persistir en Supabase (${table}): ${error.message}`);
    }
  }
}

export async function updateRow(table: string, id: string, updates: any): Promise<void> {
  const db = await getDb();
  if ((db as any)[table]) {
    const list = (db as any)[table];
    const idx = list.findIndex((x: any) => x.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...updates };
    }
  }
  if (isServiceRoleConfigured) {
    const payload = filterForSupabase(table, updates);
    if (Object.keys(payload).length > 0) {
      const { error } = await supabaseAdmin.from(table).update(payload).eq('id', id);
      if (error) {
        if (error.message && error.message.includes('fiber_g')) {
          const fallback = { ...payload };
          delete fallback.fiber_g;
          const { error: err2 } = await supabaseAdmin.from(table).update(fallback).eq('id', id);
          if (err2) {
            console.error(`Error updating in Supabase ${table}:`, err2);
            throw new Error(`Error al actualizar en Supabase (${table}): ${err2.message}`);
          }
        } else {
          console.error(`Error updating in Supabase ${table}:`, error);
          throw new Error(`Error al actualizar en Supabase (${table}): ${error.message}`);
        }
      }
    }
  }
}

export async function deleteRow(table: string, id: string): Promise<void> {
  const db = await getDb();
  if ((db as any)[table]) {
    (db as any)[table] = (db as any)[table].filter((x: any) => x.id !== id);
  }
  if (isServiceRoleConfigured) {
    const { error } = await supabaseAdmin.from(table).delete().eq('id', id);
    if (error) {
      console.error(`Error deleting from Supabase ${table}:`, error);
      throw new Error(`Error al eliminar en Supabase (${table}): ${error.message}`);
    }
  }
}

