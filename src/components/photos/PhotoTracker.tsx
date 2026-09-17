'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Camera, Sparkles, Shield, Users, Trash2, Eye, EyeOff, Layers, ArrowLeftRight } from 'lucide-react';
import { BodyPhotoPose } from '@/types/database';

export default function PhotoTracker() {
  const { user, partner } = useAuth();
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Ver fotos propias o de pareja
  const [viewTarget, setViewTarget] = useState<'me' | 'partner'>('me');

  // Silueta guía activa al tomar foto
  const [showSilhouetteGuide, setShowSilhouetteGuide] = useState(true);
  const [selectedPose, setSelectedPose] = useState<BodyPhotoPose>('front');

  // Comparador lado a lado
  const [isComparing, setIsComparing] = useState(false);
  const [beforePhoto, setBeforePhoto] = useState<any>(null);
  const [afterPhoto, setAfterPhoto] = useState<any>(null);

  // Análisis cualitativo IA
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiDescription, setAiDescription] = useState<string | null>(null);

  // Permiso para compartir con la pareja
  const [shareAllowed, setShareAllowed] = useState(user?.share_photos_with_partner ?? true);

  const fetchPhotos = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/photos?target=${viewTarget}`);
      if (res.ok) {
        const data = await res.json();
        setPhotos(data.photos || []);
        if (data.photos?.length >= 2) {
          setBeforePhoto(data.photos[data.photos.length - 1]);
          setAfterPhoto(data.photos[0]);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPhotos();
  }, [viewTarget]);

  const handleUploadPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const res = await fetch('/api/photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: new Date().toISOString().split('T')[0],
            data_url: base64,
            pose: selectedPose,
            notes: 'Toma con silueta de referencia',
          }),
        });

        if (res.ok) {
          fetchPhotos();
        }
      } catch {
        // Ignorar
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyzeWithAi = async () => {
    if (!beforePhoto || !afterPhoto) return;
    setAiAnalyzing(true);
    setAiDescription(null);

    try {
      const res = await fetch('/api/vision/photo-compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beforeImageBase64: beforePhoto.data_url,
          afterImageBase64: afterPhoto.data_url,
          beforeDate: beforePhoto.date,
          afterDate: afterPhoto.date,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAiDescription(data.description);
      }
    } finally {
      setAiAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Header con permisos de privacidad y selector de pareja */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-500" />
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">
              Seguimiento Fotográfico Privado
            </h3>
          </div>

          {/* Toggle de permisos para la pareja (solo si existe compañero) */}
          {partner && (
            <button
              onClick={() => setShareAllowed(!shareAllowed)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                shareAllowed
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700'
              }`}
            >
              {shareAllowed ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>{shareAllowed ? 'Compartido con compañero/a' : 'Solo visible por mí'}</span>
            </button>
          )}
        </div>

        {partner && (
          <div className="flex bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-2xl">
            <button
              onClick={() => setViewTarget('me')}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition ${
                viewTarget === 'me'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-white'
              }`}
            >
              Mis Fotos
            </button>
            <button
              onClick={() => setViewTarget('partner')}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
                viewTarget === 'partner'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Fotos de {partner.display_name}</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Área de Captura con Silueta Guía Superpuesta */}
      {viewTarget === 'me' && (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-zinc-500" />
              <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
                Nueva Foto con Silueta de Referencia
              </h4>
            </div>

            <button
              onClick={() => setShowSilhouetteGuide(!showSilhouetteGuide)}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{showSilhouetteGuide ? 'Silueta activa' : 'Silueta apagada'}</span>
            </button>
          </div>

          <div className="flex gap-2">
            {(['front', 'side', 'back'] as BodyPhotoPose[]).map((p) => (
              <button
                key={p}
                onClick={() => setSelectedPose(p)}
                className={`flex-1 py-1.5 rounded-xl text-xs font-semibold capitalize border transition ${
                  selectedPose === p
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                }`}
              >
                {p === 'front' ? 'Frente' : p === 'side' ? 'Perfil' : 'Espalda'}
              </button>
            ))}
          </div>

          {/* Visor de encuadre con silueta SVG semitransparente */}
          <div className="relative w-full h-64 bg-zinc-950 rounded-2xl overflow-hidden flex items-center justify-center border border-zinc-800">
            {showSilhouetteGuide && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
                {/* Silueta de encuadre anatómico estándar */}
                <svg
                  className="w-40 h-56 text-emerald-400"
                  viewBox="0 0 100 160"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                >
                  <circle cx="50" cy="22" r="12" />
                  <path d="M 35 38 C 35 38, 26 50, 22 80 L 30 82 L 35 55 L 35 95 L 42 150 L 48 150 L 47 100 L 53 100 L 52 150 L 58 150 L 65 95 L 65 55 L 70 82 L 78 80 C 74 50, 65 38, 65 38 Z" />
                </svg>
              </div>
            )}

            <div className="z-10 text-center p-4">
              <p className="text-xs text-zinc-400 mb-3 max-w-xs">
                Alinea tu cuerpo con las líneas guía para asegurar la misma distancia, altura e iluminación en cada toma.
              </p>
              <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-lg shadow-emerald-600/30 transition">
                <Camera className="w-4 h-4" />
                <span>Subir o Tomar Foto</span>
                <input type="file" accept="image/*" onChange={handleUploadPhoto} className="hidden" />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* 3. Comparador Lado a Lado y Análisis Cualitativo */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-zinc-500" />
            <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
              Comparativa de Progreso
            </h4>
          </div>

          {photos.length >= 2 && (
            <button
              onClick={() => setIsComparing(!isComparing)}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400"
            >
              {isComparing ? 'Ver galería' : 'Modo comparador'}
            </button>
          )}
        </div>

        {photos.length < 2 ? (
          <p className="text-xs text-zinc-400 text-center py-6">
            Registra al menos 2 fotografías de progreso para activar la comparativa y el análisis descriptivo.
          </p>
        ) : (
          <div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {/* Foto Antes */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-zinc-700 dark:text-zinc-300">Antes:</span>
                  <select
                    value={beforePhoto?.id}
                    onChange={(e) => setBeforePhoto(photos.find((p) => p.id === e.target.value))}
                    className="bg-zinc-100 dark:bg-zinc-800 rounded-lg text-[11px] p-1 border-0"
                  >
                    {photos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.date} ({p.pose})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="h-44 bg-zinc-100 dark:bg-zinc-800 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-700 flex items-center justify-center">
                  {beforePhoto?.data_url ? (
                    <img
                      src={beforePhoto.data_url}
                      alt="Antes"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs text-zinc-400">Sin foto</span>
                  )}
                </div>
              </div>

              {/* Foto Después */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-zinc-700 dark:text-zinc-300">Después:</span>
                  <select
                    value={afterPhoto?.id}
                    onChange={(e) => setAfterPhoto(photos.find((p) => p.id === e.target.value))}
                    className="bg-zinc-100 dark:bg-zinc-800 rounded-lg text-[11px] p-1 border-0"
                  >
                    {photos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.date} ({p.pose})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="h-44 bg-zinc-100 dark:bg-zinc-800 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-700 flex items-center justify-center">
                  {afterPhoto?.data_url ? (
                    <img
                      src={afterPhoto.data_url}
                      alt="Después"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs text-zinc-400">Sin foto</span>
                  )}
                </div>
              </div>
            </div>

            {/* BOTÓN: ANÁLISIS CUALITATIVO OPT-IN */}
            <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200/60 dark:border-emerald-900/50 space-y-3">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-xs font-bold text-zinc-900 dark:text-white">
                    Análisis Descriptivo con IA (Opt-in)
                  </h5>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">
                    Genera un resumen cualitativo y motivador de los cambios visuales observados. Sin medición biométrica ni % de grasa, respetando tu privacidad.
                  </p>
                </div>
              </div>

              <button
                onClick={handleAnalyzeWithAi}
                disabled={aiAnalyzing}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center justify-center gap-2"
              >
                {aiAnalyzing ? (
                  <span>Analizando con visión IA...</span>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Describir cambios cualitativos entre estas 2 fotos</span>
                  </>
                )}
              </button>

              {aiDescription && (
                <div className="mt-3 p-3 bg-white dark:bg-zinc-900 rounded-xl border border-emerald-200 dark:border-zinc-700 text-xs text-zinc-800 dark:text-zinc-200 space-y-2 whitespace-pre-line leading-relaxed">
                  {aiDescription}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
