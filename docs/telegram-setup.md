# Telegram — configuración

Telegram es el canal más fácil de conectar: **no requiere App Review de
Meta ni OAuth**. Solo necesitas un token de bot de @BotFather. wacrm
registra el webhook por ti automáticamente.

## Requisito previo

Telegram exige que el webhook sea una **URL pública HTTPS** (rechaza
`http://` y `localhost`). En producción normalmente ya la tienes. Si el
registro del webhook falla, define la variable de entorno:

```
NEXT_PUBLIC_SITE_URL=https://tu-dominio.com
```

(En desarrollo local necesitarías un túnel HTTPS como ngrok/cloudflared y
poner esa URL en `NEXT_PUBLIC_SITE_URL`.)

## Pasos

1. En Telegram, abre **@BotFather** → envía `/newbot` y sigue las
   instrucciones. Copia el **token** (algo como `123456789:ABCdef...`).
2. En wacrm: **Configuración → Telegram**, pega el token y pulsa
   **Guardar y conectar**.
3. wacrm valida el token (`getMe`), genera un secreto único y llama a
   `setWebhook` apuntando a `https://<tu-dominio>/api/telegram/webhook`.
4. Busca tu bot por su `@usuario` en Telegram y escríbele. El mensaje
   aparece en la bandeja con la etiqueta **TG** y la IA responde
   (si el auto-reply está activo para Telegram en Configuración → IA).

## Cómo funciona por dentro

- **Config:** tabla `telegram_config` (una fila por cuenta). El token se
  guarda cifrado (AES-256-GCM); el `secret_token` se guarda en claro
  porque es solo un secreto de webhook (no da acceso a la API de Telegram)
  y debe poder buscarse por valor.
- **Webhook** (`/api/telegram/webhook`): Telegram devuelve el
  `secret_token` en el header `X-Telegram-Bot-Api-Secret-Token`. Con él
  (a) autenticamos que la petición viene de Telegram y (b) enrutamos a la
  cuenta correcta. Luego pasa por la misma ingesta compartida
  (`ingest-core.ts`) que WhatsApp/Messenger.
- **Identidad:** el `chat.id` de Telegram se guarda como
  `contact_channel_identities.external_id` (channel `telegram`).
- **Envío** (`lib/telegram/send.ts`): resuelve el `chat.id` del contacto
  y el token del bot, y envía por `sendMessage`. Enganchado en
  `channels/router.ts`, así que la IA/automatizaciones responden por
  Telegram igual que por cualquier canal.

## Diagnóstico

Envía un mensaje a tu bot y mira los logs:

- `[telegram webhook] inbound text from chat <id> on bot @<user>` → llegó.
  Si no aparece: el webhook no quedó registrado (revisa
  `NEXT_PUBLIC_SITE_URL` / que sea HTTPS) o el token es inválido.
- Si llega pero no responde: revisa que **Configuración → IA → canales**
  tenga **Telegram** encendido, y busca `[ai auto-reply] dispatch
  failed: ...` en los logs.

## Límites de esta primera versión

- Solo texto plano (entrante y saliente). Sin fotos, stickers, botones
  inline ni comandos todavía.
- Un bot por cuenta.
