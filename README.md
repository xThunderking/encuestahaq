# Asistencia Médica HAQ

Aplicación HAQ preparada para el control de asistencia médica en eventos.

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

- `/`: espacio de asistencia médica para eventos.
- `/encuesta/[token]`: no disponible mientras las encuestas estén desactivadas.
- `/admin`: panel de encuestas, temporalmente desactivado; cuando se habilita,
  ofrece acceso mediante Google y un
  código de seis dígitos enviado al correo de la cuenta Google seleccionada.
  Todo correo de Google que complete ambas verificaciones obtiene acceso
  administrativo.
- `/admin/login`: redirige al acceso administrativo en `/admin`.
- `/api/health`: estado basico de la aplicacion, sin consultar la base de datos.
- `/api/survey-responses`: guarda las encuestas completadas.

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
