# Guía: ejecutar en localhost y publicar cambios en producción

Guía paso a paso para trabajar en el proyecto desde tu PC (Windows) y publicar
cada cambio en producción (Vercel + Supabase).

**Resumen del flujo de trabajo:**

```
Editar código  →  probar en localhost:3000  →  git commit + git push
      →  Vercel despliega solo  →  (si hay migración nueva) ejecutarla en Supabase
```

---

## Parte 1 — Preparar tu PC (solo la primera vez)

### 1.1 Instalar las herramientas

| Herramienta | Para qué | Descarga |
|---|---|---|
| **Node.js 20 o superior** (LTS) | Ejecutar el proyecto | https://nodejs.org |
| **Git** | Guardar y subir cambios | https://git-scm.com |
| **VS Code** | Editar el código | https://code.visualstudio.com |

Verifica en una terminal (PowerShell o la terminal de VS Code):

```bash
node -v    # debe mostrar v20.x o superior
npm -v
git --version
```

### 1.2 Obtener el código

Si ya tienes la carpeta `wacrm` en tu PC, sáltate este paso. Si no:

```bash
git clone https://github.com/fraydeveloper/wacrm.git
cd wacrm
```

### 1.3 Instalar dependencias

Dentro de la carpeta `wacrm`:

```bash
npm install
```

Vuelve a ejecutarlo cada vez que `package.json` cambie (por ejemplo, después de
un `git pull` que agregue librerías).

### 1.4 Crear el archivo de variables de entorno

1. Copia `.env.local.example` y renómbralo a **`.env.local`** (o usa el `.env`
   existente).
2. Completa los valores:

| Variable | Dónde se obtiene |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` `public` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` (**secreta**) |
| `ENCRYPTION_KEY` | 64 caracteres hex. Debe ser **la misma** que en producción si usas la misma base de datos (si no, los tokens de WhatsApp guardados no se podrán leer). |
| `META_APP_SECRET` | Meta for Developers → tu app → Configuración → Básica |
| `NEXT_PUBLIC_SITE_URL` | En local: `http://localhost:3000` |
| `AUTOMATION_CRON_SECRET` | Opcional. Texto aleatorio largo (ver Parte 5). |

Para generar una `ENCRYPTION_KEY` nueva (solo para un proyecto nuevo):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> ⚠️ **Nunca subas `.env` ni `.env.local` a GitHub.** Ya están en `.gitignore`.
> No compartas la `SUPABASE_SERVICE_ROLE_KEY` ni la `ENCRYPTION_KEY`.

---

## Parte 2 — Ejecutar en localhost

```bash
npm run dev
```

Abre **http://localhost:3000** e inicia sesión con tu usuario.

- Los cambios en el código se recargan solos en el navegador.
- Para detener el servidor: `Ctrl + C` en la terminal.

### ¿Qué funciona en local y qué no?

| Funciona en local | Necesita una URL pública (HTTPS) |
|---|---|
| Panel, contactos, embudos, configuración, apariencia y marca | Recibir mensajes de WhatsApp / Messenger / Telegram (webhooks) |
| Importar contactos, crear difusiones, flujos y automatizaciones | Conectar Telegram (el `setWebhook` exige HTTPS) |
| Enviar mensajes (sí sale hacia Meta) | Respuestas automáticas de la IA y los flujos (los dispara el webhook) |

Si necesitas probar webhooks en local, usa un túnel HTTPS como
[ngrok](https://ngrok.com) (`ngrok http 3000`) y pon esa URL temporal en Meta /
Telegram. Lo más simple es probar los webhooks directamente en producción.

> **Ojo:** si tu `.env` apunta al **mismo Supabase que producción**, lo que
> hagas en local (crear contactos, enviar difusiones) afecta los datos reales.
> Para pruebas grandes crea un segundo proyecto de Supabase de pruebas.

### Verificaciones antes de publicar

Ejecuta esto antes de cada `git push`; si algo falla, corrígelo primero:

```bash
npm run typecheck   # errores de tipos
npm run lint        # estilo y errores comunes
npm test            # pruebas automáticas
npm run build       # compila exactamente como lo hará Vercel
```

> En Windows, 5 pruebas de `currency.test.ts` y `date-utils.test.ts` fallan por
> el idioma/zona horaria del sistema. Es un problema conocido y no afecta a
> producción.

---

## Parte 3 — Publicar cambios en producción

Producción está en **Vercel**, conectado al repositorio de GitHub
`fraydeveloper/wacrm` (rama `main`). Cada `git push` a `main` despliega
automáticamente.

### 3.1 Guardar y subir los cambios

```bash
git status                       # ver qué archivos cambiaron
git add .                        # preparar todos los cambios
git commit -m "describe el cambio"
git push origin main             # subir → Vercel despliega solo
```

### 3.2 Ver el despliegue

1. Entra a https://vercel.com → proyecto **wacrm** → pestaña **Deployments**.
2. Espera a que el despliegue más reciente diga **Ready** (1–3 minutos).
3. Si dice **Error**, ábrelo y revisa el log de *Build*. El sitio sigue con la
   versión anterior hasta que corrijas y vuelvas a hacer push.
4. Abre tu dominio de producción y prueba el cambio.

### 3.3 Volver atrás si algo sale mal

En Vercel → Deployments → elige el despliegue anterior que funcionaba →
menú **⋯** → **Promote to Production** (o **Instant Rollback**). Es inmediato.

> El rollback de Vercel **no** deshace migraciones de base de datos. Por eso las
> migraciones de este proyecto solo agregan columnas/tablas y son seguras de
> mantener aunque vuelvas a una versión anterior del código.

### 3.4 Trabajar con una rama de prueba (recomendado para cambios grandes)

```bash
git checkout -b mi-cambio
# ...editar, probar...
git add . && git commit -m "mi cambio"
git push origin mi-cambio
```

Vercel crea una **URL de vista previa** para esa rama (sin tocar producción).
Cuando esté bien, en GitHub crea un *Pull Request* hacia `main` y fusiónalo:
eso publica en producción.

---

## Parte 4 — Migraciones de base de datos (Supabase)

Cuando un cambio agrega un archivo nuevo en `supabase/migrations/`
(por ejemplo `037_account_branding.sql`), hay que ejecutarlo **una vez** en
Supabase. Vercel **no** lo hace solo.

1. Entra a https://supabase.com → tu proyecto → **SQL Editor** → **New query**.
2. Abre el archivo de la migración en VS Code, copia **todo** su contenido y
   pégalo.
3. Pulsa **Run**. Debe decir *Success. No rows returned*.
4. Ejecuta las migraciones **en orden numérico** y solo las que aún no hayas
   ejecutado. Todas son *idempotentes*: si ejecutas una dos veces por error, no
   pasa nada.

**Orden recomendado** cuando un cambio trae migración nueva:

1. Ejecuta la migración en Supabase.
2. Luego haz `git push` del código.

(El código nuevo está preparado para funcionar aunque la migración aún no esté
aplicada, pero así evitas avisos temporales.)

### Migraciones de esta versión

| Archivo | Qué agrega |
|---|---|
| `037_account_branding.sql` | Nombre, logo y colores de la empresa (Configuración → Empresa y marca) |

---

## Parte 5 — Variables de entorno en producción (Vercel)

1. Vercel → proyecto → **Settings → Environment Variables**.
2. Agrega las mismas variables de la Parte 1.4, con
   `NEXT_PUBLIC_SITE_URL` = tu dominio real con `https://` y sin `/` final.
3. Después de agregar o cambiar una variable, haz **Redeploy** del último
   despliegue (Deployments → ⋯ → Redeploy). Las variables nuevas no se aplican
   a despliegues anteriores.

### Tareas programadas (cron) — recomendado

Las automatizaciones con pasos de **Espera** y la limpieza de **Flujos**
abandonados usan dos endpoints que deben llamarse cada 5 minutos:

- `GET https://TU-DOMINIO/api/automations/cron`
- `GET https://TU-DOMINIO/api/flows/cron`

Ambos exigen el encabezado `x-cron-secret: <AUTOMATION_CRON_SECRET>`.

Forma gratuita y simple: crea una cuenta en https://cron-job.org y agrega dos
trabajos (uno por URL), cada 5 minutos, con ese encabezado.

> Los flujos funcionan aunque no configures el cron: un flujo abandonado se
> cierra solo cuando el contacto vuelve a escribir después del tiempo límite
> del flujo (24 h por defecto). Las **esperas** de automatizaciones sí
> necesitan el cron.

---

## Parte 6 — Checklist rápido para cada cambio

- [ ] `npm run dev` y probé el cambio en http://localhost:3000
- [ ] `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` sin errores nuevos
- [ ] Si hay migración nueva: la ejecuté en Supabase → SQL Editor
- [ ] Si hay variable de entorno nueva: la agregué en Vercel y redeployé
- [ ] `git add .` → `git commit -m "..."` → `git push origin main`
- [ ] El despliegue en Vercel dice **Ready**
- [ ] Probé en producción (y sé cómo hacer rollback si algo falla)

---

## Problemas frecuentes

| Síntoma | Causa probable | Solución |
|---|---|---|
| `npm run dev` dice que faltan variables | No existe `.env.local` / `.env` | Parte 1.4 |
| El build falla en Vercel pero en local funciona | Variable faltante en Vercel o archivo sin subir | Revisar Parte 5 y `git status` |
| "Falta aplicar la migración 037..." al guardar la marca | No se ejecutó la migración | Parte 4 |
| WhatsApp dice "token inválido" tras cambiar de entorno | `ENCRYPTION_KEY` distinta | Usar la misma clave o volver a guardar la configuración de WhatsApp |
| No llegan mensajes en local | Los webhooks apuntan a producción | Normal; probar en producción o usar ngrok |
| Difusión: "Demasiadas solicitudes" | Límite de seguridad | Se reintenta solo; si persiste, esperar 1 minuto |
