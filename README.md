# Encuestas HAQ

Sistema de encuestas de satisfaccion hospitalaria con cuestionario responsivo y almacenamiento de respuestas en MySQL.

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

- `/`: cuestionario de satisfaccion.
- `/encuesta/[token]`: marcador provisional del modulo de encuestas.
- `/admin`: acceso administrativo y panel de encuestas. En desarrollo usa
  `Admin` como usuario y contraseña.
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

- Sustituir las credenciales administrativas de desarrollo antes de publicar.
- Construir reportes y exportaciones.
- Configurar envio de correos.
- Agregar auditoria.
