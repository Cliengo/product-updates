# Product Updates — Cliengo (interno)

Landing interna para equipos cara a cliente (Marketing, Ventas, CS, Ops) que centraliza features lanzados, su estado real, y el material para comunicarlos al cliente.

---

## Cómo correr localmente

```bash
npm install
npm run sync:mock   # carga 12 features de ejemplo en SQLite
npm run dev         # inicia en http://localhost:3000
```

No necesitás ninguna credencial ni variable de entorno adicional para el modo mock.

---

## Arquitectura

```
product-updates/
├── app/
│   ├── page.tsx                  ← Landing (server component)
│   ├── features/[id]/page.tsx    ← Detalle (server component)
│   └── api/sync/route.ts         ← Endpoint del cron
├── components/                   ← UI components
├── lib/
│   ├── types.ts                  ← Tipos compartidos
│   ├── db/
│   │   ├── prisma.ts             ← Singleton de Prisma
│   │   └── repository.ts         ← Queries a la DB
│   └── sync/
│       ├── index.ts              ← Orchestrador del sync
│       ├── sources/
│       │   ├── mock.ts           ← Lee data/mock-features.json
│       │   └── github.ts         ← Lee GitHub Projects v2 (GraphQL)
│       └── parsers/
│           └── comment.ts        ← Parsea el comentario estructurado
├── data/
│   └── mock-features.json        ← 12 features de ejemplo
├── prisma/
│   └── schema.prisma             ← Modelo Feature (SQLite local)
└── proxy.ts                      ← Auth stub (Next.js 16)
```

**Para reemplazar el mock por las APIs reales** solo necesitás tocar 2 archivos:
- `lib/sync/sources/github.ts` — ya implementado, necesita las variables de entorno
- `.env` — cambiar `DATA_SOURCE=github` y agregar las credenciales de GitHub

---

## Variables de entorno

Copiá `.env.example` como `.env.local` (producción) o editá `.env` (local):

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | SQLite local: `file:./dev.db`. Postgres (Neon): connection string completo |
| `DATA_SOURCE` | `mock` (default) o `github` |
| `SYNC_SECRET_TOKEN` | Token para proteger `POST /api/sync` |
| `GITHUB_TOKEN` | PAT con permisos `read:project`, `read:org` |
| `GITHUB_PROJECT_ID_ROADMAP` | ID del Project v2 del repo Roadmap |
| `GITHUB_PROJECT_ID_RAP` | ID del Project v2 del repo RAP |
| `BYPASS_AUTH` | `true` para saltar auth en desarrollo |

### Cómo obtener los IDs de GitHub Projects v2

Ejecutá esta query en el [explorador GraphQL de GitHub](https://github.com/graphql) con tu token:

```graphql
query {
  organization(login: "cliengo") {
    projectsV2(first: 20) {
      nodes {
        id
        title
      }
    }
  }
}
```

Los IDs tienen el formato `PVT_kwXXXXXXXXXX`.

---

## Sync

El sync lee de GitHub (o mock), filtra issues con Status = "IN PROD" que tengan el comentario `## 📣 Product Update`, y hace upsert en la DB.

**Correr manualmente:**
```bash
npm run sync:mock          # mock, sin credenciales
DATA_SOURCE=github npx tsx scripts/sync-mock.ts  # GitHub real
```

**Cron automático (GitHub Actions) — crear `.github/workflows/sync.yml`:**
```yaml
on:
  schedule:
    - cron: '0 * * * *'
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger sync
        run: |
          curl -X POST https://tu-app.vercel.app/api/sync \
            -H "Authorization: Bearer ${{ secrets.SYNC_SECRET_TOKEN }}"
```

---

## Deploy en Vercel + Neon

### 1. Base de datos (Neon)
1. Crear proyecto en [neon.tech](https://neon.tech) (free tier)
2. Copiar el connection string

### 2. Migrar schema a PostgreSQL
Una línea en `prisma/schema.prisma`:
```diff
datasource db {
-  provider = "sqlite"
+  provider = "postgresql"
}
```
Luego: `npx prisma migrate deploy`

### 3. Vercel
1. Conectar el repo en [vercel.com](https://vercel.com)
2. Agregar las variables de entorno del `.env.example`
3. Deploy automático en cada push a `main`

### 4. GitHub Actions
Agregar `SYNC_SECRET_TOKEN` como secret en el repo y crear el workflow de arriba.

---

## Fase 2: LaunchDarkly (pendiente)

Cuando se sume LaunchDarkly real, los únicos cambios son:
- `lib/sync/sources/github.ts`: después de obtener `featureFlag` del comentario, consultar la API de LaunchDarkly para obtener estado real y % rollout
- `lib/types.ts`: agregar campos opcionales `flagEnabled`, `flagRolloutPercentage`

El resto de la UI y la DB no cambian.
