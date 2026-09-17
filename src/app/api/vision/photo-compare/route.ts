import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/store/mockDb';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('duocal_session')?.value;
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json();
    const { beforeImageBase64, afterImageBase64, beforeDate, afterDate } = body;

    const geminiKey = process.env.GEMINI_API_KEY;

    if (geminiKey && !geminiKey.includes('placeholder') && beforeImageBase64 && afterImageBase64) {
      const cleanBefore = beforeImageBase64.replace(/^data:image\/\w+;base64,/, '');
      const cleanAfter = afterImageBase64.replace(/^data:image\/\w+;base64,/, '');

      const prompt = `Eres un coach de acondicionamiento físico empático, motivador y respetuoso de la privacidad.
Analiza cualitativamente estas dos fotos de progreso corporal tomadas en diferentes momentos (${beforeDate || 'Inicio'} vs ${afterDate || 'Actual'}).

Instrucciones de privacidad y diseño indispensables:
- Proporciona ÚNICAMENTE una descripción cualitativa y motivacional de cambios visuales generales (ej. mejor tono muscular aparente, porte o postura más erguida, cambios sutiles en la definición de hombros o abdomen).
- NO calcules ni estimes porcentajes de grasa corporal.
- NO realices marcas biométricas ni proporciones numéricas anatómicas.
- Mantén el lenguaje siempre positivo, constructivo y alentador.
- Estructura tu respuesta en 3 breves secciones: Observaciones de postura y porte, Cambios visibles en tono, y Mensaje de constancia.`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  { inline_data: { mime_type: 'image/jpeg', data: cleanBefore } },
                  { inline_data: { mime_type: 'image/jpeg', data: cleanAfter } },
                ],
              },
            ],
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const db = await getDb();
          db.photo_comparisons = db.photo_comparisons || [];
          db.photo_comparisons.push({
            id: 'cmp-' + crypto.randomUUID().slice(0, 8),
            user_id: userId,
            photo_before_id: 'photo-before',
            photo_after_id: 'photo-after',
            ai_description: text,
            created_at: new Date().toISOString(),
          });

          return NextResponse.json({
            success: true,
            description: text,
            source: 'gemini_vision',
          });
        }
      }
    }

    // Respuesta cualitativa predeterminada de muestra (si no hay API key o imágenes reales)
    const demoDescription = `### Observaciones de postura y porte
Se aprecia una postura más erguida y mayor firmeza general en la alineación de la espalda y los hombros en la toma más reciente.

### Cambios visibles en tono
Se percibe una ligera mejora en la definición muscular y consistencia del tono en la zona media y brazos. La silueta luce más compacta y atlética respecto a la primera fotografía.

### Mensaje de constancia
Excelente disciplina en las últimas semanas. Los cambios cualitativos son evidentes y demuestran que el balance nutricional semanal sostenido está dando resultados reales. ¡Sigue con esa determinación!`;

    return NextResponse.json({
      success: true,
      description: demoDescription,
      source: 'demo_fallback',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al analizar fotos';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
