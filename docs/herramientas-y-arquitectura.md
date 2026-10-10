# Herramientas y arquitectura

Documento técnico del proyecto **wacrm / Agente TED** (versión `0.7.0` en
`package.json`, último commit `491d434` del 8-oct-2026). Todo lo que sigue sale
del código, de `package.json` / `package-lock.json` y del historial de git.

- Qué hace cada módulo para el usuario → [DOCUMENTACION.md](DOCUMENTACION.md)
- Instalación, entorno local y despliegue → [guia-local-y-produccion.md](guia-local-y-produccion.md)
- API pública → [public-api.md](public-api.md)
- Cómo conectar canales en alquiler, app propia o reventa → [configuracion-por-modalidad.md](configuracion-por-modalidad.md)
- Canales → [omnichannel-messenger.md](omnichannel-messenger.md), [telegram-setup.md](telegram-setup.md), [messenger-troubleshooting.md](messenger-troubleshooting.md)
- Base de conocimiento → [knowledge-base-sources.md](knowledge-base-sources.md)

**Origen del código:** es un *fork* de la plantilla open source
[ArnasDon/wacrm](https://github.com/ArnasDon/wacrm) (licencia MIT, 474 commits
de su autor desde el 16-abr-2026). Sobre esa base hay 8 commits propios
(`fpatricioa`, 6-jul-2026 → 8-oct-2026) que agregan Messenger, Telegram, la
ingesta omnicanal, 3 proveedores de IA más, carga de archivos y Google Sheets
para la base de conocimiento, derivación a humano con aviso, marca blanca por
empresa, la traducción al español y correcciones de difusiones e importación
CSV. El remoto actual es `github.com/fraydeveloper/wacrm`.

---

## 1. Lenguajes

| Lenguaje | Dónde | Para qué |
|---|---|---|
| **TypeScript** (`.ts`, `.tsx`) | `src/` (356 archivos) | Todo el código de la aplicación: interfaz (React/TSX), rutas de API, lógica de negocio, integraciones y pruebas |
| **SQL / PL/pgSQL** | `supabase/migrations/` (37 archivos) | Tablas, índices, políticas RLS, funciones RPC, *triggers* y extensiones (`pgvector`) de PostgreSQL |
| **CSS** | `src/app/globals.css` | Variables de tema (colores, modo claro/oscuro) y estilos base de Tailwind v4 |
| **JavaScript** | `eslint.config.mjs`, `postcss.config.mjs`, `public/opus/encoderWorker.min.js` | Configuración de herramientas; el *worker* minificado de `opus-recorder` para grabar notas de voz en el navegador |
| **YAML** | `.github/workflows/ci.yml`, `.github/dependabot.yml` | Integración continua en GitHub Actions y actualizaciones automáticas de dependencias |
| **Markdown** | `docs/`, `README.md`, `CHANGELOG.md` | Documentación |

---

## 2. Frameworks, librerías y plugins

Versiones exactas instaladas según `package-lock.json` (entre paréntesis, el
rango declarado en `package.json` cuando difiere).

### 2.1 Servidor y datos

| Paquete | Versión | Para qué sirve en el proyecto |
|---|---|---|
| `next` | 16.2.6 | Framework: App Router, páginas, rutas de API (*Route Handlers*), middleware, `after()` para procesar webhooks después de responder |
| `@supabase/supabase-js` | 2.108.2 (`^2.107.0`) | Cliente de PostgreSQL, Auth, Storage y Realtime de Supabase |
| `@supabase/ssr` | 0.12.0 | Sesión de Supabase en cookies para servidor, middleware y navegador |
| `pdf-parse` | 2.4.5 | Extrae texto de PDFs subidos a la base de conocimiento (`src/lib/ai/file-extract.ts`); se excluye del *bundle* en `next.config.ts` |
| `date-fns` | 4.4.0 | Fechas y rangos del panel de métricas |

Sin SDK de terceros para Meta, Telegram, Google ni proveedores de IA: todas se
llaman con `fetch` directo:

| Servicio externo | Archivo | Detalle |
|---|---|---|
| WhatsApp Cloud API / Messenger | `src/lib/whatsapp/meta-api.ts`, `src/lib/messenger/api.ts` | Graph API `v21.0` |
| Telegram Bot API | `src/lib/telegram/api.ts` | `getMe`, `setWebhook`, `sendMessage` |
| Google Sheets API | `src/lib/google/sheets.ts` | JWT de cuenta de servicio firmado a mano con `crypto.sign('RSA-SHA256')` |
| OpenAI, Anthropic, DeepSeek, Gemini, Z.ai | `src/lib/ai/providers/*.ts` | Un adaptador por proveedor; DeepSeek y Z.ai usan `openai-compatible.ts` |
| Embeddings | `src/lib/ai/embeddings.ts` | Solo OpenAI `text-embedding-3-small` (1536 dimensiones) |

### 2.2 Interfaz

| Paquete | Versión | Para qué sirve |
|---|---|---|
| `react` / `react-dom` | 19.2.4 | Interfaz |
| `tailwindcss` + `@tailwindcss/postcss` | 4.3.1 (`^4`) | Estilos |
| `shadcn` | 4.11.0 | Generador de componentes base (`components.json`, estilo `base-nova`); el resultado está en `src/components/ui/` |
| `@base-ui/react` | 1.6.0 | Primitivas accesibles (diálogos, menús, *popover*, etc.) que usan los componentes de `ui/` |
| `class-variance-authority` | 0.7.1 | Variantes de componentes (botones, *badges*) |
| `clsx` | 2.1.1 | Composición de clases CSS |
| `tailwind-merge` | 3.6.0 | Resuelve clases Tailwind en conflicto (`cn()` en `src/lib/utils.ts`) |
| `tw-animate-css` | 1.4.0 | Animaciones CSS para Tailwind |
| `lucide-react` | 1.22.0 | Íconos |
| `sonner` | 2.0.7 | Notificaciones *toast* |
| `recharts` | 3.8.1 | Gráficos del panel (envueltos en `src/components/tremor/`) |
| `@xyflow/react` | 12.11.0 | Lienzo del editor visual de Flujos |
| `@dagrejs/dagre` | 3.0.0 | Ordenamiento automático de nodos en el editor de Flujos |
| `@dnd-kit/core` / `sortable` / `utilities` | 6.3.1 / 10.0.0 / 3.2.2 | Arrastrar y soltar en el tablero Kanban de negocios |
| `opus-recorder` | 8.0.5 | Grabación de notas de voz en formato Opus desde la bandeja |

### 2.3 Recursos cargados desde fuera (CDN)

No hay etiquetas `<script>` ni hojas de estilo cargadas desde un CDN. Lo único
externo es la fuente **Inter** vía `next/font/google` (`src/app/layout.tsx`):
Next.js la descarga al compilar y la sirve desde el propio dominio. El *worker*
de Opus está copiado en `public/opus/` en lugar de cargarse por CDN.

### 2.4 Base de datos (Supabase)

PostgreSQL gestionado por Supabase, con:

- **Auth** (correo y contraseña) y un *trigger* `handle_new_user` que crea una
  cuenta y un perfil `owner` en cada registro (migración `017`).
- **RLS** en todas las tablas mediante la función `is_account_member(account_id, min_role)`.
- **Realtime** (`postgres_changes`) para la bandeja en vivo (`src/hooks/use-realtime.ts`).
- **Storage** para avatares, medios del chat y logos.
- **pgvector** (`vector(1536)`) para la búsqueda semántica y `tsvector` para la búsqueda de texto completo de la base de conocimiento (migración `030`).

---

## 3. Herramientas de desarrollo

| Herramienta | Versión | Uso |
|---|---|---|
| Node.js | `>=20.0.0` (`engines`); CI usa 20 | Entorno de ejecución |
| npm | lockfile v3 | Gestor de dependencias; `overrides` fuerza versiones parchadas de `postcss`, `ip-address`, `fast-uri`, `hono`, `js-yaml` y `@babel/core` |
| TypeScript | 6.0.3 (`^6`) | Tipado; `npm run typecheck` = `tsc --noEmit` |
| Vitest | 4.1.9 | Pruebas unitarias (`npm test`); 59 archivos, 606 pruebas |
| ESLint + `eslint-config-next` | 9.39.4 + 16.2.6 | Análisis estático (`npm run lint`) |
| Prettier + `prettier-plugin-tailwindcss` | 3.9.1 + 0.8.0 | Formato (`npm run format`) |
| Servidor local | `next dev --webpack` | `npm run dev` usa webpack porque Turbopack falla en Windows (ver guía); `npm run dev:turbo` usa Turbopack |
| Git + GitHub | — | Control de versiones; remoto `fraydeveloper/wacrm` |
| GitHub Actions | `ci.yml` | En cada *push*/PR a `main`: lint → typecheck → test → build |
| Dependabot | `dependabot.yml` | PRs semanales de dependencias (todavía asigna como revisor a `ArnasDon`, el autor original) |

**Estado de las pruebas (8-oct-2026, Windows):** 601 de 606 pasan. Las 5 que
fallan (`currency.test.ts`, `date-utils.test.ts`) dependen del idioma y la zona
horaria del sistema operativo; es el problema conocido descrito en la guía.

**Hosting:** según la guía, producción corre en **Vercel** con despliegue
automático desde `main`. No se usa Apache, por eso no hace falta un
`docs/.htaccess`: Next.js solo publica lo que está en `public/`, y `docs/` nunca
se sirve en la web.

---

## 4. Patrón de arquitectura

### 4.1 Qué patrón es

**No es MVC.** Es una aplicación **Next.js App Router organizada por capas**,
con dos caminos hacia los datos:

1. **Navegador → Supabase directo, protegido por RLS.** Las 17 páginas del panel
   son componentes de cliente (`"use client"`), y 19 componentes leen y escriben
   tablas con el cliente de Supabase del navegador. La seguridad no está en un
   controlador, sino en las políticas RLS de PostgreSQL.
2. **Navegador → Route Handler → servicios de `lib/` → Supabase/APIs externas.**
   Las 57 rutas de `src/app/api/` se usan para todo lo que necesita secretos o
   privilegios: enviar por WhatsApp, cifrar tokens, llamar a la IA, procesar
   webhooks, la API pública.

Por qué no encaja en MVC:

- **No hay capa de "Modelo"**: no existen clases de dominio ni ORM. Los tipos de
  `src/types/index.ts` solo describen filas, y las consultas se escriben con el
  cliente de Supabase donde se necesitan (en componentes, rutas o `lib/`).
- **Parte de la lógica de negocio vive en la base de datos**: permisos por rol
  (RLS), contadores atómicos, filtros por etiqueta, invitaciones y transferencia
  de propiedad son funciones RPC en SQL.
- **Las rutas de API son adaptadores delgados**: validan sesión, rol y límite de
  peticiones, y delegan en `lib/` (por ejemplo, `/api/whatsapp/send` y
  `/api/v1/messages` comparten `sendMessageToConversation`).
- **Los webhooks no tienen vista**: entran por una ruta, pasan a un núcleo común
  de ingesta y desde ahí se reparten a automatizaciones, flujos, IA y webhooks
  salientes.

### 4.2 Diagrama de capas

```
┌──────────────────────────────────────────────────────────────────────┐
│ NAVEGADOR                                                            │
│  src/app/(dashboard)/*/page.tsx   páginas (todas "use client")       │
│  src/components/**                componentes por módulo             │
│  src/hooks/**                     sesión, permisos, realtime, tema   │
│  src/lib/supabase/client.ts       cliente Supabase (anon + sesión)   │
└───────────────┬───────────────────────────────┬──────────────────────┘
                │ fetch('/api/...')             │ consultas directas
                ▼                               │ (RLS) + Realtime
┌───────────────────────────────────┐           │
│ SERVIDOR NEXT.JS                  │           │
│  src/middleware.ts  sesión/redir. │           │
│  src/app/api/**/route.ts          │           │
│   · auth: requireRole()           │           │
│   · rate limit en memoria         │           │
│   · firma HMAC de webhooks        │           │
│        │                          │           │
│        ▼                          │           │
│  src/lib/**  servicios            │           │
│   inbound/ingest-core  núcleo     │           │
│   channels/router      envío      │           │
│   whatsapp|messenger|telegram     │           │
│   ai/*  flows/*  automations/*    │           │
│   webhooks/*  api-keys/*  google/*│           │
└───────┬───────────────────┬───────┘           │
        │ service role      │ fetch             │
        ▼                   ▼                   ▼
┌───────────────────┐ ┌───────────────────────────────────────────────┐
│ APIs EXTERNAS     │ │ SUPABASE                                      │
│ Meta Graph v21.0  │ │ PostgreSQL + RLS (is_account_member) + RPC    │
│ Telegram Bot API  │ │ Auth · Storage · Realtime · pgvector          │
│ Google Sheets     │ └───────────────────────────────────────────────┘
│ Proveedores de IA │
└───────────────────┘
```

Hay dos clientes de Supabase en el servidor:

- `src/lib/supabase/server.ts`: usa la sesión del usuario (RLS activo). Lo usan las rutas que actúan en nombre de alguien.
- `supabaseAdmin` (`src/lib/*/admin-client.ts`): usa la `SUPABASE_SERVICE_ROLE_KEY` y se salta RLS. Lo usan webhooks, motores de flujos y automatizaciones, IA y la API pública, que no tienen sesión de usuario. Esas rutas filtran siempre por `account_id` a mano.

### 4.3 Recorrido de una petición real: un cliente escribe por WhatsApp y responde la IA

| # | Archivo | Qué pasa |
|---|---|---|
| 1 | Meta → `POST /api/whatsapp/webhook` → `src/app/api/whatsapp/webhook/route.ts` | Llega el evento. `verifyMetaWebhookSignature()` (`src/lib/whatsapp/webhook-signature.ts`) valida la firma HMAC-SHA256 con `META_APP_SECRET`. Si no coincide, `trustedWhatsAppEntries()` (`src/lib/inbound/meta-account-secrets.ts`) prueba el App Secret propio de la cuenta dueña del número y deja solo sus entradas; si tampoco, responde 401 |
| 2 | mismo archivo | Responde 200 a Meta al instante y programa el procesamiento con `after()` para que no se corte en serverless |
| 3 | mismo archivo | Busca la fila de `whatsapp_config` cuyo `phone_number_id` coincide, y así sabe a qué cuenta (empresa) pertenece el mensaje |
| 4 | `src/lib/inbound/ingest-core.ts` → `resolveContactAndConversation()` | Encuentra o crea el contacto (deduplicación en `src/lib/contacts/dedupe.ts`) y la conversación `(account_id, contact_id, channel)` |
| 5 | `ingest-core.ts` → `recordAndDispatchMessage()` | Guarda el mensaje en `messages`. Supabase Realtime lo empuja a la bandeja abierta (`src/hooks/use-realtime.ts` → `src/components/inbox/message-thread.tsx`) |
| 6 | `src/lib/flows/engine.ts` → `dispatchInboundToFlows()` | Si un flujo activo captura el mensaje, gana el flujo y la IA no responde |
| 7 | `src/lib/automations/engine.ts` → `runAutomationsForTrigger()` | Ejecuta las automatizaciones cuyo disparador coincide |
| 8 | `src/lib/ai/auto-reply.ts` → `dispatchInboundToAiReply()` | Comprueba IA activa, canal habilitado, que no haya agente asignado y el tope de respuestas por conversación |
| 9 | `src/lib/ai/knowledge.ts` → `retrieveKnowledge()` | Busca fragmentos relevantes: semántica (pgvector) si hay clave de embeddings, si no texto completo |
| 10 | `src/lib/ai/generate.ts` → `generateReply()` → `src/lib/ai/providers/<proveedor>.ts` | Arma el *prompt* (`src/lib/ai/defaults.ts`) y llama al proveedor con la clave descifrada de la cuenta. Si el modelo emite `[[HANDOFF]]`, se deriva a humano y se avisa (`src/lib/ai/handoff-notify.ts`) |
| 11 | `src/lib/channels/router.ts` → `sendChannelText()` | Elige el emisor según `conversation.channel` |
| 12 | `src/lib/flows/meta-send.ts` → `src/lib/whatsapp/meta-api.ts` | Envía por Graph API y guarda el mensaje saliente |
| 13 | `src/lib/webhooks/deliver.ts` → `dispatchWebhookEvent()` | Notifica `message.received` a los webhooks salientes registrados por la cuenta |

El camino inverso (un agente responde a mano desde la bandeja) es:
`message-composer.tsx` → `fetch('/api/whatsapp/send')` →
`src/app/api/whatsapp/send/route.ts` (sesión, límite de 60/min, cuenta). Ahí
la ruta mira el canal de la conversación:

- **WhatsApp:** `sendMessageToConversation()` en `src/lib/whatsapp/send-message.ts` → `meta-api.ts` (texto, medios, plantillas).
- **Messenger / Telegram:** `sendChannelText()` en `src/lib/channels/router.ts` con `senderType: 'agent'` → `src/lib/messenger/send.ts` o `src/lib/telegram/send.ts` (solo texto). Instagram devuelve un error claro hasta que exista su emisor.

> Las automatizaciones (`src/lib/automations/meta-send.ts`) todavía envían solo
> por WhatsApp; en Messenger y Telegram responden la IA y los agentes.

---

## 5. Decisiones de diseño

### 5.1 Autenticación

- Supabase Auth con correo y contraseña (`src/app/(auth)/`). La sesión vive en cookies (`@supabase/ssr`).
- `src/middleware.ts` refresca la sesión en cada petición, copia las cookies renovadas a las redirecciones y manda a `/login` a quien no tenga sesión en `/dashboard`, `/inbox`, `/contacts`, `/pipelines`, `/broadcasts`, `/automations` y `/settings`. `/flows`, `/agents` y `/notifications` no están en esa lista, pero sus datos están protegidos igual por RLS y por las rutas de API.
- Rutas de API del panel: `requireRole(min)` en `src/lib/auth/account.ts` carga usuario, cuenta y rol, y lanza 401/403.
- API pública `/api/v1`: claves `Bearer` generadas con `randomBytes(32)`, guardadas solo como hash SHA-256 y comparadas con `timingSafeEqual` (`src/lib/api-keys/keys.ts`), con *scopes* por clave.
- Webhooks entrantes: Meta con HMAC-SHA256 (`META_APP_SECRET` o el App Secret propio de la cuenta, migración `038`); Telegram con el `secret_token` por cuenta en la cabecera `X-Telegram-Bot-Api-Secret-Token`.

### 5.2 Roles y permisos

Cuatro roles por cuenta (`owner` 4 > `admin` 3 > `agent` 2 > `viewer` 1),
definidos igual en TypeScript (`src/lib/auth/roles.ts`) y en SQL
(`is_account_member`). Se aplican en tres lugares: RLS, `requireRole()` en las
rutas, y `useCan()` en la interfaz para ocultar o desactivar botones.

| Acción | Rol mínimo | Dónde se exige |
|---|---|---|
| Ver datos de la cuenta | viewer | RLS `*_select` |
| Contactos, negocios, difusiones, automatizaciones, flujos, enviar mensajes | agent | RLS `*_insert/update`; límites en rutas |
| Embudos y etapas, etiquetas, campos personalizados, plantillas de Meta | admin | RLS (migración `017`) |
| Configurar WhatsApp/Messenger/Telegram, IA, base de conocimiento, claves de API, miembros, marca | admin | `requireRole('admin')` |
| Transferir la propiedad, eliminar la cuenta | owner | `canTransferOwnership` / `canDeleteAccount` |

### 5.3 Multiempresa

- Cada registro nuevo crea su propia **cuenta** (`accounts`) y queda como `owner` (*trigger* `handle_new_user`). Una sola instalación atiende a varias empresas.
- Todas las tablas de negocio tienen `account_id` y RLS por cuenta. Las rutas con *service role* filtran por `account_id` de forma explícita.
- Cada cuenta guarda sus propias credenciales: WhatsApp (`whatsapp_config`), Messenger (`messenger_config`), Telegram (`telegram_config`), IA (`ai_config`), Google Sheets y su marca (nombre, logo y colores, migración `037`).
- El webhook de WhatsApp enruta por `phone_number_id`, el de Messenger por `page_id` y el de Telegram por `secret_token`.

**Apps de Meta por empresa:** por defecto todas las empresas se conectan a
través de la app de Meta del operador (`META_APP_SECRET`). Una empresa también
puede usar **su propia app**: guarda su App Secret (cifrado, columna
`app_secret` de `whatsapp_config` / `messenger_config`, migración `038`). Si
la firma no coincide con el secreto global, el webhook busca solo las cuentas
mencionadas en el mensaje y acepta únicamente las entradas firmadas con el
secreto de cada una (`src/lib/inbound/meta-account-secrets.ts`). Así, la app
de una empresa no puede inyectar mensajes en otra. Lo que no existe es el
*Embedded Signup*: el alta de cada número se hace a mano. Pasos por modalidad en
[configuracion-por-modalidad.md](configuracion-por-modalidad.md).

### 5.4 Seguridad

| Medida | Implementación |
|---|---|
| Cifrado de credenciales | AES-256-GCM con `ENCRYPTION_KEY` (`src/lib/whatsapp/encryption.ts`); los textos antiguos en AES-256-CBC se migran a GCM la primera vez que se leen |
| Aislamiento de datos | RLS en todas las tablas |
| Webhooks entrantes | HMAC-SHA256 (Meta, con el App Secret de la plataforma o el propio de la cuenta), `secret_token` (Telegram) |
| Webhooks salientes | Firma HMAC (`src/lib/webhooks/sign.ts`) y bloqueo de IPs privadas/SSRF (`src/lib/webhooks/ssrf.ts`) |
| Límite de peticiones | Ventana deslizante **en memoria** (`src/lib/rate-limit.ts`): envío 60/min, difusión 90/min, reacciones 120/min, invitaciones 30 y 10/min. Con varias instancias del servidor, cada una cuenta por separado |
| Cabeceras | HSTS, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` (solo micrófono propio) y CSP en modo **Report-Only**, todavía sin bloquear (`next.config.ts`) |
| Caché | `/api/*` con `no-store` |
| *Prompt injection* | El *prompt* de sistema indica tratar los mensajes del cliente como contenido no confiable (`src/lib/ai/defaults.ts`) |
| Marca | Colores validados como hex estricto y logo solo `https` en base de datos (migración `037`) |

### 5.5 Configuración

- Variables de entorno usadas por el código: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ENCRYPTION_KEY`, `META_APP_SECRET`, `NEXT_PUBLIC_SITE_URL`, y opcionales `META_APP_ID`, `AUTOMATION_CRON_SECRET`, `ALLOWED_INVITE_HOSTS`, `WHATSAPP_TEMPLATES_DRY_RUN`, `AI_REQUEST_TIMEOUT_MS`, `AI_CONTEXT_MESSAGE_LIMIT`. Están explicadas en `.env.local.example` y en la [guía](guia-local-y-produccion.md).
- Todo lo demás (canales, IA, marca, moneda) se configura por cuenta desde la interfaz y se guarda en la base de datos.
- Tareas programadas: `/api/automations/cron` y `/api/flows/cron`, protegidas con `x-cron-secret`. Las ejecuta un servicio externo (por ejemplo cron-job.org); el proyecto no trae un *scheduler* propio.

### 5.6 Reglas de negocio importantes

- **Prioridad al responder:** primero el flujo, después las automatizaciones y por último la IA. Los flujos y los envíos de las automatizaciones solo funcionan en WhatsApp.
- **Envío manual por canal:** WhatsApp admite texto, medios y plantillas; Messenger y Telegram solo texto. Telegram no tiene ventana de 24 h, así que la bandeja no muestra el contador en esas conversaciones.
- **La IA se calla** si la conversación tiene un agente asignado, si ya se derivó a humano (`ai_autoreply_disabled`), si llegó al tope de respuestas por conversación (por defecto 3, máximo 20) o si el canal está apagado en la configuración de IA.
- **Derivación a humano:** si el modelo emite `[[HANDOFF]]`, el cliente recibe el mensaje de derivación y se avisa al humano (notificación interna y, si está configurado, un número de WhatsApp). El mensaje por defecto de `DEFAULT_HANDOFF_MESSAGE` incluye **un nombre y un teléfono fijos** ("Max Patricio", +51 989 377 295); cada cuenta debe cambiarlo en Configuración → IA.
- **Contactos:** se deduplican por teléfono normalizado (migración `022`); los de Messenger y Telegram se identifican por `contact_channel_identities`. Un mismo cliente en dos canales tiene dos conversaciones.
- **Difusiones:** solo con plantillas aprobadas por Meta. El navegador envía lotes de 10 destinatarios con 1 s de pausa (`src/hooks/use-broadcast-sending.ts`) y reintenta si recibe 429. La difusión **avanza mientras la pestaña está abierta**: no hay cola en el servidor.
- **Esperas de automatizaciones:** solo avanzan si alguien llama al cron.
- **Marca:** el nombre por defecto es "Agente TED" (`src/lib/brand.ts`); cada cuenta puede cambiar nombre, logo y colores.

---

## 6. Estructura de carpetas

```
wacrm/
├── .github/                  CI (ci.yml), Dependabot, plantillas de issues/PR, CODEOWNERS (heredados del original)
├── docs/                     Documentación (este archivo y los enlazados arriba)
├── public/
│   ├── inbox-doodle.svg      Fondo de la bandeja
│   └── opus/                 Worker de grabación de voz (copiado, no se compila)
├── supabase/migrations/      001…037 — esquema completo; se ejecutan a mano en el SQL Editor y en orden
├── src/
│   ├── middleware.ts         Sesión y redirecciones
│   ├── app/
│   │   ├── layout.tsx        HTML raíz, fuente, script de tema anterior a la hidratación
│   │   ├── (auth)/           login, signup, forgot-password
│   │   ├── (dashboard)/      dashboard, inbox, contacts, pipelines, broadcasts,
│   │   │                     automations, flows, agents, notifications, settings
│   │   ├── join/[token]/     Aceptar invitación de equipo
│   │   └── api/
│   │       ├── whatsapp/     webhook, send, broadcast, media, react, templates, config
│   │       ├── webhooks/meta-omni/   webhook de Messenger
│   │       ├── messenger/ telegram/  configuración (+ webhook de Telegram)
│   │       ├── ai/           config, draft, playground, test, knowledge, google-sheets
│   │       ├── automations/ flows/   CRUD, motor y cron
│   │       ├── account/ invitations/ miembros, invitaciones, claves de API, transferencia
│   │       └── v1/           API pública REST
│   ├── components/           Un directorio por módulo; ui/ (shadcn) y tremor/ (gráficos) son base genérica
│   ├── hooks/                use-auth, use-can, use-realtime, use-theme, use-presence…
│   ├── lib/
│   │   ├── inbound/          Núcleo de ingesta compartido por los canales
│   │   ├── channels/         Router de envío por canal
│   │   ├── whatsapp/ messenger/ telegram/   Integración de cada canal
│   │   ├── ai/               Proveedores, RAG, auto-respuesta, derivación
│   │   ├── google/           Google Sheets
│   │   ├── flows/ automations/   Motores
│   │   ├── auth/ api-keys/ api/v1/ webhooks/   Seguridad y API pública
│   │   ├── contacts/ inbox/ dashboard/ storage/ supabase/
│   │   └── brand.ts themes.ts currency.ts rate-limit.ts …
│   └── types/                Tipos de filas de la base de datos
├── next.config.ts            Cabeceras de seguridad y caché
├── vitest.config.ts  eslint.config.mjs  .prettierrc  components.json  tsconfig.json
└── .env.local.example        Plantilla de variables de entorno
```

---

## 7. Tamaño del proyecto

Líneas **no vacías** (incluyen comentarios, que en este código son abundantes),
sin `node_modules`, `.next` ni el *worker* de Opus copiado.

| Parte | Líneas |
|---|---:|
| Páginas (`app/(dashboard)`, `(auth)`, `join`, raíz) | 6,180 |
| Rutas de API (`app/api`, sin pruebas) | 7,931 |
| Componentes por módulo (sin `ui/` ni `tremor/`) | 23,624 |
| Servicios `lib/` (sin pruebas) | 14,089 |
| Hooks, tipos y middleware | 2,217 |
| CSS | 298 |
| Migraciones SQL (37) | 4,314 |
| Configuración (`next`, `vitest`, `eslint`, `postcss`) | 179 |
| **Subtotal de código de producción** | **58,832** |
| Pruebas (59 archivos) | 7,415 |
| Componentes base generados (`ui/` shadcn + `tremor/`) | 2,732 |
| Documentación Markdown (`docs/`, README, CHANGELOG, CONTRIBUTING) | ~2,500 |

Reparto aproximado por módulo funcional (TypeScript sin pruebas):

| Módulo | Líneas |
|---|---:|
| Flujos (editor visual + motor) | 8,818 |
| WhatsApp: webhook, envío, medios, plantillas | 7,714 |
| Bandeja | 4,663 |
| IA, base de conocimiento, Google Sheets | 4,416 |
| Cuentas, equipo, invitaciones, autenticación, presencia | 4,339 |
| Automatizaciones | 3,930 |
| Contactos | 3,374 |
| Difusiones | 3,308 |
| Panel y notificaciones | 2,794 |
| Omnicanal: ingesta, Messenger, Telegram | 2,777 |
| API pública y webhooks salientes | 2,486 |
| Embudos de venta | 2,089 |
| Marca, temas y *layout* | 1,755 |

**Aporte propio frente a la base:** desde la última fusión con el original
(`274db1c`), `src/` y `supabase/` suman **9,720 líneas agregadas y 2,705
borradas** en 202 archivos. Una parte importante de esos cambios es traducción
de textos al español, no funcionalidad nueva.
