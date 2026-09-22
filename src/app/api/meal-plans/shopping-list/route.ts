import { NextResponse } from 'next/server';
import { getDb } from '@/lib/store/mockDb';
import { isServiceRoleConfigured, supabaseAdmin } from '@/lib/supabase/admin';
import { STARTER_RECIPES } from '@/lib/data/starterRecipes';
import { WHOLE_FOODS } from '@/lib/data/wholeFoods';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { getWeekStartDate } from '@/lib/utils';
import { cleanIngredientName, formatGroceryItem } from '@/lib/utils/groceryUnits';

// Helper de clasificación automática de pasillos
function detectAisle(name: string): string {
  const lower = name.toLowerCase();
  if (
    lower.includes('pollo') ||
    lower.includes('res') ||
    lower.includes('carne') ||
    lower.includes('pescado') ||
    lower.includes('salmón') ||
    lower.includes('atún') ||
    lower.includes('pavo') ||
    lower.includes('bistec') ||
    lower.includes('camarón') ||
    lower.includes('cerdo') ||
    lower.includes('tofu')
  ) {
    return 'Carnicería y Proteínas';
  }
  if (
    lower.includes('espinaca') ||
    lower.includes('calabac') ||
    lower.includes('pimiento') ||
    lower.includes('cebolla') ||
    lower.includes('jitomate') ||
    lower.includes('tomate') ||
    lower.includes('aguacate') ||
    lower.includes('fresa') ||
    lower.includes('plátano') ||
    lower.includes('arándano') ||
    lower.includes('manzana') ||
    lower.includes('limón') ||
    lower.includes('espárrag') ||
    lower.includes('col') ||
    lower.includes('lechuga') ||
    lower.includes('verdura') ||
    lower.includes('fruta') ||
    lower.includes('papa') ||
    lower.includes('zanahoria') ||
    lower.includes('pepino') ||
    lower.includes('champiñ') ||
    lower.includes('nopal') ||
    lower.includes('mango') ||
    lower.includes('papaya') ||
    lower.includes('piña') ||
    lower.includes('naranja') ||
    lower.includes('sandía') ||
    lower.includes('melón') ||
    lower.includes('uvas') ||
    lower.includes('pera') ||
    lower.includes('kiwi')
  ) {
    return 'Frutas y Verduras';
  }
  if (
    lower.includes('huevo') ||
    lower.includes('yogurt') ||
    lower.includes('queso') ||
    lower.includes('leche') ||
    lower.includes('mantequilla') ||
    lower.includes('crema')
  ) {
    return 'Lácteos y Refrigerados';
  }
  if (
    lower.includes('arroz') ||
    lower.includes('avena') ||
    lower.includes('tortilla') ||
    lower.includes('pasta') ||
    lower.includes('frijol') ||
    lower.includes('lenteja') ||
    lower.includes('quinoa') ||
    lower.includes('pan') ||
    lower.includes('tostada') ||
    lower.includes('proteína en polvo') ||
    lower.includes('chía') ||
    lower.includes('linaza') ||
    lower.includes('almendra') ||
    lower.includes('nuez') ||
    lower.includes('cacahuate') ||
    lower.includes('maní')
  ) {
    return 'Abarrotes y Granos';
  }
  if (
    lower.includes('aceite') ||
    lower.includes('sal') ||
    lower.includes('pimienta') ||
    lower.includes('comino') ||
    lower.includes('ajo') ||
    lower.includes('salsa') ||
    lower.includes('canela') ||
    lower.includes('orégano') ||
    lower.includes('vinagre') ||
    lower.includes('mostaza')
  ) {
    return 'Condimentos y Aceites';
  }
  return 'Otros';
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const weekStart = searchParams.get('week_start') || getWeekStartDate();

    const cookieStore = await cookies();
    const userId = cookieStore.get('duocal_session')?.value;
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const db = await getDb();
    const user = db.profiles.find((p) => p.id === userId);
    const householdId = user?.household_id;

    if (!householdId) {
      return NextResponse.json({ items: [] });
    }

    const items = db.shopping_list_items.filter(
      (item) => item.household_id === householdId && item.week_start_date === weekStart
    );

    return NextResponse.json({ items });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('duocal_session')?.value;
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const db = await getDb();
    const user = db.profiles.find((p) => p.id === userId);
    const householdId = user?.household_id;
    if (!householdId) {
      return NextResponse.json({ error: 'No perteneces a un hogar todavía' }, { status: 400 });
    }

    const body = await req.json();
    const {
      action,
      item_id,
      is_purchased,
      item_name,
      quantity_text,
      category,
      week_start_date = getWeekStartDate(),
    } = body;

    // Acción 1: Alternar estado comprado
    if (action === 'toggle' && item_id) {
      const item = db.shopping_list_items.find(
        (i) => i.id === item_id && i.household_id === householdId
      );
      const newStatus = is_purchased !== undefined ? is_purchased : item ? !item.is_purchased : true;

      if (isServiceRoleConfigured) {
        await supabaseAdmin
          .from('shopping_list_items')
          .update({ is_purchased: newStatus })
          .eq('id', item_id);
      }

      if (item) {
        item.is_purchased = newStatus;
        return NextResponse.json({ success: true, item });
      }
      return NextResponse.json({ success: true });
    }

    // Acción 2: Eliminar elemento de la lista
    if (action === 'delete' && item_id) {
      if (isServiceRoleConfigured) {
        await supabaseAdmin
          .from('shopping_list_items')
          .delete()
          .eq('id', item_id);
      }
      db.shopping_list_items = db.shopping_list_items.filter((i) => i.id !== item_id);
      return NextResponse.json({ success: true });
    }

    // Acción 2b: Limpiar productos comprados
    if (action === 'clear_purchased') {
      if (isServiceRoleConfigured) {
        await supabaseAdmin
          .from('shopping_list_items')
          .delete()
          .eq('household_id', householdId)
          .eq('week_start_date', week_start_date)
          .eq('is_purchased', true);
      }
      db.shopping_list_items = db.shopping_list_items.filter(
        (i) => !(i.household_id === householdId && i.week_start_date === week_start_date && i.is_purchased)
      );
      return NextResponse.json({ success: true });
    }

    // Acción 2c: Desmarcar todos los productos
    if (action === 'uncheck_all') {
      if (isServiceRoleConfigured) {
        await supabaseAdmin
          .from('shopping_list_items')
          .update({ is_purchased: false })
          .eq('household_id', householdId)
          .eq('week_start_date', week_start_date);
      }
      db.shopping_list_items.forEach((i) => {
        if (i.household_id === householdId && i.week_start_date === week_start_date) {
          i.is_purchased = false;
        }
      });
      return NextResponse.json({ success: true });
    }

    // Acción 2d: Vaciar lista completa de la semana
    if (action === 'clear_all') {
      if (isServiceRoleConfigured) {
        await supabaseAdmin
          .from('shopping_list_items')
          .delete()
          .eq('household_id', householdId)
          .eq('week_start_date', week_start_date);
      }
      db.shopping_list_items = db.shopping_list_items.filter(
        (i) => !(i.household_id === householdId && i.week_start_date === week_start_date)
      );
      return NextResponse.json({ success: true });
    }

    // Acción 3: Autogenerar CONSOLIDANDO INGREDIENTES REPETIDOS desde los meal_plans de la semana
    if (action === 'generate_from_plan') {
      const memberIds = db.profiles.filter((p) => p.household_id === householdId).map((p) => p.id);
      const plannedMeals = db.meal_plans.filter(
        (p) => memberIds.includes(p.user_id) && p.week_start_date === week_start_date
      );

      if (plannedMeals.length === 0) {
        return NextResponse.json({
          success: true,
          items: [],
          message: 'No hay comidas planeadas para esta semana.',
        });
      }

      // Mapa de consolidación: clave normalizada -> { name, totalGrams, totalPieces, count, aisle }
      const consolidated: Map<
        string,
        { name: string; totalGrams: number; totalPieces: number; count: number; aisle: string }
      > = new Map();

      for (const meal of plannedMeals) {
        const servings = meal.servings || 1;
        // Limpieza de nombre (remover porciones o paréntesis como "(1 plato (1 omelette))")
        const rawMealName = meal.custom_name.trim();
        const baseMealName = rawMealName.replace(/\s*\(.*$/, '').trim().toLowerCase();

        // 1. Buscar coincidencia en platillos guardados o recetas predefinidas
        const matchedDish =
          db.dishes.find(
            (d) =>
              (meal.food_id && d.id === meal.food_id) ||
              d.name.toLowerCase().trim() === baseMealName ||
              d.name.toLowerCase().includes(baseMealName) ||
              baseMealName.includes(d.name.toLowerCase().trim())
          );

        // Obtener ingredientes del platillo guardado o caer al catálogo STARTER_RECIPES
        let dishIngredients =
          matchedDish && matchedDish.ingredients && matchedDish.ingredients.length > 0
            ? matchedDish.ingredients
            : null;

        if (!dishIngredients) {
          const matchedStarter = STARTER_RECIPES.find(
            (s) =>
              s.name.toLowerCase().trim() === baseMealName ||
              s.name.toLowerCase().includes(baseMealName) ||
              baseMealName.includes(s.name.toLowerCase().trim())
          );
          if (matchedStarter && matchedStarter.ingredients && matchedStarter.ingredients.length > 0) {
            dishIngredients = matchedStarter.ingredients;
          }
        }

        if (dishIngredients && dishIngredients.length > 0) {
          // Descomponer en sus ingredientes individuales
          for (const ing of dishIngredients) {
            const { cleanName, piecesPerServing } = cleanIngredientName(ing.ingredient_name);
            const ingKey = cleanName.toLowerCase();
            const grams = (ing.amount_g || 0) * servings;
            const pieces = (piecesPerServing || 0) * servings;
            const aisle = ing.aisle_category || detectAisle(cleanName);

            if (consolidated.has(ingKey)) {
              const prev = consolidated.get(ingKey)!;
              prev.totalGrams += grams;
              prev.totalPieces += pieces;
              prev.count += servings;
            } else {
              consolidated.set(ingKey, {
                name: cleanName,
                totalGrams: grams,
                totalPieces: pieces,
                count: servings,
                aisle,
              });
            }
          }
        } else {
          // 2. Si no es platillo compuesto, es un alimento individual suelto
          // Buscar en db.foods o WHOLE_FOODS para obtener gramos de porción
          const matchedFood = (db.foods || []).find(
            (f) =>
              (meal.food_id && f.id === meal.food_id) ||
              f.name.toLowerCase().trim() === baseMealName ||
              f.name.toLowerCase().includes(baseMealName) ||
              baseMealName.includes(f.name.toLowerCase().trim())
          ) || WHOLE_FOODS.find(
            (wf) =>
              wf.name.toLowerCase().trim() === baseMealName ||
              wf.name.toLowerCase().includes(baseMealName) ||
              baseMealName.includes(wf.name.toLowerCase().trim())
          );

          const { cleanName: cleanedRawName, piecesPerServing } = cleanIngredientName(rawMealName);
          const gramsMatch = rawMealName.match(/(\d+)\s*g/i);
          let grams = gramsMatch
            ? parseInt(gramsMatch[1], 10) * servings
            : matchedFood?.serving_size_g
            ? matchedFood.serving_size_g * servings
            : 0;
          const pieces = (piecesPerServing || 0) * servings;

          const cleanName = matchedFood ? matchedFood.name : cleanedRawName;
          const aisle = detectAisle(cleanName);
          const key = cleanName.toLowerCase();

          if (consolidated.has(key)) {
            const prev = consolidated.get(key)!;
            prev.totalGrams += grams;
            prev.totalPieces += pieces;
            prev.count += servings;
          } else {
            consolidated.set(key, {
              name: cleanName,
              totalGrams: grams,
              totalPieces: pieces,
              count: servings,
              aisle,
            });
          }
        }
      }

      // Preparar los items autogenerados con unidades comerciales inteligentes
      const generatedItems = [];
      for (const item of consolidated.values()) {
        const formatted = formatGroceryItem(item);

        generatedItems.push({
          id: crypto.randomUUID(),
          household_id: householdId,
          week_start_date,
          item_name: formatted.cleanName,
          quantity_text: formatted.quantityText,
          category: item.aisle,
          is_purchased: false,
          created_at: new Date().toISOString(),
        });
      }

      // 1. Limpiar en Supabase los productos autogenerados previos de esa semana
      if (isServiceRoleConfigured) {
        const { error: delErr } = await supabaseAdmin
          .from('shopping_list_items')
          .delete()
          .eq('household_id', householdId)
          .eq('week_start_date', week_start_date);

        if (delErr) {
          console.error('Error eliminando lista previa en Supabase:', delErr);
        }

        // 2. Insertar todos los nuevos productos consolidados en Supabase
        if (generatedItems.length > 0) {
          const { error: insErr } = await supabaseAdmin
            .from('shopping_list_items')
            .insert(generatedItems);

          if (insErr) {
            console.error('Error insertando lista generada en Supabase:', insErr);
          }
        }
      }

      // 3. Actualizar memoria local
      db.shopping_list_items = [
        ...db.shopping_list_items.filter(
          (i) => !(i.household_id === householdId && i.week_start_date === week_start_date)
        ),
        ...generatedItems,
      ];

      return NextResponse.json({
        success: true,
        items: generatedItems,
        message: `Se consolidaron ${generatedItems.length} ingredientes únicos agrupados por pasillo de supermercado.`,
      });
    }

    // Acción 4: Agregar manual
    if (item_name) {
      const newItem = {
        id: crypto.randomUUID(),
        household_id: householdId,
        week_start_date,
        item_name: item_name.trim(),
        quantity_text: quantity_text || '1 unidad',
        category: category || detectAisle(item_name),
        is_purchased: false,
        created_at: new Date().toISOString(),
      };

      if (isServiceRoleConfigured) {
        await supabaseAdmin.from('shopping_list_items').insert(newItem);
      }
      db.shopping_list_items.push(newItem);

      return NextResponse.json({ success: true, item: newItem });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error';
    console.error('Error in /api/meal-plans/shopping-list:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
