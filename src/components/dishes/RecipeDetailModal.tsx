'use client';

import React, { useState } from 'react';
import { Dish } from '@/types/database';
import { useAuth } from '@/context/AuthContext';
import {
  X,
  Clock,
  Users,
  Flame,
  CheckCircle2,
  Circle,
  Copy,
  Calendar,
  Plus,
  Scale,
  Sparkles,
} from 'lucide-react';

interface RecipeDetailModalProps {
  dish: Dish;
  onClose: () => void;
  onSchedule?: (dish: Dish) => void;
  onLogToday?: (dish: Dish, servings: number) => void;
  onCloneTemplate?: (dish: Dish) => void;
}

export default function RecipeDetailModal({
  dish,
  onClose,
  onSchedule,
  onLogToday,
  onCloneTemplate,
}: RecipeDetailModalProps) {
  const { user, partner, activeGoal, partnerGoal } = useAuth();

  // Modo de escalador: estándar (porciones totales) vs duo (reparto proporcional por metas)
  const [scaleMode, setScaleMode] = useState<'standard' | 'duo'>('standard');
  const [servings, setServings] = useState<number>(dish.total_servings || 1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const baseServings = dish.total_servings || 1;
  const scaleRatio = servings / baseServings;

  // METAS CALÓRICAS DEL DUO
  const userName = user?.display_name || 'Tú';
  const partnerName = partner?.display_name || 'Roomie';
  const userCalTarget = activeGoal?.calorie_target || 2000;
  const partnerCalTarget = partnerGoal?.calorie_target || 1800;
  const totalBothTargets = userCalTarget + partnerCalTarget;
  const defaultUserRatio = Math.round((userCalTarget / totalBothTargets) * 100);

  // Porcentaje asignado al usuario actual (ej. 55% para Alex, 45% para Sam)
  const [duoUserPct, setDuoUserPct] = useState<number>(defaultUserRatio);
  const duoPartnerPct = 100 - duoUserPct;

  // Cálculo para 2 porciones conjuntas (meal prep para ambos)
  const duoTotalServings = 2;
  const duoTotalCalories = dish.calories_per_serving * duoTotalServings;
  const duoTotalProtein = dish.protein_per_serving * duoTotalServings;
  const duoTotalCarbs = dish.carbs_per_serving * duoTotalServings;
  const duoTotalFat = dish.fat_per_serving * duoTotalServings;
  const duoTotalFiber = (dish.fiber_per_serving || 0) * duoTotalServings;

  const totalRawWeight =
    dish.total_weight_g ||
    dish.ingredients?.reduce((acc, i) => acc + (i.amount_g || 0), 0) ||
    (dish.calories_per_serving ? Math.round(dish.calories_per_serving * 1.3) : 500);

  const duoTotalWeight = Math.round((totalRawWeight / baseServings) * duoTotalServings);

  // Valores de porción para el usuario actual
  const userWeightGrams = Math.round((duoTotalWeight * duoUserPct) / 100);
  const userCalories = Math.round((duoTotalCalories * duoUserPct) / 100);
  const userProtein = Number(((duoTotalProtein * duoUserPct) / 100).toFixed(1));
  const userCarbs = Number(((duoTotalCarbs * duoUserPct) / 100).toFixed(1));
  const userFat = Number(((duoTotalFat * duoUserPct) / 100).toFixed(1));
  const userFiber = Number(((duoTotalFiber * duoUserPct) / 100).toFixed(1));
  const userServingMultiplier = Number(((duoTotalServings * duoUserPct) / 100).toFixed(2));

  // Valores de porción para el roomie / compañero
  const partnerWeightGrams = duoTotalWeight - userWeightGrams;
  const partnerCalories = Math.round((duoTotalCalories * duoPartnerPct) / 100);
  const partnerProtein = Number(((duoTotalProtein * duoPartnerPct) / 100).toFixed(1));
  const partnerCarbs = Number(((duoTotalCarbs * duoPartnerPct) / 100).toFixed(1));
  const partnerFat = Number(((duoTotalFat * duoPartnerPct) / 100).toFixed(1));
  const partnerFiber = Number(((duoTotalFiber * duoPartnerPct) / 100).toFixed(1));

  const toggleStep = (idx: number) => {
    setCompletedSteps((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const ingredients = dish.ingredients || [];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden">
        {/* Header con imagen/gradiente */}
        <div className="relative bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-5 pt-6">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center text-white transition"
          >
            <X className="w-5 h-5" />
          </button>

          <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full inline-block mb-1.5">
            {dish.category === 'breakfast'
              ? '🍳 Desayuno'
              : dish.category === 'lunch'
              ? '🥗 Comida / Meal Prep'
              : dish.category === 'dinner'
              ? '🍲 Cena Ligera'
              : '🥑 Snack Saludable'}
          </span>

          <h3 className="text-lg sm:text-xl font-black leading-tight pr-6">
            {dish.name}
          </h3>

          {dish.description && (
            <p className="text-xs text-white/80 mt-1 line-clamp-2 leading-relaxed">
              {dish.description}
            </p>
          )}

          {/* Tiempos de preparación */}
          <div className="flex items-center gap-4 mt-3 text-xs text-white/90">
            {dish.prep_time_minutes !== undefined && (
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 opacity-80" />
                <span>Prep: <strong>{dish.prep_time_minutes} min</strong></span>
              </div>
            )}
            {dish.cook_time_minutes !== undefined && (
              <div className="flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 opacity-80" />
                <span>Cocción: <strong>{dish.cook_time_minutes} min</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* SELECTOR DE MODO DE ESCALADO (Solo si tiene compañero vinculado) */}
        {partner && (
          <div className="bg-zinc-100 dark:bg-zinc-800/90 p-1.5 mx-5 mt-4 rounded-2xl flex gap-1 border border-zinc-200/80 dark:border-zinc-700/60 shrink-0">
            <button
              type="button"
              onClick={() => setScaleMode('standard')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                scaleMode === 'standard'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Porciones Totales ({servings})</span>
            </button>
            <button
              type="button"
              onClick={() => setScaleMode('duo')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                scaleMode === 'duo'
                  ? 'bg-emerald-600 text-white shadow-xs shadow-emerald-600/20'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
              <span>Reparto Duo ({userName} vs {partnerName})</span>
            </button>
          </div>
        )}

        {/* CONTENIDO DESPLAZABLE */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* MODO 1: ESCALADOR TRADICIONAL DE PORCIONES */}
          {scaleMode === 'standard' && (
            <div className="bg-zinc-50 dark:bg-zinc-800/70 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-700/60 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Escalar Porciones a Preparar</span>
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    Multiplica los ingredientes automáticamente
                  </span>
                </div>

                {/* Botones de porciones rápidas */}
                <div className="flex items-center gap-1">
                  {[1, 2, 4, 6].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setServings(s)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold transition border ${
                        servings === s
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                      }`}
                    >
                      {s} {s === 1 ? 'porc.' : 'porcs.'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Selector fino stepper */}
              <div className="flex items-center justify-between pt-1 border-t border-zinc-200/60 dark:border-zinc-700/60 text-xs">
                <span className="text-zinc-500">Ajuste personalizado:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setServings(Math.max(1, servings - 1))}
                    className="w-7 h-7 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 font-bold text-zinc-700 dark:text-zinc-200 flex items-center justify-center hover:bg-zinc-100"
                  >
                    -
                  </button>
                  <span className="w-8 text-center font-black text-emerald-600 dark:text-emerald-400 text-sm">
                    {servings}
                  </span>
                  <button
                    type="button"
                    onClick={() => setServings(servings + 1)}
                    className="w-7 h-7 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 font-bold text-zinc-700 dark:text-zinc-200 flex items-center justify-center hover:bg-zinc-100"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Resumen de macros para esta cantidad escalada */}
              <div className="grid grid-cols-4 gap-2 pt-2 text-center text-xs">
                <div className="p-2 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700">
                  <span className="text-[10px] text-zinc-400 block">Total Kcal</span>
                  <span className="font-bold text-zinc-900 dark:text-white">
                    {Math.round(dish.calories_per_serving * servings)}
                  </span>
                </div>
                <div className="p-2 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700">
                  <span className="text-[10px] text-zinc-400 block">Proteína</span>
                  <span className="font-bold text-blue-500">
                    {Math.round(dish.protein_per_serving * servings)}g
                  </span>
                </div>
                <div className="p-2 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700">
                  <span className="text-[10px] text-zinc-400 block">Carbos</span>
                  <span className="font-bold text-amber-500">
                    {Math.round(dish.carbs_per_serving * servings)}g
                  </span>
                </div>
                <div className="p-2 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700">
                  <span className="text-[10px] text-zinc-400 block">Grasas</span>
                  <span className="font-bold text-rose-500">
                    {Math.round(dish.fat_per_serving * servings)}g
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* MODO 2: ESCALADOR DE REPARTO DUO POR METAS INDIVIDUALES */}
          {scaleMode === 'duo' && (
            <div className="bg-gradient-to-b from-emerald-50/50 to-teal-50/30 dark:from-emerald-950/20 dark:to-teal-950/10 rounded-2xl p-4 border border-emerald-200/80 dark:border-emerald-800/60 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>Calculadora de Báscula Duo</span>
                  </span>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">
                    Cocinan una sola vez ({duoTotalWeight}g totales). Pesa cada tupper para cumplir las metas individuales sin cocinar doble.
                  </p>
                </div>
                <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 rounded-md shrink-0">
                  2 porciones
                </span>
              </div>

              {/* Botones de proporción rápida */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-semibold text-zinc-500 block uppercase tracking-wider">
                  Criterio de Reparto:
                </span>
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setDuoUserPct(defaultUserRatio)}
                    className={`p-2 rounded-xl border font-semibold transition text-left text-[11px] ${
                      duoUserPct === defaultUserRatio
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                    }`}
                  >
                    <span className="block font-bold">Por Metas</span>
                    <span className="text-[9px] opacity-80">{defaultUserRatio}% / {100 - defaultUserRatio}%</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDuoUserPct(50)}
                    className={`p-2 rounded-xl border font-semibold transition text-left text-[11px] ${
                      duoUserPct === 50
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                    }`}
                  >
                    <span className="block font-bold">Equitativo</span>
                    <span className="text-[9px] opacity-80">50% / 50%</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDuoUserPct(60)}
                    className={`p-2 rounded-xl border font-semibold transition text-left text-[11px] ${
                      duoUserPct === 60
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                    }`}
                  >
                    <span className="block font-bold">{userName} +</span>
                    <span className="text-[9px] opacity-80">60% / 40%</span>
                  </button>
                </div>
              </div>

              {/* Slider de ajuste fino */}
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-[11px] text-zinc-600 dark:text-zinc-300 font-medium">
                  <span>{userName}: <strong>{duoUserPct}%</strong></span>
                  <span>{partnerName}: <strong>{duoPartnerPct}%</strong></span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="70"
                  value={duoUserPct}
                  onChange={(e) => setDuoUserPct(Number(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg"
                />
              </div>

              {/* TARJETAS DE BÁSCULA INDIVIDUAL (ALEX VS SAM) */}
              <div className="space-y-2.5 pt-1">
                {/* Tupper / Plato Usuario */}
                <div className="bg-white dark:bg-zinc-800 rounded-2xl p-3 border-2 border-emerald-500/60 shadow-xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span className="text-xs font-bold text-zinc-900 dark:text-white">
                        Tupper de {userName} (Tú)
                      </span>
                      <span className="text-[10px] text-zinc-400">
                        • Meta: {userCalTarget} kcal
                      </span>
                    </div>
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                      ⚖️ Servir {userWeightGrams} g
                    </span>
                  </div>

                  <div className="grid grid-cols-5 gap-1 text-center text-[11px] pt-1 border-t border-zinc-100 dark:border-zinc-700/60">
                    <div>
                      <span className="text-[9px] text-zinc-400 block">Calorías</span>
                      <span className="font-bold text-zinc-900 dark:text-white">{userCalories}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-400 block">Proteína</span>
                      <span className="font-bold text-blue-500">{userProtein}g</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-400 block">Carbos</span>
                      <span className="font-bold text-amber-500">{userCarbs}g</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-400 block">Grasas</span>
                      <span className="font-bold text-rose-500">{userFat}g</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-400 block">Fibra</span>
                      <span className="font-bold text-emerald-600">{userFiber}g</span>
                    </div>
                  </div>
                </div>

                {/* Tupper / Plato Roomie / Partner */}
                <div className="bg-white dark:bg-zinc-800 rounded-2xl p-3 border border-zinc-200 dark:border-zinc-700 shadow-xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                      <span className="text-xs font-bold text-zinc-900 dark:text-white">
                        Tupper de {partnerName} (Roomie)
                      </span>
                      <span className="text-[10px] text-zinc-400">
                        • Meta: {partnerCalTarget} kcal
                      </span>
                    </div>
                    <span className="text-xs font-black text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950 px-2 py-0.5 rounded-md border border-teal-200 dark:border-teal-800">
                      ⚖️ Servir {partnerWeightGrams} g
                    </span>
                  </div>

                  <div className="grid grid-cols-5 gap-1 text-center text-[11px] pt-1 border-t border-zinc-100 dark:border-zinc-700/60">
                    <div>
                      <span className="text-[9px] text-zinc-400 block">Calorías</span>
                      <span className="font-bold text-zinc-900 dark:text-white">{partnerCalories}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-400 block">Proteína</span>
                      <span className="font-bold text-blue-500">{partnerProtein}g</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-400 block">Carbos</span>
                      <span className="font-bold text-amber-500">{partnerCarbs}g</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-400 block">Grasas</span>
                      <span className="font-bold text-rose-500">{partnerFat}g</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-400 block">Fibra</span>
                      <span className="font-bold text-emerald-600">{partnerFiber}g</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* LISTA DE INGREDIENTES ESCALADOS SEGÚN EL MODO */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
                Ingredientes necesarios para {scaleMode === 'duo' ? '2 porciones (Duo)' : `${servings} porciones`}
              </h4>
              <span className="text-[11px] text-zinc-400">
                Peso aprox: ~{scaleMode === 'duo' ? duoTotalWeight : Math.round(dish.total_weight_g ? dish.total_weight_g * scaleRatio : totalRawWeight * scaleRatio)}g
              </span>
            </div>

            <div className="space-y-1.5">
              {ingredients.map((ing, idx) => {
                const currentRatio = scaleMode === 'duo' ? 2 / baseServings : scaleRatio;
                const scaledGrams = Math.round(ing.amount_g * currentRatio);
                return (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/60 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">
                        {ing.ingredient_name}
                      </span>
                      {ing.aisle_category && (
                        <span className="text-[9px] bg-zinc-200/70 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 px-1.5 py-0.5 rounded">
                          {ing.aisle_category}
                        </span>
                      )}
                    </div>
                    <span className="font-bold text-zinc-900 dark:text-white shrink-0">
                      {scaledGrams} g
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* PASOS DE PREPARACIÓN */}
          {dish.instructions && dish.instructions.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-emerald-500" />
                  <span>Pasos de Preparación</span>
                </h4>
                <span className="text-[11px] text-zinc-400 font-medium">
                  {completedSteps.length} / {dish.instructions.length} completados
                </span>
              </div>

              <div className="space-y-2">
                {dish.instructions.map((step, idx) => {
                  const isDone = completedSteps.includes(idx);
                  return (
                    <div
                      key={idx}
                      onClick={() => toggleStep(idx)}
                      className={`p-3 rounded-2xl border transition cursor-pointer flex items-start gap-3 text-xs leading-relaxed ${
                        isDone
                          ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900 text-zinc-400 line-through'
                          : 'bg-white dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200'
                      }`}
                    >
                      <button type="button" className="shrink-0 mt-0.5 text-emerald-600">
                        {isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Circle className="w-4 h-4 text-zinc-300 dark:text-zinc-600" />
                        )}
                      </button>
                      <span>{step}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* BOTONES DE ACCIÓN INFERIORES */}
        <div className="p-4 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex gap-2">
          {dish.is_starter_template && onCloneTemplate ? (
            <button
              onClick={() => onCloneTemplate(dish)}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20"
            >
              <Copy className="w-4 h-4" />
              <span>Clonar a Mis Platillos</span>
            </button>
          ) : (
            <>
              {onSchedule && (
                <button
                  onClick={() => onSchedule(dish)}
                  className="flex-1 py-2.5 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Programar</span>
                </button>
              )}
              {onLogToday && (
                <button
                  onClick={() =>
                    onLogToday(
                      dish,
                      scaleMode === 'duo' ? userServingMultiplier : servings
                    )
                  }
                  className="flex-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20"
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    {scaleMode === 'duo'
                      ? `Comer mi porción (${userWeightGrams}g • ${userCalories} kcal)`
                      : `Comer ${servings} porción${servings > 1 ? 'es' : ''} hoy`}
                  </span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
