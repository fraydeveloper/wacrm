# Valoración comercial de AgenteVentasTed / wacrm

**Fecha de evaluación:** 9 de octubre de 2026 (actualización; versiones anteriores: 8 y 1 de octubre de 2026)  
**Versión observada:** 0.7.0 + mejoras de marca blanca, flujos y difusiones  
**Moneda de referencia:** USD y soles peruanos (PEN)  
**Tipo de evaluación:** valoración técnica y comercial preliminar basada en el código disponible, la documentación y la arquitectura visible del proyecto.

> **Actualización 9-oct-2026 (sin cambios de precios):** se revisó todo contra el código. Se reemplazó la lista de funcionalidades por una tabla de estado (sección 2), se agregaron limitaciones que no figuraban (sección 4), un resumen de modalidades de venta con una **licencia para revender, que es un precio nuevo** (sección 6.0), el costo de desarrollo desde cero (sección 13) y el costo por módulo adicional (sección 14, calculado con la tarifa por hora que ya figuraba en la sección 8.1). Los demás precios no cambian.
>
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

## 2. Qué funciona y qué falta (revisado contra el código el 9-oct-2026)

La descripción de cada módulo está en [DOCUMENTACION.md](DOCUMENTACION.md) y
la parte técnica en [herramientas-y-arquitectura.md](herramientas-y-arquitectura.md).
Aquí solo va el estado, que es lo que importa para poner precio.

| Área | Funciona | Falta o está limitado |
|---|---|---|
| WhatsApp (Meta Cloud API) | Webhook con firma HMAC, texto, medios, notas de voz, reacciones, respuestas citadas, plantillas (crear, enviar, sincronizar), estados enviado/entregado/leído | Alta de cada número a mano: no hay *Embedded Signup* |
| Messenger | Recibe y envía texto; responde la IA; el agente responde a mano desde la bandeja | Solo texto; las automatizaciones y flujos no envían; requiere App Review de Meta para el público |
| Telegram | Recibe y envía texto; webhook automático; responde la IA; el agente responde a mano desde la bandeja | Solo texto; las automatizaciones y flujos no envían; un bot por cuenta |
| Instagram | Columnas y tipos preparados | No hay webhook ni envío (`sendChannelText` lanza error) |
| Bandeja compartida | Tiempo real, asignación, estados, notas, filtros por etiqueta y empresa, borradores con IA, botón humano/IA, respuesta manual en los 3 canales | Adjuntos y plantillas solo en WhatsApp |
| Contactos | Etiquetas, importación CSV robusta con plantilla, deduplicación, envío de plantilla a un contacto | Campos personalizados solo de texto; no hay exportación de contactos |
| Embudos (Kanban) | Etapas configurables, negocios vinculados a contactos, arrastrar y soltar, analítica, moneda PEN | — |
| Difusiones | Plantillas, audiencia por etiqueta, campo o CSV, miles de destinatarios, reintento ante 429, exportar resultados a CSV | El envío avanza **solo mientras la pestaña del navegador está abierta** (no hay cola en el servidor); solo WhatsApp |
| Automatizaciones | 7 disparadores, 11 acciones, condiciones, esperas, registros | Las esperas necesitan un cron externo; los envíos son solo por WhatsApp |
| Flujos | Editor visual, botones, listas, captura de datos, cierre por tiempo | Solo WhatsApp |
| IA | 5 proveedores con clave propia (BYOK), borradores, auto-respuesta, tope por conversación, encendido por canal, *playground*, derivación con aviso | El mensaje de derivación por defecto trae un nombre y teléfono fijos (Max Patricio) que cada cuenta debe cambiar |
| Base de conocimiento | Texto, archivos `.md`/`.txt`/`.pdf` (15 MB), Google Sheets, búsqueda semántica o de texto completo | Sin OCR para PDFs escaneados; Google Sheets solo se sincroniza al pulsar el botón |
| Equipo y roles | 4 roles, invitaciones por enlace, transferencia de propiedad, presencia | — |
| Multiempresa y marca blanca | Cada registro es una empresa aislada (RLS) con su nombre, logo y colores | Cada empresa puede usar la app de Meta del operador o la suya propia (App Secret por cuenta). Sin *Embedded Signup*, planes, límites ni cobro automático |
| API pública y webhooks salientes | 11 rutas `/api/v1`, *scopes*, webhooks firmados con protección SSRF | Sin `DELETE` de contactos ni listado de difusiones |
| Calidad | 606 pruebas unitarias (601 pasan en Windows; las 5 restantes dependen de la zona horaria), CI con lint, typecheck, pruebas y build | Sin pruebas de extremo a extremo; límite de peticiones en memoria (no sirve con varias instancias); CSP solo en modo informe |

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
- dejar Messenger o Telegram solo para atención humana (los agentes responden con texto desde la bandeja);
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
- CI;
- herramientas y arquitectura ([herramientas-y-arquitectura.md](herramientas-y-arquitectura.md));
- negocios a los que ofrecerlo ([negocios.md](negocios.md)).

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
- en Messenger y Telegram las automatizaciones no envían y los agentes solo pueden responder con texto;
- el alta de WhatsApp y Messenger de cada empresa es manual (no hay *Embedded Signup*);
- las difusiones dependen de que la pestaña del navegador siga abierta (no hay cola en el servidor);
- el mensaje de derivación por defecto contiene un nombre y teléfono personales fijos;
- los campos personalizados solo son de texto y no hay exportación de contactos;
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

### 6.0 Resumen por modalidad

| Modalidad | Qué recibe el comprador | Precio | Origen |
|---|---|---:|---|
| **Licencia de uso** (no exclusiva) | Usarlo en su propia empresa, sin revender | US$6,000 – 15,000 (S/22,800 – 57,000) | Escenario B (ya fijado) |
| **Licencia para revender** (no exclusiva) | Puede alquilarlo o instalarlo a terceros con su marca; tú conservas el derecho a seguir vendiéndolo | US$12,000 – 20,000 (S/45,600 – 76,000) | **Nuevo, es una propuesta.** Va por encima de la licencia de uso porque el comprador pasa a competir contigo en el mismo mercado |
| **Cesión total** (exclusiva) | Derechos exclusivos sobre **tu** código y documentación; la base MIT no se puede ceder en exclusiva | US$18,000 – 40,000 (S/68,400 – 152,000) | Escenario E (ya fijado) |
| Venta del código tal cual | Repositorio, migraciones, documentación, una sesión | US$3,000 – 8,000 (S/11,400 – 30,400) | Escenario A (ya fijado) |
| Alquiler mensual (SaaS) | Acceso por empresa desde tu instalación | S/149 – 1,500 al mes + implementación | Sección 8 (ya fijado) |

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
| Alta manual de WhatsApp/Messenger por cliente | Medio | Con tu app de Meta o con la app propia del cliente ([configuracion-por-modalidad.md](configuracion-por-modalidad.md)); a futuro, *Embedded Signup* (sección 14) |
| Mensaje de derivación por defecto con datos de Max Patricio | Medio | Cambiarlo en Configuración → IA de cada cliente durante la implementación |

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

## 13. Costo de desarrollo desde cero (estimación)

Cuánto costaría construir hoy un sistema equivalente sin partir de la plantilla
open source. Sirve como **techo de referencia** en una negociación, **no como
precio de venta**: la base es gratuita en GitHub y el comprador lo sabe
(sección 1.1).

**Supuestos (todos son estimaciones):**

- Horas productivas de un desarrollador **semi-senior** con experiencia en Next.js y Supabase, calculadas a partir del tamaño real de cada módulo (ver [herramientas-y-arquitectura.md § 7](herramientas-y-arquitectura.md#7-tamaño-del-proyecto)).
- Un **junior** tarda 1.5 veces más y un **senior** 0.75 veces lo que tarda un semi-senior.
- Tarifas por hora en Perú (referencia de mercado freelance, no salen del código): junior S/30 (≈US$7.90), semi-senior S/55 (≈US$14.50), senior S/100 (≈US$26.30).
- Tipo de cambio: **US$1 = S/3.80**, el mismo que en el resto del documento.
- Las 37 migraciones SQL están repartidas dentro de cada módulo. No incluye gestión de proyecto, diseño gráfico, App Review de Meta ni pruebas con usuarios.

| Parte | Líneas de referencia | Horas (semi-senior) | Junior (S/) | Semi-senior (S/) | Senior (S/) |
|---|---:|---:|---:|---:|---:|
| Base técnica, *layout*, temas y marca blanca | ~3,500 | 160 | 7,200 | 8,800 | 12,000 |
| Cuentas, equipo, roles, invitaciones, RLS | 4,339 | 160 | 7,200 | 8,800 | 12,000 |
| Bandeja compartida en tiempo real | 4,663 | 200 | 9,000 | 11,000 | 15,000 |
| WhatsApp: webhook, envío, medios, plantillas | 7,714 | 280 | 12,600 | 15,400 | 21,000 |
| Omnicanal: ingesta común, Messenger, Telegram | 2,777 | 110 | 4,950 | 6,050 | 8,250 |
| Contactos e importación CSV | 3,374 | 120 | 5,400 | 6,600 | 9,000 |
| Embudos (Kanban) | 2,089 | 70 | 3,150 | 3,850 | 5,250 |
| Difusiones | 3,308 | 120 | 5,400 | 6,600 | 9,000 |
| Automatizaciones | 3,930 | 150 | 6,750 | 8,250 | 11,250 |
| Flujos con editor visual | 8,818 | 260 | 11,700 | 14,300 | 19,500 |
| IA, base de conocimiento, Google Sheets | 4,416 | 190 | 8,550 | 10,450 | 14,250 |
| API pública y webhooks salientes | 2,486 | 100 | 4,500 | 5,500 | 7,500 |
| Panel de métricas y notificaciones | 2,794 | 90 | 4,050 | 4,950 | 6,750 |
| Pruebas automatizadas (59 archivos) | 7,415 | 140 | 6,300 | 7,700 | 10,500 |
| Documentación, CI y despliegue | — | 50 | 2,250 | 2,750 | 3,750 |
| **Total** | | **2,200 h** | **S/99,000** | **S/121,000** | **S/165,000** |
| Total en dólares | | | **≈US$26,050** | **≈US$31,840** | **≈US$43,420** |
| Horas reales según perfil | | | 3,300 h | 2,200 h | 1,650 h |

Con una sola persona a tiempo completo (~160 h al mes), un semi-senior tardaría
unos **14 meses**.

**Valor del trabajo propio sobre el fork** (8 commits, 6-jul → 8-oct-2026):
Messenger, ingesta omnicanal, archivos y Google Sheets (~110 h), Telegram,
derivación con aviso y tarjetas por canal (~70 h), marca blanca, difusiones y
CSV (~90 h), traducción y 3 proveedores de IA (~50 h), interruptores por canal
y ajustes de IA (~50 h) y documentación (~30 h): **~400 h ≈ S/22,000
(≈US$5,800) a tarifa semi-senior**. Cae dentro del rango que ya fijaste para
las mejoras propias (US$3,000 – 10,000), así que ese rango sigue siendo
coherente.

## 14. Costo por módulo adicional (funciones que se pueden pedir)

Calculado con la tarifa de personalización que ya figura en la sección 8.1
(**S/120 – 250 por hora**). Las horas son estimaciones; los costos de terceros
(Meta, OCR, pasarela de pago) se cobran aparte.

| Módulo | Qué resuelve | Horas | Precio (S/) | Precio (US$) |
|---|---|---:|---:|---:|
| Automatizaciones por cualquier canal | Que los pasos “enviar mensaje” funcionen en Messenger y Telegram | 12 | 1,440 – 3,000 | 380 – 790 |
| Exportar contactos a CSV | Hoy solo se exportan los resultados de una difusión | 8 | 960 – 2,000 | 250 – 530 |
| Sincronización automática de Google Sheets | Hoy solo se sincroniza al pulsar el botón | 12 | 1,440 – 3,000 | 380 – 790 |
| Límite de peticiones compartido (Redis) | Necesario para correr varias instancias | 12 | 1,440 – 3,000 | 380 – 790 |
| Campos personalizados con tipos | Número, fecha y lista además de texto | 24 | 2,880 – 6,000 | 760 – 1,580 |
| OCR para PDFs escaneados | Leer PDFs que son solo imagen | 24 | 2,880 – 6,000 | 760 – 1,580 |
| Límites por plan | Tope de usuarios o contactos por empresa | 30 | 3,600 – 7,500 | 950 – 1,970 |
| Adjuntos en Messenger y Telegram | Fotos y archivos, entrantes y salientes | 40 | 4,800 – 10,000 | 1,260 – 2,630 |
| Cola de difusiones en el servidor | Que una difusión siga aunque se cierre el navegador | 40 | 4,800 – 10,000 | 1,260 – 2,630 |
| Selector de idioma (español / inglés) | Vender fuera del Perú | 40 | 4,800 – 10,000 | 1,260 – 2,630 |
| Integración con e-commerce o ERP | Pedidos, stock o clientes de otro sistema (por integración, desde) | 40 | 4,800 – 10,000 | 1,260 – 2,630 |
| Flujos en Messenger y Telegram | Menús con botones en esos canales | 50 | 6,000 – 12,500 | 1,580 – 3,290 |
| Agenda de citas | Reservar, confirmar y recordar citas por WhatsApp (no existe hoy) | 60 | 7,200 – 15,000 | 1,900 – 3,950 |
| Instagram Direct | Cuarto canal (App Review de Meta aparte) | 60 | 7,200 – 15,000 | 1,900 – 3,950 |
| Alta de WhatsApp con *Embedded Signup* | Que cada empresa conecte su número sola; requiere verificarse como *Tech Provider* en Meta | 60 | 7,200 – 15,000 | 1,900 – 3,950 |
| Cobro automático y planes | Suscripciones con pasarela (Culqi, Mercado Pago, etc.) y suspensión automática | 80 | 9,600 – 20,000 | 2,530 – 5,260 |

## 15. Recomendación (actualizada al 9-oct-2026)

Se mantiene la recomendación de la sección 12: **alquiler mensual** como modelo
principal y venta del código solo si el pago supera claramente lo que
generarían 2–3 años de suscripciones. Antes del primer cliente de alquiler
conviene resolver tres cosas que salen del código:

1. **Cambiar el mensaje de derivación por defecto** (`src/lib/ai/defaults.ts`) por uno genérico, o exigir que cada cuenta lo configure. Si no, los clientes de otras empresas verán el nombre y el teléfono de Max Patricio.
2. **Aclarar que en Messenger y Telegram se responde solo con texto**: fotos y archivos en esos canales son un módulo aparte (S/4,800 – 10,000).
3. **Elegir cómo se conecta cada cliente**: con tu app de Meta (alquiler normal) o con la app propia del cliente o revendedor. Ambas funcionan hoy; pasos en [configuracion-por-modalidad.md](configuracion-por-modalidad.md). El *Embedded Signup* sigue siendo un módulo aparte.

Ofrecer la **licencia para revender** solo a un socio que opere en otro rubro o
región, para no crear un competidor directo.
