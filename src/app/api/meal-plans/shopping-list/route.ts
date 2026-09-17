import { NextResponse } from 'next/server';
import { getDb } from '@/lib/store/mockDb';
import { STARTER_RECIPES } from '@/lib/data/starterRecipes';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { getWeekStartDate } from '@/lib/utils';

// Helper de clasificación automática de pasillos
function detectAisle(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('pollo') || lower.includes('res') || lower.includes('carne') || lower.includes('pescado') || lower.includes('salmón') || lower.includes('atún') || lower.includes('pavo') || lower.includes('bistec') || lower.includes('camarón')) {
    return 'Carnicería y Proteínas';
  }
  if (lower.includes('espinaca') || lower.includes('calabac') || lower.includes('pimiento') || lower.includes('cebolla') || lower.includes('jitomate') || lower.includes('tomate') || lower.includes('aguacate') || lower.includes('fresa') || lower.includes('plátano') || lower.includes('arándano') || lower.includes('manzana') || lower.includes('limón') || lower.includes('espárrag') || lower.includes('col') || lower.includes('lechuga') || lower.includes('verdura') || lower.includes('fruta') || lower.includes('papa')) {
    return 'Frutas y Verduras';
  }
  if (lower.includes('huevo') || lower.includes('yogurt') || lower.includes('queso') || lower.includes('leche') || lower.includes('mantequilla')) {
    return 'Lácteos y Refrigerados';
  }
  if (lower.includes('arroz') || lower.includes('avena') || lower.includes('tortilla') || lower.includes('pasta') || lower.includes('frijol') || lower.includes('lenteja') || lower.includes('quinoa') || lower.includes('pan') || lower.includes('tostada') || lower.includes('proteína en polvo') || lower.includes('chía')) {
    return 'Abarrotes y Granos';
  }
  if (lower.includes('aceite') || lower.includes('sal') || lower.includes('pimienta') || lower.includes('comino') || lower.includes('ajo') || lower.includes('salsa') || lower.includes('canela') || lower.includes('orégano') || lower.includes('vinagre')) {
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
    const { action, item_id, is_purchased, item_name, quantity_text, category, week_start_date = getWeekStartDate() } = body;

    // Acción 1: Alternar estado comprado
    if (action === 'toggle' && item_id) {
      const item = db.shopping_list_items.find((i) => i.id === item_id && i.household_id === householdId);
      if (item) {
        item.is_purchased = is_purchased !== undefined ? is_purchased : !item.is_purchased;
        return NextResponse.json({ success: true, item });
      }
      return NextResponse.json({ error: 'Elemento no encontrado' }, { status: 404 });
    }

    // Acción 2: Eliminar elemento de la lista
    if (action === 'delete' && item_id) {
      const idx = db.shopping_list_items.findIndex((i) => i.id === item_id && i.household_id === householdId);
      if (idx !== -1) {
        db.shopping_list_items.splice(idx, 1);
        return NextResponse.json({ success: true });
      }
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    }

    // Acción 2b: Limpiar productos comprados
    if (action === 'clear_purchased') {
      db.shopping_list_items = db.shopping_list_items.filter(
        (i) => !(i.household_id === householdId && i.week_start_date === week_start_date && i.is_purchased)
      );
      return NextResponse.json({ success: true });
    }

    // Acción 2c: Desmarcar todos los productos
    if (action === 'uncheck_all') {
      db.shopping_list_items.forEach((i) => {
        if (i.household_id === householdId && i.week_start_date === week_start_date) {
          i.is_purchased = false;
        }
      });
      return NextResponse.json({ success: true });
    }

    // Acción 2d: Vaciar lista completa de la semana
    if (action === 'clear_all') {
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

      // Mapa de consolidación: clave normalizada -> { displayName, totalGrams, count, aisle }
      const consolidated: Map<string, { name: string; totalGrams: number; count: number; aisle: string }> = new Map();

      for (const meal of plannedMeals) {
        const servings = meal.servings || 1;
        const cleanMealName = meal.custom_name.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();

        // Buscar si coincide con un platillo guardado o plantilla
        const matchedDish =
          db.dishes.find((d) => d.name.toLowerCase().includes(cleanMealName)) ||
          STARTER_RECIPES.find((s) => s.name.toLowerCase().includes(cleanMealName));

        if (matchedDish && matchedDish.ingredients && matchedDish.ingredients.length > 0) {
          // Descomponer en sus ingredientes individuales
          for (const ing of matchedDish.ingredients) {
            const ingKey = ing.ingredient_name.trim().toLowerCase();
            const grams = ing.amount_g * servings;
            const aisle = ing.aisle_category || detectAisle(ing.ingredient_name);

            if (consolidated.has(ingKey)) {
              const prev = consolidated.get(ingKey)!;
              prev.totalGrams += grams;
              prev.count += servings;
            } else {
              consolidated.set(ingKey, {
                name: ing.ingredient_name.trim(),
                totalGrams: grams,
                count: servings,
                aisle,
              });
            }
          }
        } else {
          // Es un alimento suelto
          const name = meal.custom_name.trim();
          const key = name.toLowerCase();
          const aisle = detectAisle(name);

          if (consolidated.has(key)) {
            const prev = consolidated.get(key)!;
            prev.count += servings;
          } else {
            consolidated.set(key, {
              name,
              totalGrams: 0,
              count: servings,
              aisle,
            });
          }
        }
      }

      // Reemplazar o actualizar los items de la semana
      // Conservar items manuales existentes si los hubiera
      const manualItems = db.shopping_list_items.filter(
        (i) => i.household_id === householdId && i.week_start_date === week_start_date && i.category === 'Manual'
      );

      const generatedItems = [];
      for (const item of consolidated.values()) {
        let quantityText = '';
        if (item.totalGrams > 0) {
          if (item.totalGrams >= 1000) {
            quantityText = `${(item.totalGrams / 1000).toFixed(1)} kg (${Math.round(item.totalGrams)}g)`;
          } else {
            quantityText = `${Math.round(item.totalGrams)} g`;
          }
        } else {
          quantityText = `${item.count} porción(es)`;
        }

        generatedItems.push({
          id: crypto.randomUUID(),
          household_id: householdId,
          week_start_date,
          item_name: item.name,
          quantity_text: quantityText,
          category: item.aisle,
          is_purchased: false,
          created_at: new Date().toISOString(),
        });
      }

      // Actualizar DB
      db.shopping_list_items = [
        ...db.shopping_list_items.filter(
          (i) => !(i.household_id === householdId && i.week_start_date === week_start_date)
        ),
        ...manualItems,
        ...generatedItems,
      ];

      return NextResponse.json({
        success: true,
        items: [...manualItems, ...generatedItems],
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
      db.shopping_list_items.push(newItem);
      return NextResponse.json({ success: true, item: newItem });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
