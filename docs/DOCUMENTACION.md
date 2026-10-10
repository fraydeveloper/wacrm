# 📋 wacrm — Documentación General de la Plataforma

> **wacrm** es un CRM template self-hostable para WhatsApp® — bandeja de entrada compartida, contactos, pipelines de ventas, broadcasts, automatizaciones sin código y agente de IA con tu propia clave. Forkea, personaliza y despliega.

---

## 📑 Tabla de contenidos

1. [Visión general](#1-visión-general)
2. [Stack tecnológico](#2-stack-tecnológico) — detalle en [herramientas-y-arquitectura.md](herramientas-y-arquitectura.md)
3. [Roles y permisos](#3-roles-y-permisos)
4. [Módulos del dashboard](#4-módulos-del-dashboard)
5. [Configuración Settings](#5-configuración-settings)
6. [Módulo de IA — Detalle completo](#6-módulo-de-ia--detalle-completo)
7. [API Pública REST v1](#7-api-pública-rest-v1) — detalle en [public-api.md](public-api.md)
8. [Seguridad](#8-seguridad) — detalle en [herramientas-y-arquitectura.md](herramientas-y-arquitectura.md#54-seguridad)
9. [Despliegue y variables de entorno](#9-despliegue-y-variables-de-entorno) — guía paso a paso en [guia-local-y-produccion.md](guia-local-y-produccion.md)
10. [Preguntas frecuentes FAQ](#10-preguntas-frecuentes-faq)

---

## 1. Visión general

wacrm es una plantilla de CRM completa construida sobre la **API oficial de WhatsApp Business de Meta**. No es un SaaS de terceros — es tu código, tu base de datos, tu dominio y tus datos.

### Qué incluye de serie

| Módulo | Descripción |
|---|---|
| Canales | WhatsApp (completo), Messenger y Telegram (solo texto); Instagram aún no |
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

Next.js 16 + React 19 + TypeScript, Tailwind CSS v4 y Supabase (PostgreSQL,
Auth, Storage, Realtime, RLS, pgvector), con la API oficial de WhatsApp Business
(Meta Cloud API). Versiones exactas, librerías, arquitectura y tamaño del código:
[herramientas-y-arquitectura.md](herramientas-y-arquitectura.md).

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
| Crear/mover negocios (deals) | SI | SI | SI | NO |
| Crear/editar embudos y etapas | SI | SI | NO | NO |
| Crear etiquetas, campos personalizados y plantillas de Meta | SI | SI | NO | NO |
| Enviar broadcasts | SI | SI | SI | NO |
| Crear automatizaciones y flujos | SI | SI | SI | NO |
| Cambiar configuración WhatsApp, Messenger, Telegram y marca | SI | SI | NO | NO |
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
- Conversaciones de WhatsApp, Messenger y Telegram con etiqueta de canal (WA / FB / TG)
- Asignación de conversaciones a agentes del equipo
- Estados: abierta, pendiente, cerrada
- Notas internas — visibles solo para el equipo
- Historial completo de mensajes por contacto
- Envío de medios — imágenes, audio, documentos, videos
- Plantillas — mensajes aprobados por Meta para iniciar conversaciones
- Reacciones — emoji reactions a mensajes
- **Drafts con IA** — botón para redactar respuestas asistidas (requiere IA activa)

> **Por canal:** en WhatsApp se puede enviar texto, adjuntos, notas de voz y
> plantillas. En **Messenger y Telegram** el agente responde a mano **solo con
> texto** (los botones de adjuntar y plantillas se ocultan). Messenger respeta
> la ventana de 24 h de Meta; Telegram no tiene ventana. Las acciones de envío
> de las automatizaciones siguen siendo solo de WhatsApp.

### 4.3 Contactos

Directorio centralizado de contactos de WhatsApp.

**Características:**
- Búsqueda y filtros por nombre, teléfono, tags, campos personalizados
- Tags — etiquetas personalizables para segmentar
- Campos personalizados — definidos por el equipo (texto, número, fecha, etc.)
- Importación CSV con **plantilla descargable** ("Descargar plantilla CSV")
  - Columna obligatoria `phone` (también acepta `telefono`, `celular`, `whatsapp`)
  - Opcionales: `name`/`nombre` (+ `apellidos`), `email`/`correo`, `company`/`empresa`, `tags`/`etiquetas`
  - Acepta archivos de Excel en español separados por `;` y con acentos (CSV UTF-8)
  - Selector "País para números sin código" (Perú +51 por defecto): `987654321` → `+51987654321`
  - Muestra las filas con teléfono no válido y su número de línea (p. ej. números convertidos por Excel a `5.19E+10`)
- Deduplicación de números (también contra contactos existentes, sin límite de 1,000)
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
- Audiencia: todos los contactos, por etiquetas, por campo personalizado o **subiendo un CSV** (con plantilla descargable)
- Exclusión de contactos por etiqueta
- Soporta miles de destinatarios (paginado) y reintenta automáticamente si se alcanza el límite de solicitudes
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
| Mensaje nuevo | Se activa cuando llega un mensaje |
| Primer mensaje del contacto | Solo en el primer mensaje de un contacto |
| Coincidencia de palabra clave | El mensaje contiene (o es exactamente) una palabra clave |
| Contacto nuevo | Se activa al crear un contacto |
| Conversación asignada | Se activa al asignar una conversación |
| Etiqueta agregada | Se activa al etiquetar un contacto |
| Basado en tiempo | Se activa por horario (requiere el cron) |

**Acciones disponibles:**

| Acción | Descripción |
|---|---|
| Enviar mensaje | Respuesta automática al contacto |
| Enviar plantilla | Envía una plantilla aprobada por Meta |
| Agregar / quitar etiqueta | Etiquetar al contacto automáticamente |
| Asignar conversación | Asignar conversación a un agente |
| Actualizar campo del contacto | Cambia un campo personalizado |
| Crear negocio | Crea un deal en un embudo y etapa |
| Esperar | Pausar la automatización un tiempo (requiere el cron) |
| Condición | Ramificación si/entonces basada en campos |
| Enviar webhook | Llamar a un endpoint externo |
| Cerrar conversación | Marca la conversación como cerrada |

**Plantillas de inicio rápido:**
- Mensaje de bienvenida — saludo automático al primer mensaje
- Fuera de horario — respuesta automática en horario no laboral
- Calificador de prospectos — preguntas automáticas para calificar
- Recordatorio de seguimiento — seguimiento post-venta

**Gestión:**
- Activar/desactivar sin borrar
- Duplicar automatizaciones existentes
- Ver logs de ejecución

### 4.7 Flows (conversaciones interactivas)

Constructor de conversaciones ramificadas con botones interactivos de WhatsApp.

> Funcionalidad en producción (sin etiqueta Beta). Los flujos se ejecutan solo
> en **WhatsApp**; los mensajes de Messenger y Telegram los atiende la IA o las
> automatizaciones. Un flujo abandonado se cierra solo cuando el contacto vuelve
> a escribir pasado el tiempo límite (24 h por defecto), aunque no haya cron.

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
- Bot de preguntas frecuentes
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

Centro de notificaciones (tipos definidos en el código):
- Conversación asignada a ti
- Derivación de la IA a un humano (llega a todos los admin/owner de la cuenta)

---

## 5. Configuración Settings

Acceso: **Configuración** en el menú lateral.

### 5.1 Perfil

- Nombre y apellido
- Email para login
- Avatar / foto de perfil

### 5.2 Seguridad

- Cambio de contraseña
- Cerrar sesión en todos los dispositivos (global sign-out; no hay listado de sesiones)

### 5.3 Apariencia

- Modo claro / oscuro
- 11 colores de acento: Color de la empresa, Verde TED, Dorado, Violeta, Esmeralda, Cobalto, Celeste, Índigo, Ámbar, Rosa y Grafito
- Se guarda por dispositivo. Si el dispositivo no eligió un color y la empresa definió su color de marca, se usa el color de la empresa.

### 5.3.1 Empresa y marca (administradores)

- **Nombre del negocio** — se muestra en la barra lateral (por defecto "Agente TED")
- **Logo** — PNG, JPG o WEBP hasta 2 MB
- **Color principal y secundario** — formato `#RRGGBB`, con sugerencias (Verde TED `#00745f`, Dorado TED `#f2b417`, etc.) y vista previa
- Requiere la migración `037_account_branding.sql`

### 5.4 WhatsApp

Configuración de la API de WhatsApp Business de Meta.

**Campos requeridos:**

| Campo | Descripción |
|---|---|
| Phone Number ID | ID del número en Meta Business |
| WABA ID | WhatsApp Business Account ID |
| Access Token | Token de acceso permanente (System User) |
| Webhook Verify Token | Token para verificar el webhook (lo defines tú) |
| App Secret de tu propia app de Meta (opcional) | Solo si la empresa usa su propia app de Meta; vacío = app de la plataforma. Ver [configuracion-por-modalidad.md](configuracion-por-modalidad.md) |

**Proceso:**
1. Crear app en Meta for Developers
2. Configurar webhook: `https://tudominio.com/api/whatsapp/webhook`
3. Pegar credenciales en el panel
4. wacrm verifica la conexión antes de guardar

### 5.5 Messenger

Configuración para Facebook Messenger (canal adicional). Igual que en WhatsApp, tiene un campo opcional *App Secret de tu propia app de Meta*. Pasos en
[omnichannel-messenger.md](omnichannel-messenger.md); si no responde, ver
[messenger-troubleshooting.md](messenger-troubleshooting.md).

### 5.5.1 Telegram

Conexión con el token de un bot de @BotFather; el webhook se registra solo.
Pasos en [telegram-setup.md](telegram-setup.md).

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
- Se crean siempre como campos de texto (la interfaz no ofrece otros tipos)
- Se añaden al perfil de cada contacto

### 5.8 Negocios y moneda

- Moneda por defecto para el dashboard y Kanban (incluye **PEN — Sol peruano**)
- Las etapas de cada embudo se configuran desde el propio tablero de Embudos (solo Owner/Admin)

### 5.9 Miembros del equipo

- Invitar por enlace con rol predefinido
- Cambiar rol de miembros (lo hacen Owner/Admin)
- Estado de presencia de cada miembro (en línea / ausente / desconectado)
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

Estos son los modelos que el formulario **precarga por defecto**
(`AI_PROVIDER_DEFAULT_MODEL` en `src/lib/ai/defaults.ts`). El campo es texto
libre: el código no valida el nombre, solo el proveedor lo acepta o lo rechaza.
Los catálogos de modelos cambian seguido; confirma el nombre vigente en la
documentación de cada proveedor.

| Proveedor | Modelo por defecto | Descripción |
|---|---|---|
| **OpenAI** | `gpt-4o-mini` | Rápido, económico, excelente para chat de soporte |
| **Anthropic** | `claude-haiku-4-5` | Más rápido y económico de Claude |
| **DeepSeek** | `deepseek-chat` | Modelo conversacional principal |
| **Google Gemini** | `gemini-1.5-flash` | Flash = versión rápida y económica |
| **Z.ai** | `glm-4-flash` | Versión flash del GLM-4 |

**Modelos alternativos** (referencia, no los define el código):

| Proveedor | Modelo | Características |
|---|---|---|
| OpenAI | `gpt-4o` | Más potente, mayor costo |
| OpenAI | `gpt-4-turbo` | Alto contexto |
| Anthropic | `claude-sonnet-4-5` | Balance potencia/velocidad |
| Anthropic | `claude-opus-4-5` | El más potente de Claude |
| Google Gemini | `gemini-1.5-pro` | Mayor razonamiento |
| Google Gemini | `gemini-2.0-flash` | Último modelo flash |
| DeepSeek | `deepseek-reasoner` | Con razonamiento en cadena |

> **IMPORTANTE:** Los nombres de modelos deben escribirse EXACTAMENTE como los define el proveedor. Un nombre que el proveedor no reconoce devuelve error al pulsar "Test key".

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
- El canal de la conversación está encendido en "Canales con respuesta automática"
- Ningún flow maneja la conversación
- Sin agente asignado a la conversación
- La conversación no fue derivada antes a un humano (`ai_autoreply_disabled`)
- No se alcanzó el tope de respuestas de esa conversación

**Parámetros configurables:**

| Parámetro | Descripción | Default |
|---|---|---|
| `auto_reply_enabled` | Activar/desactivar el bot | false |
| `auto_reply_max_per_conversation` | Max respuestas bot por hilo | 3 (máx: 20) |

**Handoff automático:**
El bot emite `[[HANDOFF]]` cuando no puede ayudar con seguridad. El sentinel se filtra antes de enviar — el cliente nunca lo ve. Entonces:

1. Se envía al cliente el **mensaje de derivación** (editable en Configuración → IA).
2. Se apaga la IA en esa conversación (`ai_autoreply_disabled`).
3. Se crea una notificación para cada Owner/Admin y, si se configuró un **número de aviso**, se le escribe por WhatsApp.

> El mensaje de derivación por defecto (`DEFAULT_HANDOFF_MESSAGE`) menciona a
> "Max Patricio" y el número +51 989 377 295. Cada empresa debe reemplazarlo por
> el suyo; si no, sus clientes verán ese contacto.

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

Endpoint base `/api/v1`, autenticación `Authorization: Bearer <api_key>`. Las
llaves se crean en Configuración → Llaves de API (solo Owner/Admin), con
permisos por *scope* y revocación inmediata.

| Método y ruta | Uso |
|---|---|
| `GET /api/v1/me` | Cuenta y permisos de la llave |
| `POST /api/v1/messages` | Enviar mensaje (WhatsApp) |
| `GET`, `POST /api/v1/contacts` · `GET`, `PATCH /api/v1/contacts/{id}` | Contactos (no hay `DELETE`) |
| `GET /api/v1/conversations` · `GET /api/v1/conversations/{id}` · `GET /api/v1/conversations/{id}/messages` | Conversaciones y su historial |
| `POST /api/v1/broadcasts` · `GET /api/v1/broadcasts/{id}` | Crear una difusión y consultar su estado (no hay listado) |
| `GET`, `POST /api/v1/webhooks` · `GET`, `PATCH`, `DELETE /api/v1/webhooks/{id}` | Webhooks salientes firmados |

Parámetros, respuestas, paginación, eventos y verificación de firma:
[public-api.md](public-api.md).

---

## 8. Seguridad

Cifrado AES-256-GCM de credenciales, RLS en todas las tablas, firma HMAC de
webhooks, control de acceso por roles, límite de peticiones en memoria y
cabeceras de seguridad (la CSP todavía está en modo *Report-Only*). Detalle y
limitaciones en
[herramientas-y-arquitectura.md § 5.4](herramientas-y-arquitectura.md#54-seguridad).

---

## 9. Despliegue y variables de entorno

Producción corre en **Vercel** + **Supabase**; la guía paso a paso (entorno
local, variables, migraciones, cron y vuelta atrás) está en
[guia-local-y-produccion.md](guia-local-y-produccion.md). La lista completa de
variables con su explicación está en `.env.local.example`.

Requisitos: proyecto de Supabase, app de Meta for Developers y HTTPS (Meta y
Telegram no aceptan webhooks sin HTTPS).

> **NUNCA** compartas `ENCRYPTION_KEY` ni `SUPABASE_SERVICE_ROLE_KEY`.

---

## 10. Preguntas frecuentes FAQ

### Por qué sale error al hacer "Test key" de la IA?

**Causa más común:** El nombre del modelo es incorrecto.

Comprueba que el nombre coincida exactamente con el que publica el proveedor.
Los valores por defecto están en la Sección 6.2.

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

*Documentación generada el 07/07/2026 y revisada contra el código el 09/10/2026 — wacrm v0.7.0*

