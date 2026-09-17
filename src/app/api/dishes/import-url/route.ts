import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Helper para parsear duraciones ISO 8601 (ej. PT20M, PT1H30M)
function parseISODuration(durationStr?: string): number {
  if (!durationStr) return 15;
  const match = durationStr.match(/P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return 15;
  const hours = parseInt(match[2] || '0', 10);
  const minutes = parseInt(match[3] || '0', 10);
  return hours * 60 + minutes;
}

// Helper para clasificar pasillo según nombre del ingrediente
function detectAisle(name: string): 'Carnicería y Proteínas' | 'Frutas y Verduras' | 'Abarrotes y Granos' | 'Lácteos y Refrigerados' | 'Condimentos y Aceites' | 'Otros' {
  const n = name.toLowerCase();
  if (/pollo|carne|res|pavo|pescado|atun|atún|salmon|salmón|cerdo|huevo|clara|tofu|camarones|lomo|bife|molida/.test(n)) {
    return 'Carnicería y Proteínas';
  }
  if (/espinaca|lechuga|tomate|jitomate|cebolla|ajo|calabacita|zanahoria|brocoli|brócoli|aguacate|limon|limón|manzana|platano|plátano|fresa|moras|champinones|champiñones|pimiento|papa/.test(n)) {
    return 'Frutas y Verduras';
  }
  if (/arroz|avena|pasta|pan|tortilla|quinoa|lentejas|frijol|garbanzo|harina|cereal|chia|chía/.test(n)) {
    return 'Abarrotes y Granos';
  }
  if (/leche|yogur|yogurt|queso|mantequilla|crema|requeson|requesón|cottage/.test(n)) {
    return 'Lácteos y Refrigerados';
  }
  if (/aceite|sal|pimienta|canela|vainilla|oregano|orégano|vinagre|salsa|comino|mostaza|miel|soya/.test(n)) {
    return 'Condimentos y Aceites';
  }
  return 'Otros';
}

// Helper para estimar gramos y macronutrientes desde texto de ingrediente
function parseIngredientString(raw: string) {
  const clean = raw.trim().replace(/\s+/g, ' ');
  let amount_g = 100;

  // Detectar gramos directamente (ej: "250g de pechuga", "200 g arroz")
  const gMatch = clean.match(/(\d+(?:[.,]\d+)?)\s*(?:g|gr|gramos)/i);
  if (gMatch) {
    amount_g = Math.round(parseFloat(gMatch[1].replace(',', '.')));
  } else if (/(\d+(?:[.,]\d+)?)\s*(?:kg|kilos)/i.test(clean)) {
    const kgMatch = clean.match(/(\d+(?:[.,]\d+)?)\s*(?:kg|kilos)/i);
    if (kgMatch) amount_g = Math.round(parseFloat(kgMatch[1].replace(',', '.')) * 1000);
  } else if (/taza|cup/i.test(clean)) {
    const cupMatch = clean.match(/(\d+(?:\/\d+)?)\s*(?:taza|cup)/i);
    amount_g = cupMatch && cupMatch[1].includes('/') ? 120 : 150;
  } else if (/cucharada|tbsp/i.test(clean)) {
    amount_g = 15;
  } else if (/cucharadita|tsp/i.test(clean)) {
    amount_g = 5;
  } else if (/(\d+)\s*(?:pieza|unidad|huevo|diente|manzana|plátano)/i.test(clean)) {
    const pMatch = clean.match(/(\d+)/);
    const count = pMatch ? parseInt(pMatch[1], 10) : 1;
    amount_g = count * 60;
  }

  // Estimar macros básicos según la proteína o ingrediente
  const aisle = detectAisle(clean);
  let calories = 100;
  let protein_g = 3;
  let carbs_g = 15;
  let fat_g = 2;

  if (aisle === 'Carnicería y Proteínas') {
    protein_g = Number(((amount_g * 0.25)).toFixed(1));
    carbs_g = 0;
    fat_g = Number(((amount_g * 0.05)).toFixed(1));
    calories = Math.round(protein_g * 4 + fat_g * 9);
  } else if (aisle === 'Frutas y Verduras') {
    protein_g = Number(((amount_g * 0.015)).toFixed(1));
    carbs_g = Number(((amount_g * 0.08)).toFixed(1));
    fat_g = 0.2;
    calories = Math.round(carbs_g * 4 + protein_g * 4);
  } else if (aisle === 'Abarrotes y Granos') {
    protein_g = Number(((amount_g * 0.07)).toFixed(1));
    carbs_g = Number(((amount_g * 0.28)).toFixed(1));
    fat_g = Number(((amount_g * 0.02)).toFixed(1));
    calories = Math.round(carbs_g * 4 + protein_g * 4 + fat_g * 9);
  } else if (aisle === 'Lácteos y Refrigerados') {
    protein_g = Number(((amount_g * 0.08)).toFixed(1));
    carbs_g = Number(((amount_g * 0.05)).toFixed(1));
    fat_g = Number(((amount_g * 0.04)).toFixed(1));
    calories = Math.round(protein_g * 4 + carbs_g * 4 + fat_g * 9);
  } else if (aisle === 'Condimentos y Aceites') {
    if (/aceite|mantequilla/i.test(clean)) {
      protein_g = 0;
      carbs_g = 0;
      fat_g = Number(((amount_g * 0.95)).toFixed(1));
      calories = Math.round(fat_g * 9);
    } else {
      calories = 5;
      protein_g = 0;
      carbs_g = 1;
      fat_g = 0;
    }
  }

  // Limpiar nombre del ingrediente de medidas y números iniciales
  let cleanName = clean
    .replace(/^[\d\s\/.,\-(?:g|gr|kg|taza|cucharada|cucharadita|tbsp|tsp|de)]+/i, '')
    .trim();
  if (!cleanName || cleanName.length < 2) cleanName = clean;

  return {
    ingredient_name: cleanName,
    amount_g: Math.max(5, amount_g),
    calories: Math.max(5, calories),
    protein_g,
    carbs_g,
    fat_g,
    aisle_category: aisle,
  };
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('duocal_session')?.value;
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json();
    const { url } = body;

    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      return NextResponse.json({ error: 'Ingresa una URL válida (ej. https://...)' }, { status: 400 });
    }

    // 1. Fetch HTML de la web con User Agent amigable
    let html = '';
    try {
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 DuoCalBot/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!resp.ok) {
        return NextResponse.json({ error: `No se pudo acceder a la página web (HTTP ${resp.status})` }, { status: 400 });
      }
      html = await resp.text();
    } catch (fetchErr: unknown) {
      const msg = fetchErr instanceof Error ? fetchErr.message : 'Error de conexión';
      return NextResponse.json({ error: `Error al consultar la URL: ${msg}` }, { status: 400 });
    }

    // 2. Buscar bloques JSON-LD Schema.org tipo Recipe
    const jsonLdMatches = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    let recipeData: any = null;

    if (jsonLdMatches) {
      for (const scriptTag of jsonLdMatches) {
        const rawJson = scriptTag.replace(/<script[^>]*>|<\/script>/gi, '').trim();
        try {
          const parsed = JSON.parse(rawJson);
          const findRecipe = (obj: any): any => {
            if (!obj) return null;
            if (Array.isArray(obj)) {
              for (const item of obj) {
                const found = findRecipe(item);
                if (found) return found;
              }
            } else if (typeof obj === 'object') {
              if (obj['@type'] === 'Recipe' || (Array.isArray(obj['@type']) && obj['@type'].includes('Recipe'))) {
                return obj;
              }
              if (obj['@graph'] && Array.isArray(obj['@graph'])) {
                return findRecipe(obj['@graph']);
              }
            }
            return null;
          };

          const candidate = findRecipe(parsed);
          if (candidate) {
            recipeData = candidate;
            break;
          }
        } catch {
          // Continuar al siguiente bloque si este no es JSON válido
        }
      }
    }

    // 3. Si encontramos Schema.org Recipe, extraer directamente los campos
    if (recipeData) {
      const title = recipeData.name || 'Receta Importada';
      const description = typeof recipeData.description === 'string' ? recipeData.description : '';
      
      // Servings
      let servings = 1;
      if (recipeData.recipeYield) {
        const yieldStr = Array.isArray(recipeData.recipeYield) ? recipeData.recipeYield[0] : String(recipeData.recipeYield);
        const match = yieldStr.match(/\d+/);
        if (match) servings = parseInt(match[0], 10);
      }

      // Tiempos
      const prepTime = parseISODuration(recipeData.prepTime);
      const cookTime = parseISODuration(recipeData.cookTime || recipeData.totalTime);

      // Instrucciones
      let instructions: string[] = [];
      if (Array.isArray(recipeData.recipeInstructions)) {
        instructions = recipeData.recipeInstructions.map((item: any, idx: number) => {
          if (typeof item === 'string') return `${idx + 1}. ${item.trim()}`;
          if (item.text) return `${idx + 1}. ${item.text.trim()}`;
          if (item.name) return `${idx + 1}. ${item.name.trim()}`;
          return `${idx + 1}. Preparar según indicaciones`;
        });
      } else if (typeof recipeData.recipeInstructions === 'string') {
        instructions = recipeData.recipeInstructions
          .split(/\n+/)
          .map((s: string) => s.trim())
          .filter(Boolean);
      }

      // Ingredientes
      const rawIngredients: string[] = Array.isArray(recipeData.recipeIngredient)
        ? recipeData.recipeIngredient
        : [];

      const ingredients = rawIngredients.map((raw) => parseIngredientString(raw));

      return NextResponse.json({
        success: true,
        source: 'schema_json_ld',
        data: {
          name: title,
          description: description.slice(0, 200),
          category: 'lunch',
          total_servings: Math.max(1, servings),
          prep_time_minutes: prepTime,
          cook_time_minutes: cookTime,
          instructions: instructions.length > 0 ? instructions : ['1. Seguir las instrucciones de la receta original.'],
          ingredients: ingredients.length > 0 ? ingredients : [
            {
              ingredient_name: 'Ingrediente principal de la receta',
              amount_g: 150,
              calories: 220,
              protein_g: 25,
              carbs_g: 10,
              fat_g: 5,
              aisle_category: 'Carnicería y Proteínas',
            }
          ],
        },
      });
    }

    // 4. Si la web NO tiene JSON-LD Recipe, extraer texto limpio del HTML y usar Gemini / Fallback
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const pageTitle = titleMatch ? titleMatch[1].trim() : 'Receta Web';

    // Limpiar HTML para obtener texto relevante
    const cleanText = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .slice(0, 5000);

    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey && !geminiKey.includes('placeholder')) {
      const prompt = `Analiza el contenido de esta página web de cocina y extrae estructuradamente:
1. name: Nombre del platillo
2. description: Descripción breve
3. category: "breakfast" | "lunch" | "dinner" | "snack" | "general"
4. total_servings: número de porciones que rinde
5. prep_time_minutes: minutos de preparación
6. cook_time_minutes: minutos de cocción
7. instructions: array de strings ["1. ...", "2. ..."]
8. ingredients: array de objetos con ingredient_name, amount_g (gramos estimados), calories, protein_g, carbs_g, fat_g, aisle_category ("Carnicería y Proteínas" | "Frutas y Verduras" | "Abarrotes y Granos" | "Lácteos y Refrigerados" | "Condimentos y Aceites" | "Otros")

Texto de la página:
"""
${cleanText}
"""

Responde ÚNICAMENTE en JSON válido con esa estructura.`;

      const aiRes = await fetch(
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

      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const text = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text);
          return NextResponse.json({ success: true, source: 'ai_web_extractor', data: parsed });
        }
      }
    }

    // Fallback si no hay JSON-LD ni IA
    return NextResponse.json({
      success: true,
      source: 'web_fallback',
      data: {
        name: pageTitle.split(/[-–|]/)[0].trim() || 'Receta desde Enlace',
        description: `Importada desde: ${url}`,
        category: 'lunch',
        total_servings: 1,
        prep_time_minutes: 15,
        cook_time_minutes: 20,
        instructions: [
          '1. Preparar y pesar los ingredientes según el enlace original.',
          '2. Cocinar a fuego medio y sazonar.',
          '3. Servir y disfrutar.',
        ],
        ingredients: [
          {
            ingredient_name: 'Ingrediente principal (según receta)',
            amount_g: 150,
            calories: 220,
            protein_g: 25,
            carbs_g: 10,
            fat_g: 5,
            aisle_category: 'Carnicería y Proteínas',
          },
          {
            ingredient_name: 'Guarnición de verduras o carbohidrato',
            amount_g: 100,
            calories: 120,
            protein_g: 3,
            carbs_g: 25,
            fat_g: 1,
            aisle_category: 'Frutas y Verduras',
          },
        ],
      },
      message: 'Se extrajo el título y estructura básica de la página web. Puedes revisar y ajustar los ingredientes.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error procesando enlace';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
