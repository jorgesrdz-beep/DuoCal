/**
 * Motor de Unidades Inteligentes para el Supermercado
 * 
 * Determina cómo se compra realmente cada producto en el mundo real:
 * - Por PIEZAS / LATAS / PAQUETES: Huevos enteros, atún en lata, tortillas, tostadas, plátanos, aguacates.
 * - Por VOLUMEN (ml / L / tazas): Claras de huevo líquidas, leche, aceites, aderezos.
 * - Por GRAMAJE / PESO (g / kg): Carnicería (pollo, res, pavo, pescado), salchichonería y quesos (panela), granos (arroz, avena).
 */

export interface CleanedIngredient {
  cleanName: string;
  piecesPerServing?: number;
  unitHint?: 'piece' | 'can' | 'pack' | 'volume' | 'weight';
}

/**
 * Limpia anotaciones de una sola porción del nombre del ingrediente
 * Ejemplo: "Huevos enteros (2 pzas)" -> cleanName: "Huevos enteros", piecesPerServing: 2
 * Ejemplo: "Atún en agua (1 lata drenada)" -> cleanName: "Atún en agua", piecesPerServing: 1
 * Ejemplo: "Tostadas de maíz horneadas (3 pzas)" -> cleanName: "Tostadas de maíz horneadas", piecesPerServing: 3
 */
export function cleanIngredientName(rawName: string): CleanedIngredient {
  const trimmed = rawName.trim();
  let piecesPerServing: number | undefined = undefined;
  let unitHint: CleanedIngredient['unitHint'] = undefined;

  // 1. Detectar latas
  const canMatch = trimmed.match(/\((\d+(?:\.\d+)?)\s*latas?(?:\s+drenadas?)?\)/i);
  if (canMatch) {
    piecesPerServing = parseFloat(canMatch[1]);
    unitHint = 'can';
  }

  // 2. Detectar piezas / unidades
  if (!piecesPerServing) {
    const pieceMatch = trimmed.match(/\((\d+(?:\.\d+)?)\s*(?:pzas?|piezas?|unidades?)\)/i);
    if (pieceMatch) {
      piecesPerServing = parseFloat(pieceMatch[1]);
      unitHint = 'piece';
    }
  }

  // 3. Detectar medio / media
  if (!piecesPerServing) {
    if (/\((?:medio|media)\)/i.test(trimmed)) {
      piecesPerServing = 0.5;
      unitHint = 'piece';
    }
  }

  // 4. Limpiar los paréntesis de porciones individuales en el nombre comercial del súper
  // Quita: "(2 pzas)", "(1 pza)", "(1 lata drenada)", "(3 piezas)", "(medio)", "(1 clara / 35 ml / 2 cdas)", etc.
  let cleanName = trimmed
    .replace(/\s*\(\s*\d+(?:\.\d+)?\s*(?:pzas?|piezas?|unidades?|latas?|rebanadas?)(?:\s+drenadas?)?\s*\)/gi, '')
    .replace(/\s*\(\s*(?:medio|media)\s*\)/gi, '')
    .replace(/\s*\(\s*\d+\s*(?:g|gr|gramos|ml)\s*\)/gi, '')
    .replace(/\s*\([^)]*(?:clara|cdas?|cucharad|tazas?|ml|pzas?|piezas?)[^)]*\)/gi, '')
    .trim();

  // Normalizar plural/singular común si quedó inconsistente
  if (cleanName.toLowerCase() === 'huevo entero') {
    cleanName = 'Huevos enteros';
  }
  if (cleanName.toLowerCase() === 'clara de huevo') {
    cleanName = 'Claras de huevo';
  }

  // Capitalizar primera letra
  if (cleanName.length > 0) {
    cleanName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
  }

  return {
    cleanName,
    piecesPerServing,
    unitHint,
  };
}

export interface GroceryConsolidationInput {
  name: string;
  totalGrams: number;
  totalPieces?: number;
  count: number;
  aisle: string;
}

export interface FormattedGroceryItem {
  cleanName: string;
  quantityText: string;
  buyingType: 'pieces' | 'volume' | 'weight' | 'packs';
}

/**
 * Genera la cantidad comercial inteligente para el carrito de compras del súper
 */
export function formatGroceryItem(item: GroceryConsolidationInput): FormattedGroceryItem {
  const lower = item.name.toLowerCase();
  const totalGrams = item.totalGrams || 0;
  const totalPieces = item.totalPieces || 0;

  // 1. HUEVOS ENTEROS (Siempre por piezas / docenas, NUNCA por gramos)
  if (
    (lower.includes('huevo') || lower.includes('huevos')) &&
    !lower.includes('clara')
  ) {
    // Si tenemos piezas directas, usarla. Si no, 1 huevo mediano ≈ 50g
    const pieces = Math.max(1, Math.round(totalPieces > 0 ? totalPieces : totalGrams / 50));
    let text = '';
    if (pieces >= 30) {
      text = `${pieces} piezas (1 cartón de 30)`;
    } else if (pieces >= 18) {
      text = `${pieces} piezas (1 cartera de 18)`;
    } else if (pieces === 12) {
      text = `12 piezas (1 docena)`;
    } else if (pieces > 12) {
      text = `${pieces} piezas (~1 docena y media)`;
    } else {
      text = `${pieces} ${pieces === 1 ? 'pieza' : 'piezas'}`;
    }

    return {
      cleanName: 'Huevos enteros',
      quantityText: text,
      buyingType: 'pieces',
    };
  }

  // 2. CLARAS DE HUEVO (En el súper se compran por envase tetrapack o ml / tazas)
  if (lower.includes('clara') || lower.includes('claras')) {
    // 1g de clara de huevo ≈ 1 ml
    const ml = Math.round(totalGrams);
    let text = '';
    if (ml >= 1000) {
      text = `${(ml / 1000).toFixed(1)} L (${ml} ml)`;
    } else if (ml >= 450) {
      text = `${ml} ml (1 envase de 500 ml)`;
    } else if (ml >= 200) {
      const tazas = (ml / 240).toFixed(1);
      text = `${ml} ml (~${tazas} ${tazas === '1.0' ? 'taza' : 'tazas'})`;
    } else if (ml > 0) {
      text = `${ml} ml`;
    } else {
      text = `${item.count} envase`;
    }

    return {
      cleanName: 'Claras de huevo líquidas',
      quantityText: text,
      buyingType: 'volume',
    };
  }

  // 3. ATÚN EN LATA U OTRAS LATAS
  if (lower.includes('atún') && (lower.includes('lata') || lower.includes('agua') || lower.includes('aceite'))) {
    // 1 lata de atún drenada suele ser 100g a 140g
    const cans = Math.max(1, Math.round(totalPieces > 0 ? totalPieces : totalGrams / 120));
    return {
      cleanName: 'Atún en agua (enlatado)',
      quantityText: `${cans} ${cans === 1 ? 'lata' : 'latas'} (140 g c/u)`,
      buyingType: 'packs',
    };
  }

  // 4. TOSTADAS Y TORTILLAS (Por piezas o paquetes comerciales)
  if (lower.includes('tostada') || lower.includes('tortilla')) {
    const pieces = Math.max(1, Math.round(totalPieces > 0 ? totalPieces : totalGrams / 25));
    let text = '';
    if (pieces >= 30) {
      text = `${pieces} piezas (~2 paquetes)`;
    } else if (pieces >= 15) {
      text = `${pieces} piezas (1 paquete)`;
    } else {
      text = `${pieces} piezas`;
    }

    return {
      cleanName: item.name,
      quantityText: text,
      buyingType: 'pieces',
    };
  }

  // 5. FRUTAS Y VERDURAS COMPRADAS POR PIEZA
  // Aguacate Hass (1 aguacate entero ≈ 120-150g, medio ≈ 60g)
  if (lower.includes('aguacate')) {
    const pieces = Math.max(1, Math.round(totalPieces > 0 ? totalPieces : totalGrams / 120));
    return {
      cleanName: 'Aguacate Hass',
      quantityText: `${pieces} ${pieces === 1 ? 'pieza' : 'piezas'} (~${Math.round(totalGrams)} g)`,
      buyingType: 'pieces',
    };
  }

  // Plátano / Banana (1 plátano mediano ≈ 120-150g)
  if (lower.includes('plátano') || lower.includes('platano') || lower.includes('banana')) {
    const pieces = Math.max(1, Math.round(totalPieces > 0 ? totalPieces : totalGrams / 130));
    return {
      cleanName: 'Plátano maduro',
      quantityText: `${pieces} ${pieces === 1 ? 'pieza' : 'piezas'} (~${Math.round(totalGrams)} g)`,
      buyingType: 'pieces',
    };
  }

  // Manzana (1 manzana ≈ 160g)
  if (lower.includes('manzana')) {
    const pieces = Math.max(1, Math.round(totalPieces > 0 ? totalPieces : totalGrams / 160));
    return {
      cleanName: item.name,
      quantityText: `${pieces} ${pieces === 1 ? 'pieza' : 'piezas'} (~${Math.round(totalGrams)} g)`,
      buyingType: 'pieces',
    };
  }

  // Limón (1 limón ≈ 35g)
  if (lower.includes('limón') || lower.includes('limon')) {
    const pieces = Math.max(1, Math.round(totalPieces > 0 ? totalPieces : totalGrams / 35));
    return {
      cleanName: item.name,
      quantityText: `${pieces} ${pieces === 1 ? 'pieza' : 'piezas'} (~${Math.round(totalGrams)} g)`,
      buyingType: 'pieces',
    };
  }

  // 6. LÍQUIDOS: ACEITES, LECHES, BEBIDAS VEGETALES, VINAGRES
  if (
    lower.includes('aceite') ||
    lower.includes('leche') ||
    lower.includes('bebida') ||
    lower.includes('vinagre') ||
    lower.includes('salsa')
  ) {
    const ml = Math.round(totalGrams);
    let text = '';
    if (ml >= 1000) {
      text = `${(ml / 1000).toFixed(1)} L (${ml} ml)`;
    } else {
      text = `${ml} ml`;
    }
    return {
      cleanName: item.name,
      quantityText: text,
      buyingType: 'volume',
    };
  }

  // 7. CARNICERÍA Y PROTEÍNAS (Báscula en gramos o kilos)
  // Pechuga de pollo, res, pavo, salmón, pescado, carne molida, etc.
  if (
    lower.includes('pollo') ||
    lower.includes('res') ||
    lower.includes('pavo') ||
    lower.includes('bistec') ||
    lower.includes('carne') ||
    lower.includes('salmón') ||
    lower.includes('salmon') ||
    lower.includes('pescado') ||
    lower.includes('tilapia') ||
    lower.includes('camarón') ||
    lower.includes('camaron')
  ) {
    let text = '';
    if (totalGrams >= 1000) {
      text = `${(totalGrams / 1000).toFixed(2)} kg (${Math.round(totalGrams)} g)`;
    } else if (totalGrams > 0) {
      text = `${Math.round(totalGrams)} g`;
    } else {
      text = `${item.count} porciones`;
    }
    return {
      cleanName: item.name,
      quantityText: text,
      buyingType: 'weight',
    };
  }

  // 8. QUESOS Y SALCHICHONERÍA (Báscula en gramos o empaques de 250g / 400g)
  if (lower.includes('queso') || lower.includes('jamón') || lower.includes('panela')) {
    let text = '';
    if (totalGrams >= 1000) {
      text = `${(totalGrams / 1000).toFixed(2)} kg (${Math.round(totalGrams)} g)`;
    } else if (totalGrams > 0) {
      text = `${Math.round(totalGrams)} g`;
    } else {
      text = `${item.count} porciones`;
    }
    return {
      cleanName: item.name,
      quantityText: text,
      buyingType: 'weight',
    };
  }

  // 9. HORTALIZAS Y VERDURAS DE BOLSA / PESO
  if (lower.includes('espinaca') || lower.includes('lechuga') || lower.includes('ensalada')) {
    let text = '';
    if (totalGrams >= 1000) {
      text = `${(totalGrams / 1000).toFixed(1)} kg`;
    } else if (totalGrams >= 200) {
      text = `${Math.round(totalGrams)} g (~1 bolsa/domo)`;
    } else if (totalGrams > 0) {
      text = `${Math.round(totalGrams)} g`;
    } else {
      text = `${item.count} porciones`;
    }
    return {
      cleanName: item.name,
      quantityText: text,
      buyingType: 'weight',
    };
  }

  // 10. REGLA GENERAL (Por defecto peso en g/kg si hay gramos, o piezas si no)
  let quantityText = '';
  if (totalGrams > 0) {
    if (totalGrams >= 1000) {
      quantityText = `${(totalGrams / 1000).toFixed(1)} kg (${Math.round(totalGrams)} g)`;
    } else {
      quantityText = `${Math.round(totalGrams)} g`;
    }
  } else if (totalPieces > 0) {
    quantityText = `${totalPieces} ${totalPieces === 1 ? 'pieza' : 'piezas'}`;
  } else {
    quantityText = `${item.count} ${item.count === 1 ? 'porción' : 'porciones'}`;
  }

  return {
    cleanName: item.name,
    quantityText,
    buyingType: 'weight',
  };
}
