/**
 * Diccionario y Motor de Traducción Culinaria Inglés -> Español
 * y Parser Inteligente de Unidades de Cocina
 */

// Diccionario de traducción de ingredientes comunes (inglés a español)
const INGREDIENT_TRANSLATIONS: Record<string, string> = {
  // Carnes y Proteínas
  'boneless skinless chicken thighs': 'Contramuslos de pollo sin piel ni hueso',
  'boneless skinless chicken thigh': 'Contramuslos de pollo sin piel ni hueso',
  'skinless chicken thighs': 'Contramuslos de pollo sin piel',
  'chicken thighs': 'Contramuslos de pollo',
  'chicken thigh': 'Contramuslo de pollo',
  'chicken breast': 'Pechuga de pollo',
  'chicken breasts': 'Pechuga de pollo',
  'chicken tenders': 'Tiras de pollo',
  'chicken wings': 'Alitas de pollo',
  'chicken drumsticks': 'Muslos de pollo',
  'ground chicken': 'Pollo molido',
  'ground beef': 'Carne molida de res',
  'ground turkey': 'Pavo molido',
  'ground pork': 'Cerdo molido',
  'beef steak': 'Bistec de res',
  'flank steak': 'Falda de res',
  'sirloin steak': 'Solomillo de res',
  'pork chop': 'Chuleta de cerdo',
  'pork chops': 'Chuletas de cerdo',
  'pork tenderloin': 'Lomo de cerdo',
  'bacon': 'Tocino',
  'turkey bacon': 'Tocino de pavo',
  'salmon fillet': 'Filete de salmón',
  'salmon fillets': 'Filetes de salmón',
  'salmon': 'Salmón',
  'tuna': 'Atún',
  'canned tuna': 'Atún en lata',
  'shrimp': 'Camarones',
  'prawns': 'Langostinos',
  'cod': 'Bacalao',
  'tilapia': 'Tilapia',
  'egg': 'Huevo',
  'eggs': 'Huevos',
  'egg white': 'Clara de huevo',
  'egg whites': 'Claras de huevo',
  'tofu': 'Tofu',

  // Verduras y Hortalizas
  'onion': 'Cebolla',
  'onions': 'Cebolla',
  'red onion': 'Cebolla morada',
  'white onion': 'Cebolla blanca',
  'yellow onion': 'Cebolla amarilla',
  'green onion': 'Cebollín / Cebolleta',
  'spring onion': 'Cebollín / Cebolleta',
  'scallion': 'Cebollín',
  'scallions': 'Cebollines',
  'garlic': 'Ajo',
  'garlic clove': 'Diente de ajo',
  'garlic cloves': 'Dientes de ajo',
  'red bell pepper': 'Pimiento rojo',
  'green bell pepper': 'Pimiento verde',
  'yellow bell pepper': 'Pimiento amarillo',
  'bell pepper': 'Pimiento morrón',
  'bell peppers': 'Pimientos morrones',
  'chili pepper': 'Chile / Guindilla',
  'jalapeno': 'Jalapeño',
  'serrano pepper': 'Chile serrano',
  'tomato': 'Tomate',
  'tomatoes': 'Tomates',
  'roma tomato': 'Jitomate / Tomate Roma',
  'cherry tomatoes': 'Tomates cherry',
  'carrot': 'Zanahoria',
  'carrots': 'Zanahorias',
  'celery': 'Apio',
  'spinach': 'Espinacas',
  'baby spinach': 'Espinacas baby',
  'kale': 'Col rizada / Kale',
  'lettuce': 'Lechuga',
  'romaine lettuce': 'Lechuga romana',
  'broccoli': 'Brócoli',
  'cauliflower': 'Coliflor',
  'zucchini': 'Calabacita / Calabacín',
  'courgette': 'Calabacín',
  'cucumber': 'Pepino',
  'mushrooms': 'Champiñones',
  'mushroom': 'Champiñón',
  'avocado': 'Aguacate',
  'avocados': 'Aguacates',
  'potato': 'Papa / Patata',
  'potatoes': 'Papas / Patatas',
  'sweet potato': 'Camote / Batata',
  'corn': 'Maíz / Elote',
  'peas': 'Chícharos / Guisantes',
  'green beans': 'Ejotes / Judías verdes',
  'asparagus': 'Espárragos',
  'cabbage': 'Col / Repollo',

  // Frutas
  'lemon': 'Limón amarillo',
  'lemon juice': 'Jugo de limón',
  'lime': 'Limón verde / Lima',
  'lime juice': 'Jugo de limón verde',
  'apple': 'Manzana',
  'banana': 'Plátano',
  'orange': 'Naranja',
  'strawberries': 'Fresas',
  'blueberries': 'Arándanos',

  // Especias, Salsas y Pastas
  'ground coriander': 'Cilantro molido',
  'coriander': 'Cilantro',
  'fresh coriander': 'Cilantro fresco',
  'cilantro': 'Cilantro',
  'ground cumin': 'Comino molido',
  'cumin': 'Comino',
  'chipotle paste': 'Pasta de chile chipotle',
  'chipotle in adobo': 'Chiles chipotles en adobo',
  'tomato puree': 'Puré / Pasta concentrada de tomate',
  'tomato purée': 'Puré / Pasta concentrada de tomate',
  'tomato paste': 'Pasta de tomate',
  'crushed tomatoes': 'Tomate triturado',
  'chicken stock': 'Caldo de pollo',
  'chicken broth': 'Caldo de pollo',
  'beef stock': 'Caldo de res',
  'vegetable stock': 'Caldo de verduras',
  'olive oil': 'Aceite de oliva',
  'extra virgin olive oil': 'Aceite de oliva virgen extra',
  'vegetable oil': 'Aceite vegetal',
  'salt': 'Sal',
  'sea salt': 'Sal marina',
  'kosher salt': 'Sal kosher',
  'black pepper': 'Pimienta negra',
  'ground black pepper': 'Pimienta negra molida',
  'paprika': 'Pimentón / Paprika',
  'smoked paprika': 'Pimentón ahumado',
  'oregano': 'Orégano',
  'dried oregano': 'Orégano seco',
  'basil': 'Albahaca',
  'thyme': 'Tomillo',
  'rosemary': 'Romero',
  'parsley': 'Perejil',
  'cinnamon': 'Canela',
  'ground cinnamon': 'Canela molida',
  'soy sauce': 'Salsa de soya',
  'mayonnaise': 'Mayonesa',
  'mustard': 'Mostaza',
  'dijon mustard': 'Mostaza Dijon',
  'honey': 'Miel',
  'maple syrup': 'Miel de maple',
  'vinegar': 'Vinagre',
  'apple cider vinegar': 'Vinagre de manzana',

  // Lácteos y Granos
  'milk': 'Leche',
  'greek yogurt': 'Yogur griego',
  'plain yogurt': 'Yogur natural',
  'butter': 'Mantequilla',
  'cheddar cheese': 'Queso cheddar',
  'mozzarella cheese': 'Queso mozzarella',
  'parmesan cheese': 'Queso parmesano',
  'cream cheese': 'Queso crema',
  'sour cream': 'Crema ácida',
  'heavy cream': 'Crema para batir',
  'rice': 'Arroz',
  'white rice': 'Arroz blanco',
  'brown rice': 'Arroz integral',
  'quinoa': 'Quinoa',
  'oats': 'Avena',
  'rolled oats': 'Hojuelas de avena',
  'pasta': 'Pasta',
  'spaghetti': 'Espagueti',
  'bread': 'Pan',
  'tortilla': 'Tortilla',
  'tortillas': 'Tortillas',
  'corn tortillas': 'Tortillas de maíz',
  'flour tortillas': 'Tortillas de harina',
  'black beans': 'Frijoles negros',
  'kidney beans': 'Frijoles rojos',
  'chickpeas': 'Garbanzos',
  'lentils': 'Lentejas',
};

// Traductor de títulos de recetas frecuentes
const RECIPE_TITLE_WORDS: [RegExp, string][] = [
  [/\bjuicy pulled chipotle chicken\b/gi, 'Pollo jugoso deshebrado al chipotle'],
  [/\bpulled chicken\b/gi, 'Pollo deshebrado'],
  [/\bchipotle chicken\b/gi, 'Pollo al chipotle'],
  [/\bjuicy\b/gi, 'jugoso'],
  [/\bpulled\b/gi, 'deshebrado'],
  [/(?<!al\s+)\bchipotle\b/gi, 'al chipotle'],
  [/\bchicken\b/gi, 'pollo'],
  [/\bcasserole\b/gi, 'cacerola'],
  [/\bbowl\b/gi, 'bowl'],
  [/\bsalad\b/gi, 'ensalada'],
  [/\bsoup\b/gi, 'sopa'],
  [/\bstew\b/gi, 'estofado'],
  [/\broast(?:ed)?\b/gi, 'asado'],
  [/\bgrilled\b/gi, 'a la parrilla'],
  [/\bbaked\b/gi, 'al horno'],
  [/\bpan-seared\b/gi, 'sellado a la sartén'],
  [/\bcreamy\b/gi, 'cremoso'],
  [/\bcrispy\b/gi, 'crujiente'],
  [/\bspicy\b/gi, 'picante'],
  [/\bsweet and sour\b/gi, 'agridulce'],
  [/\bgarlic\b/gi, 'al ajo'],
  [/\bwith\b/gi, 'con'],
  [/\band\b/gi, 'y'],
];

/**
 * Traduce un texto culinario (ingrediente, título o frase) al español
 */
export function translateCulinaryText(text: string): string {
  if (!text || typeof text !== 'string') return '';
  const clean = text.trim();
  const lower = clean.toLowerCase();

  // 1. Coincidencia exacta directa
  if (INGREDIENT_TRANSLATIONS[lower]) {
    return INGREDIENT_TRANSLATIONS[lower];
  }

  // 2. Coincidencia buscando sufijos o prefijos
  for (const [en, es] of Object.entries(INGREDIENT_TRANSLATIONS)) {
    if (lower === en) return es;
  }

  // 3. Reemplazos por palabras clave comunes
  let translated = clean;
  for (const [en, es] of Object.entries(INGREDIENT_TRANSLATIONS)) {
    const regex = new RegExp(`\\b${en}\\b`, 'gi');
    if (regex.test(translated)) {
      translated = translated.replace(regex, es);
      break;
    }
  }

  // Si no hubo traducción directa, traducir palabras descriptoras
  translated = translated
    .replace(/\bboneless\b/gi, 'sin hueso')
    .replace(/\bskinless\b/gi, 'sin piel')
    .replace(/\bground\b/gi, 'molido/a')
    .replace(/\bchopped\b/gi, 'picado/a')
    .replace(/\bdiced\b/gi, 'en cubos')
    .replace(/\bminced\b/gi, 'picado fino')
    .replace(/\bsliced\b/gi, 'en rebanadas')
    .replace(/\bshredded\b/gi, 'deshebrado/a')
    .replace(/\bcooked\b/gi, 'cocido/a')
    .replace(/\bfresh\b/gi, 'fresco/a')
    .replace(/\bdried\b/gi, 'seco/a')
    .replace(/\broasted\b/gi, 'asado/a')
    .replace(/\bto taste\b/gi, 'al gusto');

  return translated.charAt(0).toUpperCase() + translated.slice(1);
}

/**
 * Traduce el título de una receta al español si está en inglés
 */
export function translateRecipeTitle(title: string): string {
  if (!title) return 'Receta';
  let res = title;
  for (const [regex, replacement] of RECIPE_TITLE_WORDS) {
    res = res.replace(regex, replacement);
  }
  return res.charAt(0).toUpperCase() + res.slice(1);
}

/**
 * Traduce instrucciones o pasos de preparación comunes del inglés al español
 */
export function translateRecipeInstructions(steps: string[]): string[] {
  if (!steps || !Array.isArray(steps)) return [];

  const INSTRUCTION_PATTERNS: [RegExp, string][] = [
    [/\bfinely dice the onion\b/gi, 'Picar finamente la cebolla'],
    [/\bgrate the garlic\b/gi, 'rallar el ajo'],
    [/\bthinly slice the peppers\b/gi, 'cortar los pimientos en tiras finas'],
    [/\bset a large saucepan\b/gi, 'Calentar una cacerola grande'],
    [/\bover a medium heat\b/gi, 'a fuego medio'],
    [/\bover a low heat\b/gi, 'a fuego bajo'],
    [/\bover a high heat\b/gi, 'a fuego alto'],
    [/\bwith a drizzle of olive oil\b/gi, 'con un chorrito de aceite de oliva'],
    [/\bcook for 5[–-]7 mins until softened\b/gi, 'cocinar durante 5–7 minutos hasta que suavicen'],
    [/\badd the garlic\b/gi, 'agregar el ajo'],
    [/\badd the chicken thighs\b/gi, 'agregar los contramuslos de pollo'],
    [/\bin whole to the pan\b/gi, 'enteros a la cacerola'],
    [/\bpour in the chicken stock\b/gi, 'verter el caldo de pollo'],
    [/\bseason with salt and pepper\b/gi, 'sazonar con sal y pimienta'],
    [/\bbring to the boil\b/gi, 'llevar a ebullición'],
    [/\buntil the chicken is tender\b/gi, 'hasta que el pollo esté tierno'],
    [/\band the sauce has thickened\b/gi, 'y la salsa haya espesado'],
    [/\buse two forks to shred the chicken\b/gi, 'Usar dos tenedores para deshebrar el pollo'],
    [/\bdirectly in the pan\b/gi, 'directamente en la cacerola'],
    [/\bstir it all together\b/gi, 'mezclar todo'],
    [/\bseason to taste\b/gi, 'sazonar al gusto'],
    [/\bserve warm\b/gi, 'servir caliente'],
    [/\bpreheat oven to\b/gi, 'Precalentar el horno a'],
  ];

  return steps.map((step) => {
    let s = step;
    for (const [pattern, repl] of INSTRUCTION_PATTERNS) {
      s = s.replace(pattern, repl);
    }
    // Traducir palabras sueltas comunes
    s = s
      .replace(/\badd\b/gi, 'agregar')
      .replace(/\bmix\b/gi, 'mezclar')
      .replace(/\bstir\b/gi, 'revolver')
      .replace(/\bcook\b/gi, 'cocinar')
      .replace(/\bboil\b/gi, 'hervir')
      .replace(/\bsimmer\b/gi, 'cocinar a fuego lento')
      .replace(/\bbake\b/gi, 'hornear')
      .replace(/\bheat\b/gi, 'calentar')
      .replace(/\bminutes\b/gi, 'minutos')
      .replace(/\bmins\b/gi, 'minutos')
      .replace(/\bseconds\b/gi, 'segundos')
      .replace(/\bserve with\b/gi, 'servir con')
      .replace(/\bonion\b/gi, 'cebolla')
      .replace(/\bgarlic\b/gi, 'ajo')
      .replace(/\bpeppers?\b/gi, 'pimientos')
      .replace(/\bchicken\b/gi, 'pollo');
    return s.charAt(0).toUpperCase() + s.slice(1);
  });
}

// Clasificación de pasillos
export function detectAisleCategory(name: string): 'Carnicería y Proteínas' | 'Frutas y Verduras' | 'Abarrotes y Granos' | 'Lácteos y Refrigerados' | 'Condimentos y Aceites' | 'Otros' {
  const n = name.toLowerCase();

  // Condimentos y caldos primero (para evitar que "caldo de pollo" caiga en carnicería)
  if (/caldo|broth|stock|aceite|sal\b|pimienta|canela|vainilla|oregano|orégano|mejorana|vinagre|salsa|comino|cilantro|mostaza|miel|soya|manteca|azucar|azúcar|oil|salt|pepper|cumin|coriander|chipotle|especias|condimento|paprika|curry/.test(n)) {
    return 'Condimentos y Aceites';
  }
  if (/pollo|carne|res|pavo|pescado|atun|atún|salmon|salmón|cerdo|huevo|clara|tofu|camarones|lomo|bife|molida|chicken|beef|pork|turkey|meat|steak|fish|shrimp/.test(n)) {
    return 'Carnicería y Proteínas';
  }
  if (/espinaca|lechuga|tomate|jitomate|cebolla|ajo|calabacita|zanahoria|brocoli|brócoli|aguacate|limon|limón|manzana|platano|plátano|fresa|moras|champinones|champiñones|pimiento|papa|papas|perejil|chile|chiles|onion|garlic|pepper|carrot|potato|spinach|tomato|lettuce/.test(n)) {
    return 'Frutas y Verduras';
  }
  if (/arroz|avena|pasta|pan|tortilla|quinoa|lentejas|frijol|garbanzo|harina|cereal|chia|chía|rice|oats|beans|bread|noodles/.test(n)) {
    return 'Abarrotes y Granos';
  }
  if (/leche|yogur|yogurt|queso|mantequilla|crema|requeson|requesón|cottage|milk|cheese|butter|cream/.test(n)) {
    return 'Lácteos y Refrigerados';
  }
  return 'Otros';
}

/**
 * Parser inteligente de ingredientes culinarios con soporte para:
 * - Números enteros, decimales y fracciones (1/2, 1/4, 1.5, ½, etc.)
 * - Unidades pegadas a números (3tsp, 1tbsp, 4tbsp, 300ml, 12thighs)
 * - Piezas con pesos unitarios realistas
 * - Unidades de volumen y masa (ml, l, tsp, tbsp, cup, oz, lb, g, kg)
 * - Ingredientes sin cantidad / al gusto (aceite, sal, pimienta)
 * - Traducción automática al español
 */
export function parseSmartIngredient(raw: string) {
  const original = raw.trim().replace(/\s+/g, ' ');
  let clean = original;

  // 1. Extraer cantidad inicial (soporta fracciones como 1/2, números decimales y caracteres Unicode ½, ¼, ¾)
  let count = 1;
  let hasExplicitQuantity = false;

  // Normalizar fracciones unicode
  clean = clean
    .replace(/½/g, ' 1/2 ')
    .replace(/¼/g, ' 1/4 ')
    .replace(/¾/g, ' 3/4 ')
    .replace(/⅓/g, ' 1/3 ')
    .replace(/⅔/g, ' 2/3 ')
    .trim();

  // Buscar fracción compuesta (ej: "1 1/2") o fracción simple (ej: "1/2") o decimal / entero
  const mixedFractionMatch = clean.match(/^(\d+)\s+(\d+)\/(\d+)/);
  const fractionMatch = clean.match(/^(\d+)\/(\d+)/);
  const decimalMatch = clean.match(/^(\d+(?:[.,]\d+)?)/);

  if (mixedFractionMatch) {
    const whole = parseFloat(mixedFractionMatch[1]);
    const num = parseFloat(mixedFractionMatch[2]);
    const den = parseFloat(mixedFractionMatch[3]);
    count = whole + (num / den);
    hasExplicitQuantity = true;
    clean = clean.slice(mixedFractionMatch[0].length).trim();
  } else if (fractionMatch) {
    const num = parseFloat(fractionMatch[1]);
    const den = parseFloat(fractionMatch[2]);
    count = num / den;
    hasExplicitQuantity = true;
    clean = clean.slice(fractionMatch[0].length).trim();
  } else if (decimalMatch) {
    count = parseFloat(decimalMatch[1].replace(',', '.'));
    hasExplicitQuantity = true;
    clean = clean.slice(decimalMatch[0].length).trim();
  }

  // 2. Detectar unidad de medida (separada o pegada al nombre)
  let unit = 'g';
  let calculatedGrams = 100;
  let matchedUnit = false;

  // Revisar si empieza con una unidad de medida
  // Mililitros / Litros
  const mlMatch = clean.match(/^(?:ml|millilitres?|milliliters?|mililitros?|cc)\b/i);
  const lMatch = clean.match(/^(?:l|litres?|liters?|litros?)\b/i);
  // Cucharaditas (tsp)
  const tspMatch = clean.match(/^(?:tsp|teaspoons?|cucharaditas?|cdtas?)\b/i);
  // Cucharadas (tbsp)
  const tbspMatch = clean.match(/^(?:tbsp|tablespoons?|cucharadas?|cdas?)\b/i);
  // Tazas (cups)
  const cupMatch = clean.match(/^(?:cups?|tazas?)\b/i);
  // Onzas (oz)
  const ozMatch = clean.match(/^(?:oz|ounces?|onzas?)\b/i);
  // Libras (lb)
  const lbMatch = clean.match(/^(?:lbs?|pounds?|libras?)\b/i);
  // Kilos (kg)
  const kgMatch = clean.match(/^(?:kg|kilos?|kilogramos?)\b/i);
  // Gramos (g)
  const gMatch = clean.match(/^(?:g|gr|grams?|gramos?)\b/i);
  // Latas
  const canMatch = clean.match(/^(?:cans?|latas?)\b/i);
  // Dientes de ajo
  const cloveMatch = clean.match(/^(?:cloves?|dientes?)\b/i);
  // Rebanadas
  const sliceMatch = clean.match(/^(?:slices?|rebanadas?)\b/i);

  if (mlMatch) {
    calculatedGrams = Math.round(count * 1);
    clean = clean.slice(mlMatch[0].length).trim();
    matchedUnit = true;
  } else if (lMatch) {
    calculatedGrams = Math.round(count * 1000);
    clean = clean.slice(lMatch[0].length).trim();
    matchedUnit = true;
  } else if (tspMatch) {
    // 1 tsp de especias suele ser ~2-3g, líquidos ~5g
    calculatedGrams = Math.max(1, Math.round(count * 5));
    clean = clean.slice(tspMatch[0].length).trim();
    matchedUnit = true;
  } else if (tbspMatch) {
    // 1 tbsp de pasta/aceite/líquido son ~15g
    calculatedGrams = Math.max(2, Math.round(count * 15));
    clean = clean.slice(tbspMatch[0].length).trim();
    matchedUnit = true;
  } else if (cupMatch) {
    calculatedGrams = Math.round(count * 200);
    clean = clean.slice(cupMatch[0].length).trim();
    matchedUnit = true;
  } else if (ozMatch) {
    calculatedGrams = Math.round(count * 28.35);
    clean = clean.slice(ozMatch[0].length).trim();
    matchedUnit = true;
  } else if (lbMatch) {
    calculatedGrams = Math.round(count * 453.6);
    clean = clean.slice(lbMatch[0].length).trim();
    matchedUnit = true;
  } else if (kgMatch) {
    calculatedGrams = Math.round(count * 1000);
    clean = clean.slice(kgMatch[0].length).trim();
    matchedUnit = true;
  } else if (gMatch) {
    calculatedGrams = Math.round(count);
    clean = clean.slice(gMatch[0].length).trim();
    matchedUnit = true;
  } else if (canMatch) {
    calculatedGrams = Math.round(count * 400);
    clean = clean.slice(canMatch[0].length).trim();
    matchedUnit = true;
  } else if (cloveMatch) {
    calculatedGrams = Math.round(count * 4);
    clean = clean.slice(cloveMatch[0].length).trim();
    matchedUnit = true;
  } else if (sliceMatch) {
    calculatedGrams = Math.round(count * 30);
    clean = clean.slice(sliceMatch[0].length).trim();
    matchedUnit = true;
  }

  // Quitar palabras conectoras iniciales como "of", "de", etc.
  clean = clean.replace(/^(?:of|de)\s+/i, '').trim();

  // 3. Si no hubo unidad de medida explícita pero hay un conteo (ej: "12 Chicken Thighs", "1 Onion", "3 Red Bell Pepper")
  const lowerName = clean.toLowerCase();

  if (!matchedUnit) {
    if (hasExplicitQuantity) {
      // Contramuslos de pollo (~120g pieza sin hueso ni piel)
      if (/thigh|contramuslo/i.test(lowerName)) {
        calculatedGrams = Math.round(count * 120);
      }
      // Pechuga de pollo (~180g pieza)
      else if (/breast|pechuga/i.test(lowerName)) {
        calculatedGrams = Math.round(count * 180);
      }
      // Diente de ajo (~4g)
      else if (/garlic|clove|diente/i.test(lowerName)) {
        calculatedGrams = Math.round(count * 4);
      }
      // Cebolla (~150g pieza mediana)
      else if (/onion|cebolla/i.test(lowerName)) {
        calculatedGrams = Math.round(count * 150);
      }
      // Pimiento morrón (~150g pieza)
      else if (/pepper|pimiento/i.test(lowerName)) {
        calculatedGrams = Math.round(count * 150);
      }
      // Zanahoria (~100g pieza)
      else if (/carrot|zanahoria/i.test(lowerName)) {
        calculatedGrams = Math.round(count * 100);
      }
      // Papa / patata (~180g)
      else if (/potato|papa|patata/i.test(lowerName)) {
        calculatedGrams = Math.round(count * 180);
      }
      // Tomate (~120g)
      else if (/tomato|tomate|jitomate/i.test(lowerName)) {
        calculatedGrams = Math.round(count * 120);
      }
      // Huevo (~55g)
      else if (/egg|huevo/i.test(lowerName)) {
        calculatedGrams = Math.round(count * 55);
      }
      // Plátano / Banana (~120g)
      else if (/banana|plátano|platano/i.test(lowerName)) {
        calculatedGrams = Math.round(count * 120);
      }
      // Manzana (~160g)
      else if (/apple|manzana/i.test(lowerName)) {
        calculatedGrams = Math.round(count * 160);
      }
      // Aguacate (~150g)
      else if (/avocado|aguacate/i.test(lowerName)) {
        calculatedGrams = Math.round(count * 150);
      }
      // Tortilla (~25g)
      else if (/tortilla/i.test(lowerName)) {
        calculatedGrams = Math.round(count * 25);
      }
      // Pieza general no identificada: multiplicar por 100g
      else {
        calculatedGrams = Math.round(count * 100);
      }
    } else {
      // 4. Ingredientes sin cantidad explícita (al gusto, drizzle, un poco)
      if (/olive oil|aceite de oliva|vegetable oil|aceite/i.test(lowerName)) {
        calculatedGrams = 14; // ~1 cucharada sopera
      } else if (/salt|sal\b/i.test(lowerName)) {
        calculatedGrams = 5; // ~1 cucharadita
      } else if (/black pepper|pepper|pimienta/i.test(lowerName)) {
        calculatedGrams = 2; // ~1/2 cucharadita
      } else if (/coriander|cumin|paprika|oregano|thyme|especias/i.test(lowerName)) {
        calculatedGrams = 3;
      } else {
        calculatedGrams = 100;
      }
    }
  }

  // 5. Traducir el nombre del ingrediente al español
  const translatedName = translateCulinaryText(clean || original);

  // 6. Determinar pasillo y macros
  const aisle = detectAisleCategory(translatedName);
  let calories = 100;
  let protein_g = 5;
  let carbs_g = 10;
  let fat_g = 2;

  const tnLower = translatedName.toLowerCase();

  if (aisle === 'Carnicería y Proteínas') {
    if (/pollo|chicken|pavo|turkey/i.test(tnLower)) {
      protein_g = Number((calculatedGrams * 0.22).toFixed(1));
      carbs_g = 0;
      fat_g = Number((calculatedGrams * 0.08).toFixed(1)); // contramuslo ligeramente más graso que pechuga
      calories = Math.round(protein_g * 4 + fat_g * 9);
    } else {
      protein_g = Number((calculatedGrams * 0.25).toFixed(1));
      carbs_g = 0;
      fat_g = Number((calculatedGrams * 0.08).toFixed(1));
      calories = Math.round(protein_g * 4 + fat_g * 9);
    }
  } else if (aisle === 'Frutas y Verduras') {
    protein_g = Number((calculatedGrams * 0.015).toFixed(1));
    carbs_g = Number((calculatedGrams * 0.06).toFixed(1));
    fat_g = 0.2;
    calories = Math.round(carbs_g * 4 + protein_g * 4);
  } else if (aisle === 'Abarrotes y Granos') {
    protein_g = Number((calculatedGrams * 0.07).toFixed(1));
    carbs_g = Number((calculatedGrams * 0.28).toFixed(1));
    fat_g = Number((calculatedGrams * 0.02).toFixed(1));
    calories = Math.round(carbs_g * 4 + protein_g * 4 + fat_g * 9);
  } else if (aisle === 'Lácteos y Refrigerados') {
    protein_g = Number((calculatedGrams * 0.08).toFixed(1));
    carbs_g = Number((calculatedGrams * 0.05).toFixed(1));
    fat_g = Number((calculatedGrams * 0.04).toFixed(1));
    calories = Math.round(protein_g * 4 + carbs_g * 4 + fat_g * 9);
  } else if (aisle === 'Condimentos y Aceites') {
    if (/aceite|mantequilla|oil/i.test(tnLower)) {
      protein_g = 0;
      carbs_g = 0;
      fat_g = Number((calculatedGrams * 0.98).toFixed(1));
      calories = Math.round(fat_g * 9);
    } else if (/chipotle|puré|pure|tomate|salsa/i.test(tnLower)) {
      protein_g = Number((calculatedGrams * 0.03).toFixed(1));
      carbs_g = Number((calculatedGrams * 0.15).toFixed(1));
      fat_g = Number((calculatedGrams * 0.01).toFixed(1));
      calories = Math.round(carbs_g * 4 + protein_g * 4 + fat_g * 9);
    } else if (/caldo/i.test(tnLower)) {
      protein_g = Number((calculatedGrams * 0.01).toFixed(1));
      carbs_g = 0.5;
      fat_g = 0.5;
      calories = Math.round(calculatedGrams * 0.07);
    } else {
      calories = 5;
      protein_g = 0;
      carbs_g = 1;
      fat_g = 0;
    }
  }

  return {
    ingredient_name: translatedName,
    raw_name: original,
    amount_g: Math.max(1, calculatedGrams),
    calories: Math.max(1, calories),
    protein_g,
    carbs_g,
    fat_g,
    fiber_g: 0,
    sodium_mg: 0,
    aisle_category: aisle,
  };
}
