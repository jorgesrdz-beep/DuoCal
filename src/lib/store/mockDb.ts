import { Profile, Household, Goal, Food, MealPlanItem, FoodLog, HealthMetric, ShoppingListItem, PhotoComparison, Dish, DishIngredient, ConsumptionSchedule } from '@/types/database';
import { hashPin } from '@/lib/auth/pin';

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

      return {
        households: households || [],
        profiles: profiles || [],
        goals: goals || [],
        foods: foods && foods.length > 0 ? foods : (globalForDb.duoCalDb?.foods || []),
        meal_plans: meal_plans || [],
        food_logs: food_logs || [],
        health_metrics: health_metrics || [],
        shopping_list_items: shopping_list_items || [],
        photo_comparisons: photo_comparisons || [],
        dishes: dishes || [],
        dish_ingredients: dish_ingredients || [],
        consumption_schedules: consumption_schedules || [],
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

export async function insertRow(table: string, row: any): Promise<void> {
  const db = await getDb();
  if ((db as any)[table]) {
    (db as any)[table].unshift(row);
  }
  if (isServiceRoleConfigured) {
    const { error } = await supabaseAdmin.from(table).insert(row);
    if (error) {
      console.error(`Error inserting into Supabase ${table}:`, error);
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
    const { error } = await supabaseAdmin.from(table).update(updates).eq('id', id);
    if (error) {
      console.error(`Error updating in Supabase ${table}:`, error);
      throw new Error(`Error al actualizar en Supabase (${table}): ${error.message}`);
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

