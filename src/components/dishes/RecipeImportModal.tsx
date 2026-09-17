'use client';

import React, { useState } from 'react';
import {
  X,
  Globe,
  Camera,
  Share2,
  Search,
  FileText,
  Sparkles,
  Loader2,
  ArrowRight,
  Upload,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

interface RecipeImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecipeImported: (recipe: {
    name: string;
    description: string;
    category: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'general';
    total_servings: number;
    prep_time_minutes: number;
    cook_time_minutes: number;
    instructions: string[];
    ingredients: Array<{
      food_id: null;
      ingredient_name: string;
      amount_g: number;
      calories: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
      fiber_g: number;
      sodium_mg: number;
      aisle_category?: any;
    }>;
  }) => void;
  onOpenLibraryTab: () => void;
}

type ImportTab = 'url' | 'photo' | 'social' | 'public' | 'text';

export default function RecipeImportModal({
  isOpen,
  onClose,
  onRecipeImported,
  onOpenLibraryTab,
}: RecipeImportModalProps) {
  const [tab, setTab] = useState<ImportTab>('url');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Tab 1: URL
  const [urlInput, setUrlInput] = useState('');

  // Tab 2: Foto libro
  const [photoFile, setPhotoFile] = useState<string | null>(null);

  // Tab 3: Captura redes
  const [socialFile, setSocialFile] = useState<string | null>(null);

  // Tab 4: Buscador público
  const [publicSearchQuery, setPublicSearchQuery] = useState('chicken');
  const [publicResults, setPublicResults] = useState<any[]>([]);
  const [searchingPublic, setSearchingPublic] = useState(false);
  const [hasSearchedPublic, setHasSearchedPublic] = useState(false);

  // Tab 5: Texto
  const [textInput, setTextInput] = useState('');

  if (!isOpen) return null;

  const handleProcessUrl = async () => {
    if (!urlInput.trim() || !urlInput.startsWith('http')) {
      setErrorMsg('Por favor introduce una URL válida que empiece con http:// o https://');
      return;
    }
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await fetch('/api/dishes/import-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al procesar la página web');
      }

      onRecipeImported(data.data);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error conectando al enlace');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessImage = async (base64: string, type: 'book' | 'social_media') => {
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await fetch('/api/dishes/import-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, imageType: type }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error analizando la imagen');
      }

      onRecipeImported(data.data);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al procesar la imagen');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'photo' | 'social') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (target === 'photo') {
        setPhotoFile(result);
      } else {
        setSocialFile(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSearchPublic = async (query: string) => {
    setPublicSearchQuery(query);
    setErrorMsg(null);
    setSearchingPublic(true);
    setHasSearchedPublic(true);

    try {
      const res = await fetch(`/api/dishes/search-public?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (res.ok) {
        setPublicResults(data.recipes || []);
      } else {
        setErrorMsg(data.error || 'No se pudieron cargar recetas');
      }
    } catch (err: any) {
      setErrorMsg('Error al consultar recetas públicas');
    } finally {
      setSearchingPublic(false);
    }
  };

  const handleProcessText = async () => {
    if (!textInput.trim()) {
      setErrorMsg('Escribe o pega el texto de la receta primero');
      return;
    }
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await fetch('/api/dishes/parse-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipeText: textInput }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al parsear el texto');
      }

      onRecipeImported(data.data);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al procesar texto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-xl rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* ENCABEZADO */}
        <div className="p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                Hub de Importación de Recetas
              </h3>
              <p className="text-xs text-zinc-500">
                Agrega recetas sin escribir manualmente los ingredientes
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-800 dark:hover:text-white p-1 rounded-xl"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* NAVEGACIÓN DE PESTAÑAS (5 MÉTODOS) */}
        <div className="flex overflow-x-auto no-scrollbar border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50 p-1.5 gap-1 text-xs">
          <button
            onClick={() => { setTab('url'); setErrorMsg(null); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold whitespace-nowrap transition ${
              tab === 'url'
                ? 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>1. Link / URL</span>
          </button>

          <button
            onClick={() => { setTab('photo'); setErrorMsg(null); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold whitespace-nowrap transition ${
              tab === 'photo'
                ? 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-white'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>2. Foto de Libro</span>
          </button>

          <button
            onClick={() => { setTab('social'); setErrorMsg(null); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold whitespace-nowrap transition ${
              tab === 'social'
                ? 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-white'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>3. Captura Redes</span>
          </button>

          <button
            onClick={() => {
              setTab('public');
              setErrorMsg(null);
              if (!hasSearchedPublic) handleSearchPublic(publicSearchQuery);
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold whitespace-nowrap transition ${
              tab === 'public'
                ? 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-white'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>4. Buscador Público</span>
          </button>

          <button
            onClick={() => { setTab('text'); setErrorMsg(null); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold whitespace-nowrap transition ${
              tab === 'text'
                ? 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>5. Texto</span>
          </button>
        </div>

        {/* ALERTA DE ERROR */}
        {errorMsg && (
          <div className="mx-5 mt-3 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-2xl flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p className="leading-snug">{errorMsg}</p>
          </div>
        )}

        {/* CONTENIDO DE CADA PESTAÑA */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* TAB 1: POR URL */}
          {tab === 'url' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/30 rounded-2xl border border-blue-200/60 dark:border-blue-900/50 text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
                <strong className="font-bold flex items-center gap-1 mb-1">
                  <Globe className="w-3.5 h-3.5 text-blue-600" />
                  Importa desde cualquier web o blog de cocina:
                </strong>
                Pega el link de <em>Kiwilimón, Allrecipes, Directo al Paladar, Tasty</em> o cualquier blog gastronómico. DuoCal extraerá los ingredientes, gramos, tiempos y pasos automáticamente.
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block">
                  Enlace de la receta (URL)
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://www.ejemplo.com/receta/pollo-asado"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-xs text-zinc-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                  />
                  <button
                    onClick={handleProcessUrl}
                    disabled={loading || !urlInput.trim()}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition flex items-center gap-1.5 shrink-0"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Analizando...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Extraer</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Ejemplos de prueba rápida */}
              <div className="pt-2">
                <span className="text-[11px] font-semibold text-zinc-400 block mb-1.5">
                  Probar con enlaces de ejemplo:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: '🍲 Sopa Borscht (Natasha\'s Kitchen)', url: 'https://natashaskitchen.com/classic-russian-borscht-recipe/' },
                    { label: '🐟 Salmon Noodle Soup (BBC Good Food)', url: 'https://www.bbcgoodfood.com/recipes/salmon-noodle-soup' },
                    { label: '🥑 Avena Saludable (Tasty)', url: 'https://tasty.co/recipe/healthy-berry-oatmeal' },
                  ].map((ex) => (
                    <button
                      key={ex.label}
                      type="button"
                      onClick={() => setUrlInput(ex.url)}
                      className="text-[11px] bg-zinc-100 dark:bg-zinc-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 text-zinc-600 dark:text-zinc-300 px-2.5 py-1.5 rounded-xl border border-zinc-200/60 dark:border-zinc-700 transition"
                    >
                      {ex.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FOTO DE LIBRO DE COCINA */}
          {tab === 'photo' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/30 rounded-2xl border border-amber-200/60 dark:border-amber-900/50 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                <strong className="font-bold flex items-center gap-1 mb-1">
                  <Camera className="w-3.5 h-3.5 text-amber-600" />
                  Digitaliza recetarios físicos o apuntes:
                </strong>
                Toma una fotografía clara de una página de tu libro de cocina, recetario familiar o nota escrita a mano. Vision AI extraerá los ingredientes, cantidades y pasos numerados.
              </div>

              {!photoFile ? (
                <label className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-3xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/20 dark:hover:bg-emerald-950/10 transition group">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 group-hover:text-emerald-600 mb-2 transition">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    Tomar foto o subir imagen del libro
                  </span>
                  <span className="text-[11px] text-zinc-400 mt-0.5">
                    JPG, PNG o WEBP (máx. 10MB)
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => handleImageUpload(e, 'photo')}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="space-y-3">
                  <div className="relative rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-700 max-h-56 bg-zinc-950 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoFile} alt="Recetario" className="max-h-56 object-contain" />
                    <button
                      onClick={() => setPhotoFile(null)}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white hover:bg-red-600 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={() => handleProcessImage(photoFile, 'book')}
                    disabled={loading}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs py-3 rounded-xl shadow-xs transition flex items-center justify-center gap-1.5"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Escaneando página del libro con IA...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Escanear y Extraer Receta</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CAPTURA DE REDES SOCIALES */}
          {tab === 'social' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-pink-50/70 dark:bg-pink-950/30 rounded-2xl border border-pink-200/60 dark:border-pink-900/50 text-xs text-pink-900 dark:text-pink-200 leading-relaxed">
                <strong className="font-bold flex items-center gap-1 mb-1">
                  <Share2 className="w-3.5 h-3.5 text-pink-600" />
                  Capturas de Instagram, Pinterest o TikTok:
                </strong>
                ¿Guardaste la captura de pantalla de un post o reel fitness con una receta? Súbela aquí para convertirla en un platillo con macros calculados.
              </div>

              {!socialFile ? (
                <label className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-3xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-pink-500 hover:bg-pink-50/20 dark:hover:bg-pink-950/10 transition group">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 group-hover:text-pink-600 mb-2 transition">
                    <Share2 className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    Subir captura de pantalla de red social
                  </span>
                  <span className="text-[11px] text-zinc-400 mt-0.5">
                    Post de Instagram, infografía de Pinterest, etc.
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, 'social')}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="space-y-3">
                  <div className="relative rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-700 max-h-56 bg-zinc-950 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={socialFile} alt="Captura redes" className="max-h-56 object-contain" />
                    <button
                      onClick={() => setSocialFile(null)}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white hover:bg-red-600 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={() => handleProcessImage(socialFile, 'social_media')}
                    disabled={loading}
                    className="w-full bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white font-bold text-xs py-3 rounded-xl shadow-xs transition flex items-center justify-center gap-1.5"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Analizando post con IA...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Extraer Receta del Post</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: BUSCADOR PÚBLICO (THEMEALDB) */}
          {tab === 'public' && (
            <div className="space-y-4">
              <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-2xl text-xs text-zinc-600 dark:text-zinc-300">
                Busca entre miles de recetas internacionales abiertas. Selecciona una para importarla con sus ingredientes y pasos listos.
              </div>

              {/* Buscador y Chips */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Buscar platillo (ej. Chicken, Salad, Pasta, Beef...)"
                      value={publicSearchQuery}
                      onChange={(e) => setPublicSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSearchPublic(publicSearchQuery);
                      }}
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <button
                    onClick={() => handleSearchPublic(publicSearchQuery)}
                    disabled={searchingPublic}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-1 shrink-0"
                  >
                    {searchingPublic ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Buscar'}
                  </button>
                </div>

                <div className="flex flex-wrap gap-1">
                  {['Chicken', 'Salmon', 'Pasta', 'Egg', 'Salad', 'Beef', 'Pancake'].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => handleSearchPublic(chip)}
                      className={`text-[10px] px-2.5 py-1 rounded-full border transition font-medium ${
                        publicSearchQuery.toLowerCase() === chip.toLowerCase()
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-emerald-500'
                      }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lista de Resultados */}
              {searchingPublic ? (
                <div className="py-10 text-center text-xs text-zinc-400 flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                  <span>Buscando en catálogo de recetas...</span>
                </div>
              ) : publicResults.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-400">
                  No se encontraron recetas con ese término. Intenta con una palabra en inglés o común (ej. &ldquo;chicken&rdquo; o &ldquo;soup&rdquo;).
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5 max-h-72 overflow-y-auto pr-1">
                  {publicResults.map((r) => (
                    <div
                      key={r.id}
                      className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/80 flex items-center justify-between gap-3 hover:border-emerald-500 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {r.thumbnail_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={r.thumbnail_url}
                            alt={r.name}
                            className="w-12 h-12 rounded-xl object-cover shrink-0 border border-zinc-200 dark:border-zinc-700"
                          />
                        )}
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                            {r.name}
                          </h4>
                          <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block">
                            {r.calories_per_serving} kcal/porc • {r.ingredients.length} ingredientes
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          onRecipeImported({
                            name: r.name,
                            description: r.description,
                            category: r.category,
                            total_servings: r.total_servings,
                            prep_time_minutes: r.prep_time_minutes,
                            cook_time_minutes: r.cook_time_minutes,
                            instructions: r.instructions,
                            ingredients: r.ingredients.map((ing: any) => ({
                              food_id: null,
                              ingredient_name: ing.ingredient_name,
                              amount_g: ing.amount_g,
                              calories: ing.calories,
                              protein_g: ing.protein_g,
                              carbs_g: ing.carbs_g,
                              fat_g: ing.fat_g,
                              fiber_g: 0,
                              sodium_mg: 0,
                              aisle_category: ing.aisle_category,
                            })),
                          });
                          onClose();
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1 shadow-xs"
                      >
                        <span>Importar</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: PEGAR TEXTO */}
          {tab === 'text' && (
            <div className="space-y-4">
              <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-2xl text-xs text-zinc-600 dark:text-zinc-300">
                Pega cualquier lista de ingredientes o notas de WhatsApp / notas del móvil. El asistente la estructurará con gramos, pasos y macros.
              </div>

              <textarea
                rows={6}
                placeholder={`Pechuga con verduras y arroz
Ingredientes:
- 150g pechuga de pollo
- 1 taza de arroz cocido
- 1 calabacita picada
- 1 cdita de aceite
Preparación:
1. Sazonar el pollo y cocinar en sartén...
2. Servir con arroz caliente...`}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl p-3 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono leading-relaxed"
              />

              <button
                onClick={handleProcessText}
                disabled={loading || !textInput.trim()}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs py-3 rounded-xl shadow-xs transition flex items-center justify-center gap-1.5"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Estructurando receta con IA...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Estructurar y Cargar Receta</span>
                  </>
                )}
              </button>
            </div>
          )}

        </div>

        {/* PIE DE PÁGINA: ACCESO RÁPIDO A LA BIBLIOTECA CURADA (MÉTODO 5) */}
        <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-zinc-500">
            <BookOpen className="w-4 h-4 text-emerald-500" />
            <span>¿Prefieres recetas ya listas para 1 persona?</span>
          </div>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenLibraryTab();
            }}
            className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
          >
            <span>Ver Biblioteca Curada (16)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
}
