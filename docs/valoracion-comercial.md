# Valoración comercial de AgenteVentasTed / wacrm

**Fecha de evaluación:** 8 de octubre de 2026 (actualización; versión anterior: 1 de octubre de 2026)  
**Versión observada:** 0.7.0 + mejoras de marca blanca, flujos y difusiones  
**Moneda de referencia:** USD y soles peruanos (PEN)  
**Tipo de evaluación:** valoración técnica y comercial preliminar basada en el código disponible, la documentación y la arquitectura visible del proyecto.

> **Actualización 8-oct-2026:** desde la versión anterior se añadieron marca blanca por cuenta (nombre, logo y colores), Flujos en producción (sin etiqueta Beta), difusiones masivas corregidas para miles de contactos, importación CSV robusta con plantilla descargable, interfaz en español y soles (PEN). Estas mejoras **suben el valor de la entrega profesional** (rango B) y, sobre todo, **habilitan vender accesos mensuales** a varias empresas desde una sola instalación (sección 8). El valor del código por sí solo cambia poco, porque sigue sin haber clientes ni ingresos demostrables.
>
> **Conclusión ejecutiva revisada:** considerando que el proyecto base es público, tiene licencia MIT y continúa recibiendo actualizaciones, no corresponde valorar todo el CRM como si fuera desarrollo original. Una valoración conservadora del trabajo propio, sin clientes ni ingresos demostrables, es de **US$3,000 a US$10,000** (**S/11,400 a S/38,000**, usando una referencia de S/3.80 por dólar). Con instalación, personalización, capacitación y soporte, el paquete puede defenderse entre **US$7,000 y US$16,000** (**S/26,600 y S/60,800**). Los rangos más altos solo tendrían sentido con clientes, métricas o una cesión exclusiva claramente delimitada.

Los rangos son orientativos. El precio final depende especialmente de:

- si se vende el código, una licencia, una implementación o un SaaS;
- si se entregan derechos exclusivos sobre las mejoras;
- existencia de clientes activos, ingresos y casos de éxito;
- calidad del despliegue y de la transferencia técnica;
- estabilidad real de los canales y de las integraciones;
- claridad sobre la licencia del proyecto base y de sus dependencias.

## 1. Resumen del activo que se está valorando

El sistema observado es una plataforma CRM omnicanal self-hostable construida con:

- Next.js 16 y App Router;
- React 19 y TypeScript;
- Supabase para PostgreSQL, autenticación, storage, RLS y realtime;
- API oficial de WhatsApp Business de Meta;
- Messenger y Telegram como canales activos;
- base de conocimiento para IA;
- búsqueda full-text y búsqueda semántica con pgvector;
- carga de archivos `.pdf`, `.md`, `.markdown` y `.txt`;
- sincronización bajo demanda con Google Sheets;
- API REST pública;
- automatizaciones y flujos conversacionales;
- control de equipos, roles y permisos;
- cifrado AES-256-GCM para credenciales almacenadas;
- pruebas automatizadas para varias partes críticas;
- documentación técnica de despliegue, canales, API y base de conocimiento.

No se observó evidencia de métricas de producción, cantidad de clientes, MRR, churn, volumen de conversaciones, SLA, auditoría externa de seguridad o contrato de soporte. Por eso esta valoración es principalmente de **reemplazo técnico, madurez de producto y capacidad de implementación**, no de múltiplo financiero sobre ingresos.

## 1.1. Corrección importante: valor del proyecto base frente a valor propio

El repositorio original de [ArnasDon/wacrm](https://github.com/ArnasDon/wacrm) se presenta como una plantilla CRM self-hostable, está publicado bajo MIT y recomienda explícitamente hacer fork, cambiar la marca, desplegar y personalizar. Además, el repositorio original continúa activo, por lo que un comprador puede obtener gratuitamente la base y también recibir actualizaciones upstream.

Por eso conviene separar tres valores:

| Componente | ¿Debe cobrarse como desarrollo propio? | Tratamiento recomendado |
|---|---|---|
| CRM base, bandeja, contactos, pipelines y automatizaciones que ya existían | No completamente | Reconocerlo como open source y no venderlo como autoría exclusiva |
| Mejoras realizadas después del fork | Sí, si fueron desarrolladas por ti | Valorar horas, complejidad, pruebas e integración |
| Instalación, configuración, adaptación, soporte y conocimiento de negocio | Sí | Cobrarlo como servicio de implementación |

La respuesta correcta ante un comprador sería:

> “La base es un proyecto open source con licencia MIT. No estoy cobrando por apropiarme de esa base; estoy cobrando por las integraciones, adaptaciones, pruebas, configuración y mejoras que desarrollé encima de ella, además de la puesta en producción y la transferencia.”

No conviene afirmar que toda la plataforma fue creada desde cero. Eso debilitaría la negociación si el comprador compara el repositorio con GitHub.

## 2. Funcionalidades verificables

### 2.1 CRM y operación comercial

La plataforma incluye:

- bandeja compartida para equipos;
- conversaciones, estados y asignaciones;
- contactos, etiquetas y campos personalizados;
- importación CSV y deduplicación;
- notas internas;
- pipelines de ventas tipo Kanban;
- negocios vinculados a contactos y conversaciones;
- métricas operativas del dashboard;
- notificaciones;
- roles de owner, admin, agent y viewer;
- invitaciones de miembros y transferencia de ownership.

Esto permite posicionar el producto como un CRM de atención y ventas, no únicamente como un conector de WhatsApp.

### 2.2 WhatsApp Business

La integración cubre, según la documentación y las rutas observadas:

- conexión con Meta Cloud API;
- recepción mediante webhook;
- envío de texto y medios;
- plantillas aprobadas;
- sincronización y envío de plantillas;
- broadcasts;
- seguimiento de enviado, entregado, leído y fallido;
- reacciones;
- verificación de firma HMAC del webhook;
- registro de conversaciones y contactos;
- flows con botones interactivos.

WhatsApp es el canal con mayor profundidad funcional y debe ser el centro de la propuesta comercial.

### 2.3 Canales adicionales

El proyecto ya tiene una arquitectura de canal compartida:

- cada conversación y mensaje mantiene un canal;
- existe una tabla de identidades por canal;
- la ingesta común resuelve contactos, conversaciones, persistencia y despacho;
- el router selecciona el sender correcto según el canal;
- la IA y las automatizaciones reutilizan el mismo núcleo.

Canales identificados:

| Canal | Estado observado | Comentario comercial |
|---|---|---|
| WhatsApp | Activo y más completo | Principal diferenciador operativo |
| Messenger | Activo | Primer alcance centrado en texto |
| Telegram | Activo | Configuración por bot y webhook automático |
| Instagram | Fundación preparada | No se observó un adaptador/webhook completo |

Es importante no vender Instagram como integración terminada. La documentación indica que comparte la base, pero todavía necesita webhook/adaptador y puede requerir App Review de Meta.

### 2.4 Inteligencia artificial

La IA es una de las partes con mayor valor comercial:

- cinco proveedores documentados: OpenAI, Anthropic, DeepSeek, Gemini y Z.ai;
- modalidad BYOK, donde cada cuenta usa su propia clave;
- redacción asistida dentro de la bandeja;
- auto-reply;
- handoff a un agente humano;
- playground para probar respuestas;
- límite de respuestas por conversación;
- activación general de la IA;
- activación independiente por canal;
- contexto de mensajes recientes;
- configuración de modelo y proveedor;
- clave separada para embeddings.

El soporte multi-proveedor reduce dependencia de un único proveedor y permite adaptar el costo de inferencia a cada cliente.

### 2.5 Base de conocimiento y RAG

Se observan tres fuentes de conocimiento:

1. texto manual;
2. carga de archivos;
3. Google Sheets.

Los archivos soportados son:

- Markdown;
- texto plano;
- PDF con capa de texto.

El flujo documentado es:

1. cargar o sincronizar el contenido;
2. fragmentarlo;
3. generar embeddings cuando existe una clave compatible;
4. guardar los vectores en PostgreSQL/pgvector;
5. recuperar fragmentos relevantes;
6. incluirlos en el contexto de la respuesta de IA.

La búsqueda puede funcionar mediante:

- búsqueda semántica con embeddings;
- búsqueda full-text de PostgreSQL cuando no se configura embeddings.

Esta capacidad convierte el sistema en una herramienta adaptable a catálogos, políticas, FAQs, manuales y documentación interna de cada empresa.

### 2.6 Google Sheets

La integración con Google Sheets:

- usa una cuenta de servicio;
- almacena la configuración cifrada;
- permite indicar spreadsheet ID o URL;
- permite seleccionar hoja o rango;
- trata la primera fila como encabezados;
- transforma cada fila en contenido consultable;
- permite sincronización bajo demanda;
- conserva el último contenido sincronizado si se desconecta la cuenta.

Limitaciones que deben comunicarse al comprador:

- no se observó sincronización automática por cron;
- se requiere configurar Google Cloud y compartir la hoja con el service account;
- la sincronización es manual;
- no es una integración OAuth completa para usuarios finales.

### 2.7 API y extensibilidad

La API pública documentada incluye:

- autenticación por API key;
- scopes;
- revocación;
- endpoints para mensajes, contactos, conversaciones y broadcasts;
- webhooks salientes;
- envelope consistente de respuestas;
- rate limit documentado;
- endpoint para verificar la cuenta y los permisos.

La API permite vender el producto como infraestructura para integrarse con ERP, ecommerce, formularios, bots externos o sistemas internos del cliente.

### 2.8 Seguridad y multi-tenancy

Se observan mecanismos relevantes:

- Row Level Security en Supabase;
- roles y permisos por cuenta;
- cifrado AES-256-GCM para credenciales;
- HMAC-SHA256 para webhooks de Meta;
- claves API almacenadas como hash;
- tokens de invitación de un solo uso;
- rate limiting;
- headers de seguridad;
- aislamiento por `account_id`.

Esto mejora el valor frente a una demo o prototipo. Sin embargo, estas medidas no sustituyen una auditoría de seguridad independiente.

## 3. Qué agregaste frente a la base open source

La diferencia comercial no debe comunicarse como “un fork con algunos cambios”. Debe presentarse como una capa de producto y de integración encima de una base open source.

Las mejoras de mayor valor aparente son:

### 3.1 Evolución a omnicanal

La base estaba orientada principalmente a WhatsApp. Las modificaciones incorporan:

- Messenger;
- Telegram;
- modelo de identidad por canal;
- router de envío;
- ingesta compartida;
- toggles de IA por canal;
- configuración independiente de canales.

Esto amplía el mercado objetivo y evita que el cliente quede atado a un único canal.

### 3.2 IA conectada a fuentes reales de negocio

No solo se añadió un chat con un modelo. Se integró:

- base de conocimiento;
- extracción de texto de PDF;
- indexación;
- embeddings;
- recuperación semántica;
- fallback a búsqueda full-text;
- Google Sheets como fuente;
- auto-reply;
- handoff a humano.

La combinación es más valiosa que cada funcionalidad aislada.

### 3.3 Configuración operativa

La posibilidad de activar o desactivar IA por canal es importante para producción. Permite, por ejemplo:

- mantener IA activa en WhatsApp;
- dejar Messenger solo para atención humana;
- pausar Telegram;
- usar “Draft with AI” sin permitir respuestas automáticas.

Es una señal de que el proyecto considera control operativo y no únicamente una demo.

### 3.4 Documentación y mantenibilidad

Se observan documentos específicos para:

- despliegue;
- canales;
- Telegram;
- base de conocimiento;
- Google Sheets;
- API pública;
- contribución;
- CI.

La documentación reduce el costo de transferencia y hace más fácil vender una implementación a terceros.

### 3.5 Mejoras de la actualización de octubre de 2026

| Mejora | Por qué sube el valor |
|---|---|
| **Marca blanca por cuenta** (Configuración → Empresa y marca): nombre, logo, color principal y secundario, tema "Color de la empresa" aplicado a todo el equipo | Permite revender la plataforma con la marca de cada cliente; antes mostraba "CRM Template for WhatsApp". Es el requisito básico para vender accesos. |
| **11 temas de color** (incluye Verde TED y Dorado) | Personalización inmediata sin tocar código. |
| **Flujos en producción**: se quitó "Beta", cierre automático de flujos abandonados aunque no haya cron, y los flujos ya no "capturan" mensajes de Messenger/Telegram (donde no pueden responder) | Antes un contacto podía quedar atrapado en un flujo sin recibir respuesta de la IA. |
| **Difusiones masivas corregidas** | Se corrigieron tres fallos: (1) el límite de 5 solicitudes/min marcaba como fallidos los envíos después de ~50 contactos; (2) las audiencias se cortaban en 1,000 contactos; (3) la audiencia por CSV no tenía botón para subir el archivo. Ahora soporta miles de destinatarios, con reintento automático. |
| **Importación CSV robusta** | Acepta archivos de Excel en español (separados por `;`, con BOM, encabezados como "teléfono" o "nombre"), agrega el código de país (+51 por defecto), muestra las filas con error y su línea, y ofrece una plantilla descargable. |
| **Interfaz en español** y moneda **PEN (S/)** | Producto listo para el mercado peruano; mensajes de error y validaciones traducidos. |
| **Seguridad** | Los observadores (rol *viewer*) ya no pueden lanzar difusiones por API; colores y logo se validan en base de datos (hex estricto, solo URLs https) para evitar inyección. |
| **Guía de despliegue** (`docs/guia-local-y-produccion.md`) | Reduce el costo de transferencia a un comprador o a un técnico nuevo. |

## 4. Nivel de madurez estimado

### Fortalezas

- arquitectura moderna y tipada;
- separación razonable entre canales y núcleo de ingesta;
- persistencia multi-tenant;
- RLS y roles;
- integraciones de alto valor comercial;
- pruebas unitarias en módulos críticos;
- pipeline de CI que contempla lint, typecheck, tests y build;
- documentación técnica superior a la de un prototipo típico;
- posibilidad de self-hosting;
- API pública y extensibilidad.

### Aspectos que reducen el precio

- no se aportaron métricas de usuarios o ingresos;
- Messenger y Telegram tienen limitaciones de formato;
- Instagram no está terminado como canal operativo;
- Telegram está limitado a texto;
- Google Sheets sincroniza bajo demanda, no en tiempo real;
- PDF escaneado o basado solo en imágenes no se procesa mediante OCR;
- rate limiting en memoria no es suficiente para despliegues multi-instancia;
- flows funciona solo por WhatsApp (en Messenger/Telegram se omite y responde la IA);
- no hay cobro automático (billing): vender accesos requiere facturar manualmente;
- Meta App Review y configuración externa siguen siendo responsabilidad del comprador;
- no se observó evidencia de observabilidad completa, colas, reintentos distribuidos o SLA;
- el proyecto depende de servicios externos cuyos costos y políticas pueden cambiar;
- no se observó una suite E2E completa contra Meta, Telegram y Google en un ambiente de producción;
- el valor puede disminuir si la personalización no está separada claramente del código upstream.

## 5. Consideración legal sobre la base open source

La documentación del proyecto base identifica una licencia MIT y recomienda conservar el archivo `LICENSE`. Esto normalmente permite usar, modificar y comercializar el software, pero hay que revisar el archivo de licencia que se entregará al comprador.

La implicación comercial es importante:

- no es correcto vender como “propiedad exclusiva de todo el código” un proyecto que contiene una base MIT de terceros;
- sí se puede vender una implementación, una licencia comercial de las mejoras propias, soporte, configuración, marca, documentación y know-how;
- las partes originales y sus obligaciones de atribución deben mantenerse según la licencia aplicable;
- las dependencias tienen licencias propias que deben revisarse;
- si se promete exclusividad, debe delimitarse a los módulos, código y documentación desarrollados por el vendedor;
- antes de firmar una venta total, conviene hacer un inventario de commits, autores, dependencias y licencias.

Una redacción comercial más segura sería:

> “Se transfiere el código propio, las adaptaciones, integraciones, documentación y activos de despliegue desarrollados para la solución, sujeto a las licencias de terceros aplicables. La base open source conserva sus derechos y obligaciones originales.”

## 6. Escenarios de venta y precios

Conversión de referencia utilizada:

> **US$1 = S/3.80**

El comprador debe recalcular el equivalente en soles con el tipo de cambio vigente al momento del pago.

### Escenario A: venta del código tal como está

Incluye:

- repositorio;
- migraciones;
- documentación existente;
- instrucciones básicas de despliegue;
- una sesión de transferencia;
- sin personalización profunda;
- sin garantía prolongada.

**Rango defendible:**

| Precio USD | Equivalente aproximado |
|---:|---:|
| US$3,000 - US$8,000 | S/11,400 - S/30,400 |

Este escenario es el menos favorable porque el comprador asume la validación, el despliegue y la adaptación.

### Escenario B: licencia comercial no exclusiva

Incluye:

- uso del sistema por el comprador;
- derecho a desplegarlo para su propia operación;
- documentación;
- configuración inicial;
- correcciones menores;
- soporte limitado.

**Rango defendible:**

| Precio USD | Equivalente aproximado |
|---:|---:|
| US$6,000 - US$15,000 | S/22,800 - S/57,000 |

Es una buena opción si se quiere vender a varios clientes sin perder la posibilidad de seguir explotando el producto.

### Escenario C: venta del activo técnico completo con entrega y transferencia

Incluye:

- código propio y personalizaciones;
- migraciones;
- configuración de Supabase;
- configuración de variables;
- conexión inicial de canales;
- configuración de IA;
- carga de una base de conocimiento;
- configuración de Google Sheets;
- capacitación;
- documentación final;
- soporte de 30 a 60 días.

**Rango recomendado para negociar:**

| Precio USD | Equivalente aproximado |
|---:|---:|
| US$12,000 - US$25,000 | S/45,600 - S/95,000 |

Este es el escenario más razonable si el comprador quiere operar la plataforma y no solamente revisar el repositorio.

### Escenario D: implementación para una empresa

Incluye:

- descubrimiento de procesos;
- branding;
- configuración de Meta y canales;
- adaptación de campos y pipelines;
- carga de documentos;
- automatizaciones;
- pruebas con usuarios;
- capacitación;
- soporte post-lanzamiento.

**Rango recomendado:**

| Precio USD | Equivalente aproximado |
|---:|---:|
| US$15,000 - US$35,000 | S/57,000 - S/133,000 |

Este precio no es solamente por el código. Incluye consultoría, riesgo de integración, puesta en producción y responsabilidad de entrega.

### Escenario E: venta exclusiva de los derechos sobre las mejoras propias

Solo debe ofrecerse si se puede demostrar qué partes fueron desarrolladas por el vendedor y qué partes pertenecen a la base o a terceros.

**Rango orientativo:**

| Precio USD | Equivalente aproximado |
|---:|---:|
| US$18,000 - US$40,000 | S/68,400 - S/152,000 |

La exclusividad reduce la posibilidad de vender la solución a futuros clientes, por lo que debe cobrarse significativamente más que una licencia no exclusiva.

## 7. Recomendación de precio para tu situación actual

Con la información disponible y sin métricas de clientes o ingresos, recomendaría presentar una oferta inicial así:

### Oferta principal recomendada (venta única con entrega profesional)

**US$10,000 a US$16,000**  
**S/38,000 a S/60,800**

> Nota de coherencia: la versión anterior recomendaba US$15,000–18,000 aquí, por encima de su propio veredicto final (US$6,000–15,000). Se ajusta a un rango consistente con la sección 12: la parte alta solo se justifica con instalación, canales configurados y soporte incluidos.

Incluye:

- código y migraciones;
- documentación;
- instalación en el entorno del comprador;
- configuración de Supabase;
- configuración de WhatsApp y un canal adicional;
- configuración de IA;
- configuración de una fuente de conocimiento;
- una capacitación técnica y otra operativa;
- 45 días de soporte correctivo;
- sin prometer exclusividad sobre la base open source.

### Precio mínimo sugerido

**US$8,000**  
**S/30,400**

Por debajo de ese precio se estaría vendiendo una plataforma con demasiadas capacidades por el valor de una personalización pequeña, salvo que sea una venta rápida, sin soporte y sin responsabilidad de producción.

### Precio objetivo si existen clientes o pilotos demostrables

**US$25,000 a US$50,000**  
**S/95,000 a S/190,000**

Este rango requiere evidencia adicional, por ejemplo:

- clientes activos;
- conversaciones procesadas;
- reducción del tiempo de respuesta;
- leads atendidos por IA;
- conversiones;
- ingresos mensuales;
- retención;
- casos de éxito;
- despliegues repetibles.

## 8. Vender accesos (SaaS) en lugar de vender el código

Con la marca blanca por cuenta, una sola instalación puede atender a varias
empresas: cada empresa se registra, obtiene su propio espacio aislado (RLS por
`account_id`), conecta **su** número de WhatsApp, su bot de Telegram y su clave
de IA, y ve su propio nombre, logo y colores. Esto convierte el proyecto en un
producto con ingresos recurrentes, que vale más que una venta única.

### 8.1 Planes sugeridos para Perú (precios en soles, IGV aparte)

| Plan | Precio mensual | Incluye | Cliente típico |
|---|---:|---|---|
| **Básico** | S/149 – S/199 | 1 número de WhatsApp, 3 usuarios, contactos y bandeja, importación CSV, difusiones, IA con la clave del cliente | Academia, consultorio, tienda pequeña |
| **Profesional** | S/349 – S/499 | Todo lo anterior + Messenger y Telegram, flujos, automatizaciones, base de conocimiento, 10 usuarios, marca propia | Academias medianas, inmobiliarias, clínicas |
| **Empresa** | S/899 – S/1,500 | Usuarios ilimitados, API, configuración asistida, soporte prioritario, capacitación mensual | Empresas con equipo comercial |

Cobros adicionales recomendados:

- **Implementación inicial (pago único):** S/600 – S/2,500 (conectar Meta, cargar
  contactos, crear plantillas, flujos y base de conocimiento).
- **Gestión de IA incluida:** si el cliente no quiere su propia clave, cobrar el
  consumo con margen (por ejemplo, paquete de S/50 – S/150 al mes).
- **Horas de personalización:** S/120 – S/250 por hora.
- **Costos de Meta (conversaciones de plantilla):** se trasladan al cliente; Meta
  los cobra directamente a su cuenta de WhatsApp Business.

### 8.2 Cuánto podría valer como SaaS

Una referencia simple para un SaaS pequeño es entre **1 y 3 veces los ingresos
anuales** (ARR), según crecimiento y retención. Ejemplos ilustrativos:

| Clientes | Ingreso mensual (≈ S/350 promedio) | Ingreso anual | Valor orientativo (1×–3× ARR) |
|---:|---:|---:|---:|
| 10 | S/3,500 | S/42,000 | S/42,000 – S/126,000 |
| 30 | S/10,500 | S/126,000 | S/126,000 – S/378,000 |
| 60 | S/21,000 | S/252,000 | S/252,000 – S/756,000 |

Con apenas 10–15 clientes pagando de forma estable, el negocio de accesos ya
supera el precio de vender el código una sola vez.

### 8.3 Qué falta para vender accesos con tranquilidad

| Pendiente | Impacto | Solución práctica mientras tanto |
|---|---|---|
| Cobro automático (billing) | Alto | Cobrar por transferencia/Yape y suspender manualmente a quien no pague |
| Límite de usuarios por plan | Medio | Controlarlo manualmente desde Miembros del equipo |
| Rate limiting compartido entre instancias | Medio con mucho tráfico | Vercel con una sola región basta al inicio |
| Términos de servicio y política de privacidad | Alto (legal) | Redactarlos antes del primer cliente |
| Respaldo de base de datos | Alto | Plan de pago de Supabase con backups diarios |
| Cada cliente debe completar la verificación de Meta | Medio | Incluirlo en la implementación inicial |

### 8.4 ¿Vender el código o vender accesos?

| Opción | Ventaja | Desventaja | Recomendación |
|---|---|---|---|
| Venta única del código | Dinero inmediato (US$3k–16k) | Pierdes el producto o lo compartes con un competidor | Solo si necesitas liquidez |
| Licencia no exclusiva + instalación | Ingreso por cada cliente grande | Mucho trabajo por venta | Para empresas que exigen su propio servidor |
| **Accesos mensuales (SaaS)** | Ingreso recurrente, el valor crece con cada cliente | Requiere soporte continuo | **Recomendado** como modelo principal |

## 9. Cómo justificar el precio ante un comprador

La conversación no debe centrarse en “cuántas líneas de código tiene”. Debe centrarse en costo evitado y tiempo ahorrado:

1. **Tiempo de desarrollo evitado:** el comprador obtiene una base operativa en lugar de iniciar desde cero.
2. **Riesgo de integraciones:** Meta, webhooks, autenticación, RLS, cifrado y múltiples canales ya tienen una implementación.
3. **Capacidad omnicanal:** el cliente no depende exclusivamente de WhatsApp.
4. **IA con información del negocio:** PDF, texto y Sheets pueden alimentar respuestas contextualizadas.
5. **Control humano:** handoff, drafts y toggles por canal reducen el riesgo de automatización ciega.
6. **Extensibilidad:** API, automatizaciones y arquitectura de canal reducen el costo de nuevas integraciones.
7. **Self-hosting:** el comprador mantiene control sobre dominio, base de datos y datos.
8. **Documentación:** baja el costo de transferencia a un equipo interno.

## 10. Qué preparar antes de vender

Para acercarse a la parte alta del rango, conviene preparar:

- demo grabada de 5 a 10 minutos;
- ambiente demo con datos ficticios;
- diagrama de arquitectura;
- lista de funcionalidades por canal;
- matriz de funcionalidades “producción”, “beta” y “no disponible”;
- instrucciones de instalación reproducibles;
- inventario de variables de entorno sin secretos;
- inventario de licencias;
- lista de dependencias y servicios externos;
- pruebas de aceptación;
- evidencia de `lint`, `typecheck`, tests y build;
- procedimiento de backup y restauración;
- procedimiento de rotación de claves;
- documentación de límites de Meta, Telegram, Google y proveedores de IA;
- política de soporte;
- alcance exacto de la transferencia;
- cláusula que excluya datos, credenciales y secretos del entorno del vendedor.

## 11. Mejoras que aumentarían el precio

Las siguientes mejoras tendrían impacto directo en la valoración:

### Prioridad alta

- completar Instagram Direct;
- añadir pruebas E2E de los flujos principales;
- añadir observabilidad, logs estructurados y alertas;
- soportar reintentos y colas para webhooks y envíos;
- hacer el rate limiting compatible con múltiples instancias;
- añadir OCR opcional para PDFs escaneados;
- automatizar la sincronización de Google Sheets;
- crear backups y restauración documentados;
- producir una instalación reproducible en un clic.

### Prioridad comercial

- multi-idioma (la interfaz ya está en español; falta un selector de idioma);
- ~~branding por cliente~~ (**hecho** en la actualización de octubre de 2026);
- billing y planes;
- métricas de uso;
- exportación de datos;
- auditoría de actividad;
- permisos más granulares;
- plantillas de automatización por industria;
- conectores para ecommerce, CRM y ERP;
- casos de éxito cuantificados.

### Prioridad legal y de transferencia

- separar claramente código upstream y código propio;
- documentar autoría de cada módulo;
- revisar licencias de dependencias;
- definir si la venta es licencia, cesión de código o servicio;
- preparar contrato de soporte y SLA;
- no incluir secretos ni datos de clientes;
- revisar que el comprador entienda las obligaciones de Meta, Google y proveedores de IA.

## 12. Veredicto final

### Valor conservador de las mejoras propias sin clientes

**US$3,000 - US$10,000**  
**S/11,400 - S/38,000**

Este rango es el más defendible si el comprador conoce el repositorio original, puede hacer su propio fork y no necesita que le entregues soporte prolongado.

### Precio recomendado para una entrega profesional

**US$7,000 - US$16,000**  
**S/26,600 - S/60,800**

Debe incluir instalación, configuración, documentación de tus cambios, capacitación y un periodo limitado de soporte. En este escenario el comprador no solo paga el código: paga reducir el tiempo y el riesgo de ponerlo a funcionar.

### Precio de implementación para un cliente empresarial

**US$10,000 - US$25,000**  
**S/38,000 - S/95,000**

Este rango solo se justifica si hay personalización real para el cliente, carga de conocimiento, configuración de canales, pruebas, capacitación y soporte. No debe presentarse como el precio del repositorio desnudo.

### Precio potencial con clientes, ingresos y casos de éxito

**US$25,000 - US$50,000 o más**, sujeto a métricas y a la modalidad de venta.

### Modelo recomendado: vender accesos

Con la marca blanca ya implementada, la recomendación principal es **vender accesos mensuales** (sección 8): S/149 – S/1,500 al mes por empresa más una implementación inicial. Reservar la venta del código para un comprador que pague claramente por encima de lo que generarían 2–3 años de suscripciones.

Mi recomendación práctica es **no venderlo como “un código basado en open source”**, porque eso comprime demasiado el precio. Véndelo como una **plataforma CRM omnicanal con IA, base de conocimiento, integraciones y entrega técnica**, aclarando de forma transparente qué componentes provienen de open source y qué mejoras son propias.
