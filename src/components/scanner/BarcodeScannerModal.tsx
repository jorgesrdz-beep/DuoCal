'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Camera,
  Barcode,
  Search,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Food, MealType } from '@/types/database';
import { getLocalDateString } from '@/lib/utils';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFoodLogged?: (food: Food, amountGrams: number, mealType: MealType) => void;
  onFoodSelected?: (food: Food) => void;
  defaultMealType?: MealType;
}

export default function BarcodeScannerModal({
  isOpen,
  onClose,
  onFoodLogged,
  onFoodSelected,
  defaultMealType = 'lunch',
}: BarcodeScannerModalProps) {
  const [activeTab, setActiveTab] = useState<'camera' | 'manual'>('camera');
  const [manualCode, setManualCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [foundProduct, setFoundProduct] = useState<any | null>(null);
  const [amountGrams, setAmountGrams] = useState<number>(100);
  const [selectedMealType, setSelectedMealType] = useState<MealType>(defaultMealType);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isBarcodeDetectorSupported, setIsBarcodeDetectorSupported] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isScanningRef = useRef(false);

  // Inicializar escáner de cámara
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setFoundProduct(null);
      setErrorMsg(null);
      return;
    }

    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      setIsBarcodeDetectorSupported(true);
    }

    if (activeTab === 'camera' && !foundProduct) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab, foundProduct]);

  const startCamera = async () => {
    try {
      stopCamera();
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setHasCameraPermission(false);
        setActiveTab('manual');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setHasCameraPermission(true);
        startDetectionLoop();
      }
    } catch (err) {
      console.warn('Error al iniciar cámara:', err);
      setHasCameraPermission(false);
    }
  };

  const stopCamera = () => {
    isScanningRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startDetectionLoop = () => {
    if (typeof window === 'undefined' || !('BarcodeDetector' in window)) return;

    isScanningRef.current = true;
    const barcodeDetector = new (window as any).BarcodeDetector({
      formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'],
    });

    const detect = async () => {
      if (!isScanningRef.current || !videoRef.current) return;

      try {
        if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
          const barcodes = await barcodeDetector.detect(videoRef.current);
          if (barcodes.length > 0) {
            const rawValue = barcodes[0].rawValue;
            if (rawValue) {
              isScanningRef.current = false;
              handleLookupBarcode(rawValue);
              return;
            }
          }
        }
      } catch {
        // Ignorar frame
      }

      if (isScanningRef.current) {
        requestAnimationFrame(detect);
      }
    };

    requestAnimationFrame(detect);
  };

  const handleLookupBarcode = async (codeToSearch: string) => {
    const clean = codeToSearch.trim();
    if (!clean) return;

    setLoading(true);
    setErrorMsg(null);
    stopCamera();

    try {
      const res = await fetch(`/api/foods/barcode/${encodeURIComponent(clean)}`);
      const data = await res.json();

      if (res.ok && data.product) {
        setFoundProduct(data.product);
        setAmountGrams(data.product.serving_size_g || 100);
      } else {
        setErrorMsg(data.error || `No se encontró información para el código ${clean}.`);
        setActiveTab('manual');
      }
    } catch {
      setErrorMsg('Error de conexión al consultar Open Food Facts.');
      setActiveTab('manual');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToDiary = async () => {
    if (!foundProduct) return;

    const ratio = amountGrams / 100;
    const foodItem: Food = {
      id: foundProduct.id,
      user_id: null,
      name: foundProduct.name,
      brand: foundProduct.brand || null,
      serving_size_g: foundProduct.serving_size_g || 100,
      serving_unit: 'g',
      calories: foundProduct.calories,
      protein_g: foundProduct.protein_g,
      carbs_g: foundProduct.carbs_g,
      fat_g: foundProduct.fat_g,
      fiber_g: (foundProduct as any).fiber_g !== undefined ? Number((foundProduct as any).fiber_g) : 0,
      source: 'openfoodfacts',
      barcode: foundProduct.barcode,
      is_verified: true,
      created_at: new Date().toISOString(),
    };

    if (onFoodSelected) {
      onFoodSelected(foodItem);
      onClose();
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/food-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: getLocalDateString(),
          meal_type: selectedMealType,
          food_id: foundProduct.id,
          food_name: foundProduct.name + (foundProduct.brand ? ` (${foundProduct.brand})` : ''),
          amount_g: amountGrams,
          calories: Math.round(foundProduct.calories * ratio),
          protein_g: Number((foundProduct.protein_g * ratio).toFixed(1)),
          carbs_g: Number((foundProduct.carbs_g * ratio).toFixed(1)),
          fat_g: Number((foundProduct.fat_g * ratio).toFixed(1)),
          fiber_g: Number(((foundProduct.fiber_g || 0) * ratio).toFixed(1)),
        }),
      });

      if (res.ok) {
        if (onFoodLogged) {
          onFoodLogged(foodItem, amountGrams, selectedMealType);
        }
        onClose();
        alert(`¡Registrado con éxito "${foundProduct.name}" (${amountGrams}g) en tu diario!`);
      }
    } catch {
      alert('Error al registrar el alimento.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentRatio = amountGrams / 100;
  const scaledCals = foundProduct ? Math.round(foundProduct.calories * currentRatio) : 0;
  const scaledProtein = foundProduct ? Number((foundProduct.protein_g * currentRatio).toFixed(1)) : 0;
  const scaledCarbs = foundProduct ? Number((foundProduct.carbs_g * currentRatio).toFixed(1)) : 0;
  const scaledFat = foundProduct ? Number((foundProduct.fat_g * currentRatio).toFixed(1)) : 0;
  const scaledFiber = foundProduct ? Number(((foundProduct.fiber_g || 0) * currentRatio).toFixed(1)) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden">
        {/* Encabezado */}
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Barcode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                Escáner de Códigos de Barras
              </h3>
              <p className="text-[11px] text-zinc-400">Base de datos de Open Food Facts</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pestañas (si no hay producto encontrado aún) */}
        {!foundProduct && (
          <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 mx-4 mt-3 rounded-2xl text-xs">
            <button
              type="button"
              onClick={() => {
                setActiveTab('camera');
                setErrorMsg(null);
              }}
              className={`flex-1 py-1.5 rounded-xl font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'camera'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Cámara en Vivo</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('manual');
                stopCamera();
              }}
              className={`flex-1 py-1.5 rounded-xl font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'manual'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Ingreso Manual</span>
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* VISTA DEL PRODUCTO ENCONTRADO */}
          {foundProduct ? (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 space-y-3">
                <div className="flex items-start gap-3">
                  {foundProduct.image_url ? (
                    <img
                      src={foundProduct.image_url}
                      alt={foundProduct.name}
                      className="w-16 h-16 object-contain rounded-xl bg-white p-1 border border-zinc-200 shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center text-emerald-600 shrink-0">
                      <Barcode className="w-8 h-8 opacity-60" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 block">
                      {foundProduct.brand || 'Marca verificada'}
                    </span>
                    <h4 className="text-sm font-black text-zinc-900 dark:text-white leading-tight">
                      {foundProduct.name}
                    </h4>
                    <span className="text-[11px] text-zinc-400 block mt-0.5">
                      Código: {foundProduct.barcode}
                    </span>
                  </div>
                </div>

                {/* Selector de comida del día */}
                <div>
                  <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 block mb-1">
                    Comida del día:
                  </label>
                  <div className="grid grid-cols-4 gap-1 text-xs">
                    {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setSelectedMealType(m)}
                        className={`py-1.5 rounded-xl font-bold transition border ${
                          selectedMealType === m
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                        }`}
                      >
                        {m === 'breakfast'
                          ? 'Desayuno'
                          : m === 'lunch'
                          ? 'Comida'
                          : m === 'dinner'
                          ? 'Cena'
                          : 'Snack'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cantidad consumida */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                      Porción a consumir:
                    </label>
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                      {amountGrams} gramos
                    </span>
                  </div>

                  <div className="flex gap-1.5 mb-2">
                    {[50, 100, 150, 200].map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setAmountGrams(g)}
                        className={`flex-1 py-1 rounded-lg text-xs font-semibold border ${
                          amountGrams === g
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                        }`}
                      >
                        {g}g
                      </button>
                    ))}
                  </div>

                  <input
                    type="range"
                    min="10"
                    max="500"
                    step="5"
                    value={amountGrams}
                    onChange={(e) => setAmountGrams(Number(e.target.value))}
                    className="w-full accent-emerald-600 cursor-pointer h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg"
                  />
                </div>

                {/* Macros calculados */}
                <div className="grid grid-cols-5 gap-1 pt-2 border-t border-emerald-200/60 dark:border-emerald-800/60 text-center text-xs">
                  <div>
                    <span className="text-[9px] text-zinc-400 block">Kcal</span>
                    <span className="font-bold text-zinc-900 dark:text-white">{scaledCals}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-zinc-400 block">Proteína</span>
                    <span className="font-bold text-blue-500">{scaledProtein}g</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-zinc-400 block">Carbos</span>
                    <span className="font-bold text-amber-500">{scaledCarbs}g</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-zinc-400 block">Grasas</span>
                    <span className="font-bold text-rose-500">{scaledFat}g</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-zinc-400 block">Fibra</span>
                    <span className="font-bold text-emerald-600">{scaledFiber}g</span>
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="space-y-2">
                <button
                  onClick={handleSaveToDiary}
                  disabled={loading}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20"
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    Registrar en mi Diario ({amountGrams}g • {scaledCals} kcal)
                  </span>
                </button>

                <button
                  onClick={() => {
                    setFoundProduct(null);
                    setActiveTab('camera');
                  }}
                  className="w-full py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  Escanear otro código
                </button>
              </div>
            </div>
          ) : activeTab === 'camera' ? (
            /* VISTA DE CÁMARA EN VIVO */
            <div className="space-y-3 text-center">
              <div className="relative aspect-square sm:aspect-video w-full rounded-2xl overflow-hidden bg-black flex items-center justify-center border-2 border-emerald-500/40 shadow-inner">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Overlay con línea roja de escaneo láser */}
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                  <div className="w-3/4 h-1/2 border-2 border-dashed border-white/70 rounded-2xl relative">
                    <div className="w-full h-0.5 bg-red-500 shadow-[0_0_10px_#ef4444] animate-pulse absolute top-1/2 -translate-y-1/2" />
                  </div>
                  <span className="text-[11px] text-white/90 bg-black/60 px-3 py-1 rounded-full mt-3 font-medium">
                    Apunta la cámara al código de barras
                  </span>
                </div>

                {loading && (
                  <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white space-y-2">
                    <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
                    <span className="text-xs font-semibold">Consultando Open Food Facts...</span>
                  </div>
                )}
              </div>

              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Sostén el empaque a 15-20 cm. El lector identificará automáticamente el producto.
              </p>

              {hasCameraPermission === false && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-200 text-left flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    No se pudo acceder a la cámara. Revisa los permisos del navegador o usa el{' '}
                    <strong
                      onClick={() => setActiveTab('manual')}
                      className="underline cursor-pointer"
                    >
                      ingreso manual
                    </strong>.
                  </span>
                </div>
              )}
            </div>
          ) : (
            /* VISTA DE INGRESO MANUAL */
            <div className="space-y-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleLookupBarcode(manualCode);
                }}
                className="space-y-3"
              >
                <div>
                  <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 block mb-1">
                    Dígitos del Código de Barras (EAN-13 / UPC):
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      autoFocus
                      placeholder="ej. 7501000111228"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-zinc-900 dark:text-white"
                    />
                    <button
                      type="submit"
                      disabled={loading || !manualCode.trim()}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-md shadow-emerald-600/20 disabled:opacity-50"
                    >
                      {loading ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Search className="w-3.5 h-3.5" />
                      )}
                      <span>Buscar</span>
                    </button>
                  </div>
                </div>
              </form>

              {errorMsg && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* PRODUCTOS DEMO PARA PROBAR CON 1 CLIC */}
              <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-[11px] font-semibold text-zinc-500 block uppercase tracking-wider">
                  Códigos populares para probar:
                </span>
                <div className="space-y-1.5">
                  {[
                    { code: '7501000111228', name: 'Atún Dolores en Agua (Lata)' },
                    { code: '7501000153037', name: 'Avena Quaker Tradicional' },
                    { code: '5201051001077', name: 'Yogurt Griego Fage 0%' },
                  ].map((demo) => (
                    <button
                      key={demo.code}
                      type="button"
                      onClick={() => {
                        setManualCode(demo.code);
                        handleLookupBarcode(demo.code);
                      }}
                      className="w-full text-left p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-zinc-200 dark:border-zinc-700/60 transition flex justify-between items-center text-xs"
                    >
                      <div>
                        <span className="font-semibold text-zinc-900 dark:text-white block">
                          {demo.name}
                        </span>
                        <span className="text-[10px] text-zinc-400">{demo.code}</span>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-600">Probar ➔</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
