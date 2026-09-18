'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { GoalType } from '@/types/database';

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
  const [copiedToken, setCopiedToken] = useState(false);
  const [webhookSimulating, setWebhookSimulating] = useState(false);
  const [webhookSuccessMsg, setWebhookSuccessMsg] = useState<string | null>(null);

  // Estado de Reevaluación Adaptativa
  const [evalData, setEvalData] = useState<any | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [applyingAdjustment, setApplyingAdjustment] = useState(false);
  const [adjustmentMessage, setAdjustmentMessage] = useState<string | null>(null);

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

  const handleSaveGoal = async (gType: GoalType, customDef?: number) => {
    setSelectedGoalType(gType);
    setSavingGoal(true);
    const chosenDeficit = customDef !== undefined ? customDef : deficitPct;

    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal_type: gType,
          custom_deficit_pct: chosenDeficit,
          macro_preference: macroPreference,
          neat_level: neatLevel,
          training_sessions_per_week: trainingSessions,
          updated_weight_kg: Number(weightInput),
          notes: `Meta de ${gType} actualizada a ${(chosenDeficit * 100).toFixed(0)}%`,
        }),
      });

      if (res.ok) {
        await refreshSession();
        await fetchGoals();
        await fetchEvaluation();
      }
    } catch {
      // Ignorar
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
          date: new Date().toISOString().split('T')[0],
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
    { title: string; defaultDeficitText: string; defaultDeficitVal: number; protein: string; duration: string; reeval: string }
  > = {
    definition: {
      title: 'Definición',
      defaultDeficitText: '-15% (rango -10% a -25%)',
      defaultDeficitVal: -0.15,
      protein: '1.8 – 2.2 g/kg',
      duration: '8 – 12 semanas',
      reeval: 'Evaluar pérdida de 0.4%–0.7% semanal. Si hay estancamiento sostenido con buena adherencia, ajustar -120 kcal.',
    },
    recomposition: {
      title: 'Recomposición',
      defaultDeficitText: '-5% (rango 0% a -10%)',
      defaultDeficitVal: -0.05,
      protein: '1.8 – 2.0 g/kg',
      duration: '3 – 6 meses',
      reeval: 'Monitorear cambios de cintura y fuerza. Si tras 8–10 semanas no hay cambio, pasar a Definición.',
    },
    maintenance: {
      title: 'Mantenimiento',
      defaultDeficitText: '0% (Equilibrio)',
      defaultDeficitVal: 0,
      protein: '1.6 – 1.8 g/kg',
      duration: 'Continuo / Estabilidad',
      reeval: 'Monitorear estabilidad semanal del peso corporal (±0.4%).',
    },
    bulking: {
      title: 'Volumen',
      defaultDeficitText: '+8% (rango +5% a +12%)',
      defaultDeficitVal: 0.08,
      protein: '1.6 – 2.0 g/kg',
      duration: '3 – 6 meses',
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
                <span className={`text-base font-black ${evalData.adherencePct >= 75 ? 'text-emerald-500' : 'text-amber-500'}`}>
                  {evalData.adherencePct}%
                </span>
                <span className="text-[10px] text-zinc-500 block truncate">
                  {evalData.recordedDaysCount} días reg.
                </span>
              </div>

              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl border border-zinc-200/70 dark:border-zinc-700/60">
                <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5">Peso Móvil 7d</span>
                <span className="text-base font-black text-zinc-900 dark:text-white">
                  {evalData.currentRollingAvgWeight} kg
                </span>
                <span className="text-[10px] text-zinc-400 block truncate">
                  vs {evalData.previousRollingAvgWeight} kg previo
                </span>
              </div>

              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl border border-zinc-200/70 dark:border-zinc-700/60">
                <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5">Ritmo Semanal</span>
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
                <span className="text-[10px] text-zinc-400 block truncate">
                  {evalData.weeklyChangeKg > 0 ? `+${evalData.weeklyChangeKg}` : evalData.weeklyChangeKg} kg/sem
                </span>
              </div>
            </div>

            {/* Diagnóstico Clínico */}
            <div className={`p-4 rounded-2xl border ${
              evalData.status === 'on_track'
                ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-950 dark:text-emerald-200'
                : evalData.status === 'needs_adjustment'
                ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/60 text-blue-950 dark:text-blue-200'
                : 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 text-amber-950 dark:text-amber-200'
            }`}>
              <div className="flex items-center gap-2 mb-1.5">
                {evalData.status === 'on_track' && <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                {evalData.status === 'needs_adjustment' && <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                {evalData.status === 'adherence_alert' && <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                <span className="text-xs font-bold uppercase tracking-wider">
                  {evalData.headline}
                </span>
              </div>
              <p className="text-xs leading-relaxed opacity-90">
                {evalData.diagnosisMessage}
              </p>

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
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">
              Cálculo Energético y Gasto Diario
            </h3>
          </div>
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
            {activeGoal?.calorie_target ? `${activeGoal.calorie_target} kcal` : ''}
          </span>
        </div>

        {/* Inputs de Peso y Actividad Desacoplada */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Peso Actual */}
          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl border border-zinc-200 dark:border-zinc-700/60">
            <span className="text-[11px] font-bold text-zinc-500 block mb-1">Peso actual</span>
            <div className="flex items-baseline gap-1">
              <input
                type="number"
                step="0.1"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-2 py-1 text-base font-black text-zinc-900 dark:text-white"
              />
              <span className="text-xs font-semibold text-zinc-500">kg</span>
            </div>
          </div>

          {/* Actividad Cotidiana / NEAT */}
          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl border border-zinc-200 dark:border-zinc-700/60">
            <span className="text-[11px] font-bold text-zinc-500 block mb-1">Actividad laboral / NEAT</span>
            <select
              value={neatLevel}
              onChange={(e) => setNeatLevel(e.target.value as any)}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-2 py-1 text-xs font-bold text-zinc-800 dark:text-zinc-200"
            >
              <option value="sedentary">Escritorio / Sentado (&gt;7h)</option>
              <option value="light_standing">De pie frecuente (mostrador)</option>
              <option value="active_walking">Caminata activa (mesero/salud)</option>
              <option value="heavy_labor">Esfuerzo físico intenso</option>
            </select>
          </div>

          {/* Sesiones de Entrenamiento Semanales */}
          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl border border-zinc-200 dark:border-zinc-700/60">
            <span className="text-[11px] font-bold text-zinc-500 block mb-1">Entrenamientos / sem</span>
            <select
              value={trainingSessions}
              onChange={(e) => setTrainingSessions(Number(e.target.value))}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-2 py-1 text-xs font-bold text-zinc-800 dark:text-zinc-200"
            >
              <option value={0}>0 sesiones semanales</option>
              <option value={2}>2 sesiones (45-60 min)</option>
              <option value={3}>3 sesiones (45-60 min)</option>
              <option value={4}>4 sesiones (45-60 min)</option>
              <option value={5}>5 sesiones (45-60 min)</option>
              <option value={6}>6 sesiones (45-60 min)</option>
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
              {activeGoal?.fiber_target_g || (user?.gender === 'female' ? 25 : 35)}g / día
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
              {activeGoal?.water_target_ml || Math.round((user?.current_weight_kg || 70) * 35)} ml
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
            Seleccionar o actualizar fase nutricional:
          </span>

          {(['definition', 'recomposition', 'maintenance', 'bulking'] as GoalType[]).map((gt) => {
            const info = goalDescriptions[gt];
            const isActive = activeGoal?.goal_type === gt;

            return (
              <div
                key={gt}
                onClick={() => handleSaveGoal(gt, gt === 'definition' ? deficitPct : info.defaultDeficitVal)}
                className={`p-4 rounded-2xl border transition cursor-pointer ${
                  isActive
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/80 shadow-xs'
                    : 'bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-zinc-900 dark:text-white">
                      {info.title}
                    </span>
                    {isActive && (
                      <span className="text-[10px] font-bold bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                        Activa
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    {info.defaultDeficitText}
                  </span>
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

        {savingGoal && (
          <p className="text-xs text-center text-emerald-600 dark:text-emerald-400 font-semibold animate-pulse">
            Guardando y recalculando macronutrientes...
          </p>
        )}
      </div>

      {/* 2. Integración Apple Watch (Apple Shortcuts Webhook) */}
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
