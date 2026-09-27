import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('duocal_session')?.value;
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json();
    const { recipeText } = body;

    if (!recipeText || recipeText.trim().length < 15) {
      return NextResponse.json({ error: 'Pega un texto de receta más descriptivo' }, { status: 400 });
    }

    const geminiKey = process.env.GEMINI_API_KEY;

    if (geminiKey && !geminiKey.includes('placeholder')) {
      const prompt = `Analiza este texto de receta de cocina y extrae estructuradamente:
1. name (nombre del platillo)
2. description (descripción breve y apetitosa)
3. category (breakfast, lunch, dinner, snack o general)
4. total_servings (número de porciones que rinde, por defecto 1 si no se indica)
5. prep_time_minutes (número entero)
6. cook_time_minutes (número entero)
7. instructions (array de strings con los pasos de preparación ordenados: ["1. ...", "2. ..."])
8. ingredients (array de objetos con los ingredientes y gramos estimados):
   [
     {
       "ingredient_name": "Pechuga de pollo",
       "amount_g": 150,
       "calories": 245,
       "protein_g": 46.0,
       "carbs_g": 0.0,
       "fat_g": 5.0,
       "aisle_category": "Carnicería y Proteínas" // opciones: "Carnicería y Proteínas", "Frutas y Verduras", "Abarrotes y Granos", "Lácteos y Refrigerados", "Condimentos y Aceites"
     }
   ]

Texto de la receta a procesar:
"""
${recipeText}
"""

Responde ÚNICAMENTE con un JSON válido con esta estructura, sin markdown ni comillas invertidas.`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { response_mime_type: 'application/json' },
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text);
          return NextResponse.json({ success: true, data: parsed, source: 'gemini' });
        }
      }
    }

    // Fallback inteligente parseando líneas si no hay clave de Gemini
    const { parseSmartIngredient, translateRecipeTitle, translateRecipeInstructions } = await import('@/lib/utils/recipeTranslator');
    const lines = recipeText.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
    const parsedIngredients = [];
    const parsedInstructions = [];
    let detectedTitle = '';

    for (const line of lines) {
      if (!detectedTitle && !/^\d|^[-*•]|ingrediente|preparaci|paso/i.test(line) && line.length < 50) {
        detectedTitle = line;
        continue;
      }
      if (/^\d+[\.\)]\s+|paso\s*\d+/i.test(line) || /cocinar|hervir|mezclar|hornear|calentar|servir|sofreír|picar/i.test(line)) {
        parsedInstructions.push(line);
      } else {
        const ing = parseSmartIngredient(line.replace(/^[-*•]\s*/, ''));
        if (ing.ingredient_name && ing.ingredient_name.length > 2) {
          parsedIngredients.push(ing);
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        name: translateRecipeTitle(detectedTitle || 'Platillo Importado'),
        description: 'Receta importada desde texto.',
        category: 'lunch',
        total_servings: 1,
        prep_time_minutes: 15,
        cook_time_minutes: 25,
        instructions: parsedInstructions.length > 0
          ? translateRecipeInstructions(parsedInstructions)
          : ['1. Preparar y pesar los ingredientes.', '2. Cocinar a fuego medio y servir caliente.'],
        ingredients: parsedIngredients.length > 0 ? parsedIngredients : [
          {
            ingredient_name: 'Pechuga de pollo o proteína principal',
            amount_g: 150,
            calories: 245,
            protein_g: 45,
            carbs_g: 0,
            fat_g: 5,
            aisle_category: 'Carnicería y Proteínas',
          },
        ],
      },
      source: 'smart_text_parser',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al parsear receta';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
