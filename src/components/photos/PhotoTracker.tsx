'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  Camera,
  Upload,
  RefreshCw,
  Timer,
  Check,
  X,
  RotateCcw,
  Sparkles,
  Shield,
  Users,
  Trash2,
  Eye,
  EyeOff,
  Layers,
  ArrowLeftRight,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { BodyPhotoPose } from '@/types/database';
import { getLocalDateString } from '@/lib/utils';

export default function PhotoTracker() {
  const { user, partner } = useAuth();
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Ver fotos propias o de pareja
  const [viewTarget, setViewTarget] = useState<'me' | 'partner'>('me');

  // Silueta guía activa al tomar foto
  const [showSilhouetteGuide, setShowSilhouetteGuide] = useState(true);
  const [selectedPose, setSelectedPose] = useState<BodyPhotoPose>('front');

  // Estados de Cámara y Captura
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [useTimer, setUseTimer] = useState(false);

  // Comparador lado a lado
  const [isComparing, setIsComparing] = useState(false);
  const [beforePhoto, setBeforePhoto] = useState<any>(null);
  const [afterPhoto, setAfterPhoto] = useState<any>(null);

  // Análisis cualitativo IA
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiDescription, setAiDescription] = useState<string | null>(null);

  // Permiso para compartir con la pareja
  const [shareAllowed, setShareAllowed] = useState(user?.share_photos_with_partner ?? true);

  // Referencias para video y stream
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchPhotos = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/photos?target=${viewTarget}`);
      if (res.ok) {
        const data = await res.json();
        const list = data.photos || [];
        setPhotos(list);
        if (list.length >= 2) {
          setBeforePhoto(list[list.length - 1]);
          setAfterPhoto(list[0]);
        } else if (list.length === 1) {
          setBeforePhoto(list[0]);
          setAfterPhoto(list[0]);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPhotos();
  }, [viewTarget]);

  // Limpieza al desmontar
  useEffect(() => {
    return () => {
      stopCamera();
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  // Iniciar la cámara en vivo
  const startCamera = async (facing: 'user' | 'environment' = cameraFacing) => {
    setCameraError(null);
    setCapturedPreview(null);
    try {
      stopCamera();

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Tu navegador o dispositivo no soporta acceso directo a la cámara.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      setIsCameraActive(true);

      // Esperar al siguiente ciclo para asegurar que el elemento video esté montado
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch((err) => {
            console.warn('Error al reproducir video:', err);
          });
        }
      }, 100);
    } catch (err: any) {
      console.error('Error al solicitar cámara:', err);
      let msg = 'No se pudo acceder a la cámara. Verifica los permisos de tu navegador.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Permiso denegado. Permite el acceso a la cámara en los ajustes de tu navegador.';
      } else if (err.name === 'NotFoundError') {
        msg = 'No se encontró ningún dispositivo de cámara conectado.';
      }
      setCameraError(msg);
      setIsCameraActive(false);
    }
  };

  // Detener la cámara
  const stopCamera = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdown(null);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  // Alternar entre cámara frontal y trasera
  const switchCamera = () => {
    const nextFacing = cameraFacing === 'user' ? 'environment' : 'user';
    setCameraFacing(nextFacing);
    startCamera(nextFacing);
  };

  // Captura inmediata desde el fotograma del video
  const captureFrameNow = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Si la cámara es frontal (selfie), voltear horizontalmente para vista espejo natural
    if (cameraFacing === 'user') {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);

    setCapturedPreview(dataUrl);
    stopCamera();
  };

  // Disparar captura (con temporizador si está activo)
  const triggerCapture = () => {
    if (useTimer) {
      setCountdown(3);
      let currentCount = 3;
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

      countdownIntervalRef.current = setInterval(() => {
        currentCount -= 1;
        if (currentCount <= 0) {
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          setCountdown(null);
          captureFrameNow();
        } else {
          setCountdown(currentCount);
        }
      }, 1000);
    } else {
      captureFrameNow();
    }
  };

  // Subir foto desde explorador / galería de archivos
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      stopCamera();
      setCapturedPreview(base64);
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset
  };

  // Guardar foto confirmada en base de datos
  const handleConfirmSave = async () => {
    if (!capturedPreview) return;
    setIsSavingPhoto(true);

    const poseLabels: Record<BodyPhotoPose, string> = {
      front: 'Frente',
      side: 'Perfil',
      back: 'Espalda',
      other: 'Otra',
    };

    try {
      const res = await fetch('/api/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: getLocalDateString(),
          data_url: capturedPreview,
          pose: selectedPose,
          notes: `Toma de ${poseLabels[selectedPose]} con silueta`,
        }),
      });

      if (res.ok) {
        setCapturedPreview(null);
        await fetchPhotos();
      }
    } catch (err) {
      console.error('Error al guardar foto:', err);
    } finally {
      setIsSavingPhoto(false);
    }
  };

  // Descartar foto capturada y volver a la cámara
  const handleRetake = () => {
    setCapturedPreview(null);
    startCamera();
  };

  // Eliminar foto
  const handleDeletePhoto = async (id: string) => {
    if (!confirm('¿Deseas eliminar esta fotografía?')) return;
    try {
      const res = await fetch(`/api/photos?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setPhotos((prev) => prev.filter((p) => p.id !== id));
        if (beforePhoto?.id === id) setBeforePhoto(null);
        if (afterPhoto?.id === id) setAfterPhoto(null);
      }
    } catch {
      // Ignorar
    }
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

  // Renderizar siluetas SVG según la pose
  const renderSilhouette = () => {
    if (!showSilhouetteGuide) return null;

    if (selectedPose === 'side') {
      return (
        <svg
          className="w-44 h-64 text-emerald-400 drop-shadow-md pointer-events-none"
          viewBox="0 0 100 160"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="4 3"
        >
          {/* Silueta de Perfil */}
          <circle cx="48" cy="20" r="11" />
          <path d="M 57 19 L 61 22 L 57 24" stroke="currentColor" strokeWidth="1.5" />
          <path d="M 45 31 L 45 36 C 55 45, 62 60, 58 85 C 56 95, 52 105, 54 152 L 44 152 C 43 115, 38 100, 38 85 C 38 60, 42 45, 42 36 Z" />
          <line x1="28" y1="20" x2="72" y2="20" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />
          <line x1="25" y1="90" x2="75" y2="90" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />
        </svg>
      );
    }

    if (selectedPose === 'back') {
      return (
        <svg
          className="w-44 h-64 text-emerald-400 drop-shadow-md pointer-events-none"
          viewBox="0 0 100 160"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="4 3"
        >
          {/* Silueta de Espalda */}
          <circle cx="50" cy="20" r="11" />
          <path d="M 44 31 L 44 36 L 26 42 C 20 58, 18 80, 16 100 L 22 101 L 26 66 L 33 66 L 33 100 L 39 152 L 47 152 L 47 106 L 53 106 L 53 152 L 61 152 L 67 100 L 67 66 L 74 66 L 78 101 L 84 100 C 82 80, 80 58, 74 42 L 56 36 L 56 31" />
          <line x1="50" y1="36" x2="50" y2="104" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.7" />
          <line x1="28" y1="20" x2="72" y2="20" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />
          <line x1="25" y1="100" x2="75" y2="100" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />
        </svg>
      );
    }

    // Default: Frente
    return (
      <svg
        className="w-44 h-64 text-emerald-400 drop-shadow-md pointer-events-none"
        viewBox="0 0 100 160"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="4 3"
      >
        {/* Cabeza */}
        <circle cx="50" cy="20" r="11" />
        {/* Cuello, hombros, torso, brazos y piernas */}
        <path d="M 44 31 L 44 36 L 28 42 C 22 55, 20 75, 18 95 L 24 96 L 28 65 L 34 65 L 34 98 L 40 152 L 47 152 L 47 104 L 53 104 L 53 152 L 60 152 L 66 98 L 66 65 L 72 65 L 76 96 L 82 95 C 80 75, 78 55, 72 42 L 56 36 L 56 31" />
        <line x1="28" y1="20" x2="72" y2="20" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />
        <line x1="25" y1="98" x2="75" y2="98" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />
      </svg>
    );
  };

  const poseTitle = selectedPose === 'front' ? 'Frente' : selectedPose === 'side' ? 'Perfil' : 'Espalda';

  return (
    <div className="space-y-6 pb-16">
      {/* Elemento canvas oculto para congelar fotograma en alta resolución */}
      <canvas ref={canvasRef} className="hidden" />

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
              <Camera className="w-4 h-4 text-emerald-500" />
              <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
                Nueva Foto de Progreso con Silueta
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

          {/* Selector de Pose: Frente, Perfil, Espalda */}
          <div className="flex gap-2">
            {(['front', 'side', 'back'] as BodyPhotoPose[]).map((p) => (
              <button
                key={p}
                onClick={() => setSelectedPose(p)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold capitalize border transition ${
                  selectedPose === p
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-emerald-500'
                }`}
              >
                {p === 'front' ? 'Frente' : p === 'side' ? 'Perfil' : 'Espalda'}
              </button>
            ))}
          </div>

          {/* MENSAJE DE ERROR DE CÁMARA */}
          {cameraError && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 rounded-xl flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
              <div className="flex-1">
                <p className="font-semibold">{cameraError}</p>
                <p className="text-[11px] mt-0.5 text-amber-700 dark:text-amber-300">
                  Puedes seleccionar tu fotografía directamente desde tu galería o archivo con el botón de abajo.
                </p>
              </div>
              <button onClick={() => setCameraError(null)} className="text-amber-500 hover:text-amber-700">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* VISOR PRINCIPAL CON RELACIÓN DE ASPECTO ADECUADA */}
          <div className="relative w-full h-80 sm:h-96 bg-zinc-950 rounded-2xl overflow-hidden flex items-center justify-center border border-zinc-800 shadow-inner">
            {/* 1. VIDEO DE CÁMARA EN VIVO */}
            {isCameraActive && !capturedPreview && (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`absolute inset-0 w-full h-full object-cover ${
                  cameraFacing === 'user' ? 'scale-x-[-1]' : ''
                }`}
              />
            )}

            {/* 2. VISTA PREVIA DE FOTO CAPTURADA O SUBIDA */}
            {capturedPreview && (
              <img
                src={capturedPreview}
                alt="Vista previa de foto tomada"
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}

            {/* 3. CAPA DE SILUETA GUÍA SUPERPUESTA EN TIEMPO REAL */}
            {showSilhouetteGuide && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40 z-10 transition-opacity">
                {renderSilhouette()}
              </div>
            )}

            {/* 4. CUENTA REGRESIVA (ANIMADA) */}
            {countdown !== null && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-xs">
                <div className="w-24 h-24 rounded-full bg-emerald-600 text-white flex items-center justify-center text-5xl font-black shadow-2xl animate-pulse">
                  {countdown}
                </div>
              </div>
            )}

            {/* 5. CONTROLES SUPERIORES FLOTANTES (CUANDO LA CÁMARA ESTÁ ACTIVA) */}
            {isCameraActive && !capturedPreview && (
              <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-auto">
                <span className="px-2.5 py-1 bg-black/60 backdrop-blur-md text-emerald-400 border border-emerald-500/30 rounded-lg text-[11px] font-bold">
                  Pose: {poseTitle}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={switchCamera}
                    title="Voltear Cámara"
                    className="p-2 bg-black/60 hover:bg-black/80 backdrop-blur-md text-white rounded-xl border border-white/20 transition active:scale-95"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={stopCamera}
                    title="Cerrar Cámara"
                    className="p-2 bg-black/60 hover:bg-black/80 backdrop-blur-md text-white rounded-xl border border-white/20 transition active:scale-95"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* 6. CONTROLES INFERIORES FLOTANTES PARA DISPARAR (CÁMARA ACTIVA) */}
            {isCameraActive && !capturedPreview && (
              <div className="absolute bottom-4 inset-x-0 z-20 flex items-center justify-center gap-4 pointer-events-auto">
                {/* Botón Temporizador 3s */}
                <button
                  type="button"
                  onClick={() => setUseTimer(!useTimer)}
                  className={`p-2.5 rounded-full backdrop-blur-md border transition flex items-center gap-1 text-xs font-semibold ${
                    useTimer
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                      : 'bg-black/60 text-zinc-300 border-white/20 hover:text-white'
                  }`}
                  title={useTimer ? 'Temporizador 3s activo' : 'Activar temporizador 3s'}
                >
                  <Timer className="w-4 h-4" />
                  <span className="text-[10px]">3s</span>
                </button>

                {/* Botón Disparador Principal */}
                <button
                  type="button"
                  onClick={triggerCapture}
                  className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-400 active:scale-90 text-white flex items-center justify-center p-1.5 shadow-2xl shadow-emerald-500/50 transition border-4 border-white/80"
                  title="Tomar fotografía"
                >
                  <Camera className="w-7 h-7" />
                </button>
              </div>
            )}

            {/* 7. ESTADO INICIAL (CÁMARA INACTIVA Y SIN FOTO CAPTURADA) */}
            {!isCameraActive && !capturedPreview && (
              <div className="z-10 text-center p-4 max-w-sm flex flex-col items-center">
                <p className="text-xs text-zinc-300 mb-4 leading-relaxed font-medium">
                  Alinea tu cuerpo con las líneas guía para asegurar la misma distancia, altura e iluminación en cada toma de <span className="text-emerald-400 font-bold">{poseTitle}</span>.
                </p>

                {/* BOTONES PRINCIPALES: CÁMARA EN VIVO O SUBIR ARCHIVO */}
                <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full">
                  <button
                    type="button"
                    onClick={() => startCamera()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 transition cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Tomar Foto con Silueta</span>
                  </button>

                  <label className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-200 hover:text-white rounded-xl text-xs font-semibold border border-zinc-700 transition cursor-pointer shadow-sm">
                    <Upload className="w-4 h-4" />
                    <span>Elegir de Galería</span>
                    <input type="file" accept="image/*" onChange={handleFileSelected} className="hidden" />
                  </label>
                </div>
              </div>
            )}

            {/* 8. CONTROLES DE CONFIRMACIÓN (FOTO CAPTURADA O ELEGIDA) */}
            {capturedPreview && (
              <div className="absolute bottom-3 inset-x-3 z-20 flex items-center gap-2 pointer-events-auto bg-black/70 backdrop-blur-md p-2.5 rounded-2xl border border-white/15">
                <button
                  type="button"
                  onClick={handleConfirmSave}
                  disabled={isSavingPhoto}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl text-xs font-bold shadow-lg transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingPhoto ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Guardar ({poseTitle})</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleRetake}
                  disabled={isSavingPhoto}
                  className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold border border-zinc-700 transition flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Repetir</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCapturedPreview(null)}
                  disabled={isSavingPhoto}
                  className="p-2 bg-zinc-800 hover:bg-red-950/80 text-zinc-400 hover:text-red-400 rounded-xl transition"
                  title="Cancelar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Galería de Fotos y Comparador Lado a Lado */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-zinc-500" />
            <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
              {isComparing ? 'Comparativa de Progreso' : 'Galería de Registros'}
            </h4>
          </div>

          {photos.length >= 2 && (
            <button
              onClick={() => setIsComparing(!isComparing)}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 hover:underline cursor-pointer"
            >
              {isComparing ? 'Ver galería completa' : 'Modo comparador (2 fotos)'}
            </button>
          )}
        </div>

        {photos.length === 0 ? (
          <p className="text-xs text-zinc-400 text-center py-6">
            Aún no has registrado fotografías corporales. Toma tu primera foto para dar seguimiento a tu cambio.
          </p>
        ) : isComparing ? (
          /* MODO COMPARADOR */
          <div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {/* Foto Antes */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-zinc-700 dark:text-zinc-300">Antes:</span>
                  <select
                    value={beforePhoto?.id}
                    onChange={(e) => setBeforePhoto(photos.find((p) => p.id === e.target.value))}
                    className="bg-zinc-100 dark:bg-zinc-800 rounded-lg text-[11px] p-1 border-0 text-zinc-800 dark:text-zinc-200"
                  >
                    {photos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.date} ({p.pose})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="h-48 bg-zinc-100 dark:bg-zinc-800 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-700 flex items-center justify-center">
                  {beforePhoto?.data_url ? (
                    <img
                      src={beforePhoto.data_url}
                      alt="Foto Antes"
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
                    className="bg-zinc-100 dark:bg-zinc-800 rounded-lg text-[11px] p-1 border-0 text-zinc-800 dark:text-zinc-200"
                  >
                    {photos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.date} ({p.pose})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="h-48 bg-zinc-100 dark:bg-zinc-800 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-700 flex items-center justify-center">
                  {afterPhoto?.data_url ? (
                    <img
                      src={afterPhoto.data_url}
                      alt="Foto Después"
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
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {aiAnalyzing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Analizando con visión IA...</span>
                  </>
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
        ) : (
          /* MODO GALERÍA EN CUADRÍCULA */
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.map((p) => (
              <div
                key={p.id}
                className="group relative bg-zinc-100 dark:bg-zinc-800 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-700/80 aspect-[3/4] flex flex-col justify-end"
              >
                <img
                  src={p.data_url}
                  alt={`Foto ${p.date}`}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />

                {/* Pose y Fecha */}
                <div className="relative z-10 p-2.5 flex items-center justify-between text-white">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-600/90 px-1.5 py-0.5 rounded-md">
                      {p.pose === 'front' ? 'Frente' : p.pose === 'side' ? 'Perfil' : 'Espalda'}
                    </span>
                    <span className="text-[11px] font-medium block mt-1 text-zinc-200">
                      {p.date}
                    </span>
                  </div>

                  {viewTarget === 'me' && (
                    <button
                      type="button"
                      onClick={() => handleDeletePhoto(p.id)}
                      className="p-1.5 bg-black/50 hover:bg-red-600 text-white rounded-lg transition"
                      title="Eliminar foto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
