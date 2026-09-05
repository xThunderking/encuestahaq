# Encuestas HAQ

Sistema de encuestas de satisfaccion hospitalaria. Esta etapa solo define la arquitectura inicial del proyecto y deja preparada la base tecnica para las siguientes fases.

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

Estado actual: Prisma esta configurado solo con `generator` y `datasource`. Todavia no existen tablas, modelos, migraciones ni datos de prueba.

## Iniciar MySQL

```bash
docker compose up -d
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

## Rutas provisionales

- `/`: pantalla inicial del sistema.
- `/encuesta/[token]`: marcador provisional del modulo de encuestas.
- `/admin/login`: marcador provisional de acceso administrativo.
- `/admin`: marcador provisional del panel administrativo.
- `/api/health`: estado basico de la aplicacion, sin consultar la base de datos.

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

Comandos de Prisma permitidos en esta etapa:

```bash
npm run db:generate
npm run db:studio
```

No hay scripts para migraciones, `db push` ni seeds.

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

Los modulos existen como contenedores de responsabilidad. No se han creado servicios, repositorios, modelos ficticios ni implementaciones funcionales completas.

## Proximos pasos

- Definir el modelo de datos en una siguiente etapa.
- Implementar autenticacion administrativa.
- Implementar el cuestionario con SurveyJS.
- Registrar respuestas.
- Construir reportes y exportaciones.
- Configurar envio de correos.
- Agregar auditoria.
