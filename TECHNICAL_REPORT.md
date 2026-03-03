# V-QA — Video Quality Assurance Platform
## Reporte Técnico Ejecutivo

---

## 1. Resumen Ejecutivo

V-QA es una plataforma web de Quality Assurance para video que automatiza la revisión de subtítulos, transcripción de audio, ortografía y detección de nombres/marcas en contenido audiovisual. El sistema recibe un enlace de Frame.io, ejecuta un pipeline de análisis con inteligencia artificial, y presenta los resultados en un dashboard interactivo en tiempo real.

**Stack tecnológico:**
- **Frontend:** Next.js 15 / React 19 / Tailwind CSS v4
- **Backend:** Supabase (PostgreSQL + Auth + Realtime + Storage)
- **Procesamiento:** Google Cloud Functions (Python 3.11)
- **IA/ML:** Google Video Intelligence API (OCR), Google Gemini (transcripción de audio), API Ninjas (spellcheck)
- **Integración:** Frame.io V4 API via Adobe OAuth 2.0

---

## 2. Arquitectura General

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────────────────┐
│  Usuario     │────▶│  Next.js App     │────▶│  Google Cloud Function   │
│  (Browser)   │◀────│  (Vercel)        │◀────│  (Python 3.11)           │
└─────────────┘     └───────┬──────────┘     └────────┬─────────────────┘
                            │                         │
                    ┌───────▼──────────┐     ┌────────▼────────────────┐
                    │  Supabase        │     │  APIs Externas          │
                    │  • PostgreSQL    │     │  • Video Intelligence   │
                    │  • Auth (Google) │     │  • Gemini (Audio→Text)  │
                    │  • Realtime      │     │  • API Ninjas Spelling  │
                    │  • Storage       │     │  • Frame.io V4 API      │
                    └──────────────────┘     └─────────────────────────┘
```

**Flujo principal:**
1. El usuario pega una URL de Frame.io en el dashboard
2. Next.js resuelve metadata del video via Frame.io API
3. Se dispara la Cloud Function que ejecuta el pipeline completo
4. Los resultados se escriben directamente a Supabase
5. El frontend recibe actualizaciones en tiempo real via Supabase Realtime + polling

---

## 3. Pipeline de Análisis (Cloud Function)

La Cloud Function (`analyze_video`) ejecuta un pipeline de 7 pasos secuenciales. Duración típica: 2-5 minutos dependiendo de la duración del video.

### Paso 1 — Descarga del Video (10-15%)
- Descarga el video desde Frame.io a almacenamiento temporal
- Validación de que la respuesta no es HTML (URLs expiradas)

### Paso 2 — Detección de Texto OCR (20-40%)
- Envía el video completo a **Google Video Intelligence API** (feature: `TEXT_DETECTION`)
- Extrae cada texto detectado con: contenido, timestamps de inicio/fin, bounding box (posición en pantalla), confianza
- El payload crudo se almacena en Supabase Storage para auditoría posterior

### Paso 3 — Clasificación Inteligente de Texto (40-50%)
El sistema clasifica cada texto detectado usando un modelo de scoring por heurísticas:

| Heurística | Subtítulo | Texto Fijo (overlay/marca) |
|---|---|---|
| **Posición vertical** | Centro > 70% del frame: +3 | Centro < 15% del frame: +3 |
| **Duración** | 0.5–8.0 segundos: +2 | > 30% duración del video: +4 |
| **Cantidad de palabras** | ≥ 3 palabras: +1 | ≤ 2 palabras + mayúscula: +1 |
| **Repetición espacial** | — | Mismo texto, misma posición ≥ 3 veces: +8 |

Adicionalmente:
- **Merge de secuencias parciales:** Detecta texto animado (aparece letra por letra: "H" → "Ho" → "Horizonte") y conserva solo la versión completa
- **Etiquetas semánticas:** Identifica nombres propios (2-4 palabras en Title Case) y nombres de marca (>80% mayúsculas o texto fijo repetido)

### Paso 4 — Transcripción de Audio (50-65%)
- Extrae audio WAV con FFmpeg (16kHz, mono)
- Envía a **Google Gemini** para transcripción con timestamps y speaker detection
- Cadena de fallback: modelo configurado → gemini-2.5-flash → gemini-1.5-flash

### Paso 5 — Verificación Ortográfica (70-80%)
- Filtra subtítulos válidos (confianza ≥ 0.9, no secuencia parcial, no texto fijo)
- Envía cada subtítulo a **API Ninjas Spellcheck**
- Elimina falsos positivos: nombres de marca y correcciones solo de capitalización

### Paso 6 — Detección de Mismatches Audio↔Texto (85-95%)
- Compara cada subtítulo filtrado contra la transcripción de audio en la misma ventana temporal
- Tolerancia de overlap: ±1.5 segundos
- Normalización: minúsculas, sin puntuación, números word→digit
- Clasificación por ratio de similitud:
  - ≥ 0.8 → **SYNCED** (correcto)
  - 0.5–0.8 → **LIKELY_SYNCED** (posible error OCR)
  - < 0.5 → **MISALIGNED** (mismatch real → se reporta al usuario)
- Detección de offset temporal: escanea ±1.5s en pasos de 0.1s para identificar subtítulos desfasados

### Paso 7 — Persistencia de Resultados (95-100%)
- Escribe todos los resultados a las tablas de Supabase
- Actualiza el status del proyecto a "completed"

---

## 4. Base de Datos (Supabase PostgreSQL)

### Tablas principales

| Tabla | Descripción | Registros típicos por proyecto |
|---|---|---|
| `projects` | Metadata del proyecto, estado del pipeline, URLs | 1 |
| `text_detections` | Cada texto OCR detectado con posición, tiempos, clasificación | 50-500+ |
| `transcriptions` | Segmentos de audio transcritos con timestamps y speaker | 20-200+ |
| `spelling_errors` | Errores ortográficos detectados con sugerencia de corrección | 0-20 |
| `mismatches` | Discrepancias entre subtítulos y audio | 0-30 |
| `integration_tokens` | Token OAuth de Frame.io (global, un solo registro) | 1 |

### Seguridad
- **Row Level Security (RLS)** habilitado en todas las tablas
- Cada usuario solo puede ver/modificar sus propios proyectos
- Las tablas secundarias validan acceso via subquery al `user_id` del proyecto
- Autenticación via Google OAuth (Supabase Auth)

---

## 5. Frontend — Dashboard Interactivo

### Páginas

| Ruta | Función |
|---|---|
| `/login` | Login con Google OAuth |
| `/projects` | Lista de proyectos con búsqueda, filtros, crear/eliminar |
| `/projects/[id]` | Dashboard principal de QA con video + paneles |
| `/projects/[id]/ocr-testing` | Herramienta de auditoría OCR para debugging |

### Dashboard Principal (3 columnas + fila inferior)

```
┌──────────────┬────────────────────────┬──────────────┐
│  Subtítulos  │     Video Player       │Transcripción │
│  (sync con   │  (video.js + markers   │  (sync con   │
│   playback)  │   rojos y amarillos)   │   playback)  │
├──────────────┴────────────────────────┴──────────────┤
│  Errores Ortográficos     │    Nombres y Marcas      │
└───────────────────────────┴──────────────────────────┘
```

- **Panel de Subtítulos:** Lista scrolleable sincronizada con el video. El subtítulo activo se resalta automáticamente (estilo Spotify)
- **Video Player:** Reproductor video.js con marcadores en la timeline — rojos para mismatches, amarillos para errores ortográficos
- **Panel de Transcripción:** Audio transcrito con mismatches resaltados en rojo
- **Panel de Spelling:** Errores con texto original tachado, corrección sugerida en verde, y timecode
- **Panel de Marcas:** Textos fijos agrupados por frecuencia de aparición

### Progreso en Tiempo Real
Durante el análisis, un overlay muestra el progreso paso a paso con:
- Barra de progreso animada
- Estado actual del pipeline
- Log de debug colapsable (mensajes del Cloud Function en tiempo real via Supabase Realtime)

---

## 6. Integraciones Externas

### Frame.io (Adobe)
- **OAuth 2.0** via Adobe IMS con refresh automático de tokens
- Resolución de múltiples formatos de URL: `/player/`, `/f/`, `/reviews/`, query params
- Fallback a version stacks para assets versionados
- Extracción de video URL con scoring heurístico (8 criterios)

### Google Cloud Platform
- **Video Intelligence API:** OCR sobre video completo (timeout 600s)
- **Gemini:** Transcripción de audio con timestamps
- **Cloud Functions:** Procesamiento serverless con autenticación IAM via Identity Tokens

### API Ninjas
- **Spellcheck API:** Verificación ortográfica en inglés con sugerencias de corrección

---

## 7. Características Técnicas Destacables

1. **Clasificación inteligente de texto:** Sistema de scoring multi-heurístico que distingue automáticamente entre subtítulos, textos overlay (watermarks, logos, labels) y nombres de marca — sin necesidad de entrenamiento ML

2. **Detección de texto animado:** Algoritmo que agrupa secuencias parciales ("H"→"Ho"→"Horizonte") y conserva solo la versión final, eliminando duplicados de animaciones de texto

3. **Normalización robusta para comparación:** Pipeline de normalización que unifica capitalización, puntuación, y representación numérica (word↔digit) antes de comparar subtítulos con transcripción

4. **Detección de offset temporal:** Escaneo automático de desfase temporal entre subtítulo y audio, identificando si el subtítulo está correcto pero desplazado en el tiempo

5. **Resiliencia del pipeline:** Timeouts generosos, fallback de modelos Gemini, re-resolución de URLs expiradas de Frame.io, y manejo de errores con status persistido en DB

6. **Herramienta de auditoría OCR:** Página de testing que permite re-ejecutar la clasificación sobre el payload OCR almacenado sin re-procesar el video, útil para ajustar heurísticas

---

## 8. Variables de Entorno Requeridas

| Variable | Servicio |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase (cliente) |
| `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` | Supabase (admin) |
| `FRAMEIO_CLIENT_ID`, `FRAMEIO_CLIENT_SECRET` | Frame.io OAuth |
| `FRAME_IO_INTERNAL_SHARED_SECRET` | Seguridad interna |
| `GCP_SERVICE_ACCOUNT_KEY` | Google Cloud IAM |
| `CLOUD_FUNCTION_URL` | URL del Cloud Function |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Google Gemini |
| `SPELLCHECK_API_KEY` | API Ninjas |

---

## 9. Deployment

| Componente | Plataforma | Notas |
|---|---|---|
| Frontend (Next.js) | Vercel | Deploy automático desde Git |
| Cloud Function | Google Cloud Functions gen2 | Python 3.11, 1GB RAM, 540s timeout |
| Base de datos | Supabase | PostgreSQL + Auth + Realtime + Storage |
| FFmpeg | Descarga en cold start | Binary estático linux-amd64 |
