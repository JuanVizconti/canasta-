# Canasta

Aplicación web de supermercado para compras online. Este repositorio contiene el MVP en un monorepo simple.

## Estructura

- `frontend/`: aplicación Angular.
- `backend/`: API NestJS.
- `AGENTS.md`: alcance, reglas de negocio y decisiones vigentes.

## Requisitos

- Node.js 24 o superior.
- npm 11 o superior.

## Primeros pasos

```bash
npm install
npm run db:up
npm run start:frontend
npm run start:backend
```

Para preparar la base local, copiá `backend/.env.example` a `backend/.env` y ejecutá la migración con `npm run prisma:migrate:deploy --workspace=backend`.

El frontend se sirve con Angular y el backend queda disponible en el puerto `3000` por defecto. La persistencia inicial contiene solamente el modelo `Product`; no se incorporan pagos ni otras entidades del MVP.
