import { NextResponse } from 'next/server';
import { STARTER_RECIPES } from '@/lib/data/starterRecipes';
import { getDb } from '@/lib/store/mockDb';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export async function GET() {
  return NextResponse.json({ templates: STARTER_RECIPES });
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('duocal_session')?.value;
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json();
    const { templateId } = body;

    const template = STARTER_RECIPES.find((t) => t.id === templateId);
    if (!template) {
      return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 });
    }

    const db = await getDb();
    const user = db.profiles.find((p) => p.id === userId);

    const newDishId = 'dish-' + crypto.randomUUID().slice(0, 8);

    const clonedDish = {
      ...template,
      id: newDishId,
      user_id: userId,
      household_id: user?.household_id || null,
      is_starter_template: false,
      created_at: new Date().toISOString(),
    };

    db.dishes.unshift(clonedDish);

    // Clonar ingredientes
    if (template.ingredients) {
      for (const ing of template.ingredients) {
        db.dish_ingredients.push({
          ...ing,
          id: 'di-' + crypto.randomUUID().slice(0, 8),
          dish_id: newDishId,
          created_at: new Date().toISOString(),
        });
      }
    }

    return NextResponse.json({ success: true, dish: clonedDish });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al clonar plantilla';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
