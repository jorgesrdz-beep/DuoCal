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
        {
          id: 'd0000000-0000-0000-0000-000000000003',
          user_id: null,
          household_id: null,
          name: 'Sándwich de Pavo y Panela',
          description: 'Sándwich alto en proteína en pan Cero Cero multigrano con pechuga de pavo San Rafael Balance, queso panela Los Volcanes reducido en grasa, aguacate y verduras frescas.',
          category: 'lunch',
          total_servings: 1,
          total_weight_g: 315,
          serving_name: 'sándwich completo (315g)',
          is_shared_with_partner: true,
          is_starter_template: false,
          prep_time_minutes: 5,
          cook_time_minutes: 2,
          instructions: [
            'Untar la mostaza en una de las rebanadas de Pan Bimbo Cero Cero Multigrano (opcional: dorar ligeramente el pan en comal o tostadora).',
            'Colocar la cama de lechuga fresca limpia y seca.',
            'Distribuir las rebanadas de Pechuga de Pavo San Rafael Balance (90g).',
            'Colocar el Queso Panela Los Volcanes reducido en grasa en rebanadas (45g).',
            'Agregar las rodajas de jitomate (40g) y el aguacate (25g). Sazonar con unas gotas de limón, pimienta molida o chile al gusto.',
            'Cerrar con la segunda rebanada de pan, cortar en diagonal y disfrutar.'
          ],
          total_calories: 434,
          total_protein_g: 38.5,
          total_carbs_g: 40.7,
          total_fat_g: 11.8,
          total_fiber_g: 6.7,
          calories_per_serving: 434,
          protein_per_serving: 38.5,
          carbs_per_serving: 40.7,
          fat_per_serving: 11.8,
          fiber_per_serving: 6.7,
          created_at: new Date().toISOString(),
        },
        {
          id: 'd0000000-0000-0000-0000-000000000004',
          user_id: null,
          household_id: null,
          name: 'Pollo con Mole',
          description: 'Pieza de pollo cocida y bañada en mole tradicional mexicano con ajonjolí tostado (solo guisado principal).',
          category: 'lunch',
          total_servings: 1,
          total_weight_g: 245,
          serving_name: 'plato (1 pieza con mole)',
          is_shared_with_partner: true,
          is_starter_template: false,
          prep_time_minutes: 10,
          cook_time_minutes: 25,
          instructions: [
            'Cocer la pieza de pollo en agua con cebolla, ajo y sal hasta que esté bien tierna y cocida.',
            'En una cacerola pequeña, disolver y calentar la pasta de mole con un poco de caldo de cocción a fuego bajo hasta lograr una consistencia tersa.',
            'Colocar el pollo en el plato y bañar generosamente con la salsa de mole caliente.',
            'Decorar espolvoreando ajonjolí tostado por encima.',
          ],
          total_calories: 430,
          total_protein_g: 49,
          total_carbs_g: 19,
          total_fat_g: 16.5,
          total_fiber_g: 2.5,
          calories_per_serving: 430,
          protein_per_serving: 49,
          carbs_per_serving: 19,
          fat_per_serving: 16.5,
          fiber_per_serving: 2.5,
          created_at: new Date().toISOString(),
        },
        {
          id: 'd0000000-0000-0000-0000-000000000005',
          user_id: null,
          household_id: null,
          name: 'Mole de Olla',
          description: 'Caldo tradicional de res con recaudo de chile guajillo, verduras (elote, calabacita, ejote, zanahoria) y epazote.',
          category: 'lunch',
          total_servings: 1,
          total_weight_g: 550,
          serving_name: 'tazón grande (550g)',
          is_shared_with_partner: true,
          is_starter_template: false,
          prep_time_minutes: 15,
          cook_time_minutes: 45,
          instructions: [
            'Cocer la carne de res magra (chambarete o falda) en agua con cebolla, ajo y sal en olla hasta suavizar.',
            'Licuar chiles guajillos limpios y desvenados con ajo y un poco de caldo; colar e incorporar a la olla.',
            'Agregar las rodajas de elote tierno, las zanahorias y los ejotes cortados.',
            'Al final, agregar las calabacitas y unas ramas de epazote fresco, dejando hervir 10 minutos a fuego medio hasta que las verduras estén tiernas.',
          ],
          total_calories: 326,
          total_protein_g: 35,
          total_carbs_g: 19,
          total_fat_g: 11,
          total_fiber_g: 4.2,
          calories_per_serving: 326,
          protein_per_serving: 35,
          carbs_per_serving: 19,
          fat_per_serving: 11,
          fiber_per_serving: 4.2,
          created_at: new Date().toISOString(),
        },
        {
          id: 'd0000000-0000-0000-0000-000000000006',
          user_id: null,
          household_id: null,
          name: 'Carne al Pastor',
          description: 'Carne de cerdo magra marinada con achiote y chiles a la plancha con piña asada, cebolla y cilantro.',
          category: 'lunch',
          total_servings: 1,
          total_weight_g: 220,
          serving_name: 'plato (porción de 220g)',
          is_shared_with_partner: true,
          is_starter_template: false,
          prep_time_minutes: 10,
          cook_time_minutes: 12,
          instructions: [
            'Marinar las tiras o bistec de pierna/lomo de cerdo con adobo de achiote, jugo de naranja/vinagre y especias.',
            'En un sartén o plancha caliente con un toque ligero de aceite, cocinar la carne hasta que quede dorada por fuera y bien cocida.',
            'Saltear los cubos de piña en la misma plancha para caramelizarlos.',
            'Servir la carne espolvoreada con cilantro picado, cebolla picada y los trozos de piña asada.',
          ],
          total_calories: 320,
          total_protein_g: 32.5,
          total_carbs_g: 12.4,
          total_fat_g: 15,
          total_fiber_g: 1.2,
          calories_per_serving: 320,
          protein_per_serving: 32.5,
          carbs_per_serving: 12.4,
          fat_per_serving: 15,
          fiber_per_serving: 1.2,
          created_at: new Date().toISOString(),
        },
        {
          id: 'd0000000-0000-0000-0000-000000000007',
          user_id: null,
          household_id: null,
          name: 'Flautas de Res',
          description: 'Orden de 3 flautas crujientes rellenas de falda de res deshebrada, servidas tradicionalmente con lechuga fresca, crema y queso fresco.',
          category: 'lunch',
          total_servings: 1,
          total_weight_g: 265,
          serving_name: 'orden de 3 flautas preparadas',
          is_shared_with_partner: true,
          is_starter_template: false,
          prep_time_minutes: 10,
          cook_time_minutes: 15,
          instructions: [
            'Entibiar 3 tortillas de maíz para que estén flexibles y rellenar cada una con falda de res cocida y deshebrada, enrollando firmemente.',
            'Freír en sartén con aceite caliente hasta que las tortillas tomen un tono dorado y textura crujiente uniforme; escurrir sobre papel absorbente.',
            'Colocar las 3 flautas en el plato sobre una cama de lechuga fresca finamente rebanada.',
            'Bañar con crema fresca de vaca y espolvorear queso panela o fresco rallado por encima.',
          ],
          total_calories: 572,
          total_protein_g: 34.8,
          total_carbs_g: 36.4,
          total_fat_g: 32.4,
          total_fiber_g: 5.5,
          calories_per_serving: 572,
          protein_per_serving: 34.8,
          carbs_per_serving: 36.4,
          fat_per_serving: 32.4,
          fiber_per_serving: 5.5,
          created_at: new Date().toISOString(),
        },
        {
          id: 'd0000000-0000-0000-0000-000000000008',
          user_id: null,
          household_id: null,
          name: 'Fajita en Salsa Verde',
          description: 'Tiras de bistec de res magro selladas y guisadas en salsa verde casera de tomatillo, cebolla y cilantro.',
          category: 'lunch',
          total_servings: 1,
          total_weight_g: 310,
          serving_name: 'plato (porción de 310g)',
          is_shared_with_partner: true,
          is_starter_template: false,
          prep_time_minutes: 10,
          cook_time_minutes: 20,
          instructions: [
            'Cortar el bistec de res en tiras tipo fajitas y sazonar con una pizca de sal y pimienta.',
            'Hervir los tomatillos y chile serrano; licuar con ajo, sal y cilantro fresco hasta obtener una salsa verde homogénea.',
            'En un sartén a fuego alto con aceite, dorar las tiras de res y la cebolla fileteada durante 4 a 5 minutos.',
            'Verter la salsa verde sobre las fajitas de res y dejar hervir a fuego bajo durante 10 minutos para que absorba el sabor.',
          ],
          total_calories: 307,
          total_protein_g: 35.7,
          total_carbs_g: 9.8,
          total_fat_g: 13.2,
          total_fiber_g: 3.3,
          calories_per_serving: 307,
          protein_per_serving: 35.7,
          carbs_per_serving: 9.8,
          fat_per_serving: 13.2,
          fiber_per_serving: 3.3,
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
        {
          id: 'da000000-0000-0000-0000-000000000006',
          dish_id: 'd0000000-0000-0000-0000-000000000003',
          food_id: '00000000-0000-4000-8000-000000000418',
          ingredient_name: 'Pan Cero Cero Multigrano (Bimbo)',
          amount_g: 85,
          calories: 196,
          protein_g: 13.7,
          carbs_g: 31.7,
          fat_g: 1.5,
          fiber_g: 4.1,
          sodium_mg: 395,
          aisle_category: 'Abarrotes y Granos',
          created_at: new Date().toISOString(),
        },
        {
          id: 'da000000-0000-0000-0000-000000000007',
          dish_id: 'd0000000-0000-0000-0000-000000000003',
          food_id: '00000000-0000-4000-8000-000000000324',
          ingredient_name: 'Pechuga de Pavo Receta Tradicional (San Rafael Balance)',
          amount_g: 90,
          calories: 92,
          protein_g: 14.6,
          carbs_g: 2.4,
          fat_g: 0.8,
          fiber_g: 0,
          sodium_mg: 450,
          aisle_category: 'Carnicería y Proteínas',
          created_at: new Date().toISOString(),
        },
        {
          id: 'da000000-0000-0000-0000-000000000008',
          dish_id: 'd0000000-0000-0000-0000-000000000003',
          food_id: '00000000-0000-4000-8000-000000000325',
          ingredient_name: 'Queso Panela Reducido en Grasa (Los Volcanes)',
          amount_g: 45,
          calories: 90,
          protein_g: 8.6,
          carbs_g: 1.8,
          fat_g: 5.4,
          fiber_g: 0,
          sodium_mg: 234,
          aisle_category: 'Lácteos y Refrigerados',
          created_at: new Date().toISOString(),
        },
        {
          id: 'da000000-0000-0000-0000-000000000009',
          dish_id: 'd0000000-0000-0000-0000-000000000003',
          food_id: null,
          ingredient_name: 'Aguacate Hass',
          amount_g: 25,
          calories: 40,
          protein_g: 0.5,
          carbs_g: 2.1,
          fat_g: 3.7,
          fiber_g: 1.7,
          sodium_mg: 2,
          aisle_category: 'Frutas y Verduras',
          created_at: new Date().toISOString(),
        },
        {
          id: 'da000000-0000-0000-0000-000000000010',
          dish_id: 'd0000000-0000-0000-0000-000000000003',
          food_id: null,
          ingredient_name: 'Jitomate fresco en rodajas',
          amount_g: 40,
          calories: 7,
          protein_g: 0.4,
          carbs_g: 1.6,
          fat_g: 0.1,
          fiber_g: 0.5,
          sodium_mg: 2,
          aisle_category: 'Frutas y Verduras',
          created_at: new Date().toISOString(),
        },
        {
          id: 'da000000-0000-0000-0000-000000000011',
          dish_id: 'd0000000-0000-0000-0000-000000000003',
          food_id: null,
          ingredient_name: 'Lechuga romana / orejona fresca',
          amount_g: 20,
          calories: 3,
          protein_g: 0.3,
          carbs_g: 0.6,
          fat_g: 0,
          fiber_g: 0.4,
          sodium_mg: 5,
          aisle_category: 'Frutas y Verduras',
          created_at: new Date().toISOString(),
        },
        {
          id: 'da000000-0000-0000-0000-000000000012',
          dish_id: 'd0000000-0000-0000-0000-000000000003',
          food_id: null,
          ingredient_name: 'Mostaza Dijon o regular y limón al gusto',
          amount_g: 10,
          calories: 6,
          protein_g: 0.4,
          carbs_g: 0.5,
          fat_g: 0.3,
          fiber_g: 0,
          sodium_mg: 110,
          aisle_category: 'Condimentos y Aceites',
          created_at: new Date().toISOString(),
        },
        // Pollo con Mole
        {
          id: 'da000000-0000-0000-0000-000000000013',
          dish_id: 'd0000000-0000-0000-0000-000000000004',
          food_id: null,
          ingredient_name: 'Pechuga o pierna de pollo cocida (sin piel)',
          amount_g: 150,
          calories: 240,
          protein_g: 45,
          carbs_g: 0,
          fat_g: 5,
          fiber_g: 0,
          sodium_mg: 100,
          aisle_category: 'Carnicería y Proteínas',
          created_at: new Date().toISOString(),
        },
        {
          id: 'da000000-0000-0000-0000-000000000014',
          dish_id: 'd0000000-0000-0000-0000-000000000004',
          food_id: null,
          ingredient_name: 'Mole poblano preparado (pasta con caldo)',
          amount_g: 90,
          calories: 160,
          protein_g: 3,
          carbs_g: 18,
          fat_g: 9,
          fiber_g: 2,
          sodium_mg: 480,
          aisle_category: 'Abarrotes y Granos',
          created_at: new Date().toISOString(),
        },
        {
          id: 'da000000-0000-0000-0000-000000000015',
          dish_id: 'd0000000-0000-0000-0000-000000000004',
          food_id: null,
          ingredient_name: 'Semillas de ajonjolí tostadas',
          amount_g: 5,
          calories: 30,
          protein_g: 1,
          carbs_g: 1,
          fat_g: 2.5,
          fiber_g: 0.5,
          sodium_mg: 2,
          aisle_category: 'Abarrotes y Granos',
          created_at: new Date().toISOString(),
        },
        // Mole de Olla
        {
          id: 'da000000-0000-0000-0000-000000000016',
          dish_id: 'd0000000-0000-0000-0000-000000000005',
          food_id: null,
          ingredient_name: 'Carne magra de res cocida (chambarete o falda)',
          amount_g: 120,
          calories: 220,
          protein_g: 31,
          carbs_g: 0,
          fat_g: 9,
          fiber_g: 0,
          sodium_mg: 70,
          aisle_category: 'Carnicería y Proteínas',
          created_at: new Date().toISOString(),
        },
        {
          id: 'da000000-0000-0000-0000-000000000017',
          dish_id: 'd0000000-0000-0000-0000-000000000005',
          food_id: null,
          ingredient_name: 'Caldo de res con recaudo guajillo y epazote',
          amount_g: 250,
          calories: 25,
          protein_g: 1,
          carbs_g: 2,
          fat_g: 1,
          fiber_g: 0.5,
          sodium_mg: 380,
          aisle_category: 'Abarrotes y Granos',
          created_at: new Date().toISOString(),
        },
        {
          id: 'da000000-0000-0000-0000-000000000018',
          dish_id: 'd0000000-0000-0000-0000-000000000005',
          food_id: null,
          ingredient_name: 'Elote tierno en rodajas',
          amount_g: 50,
          calories: 45,
          protein_g: 1.5,
          carbs_g: 9,
          fat_g: 0.6,
          fiber_g: 1.2,
          sodium_mg: 15,
          aisle_category: 'Frutas y Verduras',
          created_at: new Date().toISOString(),
        },
        {
          id: 'da000000-0000-0000-0000-000000000019',
          dish_id: 'd0000000-0000-0000-0000-000000000005',
          food_id: null,
          ingredient_name: 'Calabacita verde en cubos',
          amount_g: 60,
          calories: 10,
          protein_g: 0.7,
          carbs_g: 2,
          fat_g: 0.1,
          fiber_g: 0.6,
          sodium_mg: 5,
          aisle_category: 'Frutas y Verduras',
          created_at: new Date().toISOString(),
        },
        {
          id: 'da000000-0000-0000-0000-000000000020',
          dish_id: 'd0000000-0000-0000-0000-000000000005',
          food_id: null,
          ingredient_name: 'Zanahoria en rodajas',
          amount_g: 40,
          calories: 16,
          protein_g: 0.4,
          carbs_g: 3.9,
          fat_g: 0.1,
          fiber_g: 1.1,
          sodium_mg: 25,
          aisle_category: 'Frutas y Verduras',
          created_at: new Date().toISOString(),
        },
        {
          id: 'da000000-0000-0000-0000-000000000021',
          dish_id: 'd0000000-0000-0000-0000-000000000005',
          food_id: null,
          ingredient_name: 'Ejotes frescos cortados',
          amount_g: 30,
          calories: 10,
          protein_g: 0.5,
          carbs_g: 2.1,
          fat_g: 0.1,
          fiber_g: 0.8,
          sodium_mg: 2,
          aisle_category: 'Frutas y Verduras',
          created_at: new Date().toISOString(),
        },
        // Carne al Pastor
        {
          id: 'da000000-0000-0000-0000-000000000022',
          dish_id: 'd0000000-0000-0000-0000-000000000006',
          food_id: null,
          ingredient_name: 'Carne de cerdo magra marinada al pastor',
          amount_g: 150,
          calories: 245,
          protein_g: 32,
          carbs_g: 5,
          fat_g: 10,
          fiber_g: 0.2,
          sodium_mg: 420,
          aisle_category: 'Carnicería y Proteínas',
          created_at: new Date().toISOString(),
        },
        {
          id: 'da000000-0000-0000-0000-000000000023',
          dish_id: 'd0000000-0000-0000-0000-000000000006',
          food_id: null,
          ingredient_name: 'Piña fresca en trozos asada',
          amount_g: 40,
          calories: 20,
          protein_g: 0.2,
          carbs_g: 5.2,
          fat_g: 0,
          fiber_g: 0.6,
          sodium_mg: 1,
          aisle_category: 'Frutas y Verduras',
          created_at: new Date().toISOString(),
        },
        {
          id: 'da000000-0000-0000-0000-000000000024',
          dish_id: 'd0000000-0000-0000-0000-000000000006',
          food_id: null,
          ingredient_name: 'Cebolla blanca y cilantro picados',
          amount_g: 25,
          calories: 10,
          protein_g: 0.3,
          carbs_g: 2.2,
          fat_g: 0,
          fiber_g: 0.4,
          sodium_mg: 3,
          aisle_category: 'Frutas y Verduras',
          created_at: new Date().toISOString(),
        },
        {
          id: 'da000000-0000-0000-0000-000000000025',
          dish_id: 'd0000000-0000-0000-0000-000000000006',
          food_id: null,
          ingredient_name: 'Aceite vegetal para plancha',
          amount_g: 5,
          calories: 45,
          protein_g: 0,
          carbs_g: 0,
          fat_g: 5,
          fiber_g: 0,
          sodium_mg: 0,
          aisle_category: 'Condimentos y Aceites',
          created_at: new Date().toISOString(),
        },
        // Flautas de Res
        {
          id: 'da000000-0000-0000-0000-000000000026',
          dish_id: 'd0000000-0000-0000-0000-000000000007',
          food_id: null,
          ingredient_name: 'Tortillas de maíz (3 piezas)',
          amount_g: 75,
          calories: 160,
          protein_g: 4.2,
          carbs_g: 33,
          fat_g: 2,
          fiber_g: 4.5,
          sodium_mg: 35,
          aisle_category: 'Abarrotes y Granos',
          created_at: new Date().toISOString(),
        },
        {
          id: 'da000000-0000-0000-0000-000000000027',
          dish_id: 'd0000000-0000-0000-0000-000000000007',
          food_id: null,
          ingredient_name: 'Falda de res cocida y deshebrada',
          amount_g: 90,
          calories: 175,
          protein_g: 25,
          carbs_g: 0,
          fat_g: 7.5,
          fiber_g: 0,
          sodium_mg: 60,
          aisle_category: 'Carnicería y Proteínas',
          created_at: new Date().toISOString(),
        },
        {
          id: 'da000000-0000-0000-0000-000000000028',
          dish_id: 'd0000000-0000-0000-0000-000000000007',
          food_id: null,
          ingredient_name: 'Aceite vegetal (absorbido en freído)',
          amount_g: 12,
          calories: 106,
          protein_g: 0,
          carbs_g: 0,
          fat_g: 12,
          fiber_g: 0,
          sodium_mg: 0,
          aisle_category: 'Condimentos y Aceites',
          created_at: new Date().toISOString(),
        },
        {
          id: 'da000000-0000-0000-0000-000000000029',
          dish_id: 'd0000000-0000-0000-0000-000000000007',
          food_id: null,
          ingredient_name: 'Lechuga romana fresca picada',
          amount_g: 40,
          calories: 6,
          protein_g: 0.5,
          carbs_g: 1.2,
          fat_g: 0.1,
          fiber_g: 0.8,
          sodium_mg: 10,
          aisle_category: 'Frutas y Verduras',
          created_at: new Date().toISOString(),
        },
        {
          id: 'da000000-0000-0000-0000-000000000030',
          dish_id: 'd0000000-0000-0000-0000-000000000007',
          food_id: null,
          ingredient_name: 'Crema ácida o media crema',
          amount_g: 25,
          calories: 60,
          protein_g: 0.6,
          carbs_g: 1.2,
          fat_g: 6,
          fiber_g: 0,
          sodium_mg: 30,
          aisle_category: 'Lácteos y Refrigerados',
          created_at: new Date().toISOString(),
        },
        {
          id: 'da000000-0000-0000-0000-000000000031',
          dish_id: 'd0000000-0000-0000-0000-000000000007',
          food_id: null,
          ingredient_name: 'Queso fresco o panela rallado',
          amount_g: 25,
          calories: 65,
          protein_g: 4.5,
          carbs_g: 1,
          fat_g: 4.8,
          fiber_g: 0,
          sodium_mg: 120,
          aisle_category: 'Lácteos y Refrigerados',
          created_at: new Date().toISOString(),
        },
        // Fajita en Salsa Verde
        {
          id: 'da000000-0000-0000-0000-000000000032',
          dish_id: 'd0000000-0000-0000-0000-000000000008',
          food_id: null,
          ingredient_name: 'Bistec de res magro en tiras (pulpa o falda)',
          amount_g: 150,
          calories: 210,
          protein_g: 34,
          carbs_g: 0,
          fat_g: 7,
          fiber_g: 0,
          sodium_mg: 80,
          aisle_category: 'Carnicería y Proteínas',
          created_at: new Date().toISOString(),
        },
        {
          id: 'da000000-0000-0000-0000-000000000033',
          dish_id: 'd0000000-0000-0000-0000-000000000008',
          food_id: null,
          ingredient_name: 'Tomatillo verde (miltomate)',
          amount_g: 100,
          calories: 32,
          protein_g: 1,
          carbs_g: 5.8,
          fat_g: 1,
          fiber_g: 1.9,
          sodium_mg: 2,
          aisle_category: 'Frutas y Verduras',
          created_at: new Date().toISOString(),
        },
        {
          id: 'da000000-0000-0000-0000-000000000034',
          dish_id: 'd0000000-0000-0000-0000-000000000008',
          food_id: null,
          ingredient_name: 'Cebolla blanca fileteada y chile serrano',
          amount_g: 50,
          calories: 20,
          protein_g: 0.7,
          carbs_g: 4,
          fat_g: 0.2,
          fiber_g: 1.4,
          sodium_mg: 5,
          aisle_category: 'Frutas y Verduras',
          created_at: new Date().toISOString(),
        },
        {
          id: 'da000000-0000-0000-0000-000000000035',
          dish_id: 'd0000000-0000-0000-0000-000000000008',
          food_id: null,
          ingredient_name: 'Aceite vegetal para sofreír',
          amount_g: 5,
          calories: 45,
          protein_g: 0,
          carbs_g: 0,
          fat_g: 5,
          fiber_g: 0,
          sodium_mg: 0,
          aisle_category: 'Condimentos y Aceites',
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

  const memDb = globalForDb.duoCalDb!;

  for (const qItem of quakerVerifiedItems) {
    const existingIdx = memDb.foods.findIndex(
      (f) => f.barcode === qItem.barcode || f.id === qItem.id
    );
    if (existingIdx !== -1) {
      memDb.foods[existingIdx] = {
        ...memDb.foods[existingIdx],
        ...qItem,
      };
    } else {
      memDb.foods.push(qItem);
    }
  }

  // Corregir logs existentes de estas avenas en el diario si no tenían fibra registrada
  for (const log of memDb.food_logs) {
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
    const existingDishIdx = memDb.dishes.findIndex(
      (d) => d.id === starter.id || d.name.toLowerCase().trim() === starter.name.toLowerCase().trim()
    );
    if (existingDishIdx === -1) {
      memDb.dishes.push(starter);
      if (starter.ingredients && Array.isArray(starter.ingredients)) {
        for (const ing of starter.ingredients) {
          if (!memDb.dish_ingredients.some((di) => di.id === ing.id)) {
            memDb.dish_ingredients.push(ing);
          }
        }
      }
    } else {
      memDb.dishes[existingDishIdx] = {
        ...memDb.dishes[existingDishIdx],
        ...starter,
      };
      if (starter.ingredients && Array.isArray(starter.ingredients)) {
        for (const ing of starter.ingredients) {
          const ingIdx = memDb.dish_ingredients.findIndex((di) => di.id === ing.id);
          if (ingIdx !== -1) {
            memDb.dish_ingredients[ingIdx] = ing;
          } else {
            memDb.dish_ingredients.push(ing);
          }
        }
      }
    }
  }

  return memDb;
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

  // Sanitizar campos UUID para evitar errores de sintaxis en Postgres/Supabase
  if (table === 'dish_ingredients' || table === 'food_logs' || table === 'meal_plans') {
    if (
      filtered.food_id &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(filtered.food_id))
    ) {
      filtered.food_id = null;
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
      if (
        table === 'dish_ingredients' &&
        (error.message?.includes('dish_ingredients_food_id_fkey') || (error as any).code === '23503')
      ) {
        // Fallback resiliente: si el alimento aún no existe en Supabase, persistir ingrediente con food_id = null
        const retryPayload = { ...payload, food_id: null };
        const { error: retryErr } = await supabaseAdmin.from(table).upsert(retryPayload);
        if (!retryErr) {
          row.food_id = null;
          return;
        }
      }
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

