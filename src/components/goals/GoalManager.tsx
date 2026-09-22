'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  Target,
  Watch,
  Download,
  Trash2,
  Copy,
  Check,
  Sparkles,
  AlertTriangle,
  Activity,
  Droplets,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Flame,
  CheckCircle2,
  RefreshCw,
  Info,
  Globe,
  Clock,
} from 'lucide-react';
import { GoalType } from '@/types/database';
import { calculateGoalMacros } from '@/lib/tdee';
import {
  getLocalDateString,
  getUserTimeZone,
  setUserTimeZone,
  getSystemTimeZone,
  TIMEZONE_OPTIONS,
} from '@/lib/utils';

export default function GoalManager() {
  const { user, activeGoal, refreshSession } = useAuth();
  const [goals, setGoals] = useState<any[]>([]);
  const [selectedGoalType, setSelectedGoalType] = useState<GoalType>(activeGoal?.goal_type || 'definition');
  const [weightInput, setWeightInput] = useState(String(user?.current_weight_kg || 75));
  
  // Opciones desacopladas de actividad y macronutrientes
  const [neatLevel, setNeatLevel] = useState<'sedentary' | 'light_standing' | 'active_walking' | 'heavy_labor'>(
    (user?.neat_level as any) || 'sedentary'
  );
  const [trainingSessions, setTrainingSessions] = useState<number>(user?.training_sessions_per_week ?? 4);
  const [macroPreference, setMacroPreference] = useState<'balanced' | 'high_carb' | 'higher_fat'>(
    activeGoal?.macro_preference || 'balanced'
  );
  const [deficitPct, setDeficitPct] = useState<number>(
    activeGoal?.deficit_surplus_pct ? activeGoal.deficit_surplus_pct : -0.15
  );

  const [savingGoal, setSavingGoal] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [webhookSimulating, setWebhookSimulating] = useState(false);
  const [webhookSuccessMsg, setWebhookSuccessMsg] = useState<string | null>(null);

  // Estado de Reevaluación Adaptativa
  const [evalData, setEvalData] = useState<any | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [applyingAdjustment, setApplyingAdjustment] = useState(false);
  const [adjustmentMessage, setAdjustmentMessage] = useState<string | null>(null);

  // Estado de Zona Horaria
  const [selectedTz, setSelectedTz] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('duo_calories_timezone') || 'auto';
    }
    return 'auto';
  });
  const [tzFeedback, setTzFeedback] = useState<string | null>(null);

  const handleTimeZoneChange = (newTz: string) => {
    setSelectedTz(newTz);
    setUserTimeZone(newTz);
    setTzFeedback('¡Zona horaria actualizada correctamente!');
    setTimeout(() => setTzFeedback(null), 3000);
  };

  // Cálculo en tiempo real (Live Preview) conforme el usuario interactúa
  const liveMacros = useMemo(() => {
    const weight = Number(weightInput) > 0 ? Number(weightInput) : (user?.current_weight_kg || 70);
    const height = user?.height_cm || 170;
    const age = user?.age || 25;
    const gender = user?.gender || 'male';
    const activity_level = user?.activity_level || 'moderate';

    return calculateGoalMacros(
      {
        age,
        gender,
        height_cm: height,
        weight_kg: weight,
        activity_level,
        neat_level: neatLevel,
        training_sessions_per_week: trainingSessions,
        macro_preference: macroPreference,
      },
      selectedGoalType,
      selectedGoalType === 'definition' ? deficitPct : undefined
    );
  }, [weightInput, user, neatLevel, trainingSessions, macroPreference, selectedGoalType, deficitPct]);

  const fetchGoals = async () => {
    try {
      const res = await fetch('/api/goals');
      if (res.ok) {
        const data = await res.json();
        setGoals(data.goals || []);
      }
    } catch {
      // Ignorar
    }
  };

  const fetchEvaluation = useCallback(async () => {
    setEvalLoading(true);
    try {
      const res = await fetch('/api/goals/reevaluate');
      if (res.ok) {
        const data = await res.json();
        if (data.hasActiveGoal) {
          setEvalData(data.evaluation);
        } else {
          setEvalData(null);
        }
      }
    } catch {
      // Ignorar
    } finally {
      setEvalLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGoals();
    fetchEvaluation();
  }, [fetchEvaluation]);

  useEffect(() => {
    if (activeGoal) {
      setSelectedGoalType(activeGoal.goal_type);
      if (activeGoal.macro_preference) setMacroPreference(activeGoal.macro_preference);
      if (activeGoal.deficit_surplus_pct !== undefined) setDeficitPct(activeGoal.deficit_surplus_pct);
    }
    if (user?.current_weight_kg) {
      setWeightInput(String(user.current_weight_kg));
    }
    if (user?.neat_level) {
      setNeatLevel(user.neat_level);
    }
    if (user?.training_sessions_per_week !== undefined && user?.training_sessions_per_week !== null) {
      setTrainingSessions(user.training_sessions_per_week);
    }
  }, [activeGoal, user]);

  const handleSaveGoal = async (gType?: GoalType, customDef?: number) => {
    const targetType = gType || selectedGoalType;
    setSelectedGoalType(targetType);
    setSavingGoal(true);
    setSaveSuccessMsg(null);
    const chosenDeficit = customDef !== undefined ? customDef : deficitPct;

    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal_type: targetType,
          custom_deficit_pct: chosenDeficit,
          macro_preference: macroPreference,
          neat_level: neatLevel,
          training_sessions_per_week: trainingSessions,
          updated_weight_kg: Number(weightInput),
          notes: `Meta de ${targetType} actualizada a ${(chosenDeficit * 100).toFixed(0)}% (${macroPreference})`,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSaveSuccessMsg('¡Metas recalculadas y guardadas exitosamente!');
        await refreshSession();
        await fetchGoals();
        await fetchEvaluation();
        setTimeout(() => setSaveSuccessMsg(null), 3500);
      } else {
        setSaveSuccessMsg(`Error: ${data.error || 'No se pudo guardar la meta'}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar meta';
      setSaveSuccessMsg(`Error: ${msg}`);
    } finally {
      setSavingGoal(false);
    }
  };

  const handleApplyAdjustment = async () => {
    if (!evalData?.suggestedDeltaKcal) return;
    setApplyingAdjustment(true);
    setAdjustmentMessage(null);

    try {
      const res = await fetch('/api/goals/reevaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deltaKcal: evalData.suggestedDeltaKcal,
          reason: `Ajuste adaptativo aceptado: ${evalData.suggestedDeltaKcal > 0 ? `+${evalData.suggestedDeltaKcal}` : evalData.suggestedDeltaKcal} kcal tras análisis de progreso.`,
        }),
      });

      if (res.ok) {
        setAdjustmentMessage('¡Ajuste aplicado exitosamente! Tu objetivo calórico y macros fueron recalculados.');
        await refreshSession();
        await fetchGoals();
        await fetchEvaluation();
      }
    } catch {
      setAdjustmentMessage('Error al aplicar ajuste. Por favor reintenta.');
    } finally {
      setApplyingAdjustment(false);
    }
  };

  const handleSimulateAppleWatch = async () => {
    if (!user?.webhook_token) return;
    setWebhookSimulating(true);
    setWebhookSuccessMsg(null);

    try {
      const res = await fetch(`/api/health-webhook/${user.webhook_token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: getLocalDateString(),
          active_calories_burned: 540,
          steps: 9200,
          resting_heart_rate: 62,
          weight_kg: Number(weightInput),
        }),
      });

      if (res.ok) {
        setWebhookSuccessMsg('¡Datos sincronizados! 540 kcal activas y 9,200 pasos recibidos.');
        await refreshSession();
        await fetchEvaluation();
      }
    } finally {
      setWebhookSimulating(false);
    }
  };

  const copyWebhookUrl = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const fullUrl = `${origin}/api/health-webhook/${user?.webhook_token}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleDeleteAccount = async () => {
    const ok = window.confirm('¿Estás completamente seguro de que deseas eliminar tu cuenta y todos tus datos registrados? Esta acción no se puede deshacer.');
    if (ok) {
      await fetch('/api/user/account', { method: 'DELETE' });
      window.location.reload();
    }
  };

  const goalDescriptions: Record<
    GoalType,
    {
      title: string;
      defaultDeficitText: string;
      defaultDeficitVal: number;
      protein: string;
      duration: string;
      reeval: string;
      objective: string;
      outcome: string;
    }
  > = {
    definition: {
      title: 'Definición',
      defaultDeficitText: '-15% (rango -10% a -25%)',
      defaultDeficitVal: -0.15,
      protein: '1.8 – 2.2 g/kg',
      duration: '8 – 12 semanas',
      objective: 'Reducir porcentaje graso reteniendo la masa muscular y fuerza.',
      outcome: 'Disminuir perímetro de cintura y conseguir mayor relieve muscular sin perder rendimiento.',
      reeval: 'Evaluar pérdida de 0.4%–0.7% semanal. Si hay estancamiento sostenido con buena adherencia, ajustar -120 kcal.',
    },
    recomposition: {
      title: 'Recomposición',
      defaultDeficitText: '-5% (rango 0% a -10%)',
      defaultDeficitVal: -0.05,
      protein: '1.8 – 2.0 g/kg',
      duration: '3 – 6 meses',
      objective: 'Perder grasa y construir masa muscular de forma simultánea.',
      outcome: 'Aumentar densidad y tono muscular reduciendo grasa suave, sin pasar hambre ni fatiga.',
      reeval: 'Monitorear cambios de cintura y fuerza. Si tras 8–10 semanas no hay cambio, pasar a Definición.',
    },
    maintenance: {
      title: 'Mantenimiento',
      defaultDeficitText: '0% (Equilibrio)',
      defaultDeficitVal: 0,
      protein: '1.6 – 1.8 g/kg',
      duration: 'Continuo / Estabilidad',
      objective: 'Estabilizar el peso y consolidar las adaptaciones metabólicas logradas.',
      outcome: 'Recuperar el equilibrio hormonal y tiroideo (diet break) y sostener tu físico con máxima energía.',
      reeval: 'Monitorear estabilidad semanal del peso corporal (±0.4%).',
    },
    bulking: {
      title: 'Volumen',
      defaultDeficitText: '+8% (rango +5% a +12%)',
      defaultDeficitVal: 0.08,
      protein: '1.6 – 2.0 g/kg',
      duration: '3 – 6 meses',
      objective: 'Maximizar el crecimiento muscular (hipertrofia) y la fuerza en entrenamientos.',
      outcome: 'Crear un superávit anabólico limpio para ganar masa magra con mínima acumulación de grasa.',
      reeval: 'Ganancia de 0.25%–0.5% semanal. Si el peso sube >0.7% semanal, moderar el superávit.',
    },
  };

  return (
    <div className="space-y-6 pb-20">
      {/* 0. MOTOR DE REEVALUACIÓN ADAPTATIVA LONGITUDINAL */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-500">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                Motor de Reevaluación Adaptativa
              </h3>
              <span className="text-[11px] text-zinc-400">
                Ajustes clínicos basados en adherencia y tendencia de peso (14 días)
              </span>
            </div>
          </div>
          <button
            onClick={fetchEvaluation}
            disabled={evalLoading}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition text-zinc-500"
            title="Actualizar diagnóstico"
          >
            <RefreshCw className={`w-4 h-4 ${evalLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {evalData ? (
          <div className="space-y-3.5">
            {/* Tarjetas de Métricas de Evaluación */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl border border-zinc-200/70 dark:border-zinc-700/60">
                <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5">Adherencia</span>
                {evalData.completeDaysCount === 0 ? (
                  <span className="text-base font-black text-zinc-400">--</span>
                ) : (
                  <span className={`text-base font-black ${evalData.adherencePct >= 75 ? 'text-emerald-500' : 'text-amber-500'}`}>
                    {evalData.adherencePct}%
                  </span>
                )}
                <span className="text-[10px] text-zinc-500 block truncate">
                  {evalData.completeDaysCount || 0} días compl.
                </span>
              </div>

              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl border border-zinc-200/70 dark:border-zinc-700/60">
                <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5">Peso Móvil 7d</span>
                <span className="text-base font-black text-zinc-900 dark:text-white">
                  {evalData.currentRollingAvgWeight} kg
                </span>
                <span className="text-[10px] text-zinc-400 block truncate">
                  {evalData.previousRollingAvgWeight
                    ? `vs ${evalData.previousRollingAvgWeight} kg previo`
                    : (evalData.weighInsCount || 0) > 0
                    ? `${evalData.weighInsCount} pesaje(s)`
                    : 'Sin pesajes aún'}
                </span>
              </div>

              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl border border-zinc-200/70 dark:border-zinc-700/60">
                <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5">Ritmo Semanal</span>
                {(evalData.completeDaysCount || 0) < 7 || (evalData.weighInsCount || 0) < 3 ? (
                  <span className="text-base font-black text-zinc-400">--</span>
                ) : (
                  <span className={`text-base font-black flex items-center justify-center gap-0.5 ${
                    evalData.weeklyChangeRatePct < 0 ? 'text-emerald-500' : 'text-blue-500'
                  }`}>
                    {evalData.weeklyChangeRatePct < 0 ? (
                      <TrendingDown className="w-3.5 h-3.5 inline" />
                    ) : (
                      <TrendingUp className="w-3.5 h-3.5 inline" />
                    )}
                    {evalData.weeklyChangeRatePct > 0 ? `+${evalData.weeklyChangeRatePct}` : evalData.weeklyChangeRatePct}%
                  </span>
                )}
                <span className="text-[10px] text-zinc-400 block truncate">
                  {(evalData.completeDaysCount || 0) < 7
                    ? `${evalData.completeDaysCount || 0}/7d mín.`
                    : `${evalData.weeklyChangeKg > 0 ? `+${evalData.weeklyChangeKg}` : evalData.weeklyChangeKg} kg/sem`}
                </span>
              </div>
            </div>

            {/* Diagnóstico Clínico */}
            <div className={`p-4 rounded-2xl border space-y-3 ${
              evalData.status === 'on_track'
                ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-950 dark:text-emerald-200'
                : evalData.status === 'needs_adjustment'
                ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/60 text-blue-950 dark:text-blue-200'
                : 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 text-amber-950 dark:text-amber-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {evalData.status === 'on_track' && <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                  {evalData.status === 'needs_adjustment' && <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                  {evalData.status === 'adherence_alert' && <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                  {evalData.status === 'insufficient_data' && <Activity className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {evalData.headline}
                  </span>
                </div>

                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-white/70 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60 text-zinc-700 dark:text-zinc-300">
                  {evalData.completeDaysCount || 0} / 7 días completos
                </span>
              </div>

              {/* Barra de progreso de calibración */}
              {(evalData.completeDaysCount || 0) < 7 && (
                <div className="space-y-1">
                  <div className="w-full bg-zinc-200/70 dark:bg-zinc-700/60 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.round(((evalData.completeDaysCount || 0) / 7) * 100))}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">
                    <span>0 días</span>
                    <span>Meta de calibración: 7 días completos</span>
                  </div>
                </div>
              )}

              <p className="text-xs leading-relaxed opacity-90">
                {evalData.diagnosisMessage}
              </p>

              {/* Alerta constructiva sobre registros parciales o necesidad de registro completo */}
              {evalData.completenessWarning && (
                <div className="p-3 rounded-xl bg-amber-100/70 dark:bg-amber-950/60 border border-amber-300/70 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
                  {evalData.completenessWarning}
                </div>
              )}

              {/* Recomendación y Confirmación Explícita (NUNCA silenciosa) */}
              {evalData.recommendationPrompt && (
                <div className="mt-3 pt-3 border-t border-zinc-200/60 dark:border-zinc-700/60 space-y-2">
                  <p className="text-xs font-semibold">
                    {evalData.recommendationPrompt}
                  </p>
                  {evalData.suggestedDeltaKcal !== 0 && (
                    <button
                      onClick={handleApplyAdjustment}
                      disabled={applyingAdjustment}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center justify-center gap-1.5"
                    >
                      {applyingAdjustment ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {evalData.suggestedDeltaKcal > 0
                          ? `Confirmar aumento de +${evalData.suggestedDeltaKcal} kcal`
                          : `Confirmar ajuste de ${evalData.suggestedDeltaKcal} kcal`}
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {adjustmentMessage && (
              <p className="text-xs text-center font-medium text-emerald-600 dark:text-emerald-400">
                {adjustmentMessage}
              </p>
            )}

            <p className="text-[11px] text-zinc-400 flex items-center gap-1">
              <Info className="w-3 h-3 shrink-0" />
              <span>
                Protección clínica: Los ajustes calóricos jamás se aplican de forma automática o imprevista. Siempre requieren tu revisión y consentimiento.
              </span>
            </p>
          </div>
        ) : (
          <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl text-center text-xs text-zinc-500">
            Registra al menos 3 a 5 días de comidas y pesajes para que el motor adaptativo analice tu evolución.
          </div>
        )}
      </div>

      {/* 1. CONFIGURACIÓN DE PARÁMETROS METABÓLICOS Y ACTIVIDAD DESACOPLADA */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-emerald-500" />
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                Cálculo Energético y Gasto Diario
              </h3>
              <span className="text-[11px] text-zinc-400 block">
                BMR: {liveMacros.bmr} kcal • TDEE: {liveMacros.tdee} kcal
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 block">
              {liveMacros.calorie_target} kcal
            </span>
            <span className="text-[10px] text-zinc-400 block">
              {liveMacros.protein_target_g}g P • {liveMacros.carbs_target_g}g C • {liveMacros.fat_target_g}g G
            </span>
          </div>
        </div>

        {/* Inputs de Peso y Actividad Desacoplada en formato vertical espacioso */}
        <div className="space-y-3">
          {/* 1. Peso Actual */}
          <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl border border-zinc-200/70 dark:border-zinc-700/60 flex items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-zinc-900 dark:text-white block">
                Peso actual de referencia
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block mt-0.5">
                Base para calcular tu metabolismo basal (BMR)
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <input
                type="number"
                step="0.1"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                className="w-24 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-2.5 py-1.5 text-base font-black text-zinc-900 dark:text-white text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="text-xs font-bold text-zinc-500">kg</span>
            </div>
          </div>

          {/* 2. Actividad Cotidiana / NEAT */}
          <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl border border-zinc-200/70 dark:border-zinc-700/60 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-zinc-900 dark:text-white block">
                  Actividad cotidiana / NEAT laboral
                </span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block mt-0.5">
                  Gasto energético de tu día a día (sin contar ejercicio programado)
                </span>
              </div>
            </div>
            <select
              value={neatLevel}
              onChange={(e) => setNeatLevel(e.target.value as any)}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="sedentary">Escritorio / Sedentario (&gt;7 horas sentado al día)</option>
              <option value="light_standing">De pie frecuente (mostrador, recepcionista, docente)</option>
              <option value="active_walking">Caminata activa continua (mesero, comercio, enfermería)</option>
              <option value="heavy_labor">Esfuerzo físico intenso (almacén, construcción, trabajo rural)</option>
            </select>
          </div>

          {/* 3. Sesiones de Entrenamiento Semanales */}
          <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl border border-zinc-200/70 dark:border-zinc-700/60 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-zinc-900 dark:text-white block">
                  Entrenamiento programado semanal
                </span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block mt-0.5">
                  Sesiones de fuerza o cardio estructuradas (~45 a 60 min)
                </span>
              </div>
            </div>
            <select
              value={trainingSessions}
              onChange={(e) => setTrainingSessions(Number(e.target.value))}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value={0}>0 sesiones semanales</option>
              <option value={2}>2 sesiones por semana (ligero)</option>
              <option value={3}>3 sesiones por semana (frecuente)</option>
              <option value={4}>4 sesiones por semana (óptimo fuerza)</option>
              <option value={5}>5 sesiones por semana (alto volumen)</option>
              <option value={6}>6 sesiones por semana (avanzado / diario)</option>
            </select>
          </div>
        </div>

        {/* Preferencia de Macronutrientes */}
        <div className="space-y-1.5">
          <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block">
            Preferencia de Distribución de Macronutrientes:
          </span>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'balanced', label: 'Equilibrada', desc: 'Grasas ~25-30% kcal' },
              { id: 'high_carb', label: 'Alta en Carbos', desc: 'Grasas ~20% kcal' },
              { id: 'higher_fat', label: 'Mayor Grasa', desc: 'Grasas ~35% kcal' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setMacroPreference(p.id as any)}
                className={`p-2.5 rounded-2xl border text-left transition ${
                  macroPreference === p.id
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-200'
                    : 'bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300'
                }`}
              >
                <span className="text-xs font-bold block">{p.label}</span>
                <span className="text-[10px] text-zinc-400 block">{p.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Déficit Personalizable en Definición */}
        {selectedGoalType === 'definition' && (
          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-700 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                Magnitud del Déficit Calórico:
              </span>
              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                {(deficitPct * 100).toFixed(0)}%
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { val: -0.10, label: '-10% (Leve)' },
                { val: -0.15, label: '-15% (Recomendado)' },
                { val: -0.20, label: '-20% (Moderado)' },
                { val: -0.25, label: '-25% (Intenso)' },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setDeficitPct(opt.val)}
                  className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition ${
                    deficitPct === opt.val
                      ? 'bg-emerald-500 text-white border-emerald-500'
                      : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700 hover:border-zinc-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-zinc-400">
              Recomendación clínica: Arrancar en -15% para proteger fuerza, energía y adherencia.
            </p>
          </div>
        )}

        {/* Métricas Clínicas de Soporte: Fibra, Hidratación Dual y Piso de Grasa */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Fibra Dietética */}
          <div className="p-3 bg-teal-50/70 dark:bg-teal-950/30 rounded-2xl border border-teal-200/60 dark:border-teal-800/50">
            <div className="flex items-center gap-1.5 text-teal-800 dark:text-teal-300 font-bold text-xs mb-0.5">
              <span>🌾 Fibra Dietética</span>
            </div>
            <span className="text-base font-black text-teal-700 dark:text-teal-400">
              {liveMacros.fiber_target_g || (user?.gender === 'female' ? 25 : 35)}g / día
            </span>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block mt-0.5">
              Rango óptimo: 30–35 g (14g / 1,000 kcal)
            </span>
          </div>

          {/* Hidratación Dual (Basal + Sesión) */}
          <div className="p-3 bg-sky-50/70 dark:bg-sky-950/30 rounded-2xl border border-sky-200/60 dark:border-sky-800/50">
            <div className="flex items-center gap-1.5 text-sky-800 dark:text-sky-300 font-bold text-xs mb-0.5">
              <Droplets className="w-3.5 h-3.5 text-sky-500" />
              <span>Agua Basal + Entreno</span>
            </div>
            <span className="text-base font-black text-sky-700 dark:text-sky-400">
              {liveMacros.water_target_ml || Math.round((Number(weightInput) || 70) * 35)} ml
            </span>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block mt-0.5">
              Basal 35 ml/kg + 400–800 ml/h de entreno
            </span>
          </div>
        </div>

        {/* Salvaguardas Médicas: Piso Calórico & Piso Fisiológico de Grasas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/50 rounded-2xl flex items-start gap-2 text-emerald-900 dark:text-emerald-200">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <p className="leading-snug text-[11px]">
              <strong>Piso Calórico Seguro:</strong> Mínimo {user?.gender === 'female' ? '1,200' : '1,500'} kcal/día para prevenir daño metabólico y vesicular.
            </p>
          </div>
          <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/50 rounded-2xl flex items-start gap-2 text-indigo-900 dark:text-indigo-200">
            <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <p className="leading-snug text-[11px]">
              <strong>Piso Fisiológico de Grasas:</strong> Mínimo 0.65 g/kg para asegurar síntesis hormonal, testosterona y absorción lipídica.
            </p>
          </div>
        </div>

        {/* Selector de las 4 Fases Nutricionales */}
        <div className="space-y-2.5">
          <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block">
            Seleccionar fase nutricional:
          </span>

          {(['definition', 'recomposition', 'maintenance', 'bulking'] as GoalType[]).map((gt) => {
            const info = goalDescriptions[gt];
            const isSelected = selectedGoalType === gt;
            const isCurrentlyActive = activeGoal?.goal_type === gt;

            return (
              <div
                key={gt}
                onClick={() => {
                  setSelectedGoalType(gt);
                  if (gt === 'definition') {
                    setDeficitPct(-0.15);
                  } else {
                    setDeficitPct(info.defaultDeficitVal);
                  }
                }}
                className={`p-4 rounded-2xl border transition cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/80 shadow-xs ring-1 ring-emerald-500/50'
                    : 'bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-zinc-900 dark:text-white">
                      {info.title}
                    </span>
                    {isCurrentlyActive ? (
                      <span className="text-[10px] font-bold bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                        Meta Activa
                      </span>
                    ) : isSelected ? (
                      <span className="text-[10px] font-bold bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-2 py-0.5 rounded-full">
                        Seleccionada
                      </span>
                    ) : null}
                  </div>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    {info.defaultDeficitText}
                  </span>
                </div>

                {/* Lo que se va a lograr / Objetivo de la fase */}
                <div className="p-2.5 my-2.5 bg-zinc-100/70 dark:bg-zinc-800/60 rounded-xl border border-zinc-200/50 dark:border-zinc-700/50 space-y-1">
                  <div className="flex items-start gap-1.5">
                    <span className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 shrink-0">
                      🎯 Objetivo:
                    </span>
                    <span className="text-[11px] text-zinc-700 dark:text-zinc-300 font-medium">
                      {info.objective}
                    </span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                      ✨ Lo que lograrás:
                    </span>
                    <span className="text-[11px] text-zinc-600 dark:text-zinc-400">
                      {info.outcome}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 mb-2">
                  <span>Proteína: <strong className="text-zinc-800 dark:text-zinc-200">{info.protein}</strong></span>
                  <span>Evaluación: <strong className="text-zinc-800 dark:text-zinc-200">{info.duration}</strong></span>
                </div>

                <p className="text-[11px] text-zinc-500 border-t border-zinc-200/60 dark:border-zinc-700/60 pt-2">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">Criterio adaptativo:</span> {info.reeval}
                </p>
              </div>
            );
          })}
        </div>

        {/* BOTÓN PRINCIPAL: RECALCULAR Y GUARDAR METAS */}
        <div className="pt-2 space-y-2">
          <button
            type="button"
            onClick={() => handleSaveGoal(selectedGoalType)}
            disabled={savingGoal}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white rounded-2xl text-xs sm:text-sm font-black shadow-md transition flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            {savingGoal ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>
              {savingGoal
                ? 'Recalculando y guardando en tu perfil...'
                : `Recalcular y Guardar Meta de ${goalDescriptions[selectedGoalType].title}`}
            </span>
          </button>

          {saveSuccessMsg && (
            <p className="text-xs text-center font-bold text-emerald-600 dark:text-emerald-400 py-2 px-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 animate-fade-in">
              {saveSuccessMsg}
            </p>
          )}
        </div>
      </div>

      {/* 2. Configuración de Zona Horaria */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-emerald-500" />
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">
              Zona Horaria y Fecha
            </h3>
          </div>
          <span className="text-[11px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            Hoy: {getLocalDateString()}
          </span>
        </div>

        <p className="text-xs text-zinc-500 leading-relaxed">
          Define cómo se calculan las fechas de tu Diario, Plan Semanal y registros. Por defecto detecta automáticamente la hora de tu dispositivo sin necesidad de solicitar permisos de ubicación.
        </p>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
            Seleccionar Zona Horaria:
          </label>
          <div className="relative">
            <select
              value={selectedTz}
              onChange={(e) => handleTimeZoneChange(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl px-3.5 py-3 text-xs font-medium text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition appearance-none cursor-pointer pr-10"
            >
              {TIMEZONE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                  {opt.value === 'auto' ? ` (Detectado: ${getSystemTimeZone()})` : ''}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-zinc-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="bg-zinc-50 dark:bg-zinc-800/60 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
            <Clock className="w-3.5 h-3.5 text-emerald-500" />
            <span>Zona horaria activa:</span>
          </div>
          <span className="font-semibold text-zinc-900 dark:text-zinc-200 font-mono text-[11px]">
            {getUserTimeZone()}
          </span>
        </div>

        {tzFeedback && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-2 animate-fadeIn">
            <Check className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{tzFeedback}</span>
          </div>
        )}
      </div>

      {/* 3. Integración Apple Watch (Apple Shortcuts Webhook) */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Watch className="w-5 h-5 text-blue-500" />
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">
              Integración Apple Watch (Atajos)
            </h3>
          </div>
          <span className="text-[11px] bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">
            Sin app nativa
          </span>
        </div>

        <p className="text-xs text-zinc-500 leading-relaxed">
          Recibe automáticamente tus calorías activas quemadas, pasos y peso desde la app Salud del iPhone a través de un Atajo personalizado.
        </p>

        {/* URL del webhook con token seguro */}
        <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 space-y-2">
          <span className="text-[11px] font-semibold text-zinc-500 block">Tu URL secreta del Webhook:</span>
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono bg-white dark:bg-zinc-900 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 flex-1 truncate text-zinc-700 dark:text-zinc-300">
              /api/health-webhook/{user?.webhook_token}
            </code>
            <button
              onClick={copyWebhookUrl}
              className="p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:bg-zinc-100 transition"
              title="Copiar URL completa"
            >
              {copiedToken ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-zinc-400" />}
            </button>
          </div>
        </div>

        {/* Botón de prueba simulada */}
        <div>
          <button
            onClick={handleSimulateAppleWatch}
            disabled={webhookSimulating}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center justify-center gap-2"
          >
            <Activity className="w-4 h-4" />
            <span>{webhookSimulating ? 'Sincronizando...' : 'Simular sincronización de Apple Watch ahora'}</span>
          </button>
          {webhookSuccessMsg && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium text-center mt-2">
              {webhookSuccessMsg}
            </p>
          )}
        </div>
      </div>

      {/* 3. Exportación y Privacidad de Datos */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-zinc-900 dark:text-white">
          Exportación y Control de Cuenta
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <a
            href="/api/user/export?format=json"
            download
            className="p-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-center transition flex flex-col items-center justify-center gap-1.5"
          >
            <Download className="w-4 h-4 text-zinc-500" />
            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Descargar JSON</span>
            <span className="text-[10px] text-zinc-400">Respaldo completo</span>
          </a>

          <a
            href="/api/user/export?format=csv"
            download
            className="p-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-center transition flex flex-col items-center justify-center gap-1.5"
          >
            <Download className="w-4 h-4 text-zinc-500" />
            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Descargar CSV</span>
            <span className="text-[10px] text-zinc-400">Comidas en Excel</span>
          </a>
        </div>

        <button
          onClick={handleDeleteAccount}
          className="w-full py-2.5 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 rounded-xl text-xs font-semibold border border-red-200 dark:border-red-900/50 transition flex items-center justify-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          <span>Eliminar mi cuenta y todos mis datos (Derecho al olvido)</span>
        </button>
      </div>
    </div>
  );
}
