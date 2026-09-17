'use client';

import React, { useState } from 'react';
import { CheckCircle, AlertCircle, Scale } from 'lucide-react';

interface NutritionFactLabelProps {
  name: string;
  servingSizeText?: string;
  servingsPerContainer?: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
  sodiumMg?: number;
  // Totales opcionales de la receta completa para el toggle
  totalCalories?: number;
  totalProteinG?: number;
  totalCarbsG?: number;
  totalFatG?: number;
  totalFiberG?: number;
}

export default function NutritionFactLabel({
  name,
  servingSizeText = '1 porción (250g)',
  servingsPerContainer = 1,
  calories,
  proteinG,
  carbsG,
  fatG,
  fiberG = 0,
  sodiumMg = 0,
  totalCalories,
  totalProteinG,
  totalCarbsG,
  totalFatG,
  totalFiberG,
}: NutritionFactLabelProps) {
  const [viewMode, setViewMode] = useState<'serving' | 'total'>('serving');

  const isTotalView = viewMode === 'total' && totalCalories !== undefined;

  const currentCals = isTotalView ? (totalCalories || calories) : calories;
  const currentProt = isTotalView ? (totalProteinG || proteinG) : proteinG;
  const currentCarbs = isTotalView ? (totalCarbsG || carbsG) : carbsG;
  const currentFat = isTotalView ? (totalFatG || fatG) : fatG;
  const currentFiber = isTotalView ? (totalFiberG || fiberG) : fiberG;

  // Validación matemática: (P * 4) + (C * 4) + (G * 9)
  const theoreticalCals = Math.round(currentProt * 4 + currentCarbs * 4 + currentFat * 9);
  const diff = Math.abs(currentCals - theoreticalCals);
  const isConsistent = diff <= 15; // margen de tolerancia habitual por redondeo o fibra

  return (
    <div className="bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-4 rounded-2xl border-2 border-zinc-900 dark:border-zinc-700 shadow-md max-w-xs mx-auto font-sans">
      {/* Selector de vista si hay totales disponibles */}
      {totalCalories !== undefined && (
        <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl mb-3 text-xs">
          <button
            type="button"
            onClick={() => setViewMode('serving')}
            className={`flex-1 py-1 rounded-lg font-bold transition ${
              viewMode === 'serving'
                ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-zinc-500'
            }`}
          >
            Por Porción
          </button>
          <button
            type="button"
            onClick={() => setViewMode('total')}
            className={`flex-1 py-1 rounded-lg font-bold transition ${
              viewMode === 'total'
                ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-zinc-500'
            }`}
          >
            Receta Total ({servingsPerContainer} porc.)
          </button>
        </div>
      )}

      {/* Encabezado Estilo Tabla Oficial */}
      <div className="border-b-8 border-zinc-900 dark:border-zinc-300 pb-1">
        <h4 className="text-xl font-black uppercase tracking-tight leading-none">
          Información Nutrimental
        </h4>
        <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 mt-1 truncate">
          {name}
        </p>
      </div>

      <div className="border-b-4 border-zinc-900 dark:border-zinc-300 py-1.5 text-xs">
        <div className="flex justify-between font-semibold">
          <span>Tamaño de porción:</span>
          <span>{isTotalView ? `Receta completa (${servingsPerContainer} porciones)` : servingSizeText}</span>
        </div>
        {!isTotalView && servingsPerContainer > 1 && (
          <div className="flex justify-between text-zinc-500 text-[11px]">
            <span>Porciones por preparación:</span>
            <span>{servingsPerContainer}</span>
          </div>
        )}
      </div>

      {/* Calorías */}
      <div className="border-b-8 border-zinc-900 dark:border-zinc-300 py-2 flex items-baseline justify-between">
        <div>
          <span className="text-xs font-bold block">Contenido Energético</span>
          <span className="text-3xl font-black tracking-tight">{currentCals}</span>
        </div>
        <span className="text-sm font-bold text-zinc-500">kcal</span>
      </div>

      {/* Macronutrientes y Desglose */}
      <div className="space-y-1 py-2 text-xs divide-y divide-zinc-200 dark:divide-zinc-800">
        <div className="flex justify-between pt-1 font-bold">
          <span>Grasas Totales</span>
          <span>{currentFat} g</span>
        </div>

        <div className="flex justify-between pt-1 font-bold">
          <span>Carbohidratos Totales</span>
          <span>{currentCarbs} g</span>
        </div>

        {currentFiber > 0 && (
          <div className="flex justify-between pl-4 text-zinc-600 dark:text-zinc-400 text-[11px] pt-1">
            <span>Fibra Dietética</span>
            <span>{currentFiber} g</span>
          </div>
        )}

        <div className="flex justify-between pt-1 font-bold">
          <span>Proteínas</span>
          <span>{currentProt} g</span>
        </div>

        {sodiumMg > 0 && (
          <div className="flex justify-between pt-1 text-zinc-600 dark:text-zinc-400">
            <span>Sodio</span>
            <span>{sodiumMg} mg</span>
          </div>
        )}
      </div>

      {/* Validación Matemática de Consistencia Calórica */}
      <div className="border-t-2 border-zinc-900 dark:border-zinc-700 pt-2 mt-2">
        <div className="flex items-center gap-1.5 text-[11px]">
          {isConsistent ? (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
              <CheckCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Coherencia calórica verificada ({theoreticalCals} kcal teóricas)</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Difiere de la suma teórica: {theoreticalCals} kcal</span>
            </span>
          )}
        </div>
        <p className="text-[9px] text-zinc-400 mt-1 leading-tight">
          Cálculo: (Proteína x 4) + (Carbohidratos x 4) + (Grasas x 9)
        </p>
      </div>
    </div>
  );
}
