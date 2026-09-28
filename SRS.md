# Especificación de Requisitos de Software (SRS)

## QuantPortfolio(Nombre por definir): plataforma de monitoreo, predicción y optimización de carteras

**Versión:** 1.0  
**Estado:** Borrador para revisión  
**Materia:** Programación Estructurada  
**Lenguajes principales:** Julia y SQL  
**Frontend:** Framework web a definir  
**Integrantes:** _Por completar_   
**Fecha:** _Por completar_

---

## 1. Introducción

### 1.1 Propósito

Este documento especifica los requisitos de **QuantPortfolio**, una plataforma web para consultar información de mercado, analizar activos financieros, construir carteras, estimar riesgos, realizar predicciones y comparar estrategias mediante simulaciones.

El documento sirve como referencia para el diseño, desarrollo, pruebas y evaluación del proyecto universitario.

### 1.2 Alcance del producto

QuantPortfolio permitirá que un usuario:

1. Consulte precios históricos y actuales mediante una API financiera.
2. Analice el rendimiento y el riesgo de distintos activos.
3. Construya carteras con activos seleccionados.
4. Genere carteras optimizadas según distintos objetivos.
5. Simule posibles escenarios futuros mediante Monte Carlo.
6. Compare predicciones con resultados históricos mediante backtesting.
7. Evalúe el comportamiento de una cartera ante escenarios de estrés.
8. Guarde y consulte análisis, carteras y simulaciones anteriores.

El sistema será una herramienta académica de análisis y apoyo a decisiones. **No realizará operaciones reales, no administrará dinero y no reemplazará asesoramiento financiero profesional.**

### 1.3 Objetivos

- Aplicar modelos matemáticos y estadísticos a datos financieros.
- Utilizar Julia para procesamiento numérico, predicción, simulación y optimización.
- Utilizar SQL para almacenar y consultar datos estructurados.
- Integrar una fuente externa de datos de mercado mediante una API.
- Ofrecer una interfaz visual para explorar resultados y comparar escenarios.
- Construir un sistema funcional, reproducible y evaluable sin depender de sensores ni de operaciones financieras reales.

### 1.4 Definiciones y acrónimos

| Término | Definición |
|---|---|
| API | Interfaz que permite consultar datos de un servicio externo. |
| Activo | Instrumento financiero identificado por un símbolo o ticker. |
| Cartera | Conjunto de activos y sus respectivas proporciones. |
| Rendimiento | Variación porcentual del precio de un activo durante un período. |
| Volatilidad | Medida de la variabilidad de los rendimientos. |
| VaR | Valor en Riesgo; pérdida máxima estimada para un nivel de confianza determinado. |
| CVaR | Pérdida promedio esperada en los escenarios que superan el VaR. |
| Backtesting | Evaluación histórica de una estrategia usando datos del pasado. |
| Monte Carlo | Técnica que genera múltiples escenarios aleatorios para estimar resultados posibles. |
| Rebalanceo | Ajuste de los pesos de una cartera para alcanzar una distribución objetivo. |

---

## 2. Descripción general

### 2.1 Perspectiva del producto

QuantPortfolio será una aplicación web con una arquitectura separada por capas:

```text
Usuario
   ↓
Frontend Next.js alojado en Vercel
   ↓ HTTP/JSON
API Julia alojada en Railway
   ↓
Módulos de análisis, predicción, simulación y optimización en Julia
   ↓
PostgreSQL administrado por Supabase
   ↓
Servicio externo de datos de mercado
```

El frontend será responsable de la interfaz y la visualización. La API Julia será responsable de la lógica de negocio, los cálculos matemáticos, la integración con la API financiera y el acceso a la base de datos. Supabase se utilizará como servicio administrado de PostgreSQL, no como reemplazo de la API Julia.

La aplicación conservará los datos consultados y los resultados calculados para reducir consultas repetidas a la API y permitir la comparación histórica.

### 2.2 Usuarios del sistema

| Usuario | Necesidades principales |
|---|---|
| Analista o estudiante | Explorar activos, crear carteras y evaluar escenarios. |
| Administrador del sistema | Configurar la fuente de datos, revisar sincronizaciones y mantener parámetros. |

Para la primera versión, el sistema podrá trabajar con un único tipo de usuario autenticado o con una sesión local simplificada. La gestión avanzada de permisos queda fuera del alcance inicial.

### 2.3 Entorno de ejecución

- **Frontend:** Next.js con TypeScript.
- **Estilos y componentes:** Tailwind CSS y shadcn/ui.
- **Visualización:** Apache ECharts para gráficos financieros, series temporales, correlaciones y simulaciones.
- **Backend:** Julia con Oxygen.jl para exponer la API REST.
- **Procesamiento:** DataFrames.jl, HTTP.jl y JSON3.jl.
- **Optimización:** JuMP con HiGHS como solver inicial.
- **Conexión SQL:** LibPQ.jl.
- **Base de datos:** PostgreSQL administrado por Supabase.
- **Hosting del frontend:** Vercel.
- **Hosting del backend:** Railway, mediante un contenedor Docker de larga duración.
- **Comunicación:** HTTP/JSON entre frontend y backend.
- **Datos externos:** API financiera con clave almacenada mediante variables de entorno en el backend.
- **Datos de respaldo:** archivos CSV precargados para poder ejecutar el sistema sin conexión permanente a la API.

#### 2.3.1 Distribución de responsabilidades

El hosting del frontend y el hosting del backend tendrán responsabilidades diferentes:

| Componente | Responsabilidad |
|---|---|
| Vercel | Servir la interfaz web y los recursos estáticos de Next.js. |
| Railway | Mantener disponible la API Julia y ejecutar análisis, predicciones, optimizaciones y simulaciones. |
| Supabase | Almacenar activos, precios, carteras, parámetros y resultados en PostgreSQL. |
| API financiera | Proporcionar cotizaciones y datos históricos externos. |

El frontend no se conectará directamente a Supabase. Toda operación de negocio pasará por la API Julia para mantener centralizados los cálculos, las validaciones y las reglas del sistema.

#### 2.3.2 Flujo de una operación

Por ejemplo, para optimizar una cartera:

```text
1. El usuario selecciona activos y restricciones en Next.js.
2. Next.js envía una solicitud HTTP a la API Julia.
3. Julia valida los parámetros y consulta los datos en Supabase.
4. JuMP ejecuta el modelo de optimización.
5. Julia guarda el resultado y devuelve la respuesta.
6. Next.js muestra la composición y los gráficos resultantes.
```

### 2.4 Supuestos

- La API seleccionada ofrece precios históricos y cotizaciones de los activos elegidos.
- Los datos históricos pueden estar sujetos a límites de consultas, retrasos o períodos faltantes.
- El sistema trabajará principalmente con datos diarios.
- La información externa no se considerará en tiempo real estricto.
- Los resultados serán aproximaciones dependientes de la calidad de los datos y del modelo seleccionado.
- Se contará con datos sintéticos o públicos para las pruebas y demostraciones.

### 2.5 Restricciones

- Julia y SQL deben ser las tecnologías principales del proyecto.
- El sistema no debe depender de sensores físicos.
- No se implementará compra, venta ni ejecución de órdenes reales.
- Las claves de API no se almacenarán en el repositorio.
- El sistema debe conservar una alternativa local cuando la API no esté disponible.
- Los cálculos deben poder reproducirse utilizando los mismos datos y parámetros.

---

## 3. Alcance

### 3.1 Incluido

- Importación de datos mediante API y CSV.
- Almacenamiento de activos, precios y resultados en SQL.
- Seguimiento de activos seleccionados.
- Cálculo de indicadores financieros.
- Predicción de rendimientos o volatilidad.
- Optimización de carteras.
- Simulación Monte Carlo.
- Análisis VaR y CVaR.
- Pruebas de estrés.
- Backtesting de estrategias.
- Visualización de resultados.
- Registro de carteras y escenarios.

### 3.2 Fuera de alcance

- Ejecución de operaciones financieras.
- Conexión con cuentas bancarias o brokers.
- Asesoramiento financiero personalizado.
- Garantía de rentabilidad.
- Datos tick-by-tick o infraestructura de trading de alta frecuencia.
- Aplicación móvil nativa.
- Sistema avanzado de roles y permisos.
- Modelos de inteligencia artificial no justificados o imposibles de validar con los datos disponibles.

---

## 4. Requisitos funcionales

### 4.1 Gestión de datos de mercado

| ID | Requisito | Prioridad |
|---|---|---|
| RF-01 | El sistema deberá permitir registrar activos mediante su símbolo, nombre, mercado y categoría. | Alta |
| RF-02 | El sistema deberá importar precios históricos desde un archivo CSV. | Alta |
| RF-03 | El sistema deberá consultar precios y datos históricos desde una API configurada. | Alta |
| RF-04 | El sistema deberá almacenar la fecha y hora de la última actualización de cada activo. | Alta |
| RF-05 | El sistema deberá evitar duplicar registros de precios para un mismo activo y fecha. | Alta |
| RF-06 | El sistema deberá informar cuando una consulta a la API falle, supere el límite permitido o devuelva datos incompletos. | Alta |
| RF-07 | El sistema deberá permitir utilizar datos almacenados localmente cuando la API no esté disponible. | Alta |

### 4.2 Seguimiento del mercado

| ID | Requisito | Prioridad |
|---|---|---|
| RF-08 | El usuario deberá poder crear una lista de seguimiento de activos. | Alta |
| RF-09 | El sistema deberá mostrar el precio más reciente disponible de cada activo seguido. | Alta |
| RF-10 | El sistema deberá mostrar la variación porcentual diaria, semanal y mensual cuando existan datos suficientes. | Alta |
| RF-11 | El sistema deberá mostrar gráficos históricos de los activos seleccionados. | Alta |
| RF-12 | El usuario deberá poder solicitar una actualización manual de los activos seguidos. | Media |
| RF-13 | El sistema deberá indicar si un dato es actualizado, almacenado en caché o proveniente de un archivo local. | Media |
| RF-14 | El sistema podrá generar una alerta visual cuando un activo supere un umbral de variación o volatilidad configurado. | Media |

### 4.3 Análisis de activos

| ID | Requisito | Prioridad |
|---|---|---|
| RF-15 | El sistema deberá calcular rendimientos simples y logarítmicos. | Alta |
| RF-16 | El sistema deberá calcular rendimiento acumulado, media, volatilidad y drawdown. | Alta |
| RF-17 | El sistema deberá calcular la correlación entre dos o más activos. | Alta |
| RF-18 | El sistema deberá mostrar una matriz de correlación para los activos seleccionados. | Media |
| RF-19 | El sistema deberá permitir seleccionar el período utilizado para el análisis. | Alta |
| RF-20 | El sistema deberá indicar cuando el período seleccionado no tenga suficientes datos. | Alta |

### 4.4 Predicción

| ID | Requisito | Prioridad |
|---|---|---|
| RF-21 | El sistema deberá permitir seleccionar un activo y un horizonte de predicción. | Alta |
| RF-22 | El sistema deberá generar una predicción de rendimiento o volatilidad para el horizonte seleccionado. | Alta |
| RF-23 | El sistema deberá mostrar la predicción junto con un intervalo o medida de incertidumbre. | Alta |
| RF-24 | El sistema deberá guardar el modelo, los parámetros, el período de entrenamiento y la fecha de cálculo. | Alta |
| RF-25 | El sistema deberá mostrar las limitaciones de la predicción y no presentarla como una certeza. | Alta |
| RF-26 | El sistema deberá permitir comparar la predicción con los valores observados posteriormente. | Media |

El modelo inicial será seleccionado durante el desarrollo con base en la disponibilidad de datos y la validación. Podrá utilizarse un modelo de referencia de medias móviles, suavizamiento exponencial, ARIMA o un modelo de volatilidad, siempre que su funcionamiento sea explicable y evaluable.

### 4.5 Gestión de carteras

| ID | Requisito | Prioridad |
|---|---|---|
| RF-27 | El usuario deberá poder crear una cartera indicando nombre, capital inicial, moneda y fecha. | Alta |
| RF-28 | El usuario deberá poder agregar activos y pesos a una cartera. | Alta |
| RF-29 | El sistema deberá validar que los pesos de una cartera sean válidos y que sumen el 100 %. | Alta |
| RF-30 | El sistema deberá calcular el rendimiento y riesgo estimado de una cartera. | Alta |
| RF-31 | El sistema deberá mostrar la composición porcentual de una cartera. | Alta |
| RF-32 | El usuario deberá poder guardar varias versiones de una cartera. | Media |
| RF-33 | El sistema deberá permitir duplicar una cartera para modificarla sin alterar la original. | Media |

### 4.6 Optimización

| ID | Requisito | Prioridad |
|---|---|---|
| RF-34 | El sistema deberá permitir seleccionar un objetivo de optimización. | Alta |
| RF-35 | El sistema deberá soportar, como mínimo, la minimización de varianza y la maximización del ratio de Sharpe. | Alta |
| RF-36 | El sistema deberá permitir establecer límites mínimos y máximos por activo. | Alta |
| RF-37 | El sistema deberá permitir establecer un nivel máximo de riesgo o volatilidad. | Media |
| RF-38 | El sistema deberá mostrar los pesos resultantes y el valor de la función objetivo. | Alta |
| RF-39 | El sistema deberá informar cuando no exista una solución válida con las restricciones indicadas. | Alta |
| RF-40 | El usuario deberá poder comparar una cartera manual con una cartera optimizada. | Alta |

### 4.7 Riesgo y simulación

| ID | Requisito | Prioridad |
|---|---|---|
| RF-41 | El sistema deberá permitir configurar la cantidad de simulaciones Monte Carlo. | Alta |
| RF-42 | El sistema deberá permitir definir un horizonte temporal y un nivel de confianza. | Alta |
| RF-43 | El sistema deberá calcular la distribución simulada de resultados de una cartera. | Alta |
| RF-44 | El sistema deberá calcular VaR y CVaR para una cartera y configuración determinadas. | Alta |
| RF-45 | El sistema deberá mostrar gráficamente la distribución de ganancias y pérdidas. | Alta |
| RF-46 | El sistema deberá permitir crear escenarios de estrés modificando rendimientos, volatilidades o correlaciones. | Alta |
| RF-47 | El sistema deberá guardar los parámetros y resultados de cada simulación. | Alta |
| RF-48 | El sistema deberá identificar el peor resultado, el mejor resultado y percentiles relevantes de una simulación. | Media |

### 4.8 Backtesting

| ID | Requisito | Prioridad |
|---|---|---|
| RF-49 | El sistema deberá permitir seleccionar un período histórico para realizar backtesting. | Alta |
| RF-50 | El sistema deberá evaluar una estrategia de cartera sobre datos históricos no utilizados en su configuración. | Alta |
| RF-51 | El sistema deberá mostrar rendimiento acumulado, volatilidad, drawdown y ratio de Sharpe de la estrategia. | Alta |
| RF-52 | El sistema deberá comparar la estrategia contra un benchmark configurado. | Media |
| RF-53 | El sistema deberá guardar los resultados del backtesting junto con sus parámetros. | Media |

### 4.9 Visualización y reportes

| ID | Requisito | Prioridad |
|---|---|---|
| RF-54 | El sistema deberá mostrar un resumen de cada análisis en un dashboard. | Alta |
| RF-55 | El sistema deberá utilizar gráficos legibles para evolución temporal, composición, correlaciones y distribución de resultados. | Alta |
| RF-56 | El usuario deberá poder consultar el detalle matemático de las métricas principales. | Media |
| RF-57 | El sistema deberá mostrar la fecha, fuente y período de los datos utilizados. | Alta |
| RF-58 | El usuario deberá poder exportar los resultados principales en CSV o formato equivalente. | Baja |

---

## 5. Requisitos no funcionales

### 5.1 Rendimiento

| ID | Requisito | Criterio de aceptación |
|---|---|---|
| RNF-01 | Las consultas de datos almacenados deberán responder en un tiempo razonable para el volumen del proyecto. | El 95 % de las consultas habituales deberá responder en menos de 3 segundos. |
| RNF-02 | El sistema deberá informar el progreso o estado de simulaciones largas. | El usuario no deberá interpretar una pantalla sin respuesta como un error. |
| RNF-03 | La solución deberá poder ejecutar al menos 10.000 escenarios Monte Carlo en el entorno definido para la demostración. | La simulación deberá finalizar sin pérdida de datos. |

### 5.2 Seguridad

| ID | Requisito |
|---|---|
| RNF-04 | Las claves de API deberán almacenarse mediante variables de entorno o un mecanismo equivalente. |
| RNF-05 | Las entradas recibidas desde el frontend deberán validarse antes de ejecutar consultas o cálculos. |
| RNF-06 | El sistema no deberá almacenar credenciales bancarias ni datos financieros personales sensibles. |
| RNF-07 | El sistema deberá evitar ejecutar órdenes reales o enviar instrucciones a brokers. |

### 5.3 Disponibilidad y tolerancia a fallos

| ID | Requisito |
|---|---|
| RNF-08 | El sistema deberá funcionar con datos precargados aunque la API externa no responda. |
| RNF-09 | Los errores de la API deberán registrarse sin interrumpir el acceso a los análisis ya almacenados. |
| RNF-10 | La aplicación deberá diferenciar datos actualizados, datos en caché y datos de respaldo. |

### 5.4 Usabilidad y accesibilidad

| ID | Requisito |
|---|---|
| RNF-11 | Las pantallas principales deberán ser comprensibles sin conocer la implementación interna. |
| RNF-12 | Cada métrica deberá incluir una etiqueta, unidad y descripción breve. |
| RNF-13 | Los gráficos deberán incluir títulos, escalas, leyendas y período analizado. |
| RNF-14 | La aplicación deberá poder utilizarse en una pantalla de escritorio y adaptarse a resoluciones menores. |

### 5.5 Mantenibilidad y reproducibilidad

| ID | Requisito |
|---|---|
| RNF-15 | Los módulos de ingesta, análisis, predicción, optimización y persistencia deberán mantenerse separados. |
| RNF-16 | Los cálculos deberán recibir parámetros explícitos y producir resultados reproducibles cuando se utilice una semilla fija. |
| RNF-17 | Cada resultado almacenado deberá conservar los parámetros y la versión del modelo utilizado. |
| RNF-18 | El código deberá incluir documentación de las fórmulas y supuestos principales. |

---

## 6. Interfaces externas

### 6.1 Interfaz de usuario

La aplicación deberá ofrecer, como mínimo, las siguientes vistas:

1. **Inicio o dashboard:** resumen del mercado, carteras y últimos análisis.
2. **Seguimiento:** lista de activos, cotizaciones y variaciones.
3. **Análisis de activos:** indicadores, gráficos y correlaciones.
4. **Carteras:** creación, edición y consulta de carteras.
5. **Optimización:** objetivo, restricciones y cartera resultante.
6. **Simulación:** parámetros, progreso y resultados Monte Carlo.
7. **Backtesting:** período, estrategia y comparación con benchmark.
8. **Historial:** análisis, simulaciones y carteras guardadas.

### 6.2 API de mercado

La integración deberá:

- Utilizar solicitudes HTTP seguras.
- Autenticarse mediante una clave configurable.
- Convertir la respuesta externa a un formato interno uniforme.
- Validar símbolos, fechas, precios y valores faltantes.
- Respetar límites de solicitudes.
- Guardar la fecha de consulta y la fuente de cada dato.
- Permitir reemplazar el proveedor sin modificar los módulos matemáticos.

### 6.3 API interna

El backend deberá exponer operaciones para:

- Consultar activos y precios.
- Actualizar datos de mercado.
- Crear y consultar carteras.
- Solicitar análisis.
- Ejecutar predicciones.
- Ejecutar optimizaciones.
- Ejecutar simulaciones y backtesting.
- Consultar resultados almacenados.

### 6.4 Importación y exportación de archivos

El sistema deberá aceptar archivos CSV con, como mínimo, los campos:

```text
symbol,date,open,high,low,close,volume
```

Los nombres exactos podrán adaptarse al proveedor de datos, siempre que exista una transformación documentada.

### 6.5 Despliegue y comunicación entre servicios

La aplicación publicada estará compuesta por tres servicios principales:

1. **Frontend en Vercel:** presenta la interfaz y realiza solicitudes al backend.
2. **Backend Julia en Railway:** permanece disponible en internet y ejecuta la lógica de aplicación.
3. **Base de datos PostgreSQL en Supabase:** persiste los datos y resultados.

El backend Julia no se ejecutará como una función serverless del frontend, porque las simulaciones Monte Carlo, los modelos predictivos y los algoritmos de optimización pueden requerir procesos más largos que una solicitud web simple. Railway deberá ejecutar el backend como un servicio persistente construido a partir de un `Dockerfile`.

Las variables de entorno mínimas serán:

```text
DATABASE_URL
MARKET_API_KEY
MARKET_API_BASE_URL
ALLOWED_ORIGINS
```

El frontend deberá conocer únicamente la URL pública de la API Julia. Las credenciales de Supabase y de la API financiera permanecerán exclusivamente en el backend.

---

## 7. Requisitos de datos

### 7.1 Entidades principales

| Entidad | Datos principales |
|---|---|
| Activo | Identificador, símbolo, nombre, mercado, categoría y moneda. |
| Precio histórico | Activo, fecha, apertura, máximo, mínimo, cierre y volumen. |
| Lista de seguimiento | Usuario, activo y fecha de incorporación. |
| Cartera | Nombre, capital, moneda, fecha y estado. |
| Posición | Cartera, activo, peso y cantidad estimada. |
| Modelo predictivo | Tipo, activo, parámetros, período y versión. |
| Predicción | Modelo, horizonte, fecha de generación, valor e incertidumbre. |
| Simulación | Cartera, parámetros, semilla, cantidad de escenarios y resultados. |
| Escenario de estrés | Nombre, modificaciones aplicadas y resultado. |
| Backtesting | Estrategia, período, benchmark y métricas. |
| Sincronización | Fuente, fecha, estado, cantidad de registros y mensaje de error. |

### 7.2 Reglas de integridad

- Cada activo deberá tener un símbolo único dentro de su mercado.
- No deberá existir más de un precio para el mismo activo y fecha en la misma fuente.
- Una cartera deberá tener al menos un activo para poder analizarse.
- Los pesos de una cartera deberán estar entre 0 % y 100 %, salvo que el modelo permita explícitamente posiciones cortas.
- Los pesos de una cartera deberán sumar 100 % con una tolerancia numérica documentada.
- Las fechas de precios deberán ser válidas y estar ordenadas para los cálculos temporales.
- Los resultados deberán conservar una referencia a los datos y parámetros que los generaron.

---

## 8. Casos de uso principales

### CU-01: Consultar el estado del mercado

**Actor:** Analista.  
**Precondición:** Existe al menos un activo registrado.  
**Flujo principal:**

1. El usuario abre la lista de seguimiento.
2. El sistema muestra el último precio almacenado.
3. El usuario solicita una actualización.
4. El sistema consulta la API.
5. El sistema valida y almacena los nuevos datos.
6. El sistema actualiza la vista e indica la fuente y fecha del dato.

**Flujo alternativo:** Si la API no responde, el sistema muestra el último dato disponible y un mensaje de advertencia.

### CU-02: Analizar una cartera

**Actor:** Analista.  
**Precondición:** La cartera contiene activos con datos suficientes.  
**Flujo principal:**

1. El usuario selecciona una cartera.
2. Selecciona un período de análisis.
3. El sistema calcula rendimiento, volatilidad, drawdown, Sharpe, VaR y CVaR.
4. El sistema muestra las métricas y gráficos.
5. El usuario puede guardar el análisis.

### CU-03: Optimizar una cartera

**Actor:** Analista.  
**Precondición:** Existen datos históricos y al menos dos activos seleccionados.  
**Flujo principal:**

1. El usuario selecciona los activos.
2. Elige el objetivo de optimización.
3. Define límites y restricciones.
4. El sistema valida los parámetros.
5. Julia ejecuta el modelo matemático.
6. El sistema muestra los pesos resultantes y sus métricas.
7. El usuario puede guardar o comparar la cartera.

**Flujo alternativo:** Si las restricciones son incompatibles, el sistema informa la causa y no guarda una solución inválida.

### CU-04: Ejecutar una simulación de riesgo

**Actor:** Analista.  
**Precondición:** Existe una cartera válida.  
**Flujo principal:**

1. El usuario selecciona la cartera.
2. Define horizonte, confianza y cantidad de escenarios.
3. El sistema valida los parámetros.
4. Julia genera los escenarios.
5. El sistema calcula VaR, CVaR y percentiles.
6. El sistema muestra la distribución de resultados.
7. El usuario guarda la simulación para compararla posteriormente.

### CU-05: Ejecutar backtesting

**Actor:** Analista.  
**Precondición:** Existe suficiente información histórica.  
**Flujo principal:**

1. El usuario selecciona una estrategia y un período.
2. Selecciona un benchmark opcional.
3. El sistema separa los períodos de configuración y evaluación.
4. El sistema ejecuta la estrategia sobre los datos históricos.
5. El sistema calcula las métricas.
6. El sistema muestra una comparación visual.

---

## 9. Reglas de negocio y cálculos

1. Los rendimientos deberán calcularse con una fórmula documentada.
2. La volatilidad deberá indicar la frecuencia utilizada y su eventual anualización.
3. El nivel de confianza utilizado por VaR y CVaR deberá mostrarse junto con el resultado.
4. Las predicciones deberán indicar horizonte, fecha de generación y modelo utilizado.
5. Una predicción nunca deberá mostrarse como garantía de rendimiento.
6. Una optimización deberá conservar objetivo, restricciones, datos de entrada y solución.
7. Las simulaciones deberán poder repetirse con una semilla fija.
8. El backtesting deberá diferenciar los datos utilizados para configurar una estrategia de los datos utilizados para evaluarla.
9. Si falta información suficiente, el sistema deberá bloquear el cálculo o mostrar una advertencia explícita.
10. Las métricas calculadas con datos en caché deberán indicarlo al usuario.

---

## 10. Criterios de aceptación

El sistema se considerará aceptable cuando:

- [ ] Permita cargar datos desde CSV sin depender de una API.
- [ ] Pueda consultar y almacenar datos desde una API de mercado.
- [ ] Muestre una lista de seguimiento con actualización y fecha del dato.
- [ ] Calcule indicadores de activos y carteras.
- [ ] Permita crear una cartera válida y modificar sus pesos.
- [ ] Genere al menos dos tipos de carteras optimizadas.
- [ ] Ejecute una simulación Monte Carlo configurable.
- [ ] Calcule y visualice VaR y CVaR.
- [ ] Permita ejecutar al menos una predicción evaluable.
- [ ] Incluya una comparación mediante backtesting.
- [ ] Permita crear al menos un escenario de estrés.
- [ ] Persista datos y resultados en una base SQL.
- [ ] Funcione con datos locales cuando la API esté caída.
- [ ] Muestre advertencias claras ante datos insuficientes o errores.
- [ ] Mantenga las claves de API fuera del código fuente.
- [ ] Documente los supuestos matemáticos y las limitaciones del sistema.

---

## 11. Plan de implementación por etapas

### Etapa 1: Base del sistema

- Crear el esquema SQL.
- Configurar el backend en Julia.
- Implementar importación desde CSV.
- Implementar las entidades principales.

### Etapa 2: Análisis de datos

- Calcular rendimientos, volatilidad y correlaciones.
- Crear los primeros endpoints.
- Construir dashboard y gráficos iniciales.

### Etapa 3: Integración de mercado

- Seleccionar el proveedor de API.
- Implementar sincronización y caché.
- Agregar lista de seguimiento y manejo de errores.

### Etapa 4: Optimización y riesgo

- Implementar optimización con restricciones.
- Agregar Monte Carlo, VaR y CVaR.
- Incorporar escenarios de estrés.

### Etapa 5: Predicción y validación

- Implementar el modelo predictivo seleccionado.
- Incorporar backtesting.
- Comparar predicciones con resultados observados.

### Etapa 6: Cierre

- Completar visualizaciones.
- Ejecutar pruebas.
- Documentar fórmulas, limitaciones y resultados.
- Preparar datos reproducibles para la demostración.

---

## 12. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| La API tiene límites de consultas. | Alto | Usar caché, sincronización controlada y datos CSV de respaldo. |
| Faltan datos históricos para algunos activos. | Alto | Validar períodos y utilizar un conjunto de activos con datos suficientes. |
| El modelo predictivo no produce resultados confiables. | Alto | Usar un modelo de referencia, medir error y documentar limitaciones. |
| La optimización no encuentra una solución. | Medio | Validar restricciones y explicar conflictos al usuario. |
| Las simulaciones tardan demasiado. | Medio | Limitar escenarios por defecto, informar progreso y optimizar cálculos. |
| El alcance crece demasiado. | Alto | Priorizar el mínimo viable y dejar funciones avanzadas como extras. |
| Los resultados financieros se interpretan como recomendaciones. | Medio | Incluir advertencias y aclarar el objetivo académico del sistema. |

---

## 13. Decisiones adoptadas y pendientes

### 13.1 Decisiones adoptadas

- Frontend: Next.js con TypeScript.
- Estilos: Tailwind CSS y shadcn/ui.
- Gráficos: Apache ECharts.
- Backend: Julia con Oxygen.jl.
- Base de datos: PostgreSQL administrado por Supabase.
- Hosting del frontend: Vercel.
- Hosting del backend: Railway mediante Docker.
- Acceso a datos: el frontend consumirá la API Julia y no accederá directamente a Supabase.

### 13.2 Decisiones pendientes

- Seleccionar el proveedor concreto de datos de mercado.
- Elegir el modelo predictivo inicial.
- Definir la moneda y el conjunto inicial de activos.
- Determinar si se implementará autenticación o una sesión local.
- Definir integrantes, fechas y criterios particulares de la materia.

---

## 14. Glosario de alcance

QuantPortfolio no busca predecir el mercado de forma infalible. Su objetivo es mostrar cómo los datos históricos, la estadística, la simulación y la optimización pueden combinarse para construir una herramienta de análisis reproducible.
