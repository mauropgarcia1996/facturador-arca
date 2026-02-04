# ARCA Auth Service

Microservicio de autenticación WSAA para ARCA/AFIP. Usa OpenSSL para la firma CMS (compatible con AFIP). Pensado para desplegar en Railway o Render y ser llamado desde la app en Vercel.

## Requisitos

- Node.js 18+
- OpenSSL (incluido en Railway/Render por defecto)

## Variables de entorno

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `ARCA_CUIT` | Sí | Tu CUIT (11 dígitos) |
| `ARCA_WSAA_URL` | Sí | `https://wsaa.afip.gov.ar/ws/services/LoginCms` |
| `ARCA_CERT_PATH` | Sí* | Ruta al certificado .crt |
| `ARCA_KEY_PATH` | Sí* | Ruta a la clave .key |
| `ARCA_CERT_BASE64` | Sí* | Certificado PEM en base64 (alternativa a paths) |
| `ARCA_KEY_BASE64` | Sí* | Clave PEM en base64 (alternativa a paths) |
| `ARCA_AUTH_API_KEY` | No | Si se define, las requests deben incluir `X-Api-Key: <valor>` |

*Usar paths O base64, no ambos.

## Despliegue en Railway

1. Creá una cuenta en [railway.app](https://railway.app)
2. **New Project** → **Deploy from GitHub repo**
3. Seleccioná tu repo. En "Root Directory" poné `auth-service`
4. En **Variables** agregá:
   - `ARCA_CUIT` = tu CUIT
   - `ARCA_WSAA_URL` = `https://wsaa.afip.gov.ar/ws/services/LoginCms`
   - `ARCA_CERT_BASE64` = `base64 -w0 certificado.crt` (Linux) o `base64 -i certificado.crt \| tr -d '\n'` (macOS)
   - `ARCA_KEY_BASE64` = mismo para la clave .key
   - `ARCA_AUTH_API_KEY` = una clave secreta que vas a usar en Vercel
5. **Deploy**. Railway te da una URL tipo `https://xxx.up.railway.app`
6. En Vercel, agregá `ARCA_AUTH_SERVICE_URL=https://xxx.up.railway.app` y `ARCA_AUTH_API_KEY=<la misma clave>`

## Despliegue en Render

1. Creá una cuenta en [render.com](https://render.com)
2. **New** → **Web Service**
3. Conectá tu repo. En **Root Directory** poné `auth-service`
4. **Build Command**: `npm install`
5. **Start Command**: `npm start`
6. En **Environment** agregá las mismas variables que en Railway
7. **Create Web Service**. La URL será tipo `https://xxx.onrender.com`
8. En Vercel, agregá `ARCA_AUTH_SERVICE_URL` y `ARCA_AUTH_API_KEY`

## Probar localmente

```bash
cd auth-service
npm install
# Configurá .env o export las variables
export ARCA_CUIT=20400492140
export ARCA_WSAA_URL=https://wsaa.afip.gov.ar/ws/services/LoginCms
export ARCA_CERT_PATH=../certs/certificado.crt
export ARCA_KEY_PATH=../certs/clave.key
npm start
```

En otra terminal:

```bash
curl -X POST http://localhost:3001/auth -H "Content-Type: application/json"
```

Si definiste `ARCA_AUTH_API_KEY`:

```bash
curl -X POST http://localhost:3001/auth -H "X-Api-Key: tu-clave-secreta"
```
