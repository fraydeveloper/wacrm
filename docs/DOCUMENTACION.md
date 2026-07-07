# 📋 wacrm — Documentación General de la Plataforma

> **wacrm** es un CRM template self-hostable para WhatsApp® — bandeja de entrada compartida, contactos, pipelines de ventas, broadcasts, automatizaciones sin código y agente de IA con tu propia clave. Forkea, personaliza y despliega.

---

## 📑 Tabla de contenidos

1. [Visión general](#1-visión-general)
2. [Stack tecnológico](#2-stack-tecnológico)
3. [Roles y permisos](#3-roles-y-permisos)
4. [Módulos del dashboard](#4-módulos-del-dashboard)
5. [Configuración Settings](#5-configuración-settings)
6. [Módulo de IA — Detalle completo](#6-módulo-de-ia--detalle-completo)
7. [API Pública REST v1](#7-api-pública-rest-v1)
8. [Seguridad](#8-seguridad)
9. [Despliegue](#9-despliegue)
10. [Variables de entorno](#10-variables-de-entorno)
11. [Preguntas frecuentes FAQ](#11-preguntas-frecuentes-faq)

---

## 1. Visión general

wacrm es una plantilla de CRM completa construida sobre la **API oficial de WhatsApp Business de Meta**. No es un SaaS de terceros — es tu código, tu base de datos, tu dominio y tus datos.

### Qué incluye de serie

| Módulo | Descripción |
|---|---|
| Bandeja de entrada | Múltiples agentes en un solo número, asignación, estados, notas |
| Contactos | Tags, campos personalizados, importación CSV, deduplicación |
| Pipelines | Tablero Kanban, negocios vinculados a conversaciones |
| Broadcasts | Plantillas aprobadas por Meta, tracking de entrega/lectura |
| Automatizaciones | Triggers, condiciones, acciones sin código |
| Flows | Conversaciones ramificadas con botones interactivos |
| Agente de IA | 5 proveedores soportados, base de conocimiento, auto-reply |
| API REST pública | Llaves revocables, endpoints para contactos, conversaciones, mensajes |
| Equipos | Roles, invitaciones por enlace, transferencia de ownership |

---

## 2. Stack tecnológico

| Capa | Tecnología |
|---|---|
| **Framework** | Next.js 16 (App Router), React 19, TypeScript |
| **Estilos** | Tailwind CSS v4 |
| **Base de datos** | Supabase (PostgreSQL + Auth + Storage + RLS) |
| **WhatsApp** | Meta Cloud API (API oficial de WhatsApp Business) |
| **Seguridad de claves** | AES-256-GCM (claves cifradas en reposo) |
| **Rate limiting** | In-memory sliding window |
| **PDF parsing** | pdf-parse v2 (ejecución en Node.js serverless) |

---

## 3. Roles y permisos

wacrm usa un sistema de roles basado en 4 niveles. Cada usuario tiene **un rol por cuenta**.

| Rol | Descripción |
|---|---|
| **Owner** | Propietario — todo + transferir ownership + eliminar cuenta |
| **Admin** | Administrador — todo excepto eliminar la cuenta |
| **Agent** | Agente — responder mensajes, gestionar contactos y deals |
| **Viewer** | Solo lectura — ver conversaciones e información |

### Matriz de permisos clave

| Acción | Owner | Admin | Agent | Viewer |
|---|:---:|:---:|:---:|:---:|
| Responder mensajes | SI | SI | SI | NO |
| Gestionar contactos | SI | SI | SI | NO |
| Crear/editar pipelines | SI | SI | SI | NO |
| Enviar broadcasts | SI | SI | SI | NO |
| Crear automatizaciones | SI | SI | SI | NO |
| Cambiar configuración WhatsApp | SI | SI | NO | NO |
| Configurar IA | SI | SI | NO | NO |
| Gestionar miembros | SI | SI | NO | NO |
| Crear llaves API | SI | SI | NO | NO |
| Transferir ownership | SI | NO | NO | NO |

---

## 4. Módulos del dashboard

### 4.1 Dashboard / Inicio

Panel de control en tiempo real:

- **Tiempo de respuesta promedio** — cuánto tarda el equipo en responder mensajes
- **Volumen diario** — mensajes enviados y recibidos por día
- **Conversaciones abiertas / resueltas**
- **Valor del pipeline** — suma de negocios activos
- **Feed de actividad reciente** — registros cruzados de todos los módulos

### 4.2 Bandeja de entrada (Inbox)

Centro de operaciones para gestionar conversaciones de WhatsApp en equipo.

**Características:**
- Conversaciones en tiempo real via Supabase Realtime
- Asignación de conversaciones a agentes del equipo
- Estados: abierta, resuelta, pendiente
- Notas internas — visibles solo para el equipo
- Historial completo de mensajes por contacto
- Envío de medios — imágenes, audio, documentos, videos
- Plantillas — mensajes aprobados por Meta para iniciar conversaciones
- Reacciones — emoji reactions a mensajes
- **Drafts con IA** — botón para redactar respuestas asistidas (requiere IA activa)

### 4.3 Contactos

Directorio centralizado de contactos de WhatsApp.

**Características:**
- Búsqueda y filtros por nombre, teléfono, tags, campos personalizados
- Tags — etiquetas personalizables para segmentar
- Campos personalizados — definidos por el equipo (texto, número, fecha, etc.)
- Importación CSV con mapeo de columnas
- Deduplicación de números
- Vista de perfil — historial, negocios vinculados, notas

### 4.4 Pipelines de ventas (Kanban)

Tablero visual de oportunidades de venta.

**Características:**
- Columnas personalizables (ej: Lead → Calificado → Propuesta → Cerrado)
- Negocios (Deals) con valor monetario
- Vinculación con contactos y conversaciones
- Moneda configurable (definida en Ajustes)
- Drag & drop entre columnas

### 4.5 Broadcasts

Envío masivo de mensajes usando plantillas aprobadas por Meta.

**Características:**
- Selección de plantilla aprobada por Meta
- Filtrado de audiencia por tags y campos personalizados
- Variables por destinatario — `{{nombre}}`, `{{empresa}}`, etc.
- Programación — envío inmediato o programado
- Tracking de entrega — enviado, entregado, leído, fallido
- Rate limiting respetando límites de Meta

> **Importante:** Los broadcasts solo funcionan con plantillas aprobadas por Meta.

### 4.6 Automatizaciones

Motor de automatización sin código basado en reglas.

**Triggers disponibles:**

| Trigger | Descripción |
|---|---|
| Mensaje inbound | Se activa cuando llega un mensaje nuevo |
| Nuevo contacto | Se activa al crear un contacto |
| Keyword | El mensaje contiene una palabra clave específica |
| Horario | Se activa en un horario (cron) |
| Webhook externo | Activado desde sistema externo via HTTP |

**Acciones disponibles:**

| Acción | Descripción |
|---|---|
| Enviar mensaje | Respuesta automática al contacto |
| Agregar tag | Etiquetar al contacto automáticamente |
| Asignar agente | Asignar conversación a un agente |
| Cambiar estado | Cambiar estado de la conversación |
| Esperar | Pausar la automatización un tiempo |
| Condición | Ramificación si/entonces basada en campos |
| Webhook | Llamar a un endpoint externo |

**Plantillas de inicio rápido:**
- Mensaje de bienvenida — saludo automático al primer mensaje
- Fuera de oficina — respuesta automática en horario no laboral
- Calificador de leads — preguntas automáticas para calificar
- Recordatorio de seguimiento — seguimiento post-venta

**Gestión:**
- Activar/desactivar sin borrar
- Duplicar automatizaciones existentes
- Ver logs de ejecución

### 4.7 Flows (conversaciones interactivas)

Constructor de conversaciones ramificadas con botones interactivos de WhatsApp.

> **Beta** — Funcionalidad en soft-GA. Completamente funcional.

**Casos de uso:**
- Menú principal de bienvenida
- FAQ interactivo con opciones de botón
- Triage antes de pasar con un agente humano
- Formularios de captura de datos

**Triggers disponibles:**

| Trigger | Descripción |
|---|---|
| Keyword | Inicia cuando el mensaje contiene palabras clave |
| Primer mensaje inbound | Se activa en el primer mensaje de un contacto |
| Manual | El agente lo inicia desde la bandeja |

**Estados de un flow:**

| Estado | Descripción |
|---|---|
| `draft` | En edición, no se ejecuta con clientes |
| `active` | En producción, activo con clientes |
| `archived` | Desactivado y archivado |

**Plantillas disponibles:**
- Menú de bienvenida
- FAQ con botones
- Captura de datos de contacto

### 4.8 Agentes de IA

Asistente de IA con tu propia clave. Sin cobros por asiento, sin lock-in.

Ver **Sección 6** para documentación completa.

**Resumen:**
- 5 proveedores soportados (OpenAI, Anthropic, DeepSeek, Gemini, Z.ai)
- Redacción asistida en la bandeja de entrada
- Auto-reply bot con handoff automático a humano
- Base de conocimiento con búsqueda semántica o por palabras clave
- Zona de pruebas (Playground) para probar antes de activar

### 4.9 Notificaciones

Centro de notificaciones:
- Nuevas asignaciones de conversaciones
- Menciones en notas internas
- Alertas del sistema

---

## 5. Configuración Settings

Acceso: **Configuración** en el menú lateral.

### 5.1 Perfil

- Nombre y apellido
- Email para login
- Avatar / foto de perfil
- Zona horaria

### 5.2 Seguridad

- Cambio de contraseña
- Historial de sesiones activas
- Cerrar todas las sesiones (global sign-out)

### 5.3 Apariencia

- Tema claro / oscuro / sistema — sincronizado con el SO

### 5.4 WhatsApp

Configuración de la API de WhatsApp Business de Meta.

**Campos requeridos:**

| Campo | Descripción |
|---|---|
| Phone Number ID | ID del número en Meta Business |
| WABA ID | WhatsApp Business Account ID |
| Access Token | Token de acceso permanente (System User) |
| Webhook Verify Token | Token para verificar el webhook (lo defines tú) |

**Proceso:**
1. Crear app en Meta for Developers
2. Configurar webhook: `https://tudominio.com/api/whatsapp/webhook`
3. Pegar credenciales en el panel
4. wacrm verifica la conexión antes de guardar

### 5.5 Messenger

Configuración para Facebook Messenger (canal adicional).

### 5.6 Plantillas de mensajes

- Crear plantillas con variables `{{1}}`, `{{2}}`, etc.
- Estado de aprobación: pendiente, aprobada, rechazada (Meta tarda 24-48h)
- Sincronizar plantillas ya aprobadas en Meta
- Categorías: marketing, utilidad, autenticación

### 5.7 Campos y etiquetas

**Tags:**
- Crear etiquetas con colores personalizados
- Usadas para segmentar en broadcasts y automatizaciones

**Campos personalizados:**
- Tipos: texto, número, fecha, booleano, lista
- Se añaden al perfil de cada contacto

### 5.8 Negocios y moneda

- Moneda por defecto para el dashboard y Kanban
- Configuración de etapas del pipeline de ventas

### 5.9 Miembros del equipo

- Invitar por enlace con rol predefinido
- Cambiar rol de miembros (Owner/Admin)
- Remover miembro — quitar acceso
- Transferir ownership (solo Owner)

### 5.10 Llaves de API

- Crear llaves con nombre y permisos (lectura, escritura, o ambos)
- Revocar al instante si se comprometen
- Ver timestamp del último uso

---

## 6. Módulo de IA — Detalle completo

El agente de IA funciona con BYOK (Bring Your Own Key): tú pagas directamente al proveedor, sin markup ni límites por asiento.

### 6.1 Proveedores soportados

wacrm soporta **5 proveedores** de IA:

| Proveedor | ID interno | Endpoint | Tipo de API |
|---|---|---|---|
| OpenAI | `openai` | `api.openai.com/v1/chat/completions` | OpenAI Chat Completions |
| Anthropic (Claude) | `anthropic` | `api.anthropic.com/v1/messages` | Messages API propia |
| DeepSeek | `deepseek` | `api.deepseek.com/chat/completions` | OpenAI-compatible |
| Google Gemini | `gemini` | `generativelanguage.googleapis.com/v1beta` | generateContent API |
| Z.ai (GLM) | `zai` | `api.z.ai/api/paas/v4/chat/completions` | OpenAI-compatible |

**Notas de implementación:**
- **OpenAI** — usa `max_completion_tokens` (campo nuevo), `Bearer` auth
- **DeepSeek y Z.ai** — adaptador OpenAI-compatible con `max_tokens` (campo legacy)
- **Gemini** — adaptador propio: roles `user`/`model`, campo `systemInstruction`, clave en query string
- **Anthropic** — headers `x-api-key` y `anthropic-version: 2023-06-01`

### 6.2 Modelos recomendados

Estos son los modelos **correctos y verificados** por proveedor:

| Proveedor | Modelo recomendado | Descripción |
|---|---|---|
| **OpenAI** | `gpt-4o-mini` | Rápido, económico, excelente para chat de soporte |
| **Anthropic** | `claude-haiku-4-5` | Más rápido y económico de Claude |
| **DeepSeek** | `deepseek-chat` | Modelo conversacional principal |
| **Google Gemini** | `gemini-1.5-flash` | Flash = versión rápida y económica |
| **Z.ai** | `glm-4-flash` | Versión flash del GLM-4 |

**Modelos alternativos:**

| Proveedor | Modelo | Características |
|---|---|---|
| OpenAI | `gpt-4o` | Más potente, mayor costo |
| OpenAI | `gpt-4-turbo` | Alto contexto |
| Anthropic | `claude-sonnet-4-5` | Balance potencia/velocidad |
| Anthropic | `claude-opus-4-5` | El más potente de Claude |
| Google Gemini | `gemini-1.5-pro` | Mayor razonamiento |
| Google Gemini | `gemini-2.0-flash` | Último modelo flash |
| DeepSeek | `deepseek-reasoner` | Con razonamiento en cadena |

> **IMPORTANTE:** Los nombres de modelos deben escribirse EXACTAMENTE como los define el proveedor. Un nombre incorrecto retorna error 404. Por ejemplo: `gpt-5.4-mini` NO existe — el correcto es `gpt-4o-mini`.

### 6.3 Base de conocimiento

Permite al agente responder usando tu propio contenido (FAQs, políticas, catálogos).

**Formatos de archivo soportados:**

| Extensión | Tipo | Procesamiento |
|---|---|---|
| `.md` | Markdown | Leído como texto plano |
| `.markdown` | Markdown | Ídem |
| `.txt` | Texto plano | Leído directamente |
| `.pdf` | PDF | Extracción via pdf-parse v2 |

**Límite de tamaño:** 15 MB por archivo.

**Fuentes de contenido:**

| Fuente | Descripción |
|---|---|
| Texto manual | Pegar directamente en el editor |
| Subida de archivo | PDF, MD, TXT hasta 15 MB |
| Google Sheets | Sincronizar desde hoja de cálculo (requiere Service Account) |

**Cómo funciona la recuperación:**

1. Llega una pregunta del cliente
2. Si hay clave de embeddings → búsqueda **semántica** (pgvector)
3. Si no hay clave → búsqueda **full-text** (PostgreSQL tsvector)
4. Los fragmentos relevantes se inyectan en el prompt
5. El modelo responde basándose en esos fragmentos

**Fragmentación (chunking):**
- Los documentos se dividen automáticamente en trozos óptimos
- Cada fragmento se vectoriza con `text-embedding-3-small` (1536 dims)
- Vectores almacenados en PostgreSQL con pgvector

**Gestión:**
- Crear / editar / eliminar documentos
- Ver fecha de última actualización
- **Reindexar** — regenerar todos los vectores
- Indicador de fuente: manual, archivo, Google Sheet

### 6.4 Indicador de estado de la IA

El estado se muestra en **dos lugares**:

**1. Cabecera de la página Agentes IA (siempre visible):**
- Verde pulsante + "IA encendida" → asistente activo y respondiendo
- Gris + "IA apagada" → configurado pero desactivado
- Sin badge → no configurado aún

**2. Panel de Configuración del agente:**
- Badge junto al título del panel (IA activa / IA inactiva)
- Se actualiza automáticamente al guardar sin recargar la página

### 6.5 Auto-reply bot

El bot responde mensajes inbound sin intervención humana.

**Condiciones para que se active:**
- IA activa (`is_active = true`)
- Auto-reply habilitado (`auto_reply_enabled = true`)
- Ningún flow maneja la conversación
- Sin agente asignado a la conversación

**Parámetros configurables:**

| Parámetro | Descripción | Default |
|---|---|---|
| `auto_reply_enabled` | Activar/desactivar el bot | false |
| `auto_reply_max_per_conversation` | Max respuestas bot por hilo | 3 (máx: 20) |

**Handoff automático:**
El bot emite `[[HANDOFF]]` cuando no puede ayudar con seguridad. El sentinel se filtra antes de enviar — el cliente nunca lo ve. El sistema marca la conversación para revisión humana.

**Condiciones de handoff:**
- El cliente pide explícitamente un humano
- El cliente está molesto o quejándose
- La solicitud requiere info que el bot no tiene
- La KB no cubre la pregunta

### 6.6 Embeddings y búsqueda semántica

La búsqueda semántica requiere una clave de embeddings (puede ser distinta a la clave principal).

**Por qué una clave separada:**
- Los embeddings solo están disponibles via OpenAI (`text-embedding-3-small`)
- Si usas Anthropic/DeepSeek como principal, puedes agregar una clave OpenAI solo para embeddings
- Si usas OpenAI como principal, puedes usar la misma clave para ambos

**Modelo:** `text-embedding-3-small`
- Dimensiones: 1536
- Almacenamiento: columna `vector(1536)` en PostgreSQL con extensión pgvector

**Sin clave de embeddings:** búsqueda full-text (PostgreSQL tsvector) — menos precisa pero funcional.

**Con clave de embeddings:** búsqueda vectorial por similitud coseno — más precisa para preguntas en lenguaje natural.

---

## 7. API Pública REST v1

Endpoint base: `/api/v1`

Autenticación: `Authorization: Bearer <api_key>`

### Endpoints disponibles

#### Contactos
```
GET    /api/v1/contacts           Listar contactos
POST   /api/v1/contacts           Crear contacto
GET    /api/v1/contacts/:id       Ver contacto
PATCH  /api/v1/contacts/:id       Actualizar contacto
DELETE /api/v1/contacts/:id       Eliminar contacto
```

#### Conversaciones
```
GET    /api/v1/conversations      Listar conversaciones
GET    /api/v1/conversations/:id  Ver conversación
```

#### Mensajes
```
GET    /api/v1/messages           Listar mensajes de una conversación
POST   /api/v1/messages           Enviar mensaje
```

#### Broadcasts
```
GET    /api/v1/broadcasts         Listar broadcasts
POST   /api/v1/broadcasts         Crear y enviar broadcast
```

#### Webhooks
```
GET    /api/v1/webhooks           Listar webhooks registrados
POST   /api/v1/webhooks           Registrar webhook
DELETE /api/v1/webhooks/:id       Eliminar webhook
```

#### Perfil
```
GET    /api/v1/me                 Información del usuario autenticado
```

### Gestión de llaves API

Desde Configuración → Llaves de API:
- Crear llaves con nombre y permisos
- Asignar permisos: solo lectura, solo escritura, o ambos
- Revocar al instante

> Documentación completa: `docs/public-api.md`

---

## 8. Seguridad

| Medida | Implementación |
|---|---|
| Cifrado de claves | AES-256-GCM para claves de API (WhatsApp, IA) en BD |
| RLS | Row Level Security en cada tabla — datos de una cuenta no se filtran a otra |
| HMAC webhooks | Verificación HMAC-SHA256 en webhooks de Meta |
| Rate limiting | Ventana deslizante en memoria por usuario/acción |
| CSP | Content Security Policy en modo Report-Only |
| HSTS | Strict-Transport-Security con preload |
| X-Frame-Options | DENY — protección contra clickjacking |
| RBAC | Control de acceso por roles en cada endpoint |
| Tokens de invitación | Criptográficos, expiran en uso único |

---

## 9. Despliegue

### Opción recomendada: Hostinger

1. Fork del repositorio en GitHub
2. hPanel → Websites → Create → Node.js
3. Conectar fork de GitHub
4. Configurar variables de entorno en hPanel
5. Push a `main` — Hostinger construye y despliega

### Otras opciones

- **Vercel** — soporte nativo de Next.js
- **Railway** — deploy desde GitHub
- **VPS propio** — Node.js + PM2 + nginx

### Pre-requisitos

1. Proyecto Supabase (PostgreSQL + Auth)
2. Cuenta Meta for Developers (API WhatsApp Business)
3. HTTPS obligatorio — Meta requiere HTTPS para el webhook

---

## 10. Variables de entorno

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Cifrado AES-256-GCM (generar: openssl rand -hex 32)
ENCRYPTION_KEY=tu_clave_hex_de_64_caracteres

# WhatsApp
WHATSAPP_VERIFY_TOKEN=tu_token_personalizado

# IA (opcional - overrides)
AI_REQUEST_TIMEOUT_MS=30000
AI_CONTEXT_MESSAGE_LIMIT=20

# App
NEXT_PUBLIC_APP_URL=https://tudominio.com
```

> **NUNCA** compartas `ENCRYPTION_KEY` ni `SUPABASE_SERVICE_ROLE_KEY`.

---

## 11. Preguntas frecuentes FAQ

### Por qué sale error al hacer "Test key" de la IA?

**Causa más común:** El nombre del modelo es incorrecto.

- INCORRECTO: `gpt-5.4-mini` (no existe)
- CORRECTO: `gpt-4o-mini`

Consulta la tabla de modelos en la Sección 6.2.

---

### Por qué falla la subida de archivos PDF/MD?

Este error fue corregido en la última actualización. Si persiste:
1. Archivo mayor a 15 MB → reducir tamaño
2. Extensión no soportada → usar .pdf, .md, .txt
3. PDF sin texto seleccionable → el PDF es solo imagen, no se puede extraer texto

---

### Puedo usar la misma clave OpenAI para chat y embeddings?

Sí. Si usas OpenAI como proveedor principal, puedes usar la misma clave en ambos campos (API key y Embeddings key).

---

### Como activar el auto-reply bot?

1. Ir a Agentes IA → Configuración
2. Configurar proveedor, modelo y clave
3. Activar "Enable AI assistant"
4. Activar "Auto-reply to inbound messages"
5. Definir límite de respuestas por conversación (recomendado: 3-5)
6. Guardar

---

### Como sé si la IA está activa?

En la página Agentes IA verás en la esquina superior derecha:
- Verde pulsante + "IA encendida" → activa
- Gris + "IA apagada" → desactivada
- Sin badge → no configurada

---

### Qué pasa si la clave de OpenAI se queda sin crédito?

- Las respuestas de IA fallarán (error rate_limited)
- Los mensajes manuales del equipo siguen funcionando
- La base de conocimiento sigue guardada
- Solución: recargar crédito en platform.openai.com

---

### Los datos van a los servidores de OpenAI/Anthropic?

Solo el contenido del mensaje y contexto se envían al proveedor para generar respuesta. Las claves se almacenan cifradas (AES-256-GCM) en tu Supabase. wacrm nunca guarda claves en texto plano.

---

### Flows vs Automatizaciones — cuál usar?

| | Flows | Automatizaciones |
|---|---|---|
| **Interactividad** | Botones de WhatsApp, menús | Sin botones, basado en eventos |
| **Control de flujo** | El cliente elige con botones | El sistema decide por condiciones |
| **Caso de uso** | Menú principal, FAQ interactivo | Bienvenida, out-of-office |
| **Cuando usarlo** | Conversaciones guiadas | Tareas automáticas en background |

---

*Documentacion generada el 07/07/2026 — wacrm v0.7.0*

