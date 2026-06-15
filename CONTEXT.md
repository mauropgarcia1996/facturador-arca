# ARCA Facturador — Domain Context

Personal **Next.js 15** web app for issuing **Argentine electronic export invoices (Factura E)** via ARCA/AFIP. Optimized for a single recurring workflow: bill **Deel Inc.** for software services in USD from a phone.

Use this file (not README alone) for domain vocabulary, architecture, and what is in/out of scope. README covers install and env setup.

---

## Glossary

| Term | Meaning in this repo |
|------|----------------------|
| **ARCA / AFIP** | Argentina tax authority. We call the integration "ARCA"; web services use AFIP endpoints. |
| **WSAA** | Web Service de Autenticación y Autorización. Returns `token` + `sign` (12h TTL). Service name: `wsfex`. |
| **WSFEX** | Web Service Factura Electrónica de Exportación. SOAP at `servicios1.afip.gov.ar/wsfexv1/service.asmx`. |
| **Factura E** | Export invoice. **Tipo comprobante 19** in WSFEX. Only type implemented end-to-end. |
| **CAE** | Código de Autorización Electrónico. Returned by `FEXAuthorize` on success. |
| **Punto de venta (PV)** | Sales point registered in ARCA for export (`FEEWS`). UI defaults to **5**; server resolves via `FEXGetPARAM_PtoVenta`. |
| **Tipo de cambio / cotización** | Exchange rate. For services (`Tipo_expo=2`), ARCA requires **previous business day** rate (validation 2053). Source: `FEXGetPARAM_MON_CON_COTIZACION`. |
| **Dst_cmp** | Destination country code from `FEXGetPARAM_DST_pais`. Resolved from client country (e.g. USA → 555). |
| **Cliente exportación** | Foreign client record in `lib/db/clientes.ts` (`ClienteExportacion`). Not a DB entity — hardcoded array. |
| **auth-service** | Express microservice (`auth-service/`) on Railway/Render. Holds certs, signs WSAA with OpenSSL, proxies WSFEX SOAP. Required for Vercel production. |
| **Monotributo** | UI subtitle; operator tax regime. No special logic in code beyond Factura E export rules. |

**Avoid:** Calling this a "billing platform" or "SaaS" — it is a personal facturador with one primary client pre-loaded.

---

## Product scope

### In scope (implemented)

- Mobile-first single-page UI (`app/page.tsx`)
- Auto WSAA auth on load
- Display USD→ARS cotización from ARCA (previous business day)
- Emit **Factura E tipo 19** for **exportación de servicios** (`Tipo_expo=2`)
- Pre-saved export clients (currently **Deel Inc.** only)
- HTTP Basic Auth on entire app (`middleware.ts`)
- Local dev (certs on disk + node-forge) and production (Vercel + auth-service)

### Out of scope (not implemented)

- **Factura C** — type exists in `lib/types/factura.ts`, no UI/API
- Invoice PDF, email, history, persistence
- Dynamic client management UI (add via `lib/db/clientes.ts` only)
- Multi-tenant / multi-user
- Manual tipo de cambio override (UI shows rate but emission re-fetches from ARCA)
- `/api/puntosventa` wired to UI (API exists, unused)
- `ARCA_PV_C` / `ARCA_PV_E` env vars (defined in `.env.local.example`, unused)

### Known inconsistencies

- UI label says **"Bluelytics"** for tipo de cambio; **code uses ARCA/AFIP only** (`getTipoCambio` in `lib/arca/wsfe.ts`).
- README mentions manual tipo de cambio adjustment; UI has no edit field and `emitirFacturaE` ignores `factura.tipoCambio`.
- README says "sin dependencias externas"; production **depends on auth-service** on Railway/Render for Vercel deploys.

---

## Architecture

```
Browser (mobile UI)
  → middleware.ts (Basic Auth)
  → app/page.tsx
  → API routes (/api/auth, /api/tipocambio, /api/factura, /api/puntosventa)
  → lib/arca/* (WSAA + WSFEX SOAP)
  → [production] auth-service (Railway/Render) → AFIP
  → [local dev] direct to AFIP
```

### Why auth-service exists

Vercel datacenter IPs often **cannot reach AFIP** (`fetch failed`). Railway/Render can. When `ARCA_AUTH_SERVICE_URL` is set:

| Concern | Path |
|---------|------|
| WSAA auth | Next.js `POST /api/auth` → auth-service `POST /auth` |
| WSFEX SOAP | `wsfexFetch()` in `lib/arca/wsfe.ts` → auth-service `POST /wsfex` |

Certs live in auth-service env (`ARCA_CERT_BASE64` / `ARCA_KEY_BASE64`), not on Vercel.

### Signing strategies

| Environment | WSAA CMS signing |
|-------------|------------------|
| Local Next.js | `node-forge` in `lib/arca/crypto.ts` |
| auth-service | OpenSSL `cms -sign` in `auth-service/index.js` |

Both target service `wsfex` and Argentina timezone (`America/Argentina/Buenos_Aires`) for ticket timestamps.

---

## Emission pipeline (`emitirFacturaE`)

Order of WSFEX calls in `lib/arca/wsfe.ts`:

1. `FEXGetPARAM_PtoVenta` — pick enabled PV (prefer UI value 5)
2. `FEXGetLast_CMP` — next invoice number (tipo 19)
3. `FEXGetPARAM_DST_pais` — resolve `Dst_cmp` for client country
4. `FEXGetPARAM_MON_CON_COTIZACION` — cotización día hábil anterior (USD)
5. `FEXAuthorize` — submit comprobante, return CAE

Fixed emission fields: `Tipo_expo=2` (servicios), `Pro_umed=7`, `Forma_pago=Transferencia`, `Idioma_cbte=1`, single line item.

---

## API routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth` | POST | WSAA token/sign (local or via auth-service) |
| `/api/tipocambio` | POST | Body: `{ auth, moneda? }`. Returns ARCA cotización for display. |
| `/api/factura` | POST | Body: `{ auth, factura: FacturaE }`. Emits and returns CAE + número. |
| `/api/puntosventa` | POST | Body: `{ auth }`. Lists PVs from ARCA (not used by UI). |

Auth object shape: `{ token, sign, expirationTime? }`. CUIT comes from server env, not client.

---

## Environment variables

### Next.js app

| Variable | Required | Purpose |
|----------|----------|---------|
| `APP_LOGIN_USER` | Recommended | Basic Auth username (default `arca` if unset) |
| `APP_LOGIN_PASSWORD` | Recommended | Basic Auth password (default `changeme` if unset) |
| `ARCA_CUIT` | Yes | 11-digit CUIT |
| `ARCA_WSAA_URL` | Local dev | e.g. `https://wsaa.afip.gov.ar/ws/services/LoginCms` |
| `ARCA_CERT_PATH` + `ARCA_KEY_PATH` | Local dev | Certificate files |
| `ARCA_CERT_BASE64` + `ARCA_KEY_BASE64` | Alt local | PEM in base64 → written to `/tmp` |
| `ARCA_AUTH_SERVICE_URL` | Production | auth-service base URL |
| `ARCA_AUTH_API_KEY` | Production | Shared secret; `X-Api-Key` header |

Unused in code today: `ARCA_PV_C`, `ARCA_PV_E`, `ARCA_WSFE_URL`, `ARCA_ENV`.

### auth-service

See `auth-service/README.md`. Same cert/CUIT/WSAA vars plus optional `ARCA_AUTH_API_KEY`.

---

## Project layout

```
arca-facturador/
├── app/
│   ├── page.tsx              # Main UI (client component)
│   ├── layout.tsx
│   └── api/                  # auth, tipocambio, factura, puntosventa
├── lib/
│   ├── arca/
│   │   ├── wsaa.ts           # WSAA LoginCms
│   │   ├── wsfe.ts           # WSFEX (tipo cambio, emission, params)
│   │   ├── crypto.ts         # node-forge CMS signing
│   │   ├── cert-resolver.ts  # cert paths or base64 → /tmp
│   │   └── soap.ts           # SOAP envelope helper
│   ├── db/clientes.ts        # Hardcoded export clients
│   └── types/factura.ts      # FacturaE, FacturaC (unused), ClienteExportacion
├── auth-service/               # Express: /auth, /wsfex, /health
├── middleware.ts               # Basic Auth (all routes except _next static)
├── certs/                      # Local certs (gitignored)
├── start.sh                    # Dev helper: npm run dev + LAN URL for phone
└── test-auth.ts                # Legacy OpenSSL auth debug script (not part of app)
```

No `components/` directory, no test suite, no `vercel.json`. Project linked to Vercel (`arca-facturador`).

---

## Tech stack

- Next.js 15.1, React 19, Tailwind 3, TypeScript 5
- `node-forge` — PKCS#7/CMS for local WSAA
- auth-service — Express 4, OpenSSL CLI, no ORM/DB

---

## Security notes

- Entire app gated by Basic Auth; set strong `APP_LOGIN_*` in production.
- WSAA `token`/`sign` held in browser state and sent in API request bodies — acceptable for solo use; revisit if multi-user.
- auth-service optionally requires `X-Api-Key`.
- Certificates never committed (see `.gitignore`).

---

## Open decisions (unresolved)

1. **Product direction** — Stay personal Deel tool vs. generalize (more clients, Factura C, history)?
2. **Tipo de cambio display** — Align UI label with ARCA source or add separate market-rate reference?
3. **Punto de venta** — Keep hardcoded 5 vs. env config vs. UI picker using `/api/puntosventa`?

---

## Agent workflow

- Issues: `.scratch/<feature>/` (see `docs/agents/issue-tracker.md`)
- Triage labels: `docs/agents/triage-labels.md`
- ADRs: `docs/adr/` when decisions are recorded (none yet)
