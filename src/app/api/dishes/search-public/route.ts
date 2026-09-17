import { NextResponse } from 'next/server';

function detectAisle(name: string): 'Carnicería y Proteínas' | 'Frutas y Verduras' | 'Abarrotes y Granos' | 'Lácteos y Refrigerados' | 'Condimentos y Aceites' | 'Otros' {
  const n = name.toLowerCase();
  if (/chicken|beef|pork|turkey|fish|salmon|tuna|egg|meat|steak|shrimp|bacon|lamb|duck|pollo|carne|pescado|huevo|atun|atún|salmon|salmón/.test(n)) {
    return 'Carnicería y Proteínas';
  }
  if (/onion|garlic|tomato|spinach|lettuce|carrot|broccoli|avocado|lemon|lime|apple|banana|pepper|mushroom|potato|cebolla|ajo|jitomate|espinaca|lechuga|zanahoria|brocoli|brócoli|aguacate|limon|limón|manzana|platano|plátano|pimiento|champinon|champiñón|papa/.test(n)) {
    return 'Frutas y Verduras';
  }
  if (/rice|oats|pasta|flour|bread|quinoa|beans|lentils|corn|noodles|sugar|arroz|avena|pasta|harina|pan|lenteja|frijol|maiz|maíz/.test(n)) {
    return 'Abarrotes y Granos';
  }
  if (/milk|cheese|butter|cream|yogurt|cottage|parmesan|cheddar|leche|queso|mantequilla|crema|yogur/.test(n)) {
    return 'Lácteos y Refrigerados';
  }
  if (/oil|salt|pepper|vinegar|sauce|oregano|cinnamon|cumin|paprika|mustard|soy|honey|aceite|sal|pimienta|vinagre|salsa|oregano|orégano|canela|comino|miel/.test(n)) {
    return 'Condimentos y Aceites';
  }
  return 'Otros';
}

function parseMeasureToGrams(measure: string, ingredient: string): number {
  const m = (measure || '').toLowerCase().trim();
  const ing = ingredient.toLowerCase();

  const gMatch = m.match(/(\d+(?:\.\d+)?)\s*g/);
  if (gMatch) return Math.round(parseFloat(gMatch[1]));

  const kgMatch = m.match(/(\d+(?:\.\d+)?)\s*kg/);
  if (kgMatch) return Math.round(parseFloat(kgMatch[1]) * 1000);

  const lbMatch = m.match(/(\d+(?:\.\d+)?)\s*(?:lb|pound)/);
  if (lbMatch) return Math.round(parseFloat(lbMatch[1]) * 453);

  const ozMatch = m.match(/(\d+(?:\.\d+)?)\s*oz/);
  if (ozMatch) return Math.round(parseFloat(ozMatch[1]) * 28.3);

  if (/cup|taza/i.test(m)) {
    if (/1\/2/.test(m)) return 80;
    if (/1\/4/.test(m)) return 40;
    if (/1\/3/.test(m)) return 50;
    const num = parseFloat(m) || 1;
    return Math.round(num * 140);
  }

  if (/tbsp|tablespoon|cucharada/i.test(m)) {
    const num = parseFloat(m) || 1;
    return Math.round(num * 15);
  }

  if (/tsp|teaspoon|cucharadita/i.test(m)) {
    const num = parseFloat(m) || 1;
    return Math.round(num * 5);
  }

  if (/clove|diente/i.test(m)) {
    const num = parseFloat(m) || 1;
    return Math.round(num * 5);
  }

  const num = parseFloat(m);
  if (!isNaN(num) && num > 0) {
    if (/chicken|beef|meat|fish|salmon|fillet|pechuga|filete/i.test(ing)) return Math.round(num * 150);
    if (/egg|huevo/i.test(ing)) return Math.round(num * 55);
    if (/onion|tomato|potato|apple|banana/i.test(ing)) return Math.round(num * 100);
    return Math.round(num * 30);
  }

  return 50;
}

function estimateMacros(ingredient: string, amount_g: number, aisle: string) {
  let calories = 50;
  let protein_g = 2;
  let carbs_g = 8;
  let fat_g = 1;

  if (aisle === 'Carnicería y Proteínas') {
    protein_g = Number(((amount_g * 0.24)).toFixed(1));
    carbs_g = 0;
    fat_g = Number(((amount_g * 0.06)).toFixed(1));
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
    carbs_g = Number(((amount_g * 0.04)).toFixed(1));
    fat_g = Number(((amount_g * 0.05)).toFixed(1));
    calories = Math.round(protein_g * 4 + carbs_g * 4 + fat_g * 9);
  } else if (aisle === 'Condimentos y Aceites') {
    if (/oil|butter|aceite|mantequilla/i.test(ingredient)) {
      protein_g = 0;
      carbs_g = 0;
      fat_g = Number(((amount_g * 0.9)).toFixed(1));
      calories = Math.round(fat_g * 9);
    } else {
      protein_g = 0;
      carbs_g = 1;
      fat_g = 0;
      calories = 5;
    }
  }

  return {
    calories: Math.max(5, calories),
    protein_g,
    carbs_g,
    fat_g,
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || 'chicken').trim();

    const res = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(q)}`, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Error al consultar catálogo de recetas' }, { status: 502 });
    }

    const data = await res.json();
    const meals = data.meals || [];

    const formatted = meals.slice(0, 8).map((meal: any) => {
      const ingredients: Array<{
        ingredient_name: string;
        amount_g: number;
        calories: number;
        protein_g: number;
        carbs_g: number;
        fat_g: number;
        aisle_category: string;
      }> = [];

      for (let i = 1; i <= 20; i++) {
        const ing = meal[`strIngredient${i}`];
        const measure = meal[`strMeasure${i}`];
        if (ing && ing.trim()) {
          const cleanIng = ing.trim();
          const grams = parseMeasureToGrams(measure || '', cleanIng);
          const aisle = detectAisle(cleanIng);
          const macros = estimateMacros(cleanIng, grams, aisle);

          ingredients.push({
            ingredient_name: cleanIng,
            amount_g: grams,
            calories: macros.calories,
            protein_g: macros.protein_g,
            carbs_g: macros.carbs_g,
            fat_g: macros.fat_g,
            aisle_category: aisle,
          });
        }
      }

      // Separar instrucciones en pasos limpios
      const instructions = (meal.strInstructions || '')
        .split(/\r?\n+/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 5)
        .map((s: string, idx: number) => (/^\d+\.?/.test(s) ? s : `${idx + 1}. ${s}`));

      const totalCalories = ingredients.reduce((sum, ing) => sum + ing.calories, 0);
      const totalProtein = ingredients.reduce((sum, ing) => sum + ing.protein_g, 0);
      const totalCarbs = ingredients.reduce((sum, ing) => sum + ing.carbs_g, 0);
      const totalFat = ingredients.reduce((sum, ing) => sum + ing.fat_g, 0);

      // Por defecto calculamos 2 porciones para estas recetas familiares
      const servings = 2;

      return {
        id: meal.idMeal,
        name: meal.strMeal,
        description: `Receta de ${meal.strArea || 'cocina internacional'} (${meal.strCategory || 'Platillo principal'}).`,
        category: meal.strCategory?.toLowerCase().includes('breakfast')
          ? 'breakfast'
          : meal.strCategory?.toLowerCase().includes('dessert')
          ? 'snack'
          : 'lunch',
        total_servings: servings,
        prep_time_minutes: 15,
        cook_time_minutes: 25,
        thumbnail_url: meal.strMealThumb,
        instructions: instructions.length > 0 ? instructions : ['1. Cocinar los ingredientes según la receta tradicional.'],
        ingredients,
        calories_per_serving: Math.round(totalCalories / servings),
        protein_per_serving: Number((totalProtein / servings).toFixed(1)),
        carbs_per_serving: Number((totalCarbs / servings).toFixed(1)),
        fat_per_serving: Number((totalFat / servings).toFixed(1)),
      };
    });

    return NextResponse.json({
      success: true,
      count: formatted.length,
      recipes: formatted,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error en búsqueda pública';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
