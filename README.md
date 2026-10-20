# Asistencia Médica HAQ

Sistema para la lista de invitados y el control de asistencia del desayuno por el
Día del Médico.

## Flujo de recepción

El menú principal muestra una bienvenida con un buscador. La tabla aparece al
empezar a escribir y desaparece al limpiar la búsqueda. Permite buscar por nombre,
apellidos, hospital o boleto, incluso sin acentos. Los resultados muestran etiquetas
de estado: **Pendiente** en ámbar y **Registrado** en verde. Al registrar la llegada
de un médico con boleto, se confirma su número en una ventana; los invitados sin
boleto se registran directamente. Después de guardar la llegada, aparece una
confirmación con el nombre del médico y, a los 5 segundos, vuelve automáticamente
a la bienvenida con el buscador limpio para recibir al siguiente invitado.

Si el médico no está en la lista, recepción puede agregarlo en **Registro doctor**
y continuar con su asistencia, o solo agregarlo para después. El número de boleto
es opcional al agregar al médico. La lista y las estadísticas se sincronizan en
tiempo real en todos los equipos abiertos mediante suscripciones de Firestore y
Server-Sent Events (SSE). Se utiliza la base `(default)` existente; las reglas de
acceso de Firestore se mantienen cerradas y la suscripción pasa por el servidor.

El avance general (registrados, pendientes y porcentaje) y el indicador de
conexión aparecen en los tres módulos, incluida la bienvenida. Si se pierde la conexión,
el navegador intenta recuperarla automáticamente y recibe una lista completa al
reconectar. Mientras el canal se recupera, consulta los datos cada 5 segundos como
respaldo. Para trabajar en cinco computadoras, abre la misma dirección del sistema
en cada una y mantén su conexión a internet. No es necesario recargar la página.
Las consultas de respaldo se ejecutan de una en una y se cancelan tras 10 segundos
para evitar que una conexión lenta bloquee el canal de actualizaciones.

Las llegadas se guardan en transacciones: si dos equipos registran al mismo médico,
se conserva la primera asistencia y su boleto, y el segundo equipo recibe un aviso.
Cada número de boleto queda reservado para un solo médico al agregarlo o confirmar
la llegada; la comparación ignora espacios al inicio y final y diferencias entre
mayúsculas y minúsculas. Si el número ya está asignado, el sistema lo rechaza y
muestra un aviso.
Al deshacer una llegada, se verifica que corresponda a la que el operador tenía
abierta; si otro equipo registró una llegada nueva, la solicitud anterior se rechaza.
Las estadísticas se calculan a partir de la misma lista sincronizada. El servidor
debe permitir respuestas HTTP en streaming sin buffering para `/api/admin/attendance/stream`.
La conexión se renueva automáticamente cada cuatro minutos para respetar los
límites de duración de las solicitudes del servidor.

### Diseño adaptable

La interfaz adapta el menú, los formularios y los gráficos al ancho y a la altura
disponibles. En tabletas la lista se presenta en dos columnas de tarjetas; en
móviles, en una columna; y en pantallas amplias conserva la tabla. Los campos usan
un tamaño de letra de al menos 16 px y los controles táctiles tienen áreas de
interacción amplias. Las ventanas de registro ajustan su altura al espacio visible
al girar el dispositivo o abrir el teclado. Se respetan las áreas seguras de pantalla
y el zoom del navegador.

### Datos ficticios para pruebas

Para agregar 20 registros identificados como **PRUEBA** a la lista compartida,
ejecuta `node scripts/attendance-demo.cjs seed`. Incluye médicos de HAQ y HACS,
con y sin boleto, y estados de asistencia pendientes y confirmados. Para quitar
solo esos registros después, ejecuta `node scripts/attendance-demo.cjs clear --confirm`.
Para revisar el total sin mostrar otros invitados, ejecuta
`node scripts/attendance-demo.cjs verify`.
La limpieza valida el marcador interno de cada registro y conserva los demás
invitados.

## Estado temporal del módulo de encuestas

El módulo de encuestas está desactivado por defecto. La portada muestra el espacio
de asistencia y las páginas y API de encuestas responden como no disponibles. El
código y las respuestas existentes se conservan.

Para volver a habilitar las encuestas temporalmente, define `ENABLE_SURVEYS="true"`
en el entorno de ejecución y reinicia la aplicación. El valor predeterminado es
`false`.

## Stack

- Node.js 22 LTS
- npm
- Next.js con App Router
- React
- TypeScript estricto
- Tailwind CSS
- MySQL 8.4 con Docker Compose
- Prisma ORM
- Zod
- SurveyJS
- Auth.js
- bcryptjs
- Recharts
- ExcelJS
- PDFKit
- Nodemailer
- Vitest
- Playwright
- ESLint
- Prettier

## Requisitos

- Node.js 22
- npm
- Docker Desktop o Docker Compose

## Instalacion

```bash
npm install
```

Crear el archivo local de variables si no existe:

```bash
cp .env.example .env
```

En Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

## Base de datos

La base de datos debe llamarse exactamente:

```text
encuestashaq
```

Estado actual: Prisma incluye el modelo `SurveyResponse` y una migracion para guardar cada encuesta contestada. Las respuestas completas se almacenan como JSON junto con el idioma y la fecha de envio.

## Iniciar MySQL

```bash
docker compose up -d --wait
npm run db:migrate
```

El contenedor local se llama `encuestashaq_mysql` y usa la imagen `mysql:8.4`.

## Detener MySQL

```bash
docker compose down
```

Para conservar los datos locales se mantiene el volumen `encuestashaq_mysql_data`.

## Iniciar Next.js

```bash
npm run dev
```

La aplicacion queda disponible en:

```text
http://localhost:3000
```

## Rutas

- `/`: tabla pública de invitados y registro de asistencia, sin inicio de sesión.
- `/encuesta/[token]`: no disponible mientras las encuestas estén desactivadas.
- `/admin`: redirige a la lista principal en `/`.
- `/api/admin/attendance`: consulta, agrega invitados y registra o deshace asistencias sin autenticación.
- `/admin/login`: redirige al sistema público en `/`.
- `/api/health`: estado basico de la aplicacion, sin consultar la base de datos.
- `/api/survey-responses`: desactivada mientras `ENABLE_SURVEYS` sea `false`.

## Comandos de calidad

```bash
npm run format
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

Para E2E, iniciar primero la aplicacion en otra terminal:

```bash
npm run dev -- --hostname 127.0.0.1
npm run test:e2e
```

Comandos de Prisma:

```bash
npm run db:generate
npm run db:migrate
npm run db:studio
```

## Estructura de carpetas

```text
src/
  app/
  components/
  modules/
  lib/
  types/
prisma/
tests/
docs/
```

## Proximos pasos

- Configurar SMTP y habilitar Google como proveedor en Firebase Authentication.
- Construir reportes y exportaciones.
- Configurar envio de correos.
- Agregar auditoria.
