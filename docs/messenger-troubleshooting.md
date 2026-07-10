# Messenger no responde (pero WhatsApp sí) — diagnóstico

> Respuesta corta: **no es un bug del código.** El flujo de Messenger
> (webhook → IA → envío) es idéntico al de WhatsApp y está completo. La
> diferencia está en **las reglas de la plataforma de Meta**, que son
> distintas para WhatsApp y para Messenger.

## Por qué WhatsApp funciona sin verificar la app y Messenger no

| | WhatsApp Cloud API | Messenger (Facebook Page) |
|---|---|---|
| Mensajería en **modo desarrollo** | Funciona con tu número de prueba/negocio ya registrado, contra cualquier cliente. | **Solo** funciona con personas que tienen un **rol en la app** (Admin / Desarrollador / **Tester**). |
| Para atender al **público general** | Basta el acceso estándar. | Requiere **App Review** de Meta para el permiso `pages_messaging` (Acceso Avanzado). Puede tardar días. |
| Envío fuera de ventana | Ventana de 24 h + plantillas. | Ventana de 24 h + *message tags*. |

Traducción: con WhatsApp, Meta te deja hablar con clientes reales en
cuanto registras el número. Con **Messenger, en modo desarrollo Meta
bloquea** los mensajes hacia/desde cualquier persona que **no** tenga un
rol en tu app. Por eso "escribo desde mi perfil y no responde": si ese
perfil de Facebook **no está agregado como rol/tester** de la app, Meta:

1. puede **no entregar** el webhook de tu mensaje, o
2. entregarlo (la IA genera la respuesta) pero **rechazar el envío de
   vuelta** en la Send API con un error tipo `(#10)` o `(#200)
   pages_messaging`.

En ambos casos el cliente no ve nada.

## Por qué en Botpress "sí funciona" con "Connect with OAuth"

Ojo con la idea de que "Botpress no necesita App Review". **Sí la
necesita** — su propia documentación lo dice textualmente:

> *"The integration is configured, but will only work for admins,
> developers, and testers. To make it available for public use, make sure
> you submit it for review by Meta."*
> — [Botpress · Messenger and Facebook](https://botpress.com/docs/integrations/integration-guides/messenger)

Es decir: en Botpress **también** funciona solo para admins / testers
hasta que envíes la app a revisión de Meta. La razón por la que a ti "te
funcionó" en Botpress es que:

1. Estabas escribiendo **desde tu propio perfil, que es admin/tester** de
   esa conexión (justo el caso que Meta permite sin review).
2. El botón "**Authorize Messenger**" (OAuth) hace por ti la parte que es
   fácil equivocar a mano: **suscribe el webhook al campo `messages`,
   suscribe la Página a la app y coloca los permisos correctos**
   automáticamente.

En wacrm te conectas con **tu propia app de Meta** y ese cableado lo haces
a mano (Callback URL + Verify Token + suscribir `messages` + suscribir la
Página). Si falta cualquiera de esos pasos, o tu perfil no es rol/tester
de la app, Messenger no responde — aunque el token diga "Conectado".

**Conclusión:** no es que Botpress se salte la revisión; es que
(a) automatiza la configuración del webhook y (b) tú probabas como
admin/tester. Para el público, ambas plataformas requieren App Review de
`pages_messaging`. Con los pasos 1–3 de abajo, wacrm te responderá **hoy**
igual que Botpress mientras pruebas con tu perfil.

## Checklist para dejar Messenger 100% funcional

Sigue en orden. Los pasos 1–3 hacen que funcione **hoy** para pruebas; el
paso 4 lo abre al público.

1. **¿Están WhatsApp y Messenger en la MISMA app de Meta?**
   La firma del webhook se valida con un único `META_APP_SECRET`. Si tu
   Página vive en una app distinta a la de tu número de WhatsApp, **todos**
   los eventos de Messenger se rechazan por firma inválida antes de llegar
   a la IA. En los logs verás:
   `[meta-omni webhook] rejected request with invalid signature`.
   → Solución: usa una sola app de Meta para ambos productos, o pon en
   `META_APP_SECRET` el App Secret de la app que tiene la Página.

2. **¿La Página está suscrita al campo `messages`?**
   Meta App → Messenger → Settings → Webhooks: la Callback URL debe ser
   `https://<tu-dominio>/api/webhooks/meta-omni`, con tu Verify Token, y la
   Página **suscrita al campo `messages`**. Sin esto, tu mensaje nunca
   llega. Con esto, al escribir verás en los logs:
   `[meta-omni webhook] inbound Messenger text from PSID ... on page ...`.

3. **Agrega tu perfil como Tester de la app** (para probar en modo
   desarrollo): Meta App → App Roles / Roles → agrega tu cuenta de
   Facebook como **Tester** (y acepta la invitación desde tu perfil).
   Luego escribe a la Página desde ese perfil.

4. **Para atender al público (producción):** solicita **App Review** del
   permiso `pages_messaging` y pon la app en modo **Live**. Hasta que Meta
   lo apruebe, Messenger solo responderá a roles/testers de tu app.

5. **La IA debe tener Messenger habilitado:** Ajustes → IA → "Canales con
   respuesta automática" → **Messenger encendido** (por defecto lo está).

## Cómo leer los logs para saber dónde falla

Envía un mensaje a la Página y mira los logs del servidor:

- **No aparece** `inbound Messenger text ...` →
  el evento no llegó. Es el paso 1 o 2 (firma / suscripción del webhook).
- **Aparece** `inbound Messenger text ...` pero no llega respuesta →
  el problema es de salida. Busca `[ai auto-reply] dispatch failed: ...`
  o `Messenger API error: ...` — ahí Meta te dice el motivo exacto
  (normalmente falta de permiso `pages_messaging` / fuera de ventana =
  paso 3 o 4).

## Nota sobre el estado en Configuración

El "Probar conexión" de Messenger valida el **Page Access Token** contra
Meta (que el token sea válido y de esa Página). Eso puede decir
"Conectado" aunque el **envío al cliente** aún esté bloqueado por App
Review — son cosas distintas: una es *credenciales válidas*, la otra es
*permiso para mensajear al público*.
