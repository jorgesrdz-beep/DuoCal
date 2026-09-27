import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  parseSmartIngredient,
  translateRecipeTitle,
  translateRecipeInstructions,
  translateCulinaryText,
} from '@/lib/utils/recipeTranslator';

// Helper para parsear duraciones ISO 8601 (ej. PT20M, PT1H30M)
function parseISODuration(durationStr?: string): number {
  if (!durationStr) return 15;
  const match = durationStr.match(/P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return 15;
  const hours = parseInt(match[2] || '0', 10);
  const minutes = parseInt(match[3] || '0', 10);
  return hours * 60 + minutes;
}

// Wrapper para parsear ingrediente con soporte bilingüe de unidades y traducción automática
function parseIngredientString(raw: string) {
  return parseSmartIngredient(raw);
}

// Helper para extraer receta directamente desde el texto estructurado del HTML
function extractRecipeFromHtmlText(html: string) {
  let title = '';
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (ogTitle) title = ogTitle[1];
  if (!title) {
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1) title = h1[1].replace(/<[^>]+>/g, '').trim();
  }
  if (!title) {
    const t = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (t) title = t[1].split(/[-–|]/)[0].trim();
  }
  title = (title || 'Receta').split(/[-–|]/)[0].trim();

  let description = '';
  const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  if (ogDesc) description = ogDesc[1].trim();

  const cleanLines = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '\n')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '\n')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '\n')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  let inIngredients = false;
  let inPreparation = false;
  const rawIngredients: string[] = [];
  const rawSteps: string[] = [];
  let servings = 1;

  for (let i = 0; i < cleanLines.length; i++) {
    const line = cleanLines[i];

    // Detectar encabezado de sección INGREDIENTES
    if (/^\s*INGREDIENTES\b/i.test(line) && line.length < 60) {
      inIngredients = true;
      inPreparation = false;
      const servingsMatch = line.match(/(?:PARA|RINDE|PORCIONES)?\s*(\d+)\s*(?:PERSONAS|PORCIONES|RACIONES)/i);
      if (servingsMatch) {
        servings = parseInt(servingsMatch[1], 10);
      }
      continue;
    }

    // Detectar encabezado de sección PREPARACIÓN / INSTRUCCIONES
    if (/^\s*(PREPARACI[OÓ]N|ELABORACI[OÓ]N|INSTRUCCIONES|PASO A PASO|MODO DE PREPARACI[OÓ]N|PROCEDIMIENTO)\b/i.test(line) && line.length < 60) {
      inIngredients = false;
      inPreparation = true;
      continue;
    }

    // Detener la preparación al llegar a presentación, notas o pie
    if (inPreparation && (/^\s*(PRESENTACI[OÓ]N|NOTAS|CONSEJOS|INFORMACI[OÓ]N NUTRICIONAL|COMENTARIOS|COMPARTIR|¿TE INTERESA|SUSCR|RELACIONADAS)\b/i.test(line) || line.startsWith('-->'))) {
      inPreparation = false;
      break;
    }

    if (inIngredients) {
      if (line.length > 2 && !/^\s*(INGREDIENTES|IMPRIMIR|COMPARTIR)\b/i.test(line)) {
        if (/^para /i.test(line) && line.endsWith(':')) {
          // Subtítulo de sección (ej. "Para la salsa:"), no agregar como ingrediente
        } else {
          rawIngredients.push(line);
        }
      }
    } else if (inPreparation) {
      if (line.length > 5 && !/^\s*(PREPARACI|IMPRIMIR|COMPARTIR)\b/i.test(line)) {
        if (/^para /i.test(line) && line.endsWith(':')) {
          // Subtítulo de salsa o guarnición
        } else {
          rawSteps.push(line);
        }
      }
    }
  }

  return {
    title,
    description,
    servings,
    rawIngredients,
    rawSteps,
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

    // 1. Fetch HTML de la web con rotación resiliente de User Agents (evita bloqueos 403 / Cloudflare)
    let html = '';
    const userAgents = [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    ];

    let lastStatus = 0;
    let lastErrorMsg = '';

    for (const ua of userAgents) {
      try {
        const resp = await fetch(url, {
          headers: {
            'User-Agent': ua,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'es-MX,es;q=0.9,en-US;q=0.8,en;q=0.7',
            'Cache-Control': 'no-cache',
            'Upgrade-Insecure-Requests': '1',
          },
          signal: AbortSignal.timeout(8000),
        });

        lastStatus = resp.status;
        if (resp.ok) {
          html = await resp.text();
          break;
        }
      } catch (err: unknown) {
        lastErrorMsg = err instanceof Error ? err.message : 'Error de conexión';
      }
    }

    if (!html) {
      return NextResponse.json(
        {
          error: `No se pudo acceder a la página web (HTTP ${lastStatus || 'Error'}: El sitio web bloquea conexiones externas). Puedes copiar y pegar los ingredientes en la pestaña "5. Texto".`,
          canPasteText: true,
        },
        { status: 400 }
      );
    }

    // 2. Buscar bloques JSON-LD Schema.org tipo Recipe
    const jsonLdMatches = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    let recipeData: any = null;

    if (jsonLdMatches) {
      for (const scriptTag of jsonLdMatches) {
        const rawJson = scriptTag.replace(/<script[^>]*>|<\/script>/gi, '').trim();
        // Sanitizar caracteres de control no escapados que rompen JSON.parse en scripts embebidos
        const sanitizedJson = rawJson.replace(/[\u0000-\u001F\u007F-\u009F]/g, (char) => {
          if (char === '\n' || char === '\r' || char === '\t') return ' ';
          return '';
        });
        try {
          const parsed = JSON.parse(sanitizedJson);
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
          name: translateRecipeTitle(title),
          description: translateCulinaryText(description.slice(0, 200)),
          category: 'lunch',
          total_servings: Math.max(1, servings),
          prep_time_minutes: prepTime,
          cook_time_minutes: cookTime,
          instructions: translateRecipeInstructions(instructions.length > 0 ? instructions : ['1. Seguir las instrucciones de la receta original.']),
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

    // 4. Si la web NO tiene JSON-LD Recipe, probar extracción heurística de ingredientes y pasos
    const heuristic = extractRecipeFromHtmlText(html);
    if (heuristic.rawIngredients && heuristic.rawIngredients.length > 0) {
      const ingredients = heuristic.rawIngredients.map((raw) => parseIngredientString(raw));
      const instructions = heuristic.rawSteps && heuristic.rawSteps.length > 0
        ? heuristic.rawSteps.map((s, idx) => `${idx + 1}. ${s.replace(/^\d+[\.\)]\s*/, '')}`)
        : ['1. Seguir las instrucciones de la receta original.'];

      return NextResponse.json({
        success: true,
        source: 'html_heuristic_extractor',
        data: {
          name: translateRecipeTitle(heuristic.title || 'Receta Importada'),
          description: (heuristic.description || `Importada desde: ${url}`).slice(0, 200),
          category: 'lunch',
          total_servings: Math.max(1, heuristic.servings),
          prep_time_minutes: 20,
          cook_time_minutes: 30,
          instructions: translateRecipeInstructions(instructions),
          ingredients,
        },
      });
    }

    // 5. Si la heurística no detectó ingredientes, intentar IA Gemini si está configurada
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const pageTitle = titleMatch ? titleMatch[1].trim() : 'Receta Web';

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

    // Fallback si no hay JSON-LD, heurística ni IA
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
