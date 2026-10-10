# Negocios a los que ofrecerlo

**Tipo de proyecto:** producto genérico para vender o alquilar a varios
negocios. Lo indican el código y el historial de git: cada registro crea una
empresa aislada (*trigger* `handle_new_user`, RLS por `account_id`), hay marca
blanca por empresa (migración `037`, commit `491d434`) y la configuración de
canales e IA es por cuenta. No hay lógica atada a un rubro concreto.

Precios y planes → [valoracion-comercial.md](valoracion-comercial.md) (sección 8.1 para el alquiler y sección 14 para los módulos adicionales).
Qué hace cada módulo → [DOCUMENTACION.md](DOCUMENTACION.md).

---

## 1. Argumentos de venta

Cada argumento corresponde a algo que ya existe en el código.

| Argumento | En qué se apoya |
|---|---|
| **Un solo número de WhatsApp para todo el equipo** | Bandeja compartida en tiempo real, asignación de conversaciones, notas internas, 4 roles |
| **Responde solo, 24/7, con la información del negocio** | Auto-respuesta con IA que consulta la base de conocimiento (PDF, textos, Google Sheets) y no inventa precios ni datos que no estén ahí |
| **Pasa a una persona cuando hace falta** | Derivación automática: avisa al cliente, apaga la IA en esa conversación y notifica al equipo (también por WhatsApp a un número de aviso) |
| **El cliente paga su propia IA** | Clave propia (OpenAI, Anthropic, DeepSeek, Gemini o Z.ai), sin recargo por usuario |
| **Envíos masivos oficiales** | Difusiones con plantillas aprobadas por Meta a miles de contactos, con estado enviado/entregado/leído y exportación de resultados |
| **Embudo de ventas visible** | Kanban de negocios con valor en soles, enlazado a la conversación |
| **Menús automáticos sin programar** | Flujos con botones y listas, y automatizaciones con 7 disparadores y 11 acciones |
| **Con la marca del cliente** | Nombre, logo y colores propios en el panel |
| **Importa su Excel tal como lo tiene** | Importación CSV que acepta `;`, tildes y encabezados en español, y agrega el +51 |
| **Se conecta con otros sistemas** | API REST y webhooks salientes firmados |
| **WhatsApp oficial, no "pirata"** | Usa la API oficial de Meta (Cloud API), no automatiza WhatsApp Web |

---

## 2. Negocios que pueden usarlo tal como está

Encajan los que **venden o atienden por WhatsApp**, reciben **preguntas
repetidas** que se responden con información fija y tienen **más de una persona
atendiendo**.

| Rubro | Para qué lo usaría | Módulos clave |
|---|---|---|
| Academias, institutos, colegios particulares | Informes de cursos, precios y horarios; campañas de matrícula | IA + base de conocimiento, difusiones, embudo |
| Inmobiliarias | Calificar interesados, enviar fichas, seguir cada operación | Flujos de calificación, embudo, asignación |
| Concesionarios y venta de vehículos o maquinaria | Consultas de modelos y precios, seguimiento de cotizaciones | IA con catálogo en Google Sheets, embudo |
| Agencias de viajes y turismo | Paquetes, fechas, precios; promociones por temporada | Base de conocimiento, difusiones con plantillas |
| Tiendas con catálogo (sin integración de stock) | Preguntas de productos, precios y envíos | IA con catálogo en Google Sheets, etiquetas |
| Servicios técnicos e instaladores | Recibir pedidos, asignar técnico, cerrar el caso | Asignación, estados, automatizaciones |
| Gimnasios y centros deportivos | Planes, horarios, renovaciones | Difusiones, automatizaciones, IA |
| Agencias de marketing | Atender a varios clientes con la marca de cada uno | Multiempresa y marca blanca |
| Empresas de servicios B2B | Seguimiento comercial de cuentas | Embudo, notas, API para su CRM o ERP |

---

## 3. Negocios que necesitan un módulo adicional

Precios en [valoracion-comercial.md § 14](valoracion-comercial.md#14-costo-por-módulo-adicional-funciones-que-se-pueden-pedir).

| Rubro | Qué les falta | Módulo |
|---|---|---|
| Clínicas, consultorios, odontología, veterinarias, spas y salones | Reservar y recordar citas | Agenda de citas |
| Tiendas online con stock real | Consultar stock y pedidos en su sistema | Integración con e-commerce o ERP |
| Restaurantes y *delivery* | Tomar pedidos con un catálogo | Integración con e-commerce o ERP (o su sistema de pedidos) |
| Marcas que venden sobre todo por Instagram (moda, belleza) | El canal Instagram | Instagram Direct |
| Negocios que necesitan enviar fotos o archivos por Facebook o Telegram | Adjuntos en esos canales | Adjuntos en Messenger y Telegram |
| Empresas con campañas grandes y frecuentes | Que la difusión no dependa del navegador abierto | Cola de difusiones en el servidor |
| Negocios fuera del Perú o con equipo de habla inglesa | Interfaz en otro idioma | Selector de idioma |
| Quien quiera revender accesos con cobro automático | Planes y suscripciones | Cobro automático y planes, límites por plan |

---

## 4. Negocios a los que no conviene ofrecerlo

| Caso | Por qué |
|---|---|
| Negocios muy pequeños, con una sola persona y pocos mensajes al día | El plan mensual, la verificación de Meta y el costo de las plantillas pesan más que el beneficio; les basta la app de WhatsApp Business |
| Bancos, aseguradoras y salud con historia clínica | No hay auditoría de seguridad independiente, la CSP no está en modo de bloqueo y no hay registro de auditoría; suelen exigir certificaciones |
| Call centers que necesitan llamadas de voz | El sistema solo maneja mensajes |
| Quien quiere enviar publicidad a listas compradas | Meta exige plantillas aprobadas y castiga la calidad del número; el sistema no evita ese riesgo |
| Negocios cuyo canal principal es Instagram | Instagram no funciona hoy |
| Empresas que exigen alta disponibilidad con varios servidores | El límite de peticiones es en memoria y no hay colas ni monitoreo |

---

## 5. Guion de visita (15–20 minutos)

**Antes de la visita**

- Revisar si el negocio usa WhatsApp para vender y cuántas personas atienden.
- Preparar una cuenta demo con su nombre, logo y colores (Configuración → Empresa y marca) y 5–10 preguntas reales del rubro en la base de conocimiento.
- Cambiar el mensaje de derivación de la demo por uno con sus datos.

**1. Diagnóstico (3 min).** Preguntar:
- ¿Cuántos mensajes de WhatsApp reciben al día y quién los contesta?
- ¿Qué preguntas se repiten todo el tiempo?
- ¿Qué pasa con los mensajes que llegan de noche o en fin de semana?
- ¿Cómo saben en qué etapa está cada cliente?

**2. Demostración (8 min).** Siempre con su marca:
1. Escribir desde un celular al número de la demo una de sus preguntas frecuentes → la IA responde con su información.
2. Pedir “hablar con una persona” → mostrar la derivación y la notificación al equipo.
3. Abrir la bandeja: asignar la conversación a un vendedor y dejar una nota interna.
4. Mover al cliente en el embudo de ventas.
5. Mostrar una difusión con plantilla y sus estados de entrega y lectura.
6. Importar su Excel de contactos.

**3. Cierre (4 min).**
- Proponer el plan según el tamaño del equipo (planes en [valoracion-comercial.md § 8.1](valoracion-comercial.md#81-planes-sugeridos-para-perú-precios-en-soles-igv-aparte)) más la implementación inicial.
- Explicar los costos que paga el cliente directamente: su clave de IA y las conversaciones de plantilla que cobra Meta.
- Ofrecer un piloto de 2 semanas con su número.

**Respuestas a objeciones frecuentes**

| Objeción | Respuesta |
|---|---|
| “¿Y si la IA responde algo incorrecto?” | Solo responde con la información que ustedes cargan; si no la tiene, deriva a una persona. Se puede probar antes en el *playground* y limitar cuántas respuestas da por conversación. |
| “¿Me pueden bloquear el número?” | Usa la API oficial de Meta, no WhatsApp Web. El riesgo depende de enviar plantillas a personas que no las pidieron. |
| “Ya uso WhatsApp Business en el celular” | Con el sistema todo el equipo atiende el mismo número desde la computadora, con historial, asignación y métricas. |
| “¿Funciona con Facebook e Instagram?” | Facebook Messenger y Telegram sí: responde la IA y tu equipo puede contestar desde la misma bandeja (solo texto). Instagram todavía no. |
| “¿Mis datos quedan con ustedes?” | Cada empresa tiene su espacio aislado; las claves se guardan cifradas. Si lo prefiere, se instala en su propio servidor (licencia). |

**Lo que no hay que prometer:** Instagram, fotos o archivos en Messenger o
Telegram, agenda de citas, conexión con stock o pedidos, ni cobro automático.
Todo eso es un módulo adicional.
