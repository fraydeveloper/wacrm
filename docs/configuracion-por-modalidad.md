# Configuración según la modalidad de venta

Cómo se conectan los canales de cada empresa en las tres formas de vender el
sistema. Precios de cada modalidad en
[valoracion-comercial.md § 6.0](valoracion-comercial.md#60-resumen-por-modalidad).
Instalación y despliegue en [guia-local-y-produccion.md](guia-local-y-produccion.md).

## Antes de empezar: qué es la "app de Meta"

WhatsApp y Messenger no se conectan directo a un número o a una Página: pasan
por una **app** creada en [Meta for Developers](https://developers.facebook.com).
Esa app tiene un **App Secret**, y Meta firma con él cada mensaje que envía al
webhook. El sistema rechaza todo mensaje cuya firma no reconoce.

El sistema reconoce dos tipos de firma:

| Firma | Dónde se configura | Para quién |
|---|---|---|
| **App Secret de la plataforma** | Variable de entorno `META_APP_SECRET` (en Vercel) | Todas las empresas conectadas a **tu** app de Meta |
| **App Secret propio de la empresa** | Configuración → WhatsApp / Messenger → *App Secret de tu propia app de Meta* | Una empresa que usa **su propia** app de Meta |

Primero se prueba el App Secret de la plataforma. Si no coincide, se busca la
empresa dueña del número o de la Página y se prueba el App Secret que esa
empresa guardó. Una app solo puede entregar mensajes de los números y Páginas
de la empresa que la configuró, nunca de otra. Código:
`src/lib/inbound/meta-account-secrets.ts`.

**Telegram no usa Meta.** En todas las modalidades cada empresa crea su bot
con @BotFather y pega el token en Configuración → Telegram
([telegram-setup.md](telegram-setup.md)). No hay nada compartido.

**Requisito:** ejecutar la migración `038_channel_app_secret.sql` en Supabase
(SQL Editor), una sola vez. Sin ella, todo sigue funcionando con la app de la
plataforma, pero el campo de App Secret propio no se puede guardar.

---

## Modalidad 1: Alquiler mensual con tu app de Meta (la normal)

Tú operas una sola instalación, cada empresa es una cuenta y **todas usan tu
app de Meta**. Es la opción más simple para el cliente porque no tiene que
crear nada en Meta for Developers.

### Lo que configuras una sola vez (operador)

1. Una app de Meta tuya con los productos **WhatsApp** y **Messenger**.
2. En Vercel: `META_APP_SECRET` = App Secret de esa app (y `META_APP_ID` si
   vas a crear plantillas con imagen).
3. Webhooks de la app, apuntando a tu dominio:
   - WhatsApp: `https://TU-DOMINIO/api/whatsapp/webhook`, campo `messages`.
   - Messenger: `https://TU-DOMINIO/api/webhooks/meta-omni`, campo `messages`.
   - Verify Token: el mismo texto que cada cuenta escriba en su configuración
     (Meta solo lo pide al registrar la URL).
4. **Verificación del negocio** y **App Review** de tu app (permisos de
   mensajería de WhatsApp y `pages_messaging` para Messenger). Sin App Review,
   Messenger solo responde a quienes tienen un rol en la app
   ([messenger-troubleshooting.md](messenger-troubleshooting.md)).

### Lo que haces por cada empresa cliente

1. La empresa se registra (o la invitas) y obtiene su propia cuenta.
2. **WhatsApp:** el número del cliente tiene que quedar bajo tu app. El camino
   habitual es que el cliente te comparta su cuenta de WhatsApp Business
   (WABA) como socio en su Business Manager. Luego generas un token permanente
   de un *System User* de tu negocio con acceso a esa WABA. En Configuración →
   WhatsApp de la cuenta del cliente pegas Phone Number ID, WABA ID, ese token y
   el PIN. Al guardar, el sistema suscribe la WABA a tu app (`subscribed_apps`).
3. **Messenger:** el cliente te da acceso a su Página de Facebook. Generas un
   Page Access Token desde tu app y lo pegas en Configuración → Messenger con
   el Page ID.
4. **Deja vacío** el campo *App Secret de tu propia app de Meta*.
5. Telegram: el cliente crea su bot y pega el token.
6. Cambia el **mensaje de derivación** en Configuración → IA por uno con los
   datos del cliente.

> Los nombres de pantallas de Meta (Business Manager, socios, System User)
> cambian con frecuencia; el sistema solo necesita los datos del paso 2 y 3.

---

## Modalidad 2: Empresa con su propia app de Meta (en tu instalación)

La empresa usa tu instalación pero **trae su propia app de Meta**. Por ejemplo,
porque ya tenía una, porque no quiere darte acceso a su WABA o porque es un
revendedor que gestiona varias marcas desde su cuenta de Meta.

### Lo que hace la empresa (o su técnico) en Meta for Developers

1. Crea su app con los productos WhatsApp y/o Messenger.
2. Configura los webhooks de **su** app apuntando a **tu** dominio (las mismas
   URL de la modalidad 1) con su propio Verify Token.
3. Copia su **App Secret** (Configuración de la app → Básica).
4. Tramita su verificación de negocio y su App Review.

### Lo que se llena en el sistema (cuenta de esa empresa)

| Pantalla | Campos |
|---|---|
| Configuración → WhatsApp | Phone Number ID, WABA ID, token permanente **de su app**, Verify Token, PIN y **App Secret de tu propia app de Meta** |
| Configuración → Messenger | Page ID, Page Access Token **de su app**, Verify Token y **App Secret de tu propia app de Meta** |
| Configuración → Telegram | Token de su bot |

Cuando el App Secret está guardado, el campo muestra "Guardado — déjalo vacío
para mantenerlo". El valor no vuelve a mostrarse. Para volver a la app de la
plataforma, pulsa **Usar la app de Meta de la plataforma** y guarda.

### Limitación de esta modalidad

Las **plantillas con imagen en el encabezado** se suben con `META_APP_ID`, que
es el ID de la app de la plataforma. Con la app propia de la empresa, Meta
puede rechazar esa subida. Solución: crear esas plantillas en el WhatsApp
Manager de Meta y traerlas con **Sincronizar plantillas**. Las plantillas de
solo texto funcionan normal.

---

## Modalidad 3: Revendedor con su propia instalación (licencia para revender)

El revendedor despliega **su propia copia** del sistema (su Vercel y su
Supabase) siguiendo [guia-local-y-produccion.md](guia-local-y-produccion.md).
Para el sistema es un operador nuevo:

1. Pone en **su** Vercel su `META_APP_SECRET`, su `ENCRYPTION_KEY` y el resto de variables.
2. Ejecuta todas las migraciones, de la `001` a la `038`.
3. Configura su marca y, a sus clientes, los conecta como en la **modalidad
   1** (con la app del revendedor) o la **modalidad 2** (cada cliente con su app).

Nada de tu instalación se comparte con la del revendedor.

---

## Resumen

| | Alquiler (tu app) | Empresa con app propia | Revendedor con instalación propia |
|---|---|---|---|
| ¿Quién crea la app de Meta? | Tú, una vez | La empresa | El revendedor |
| `META_APP_SECRET` (Vercel) | El de tu app | El de tu app (no lo usa esa empresa) | El de la app del revendedor |
| Campo *App Secret propio* | Vacío | App Secret de la empresa | Según cómo conecte a sus clientes |
| ¿Quién tramita App Review? | Tú | La empresa | El revendedor |
| Webhook (URL) | Tu dominio | Tu dominio | Dominio del revendedor |
| Telegram | Bot de cada empresa | Bot de cada empresa | Bot de cada empresa |
| Plantillas con imagen | Funcionan | Crearlas en Meta y sincronizar | Funcionan con su `META_APP_ID` |

## Si no llegan mensajes

En los logs del servidor (Vercel → Logs):

- `[webhook] rejected request with invalid signature` (WhatsApp) o
  `[meta-omni webhook] rejected request with invalid signature` (Messenger):
  la firma no coincide con `META_APP_SECRET` ni con el App Secret guardado
  para ese número o Página. Revisa que el App Secret pegado sea el de la app
  que tiene configurado el webhook, y que el número o la Página estén guardados
  en esa cuenta.
- `[meta-account-secrets] ... lookup failed`: falta ejecutar la migración `038`.
