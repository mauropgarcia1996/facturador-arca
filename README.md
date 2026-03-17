# ARCA Facturador

Facturador electrónico para ARCA/AFIP Argentina. Diseñado específicamente para emisión de **Facturas E de Exportación de Servicios** con flujo ultra-simplificado.

## 🎯 Características

- ✅ **Cliente Deel Inc. pre-guardado** - Solo ingresás el monto USD
- ✅ **Tipo de cambio automático** - Desde ARCA en tiempo real
- ✅ **Autenticación automática** - Conecta con ARCA al abrir
- ✅ **UI Mobile-first** - Optimizado para usar desde el celular
- ✅ **Factura E Exportación** - Código 19 para servicios al exterior
- ✅ **Sin dependencias externas** - Solo Node.js nativo

## 📋 Requisitos

- Node.js 18+
- Certificado digital ARCA (.crt)
- Clave privada (.key)
- CUIT habilitado para facturación electrónica

## 🚀 Instalación

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.local.example .env.local
# Editar .env.local con tus datos:
# - CUIT
# - Rutas a certificados
# - Puntos de venta
# - Credenciales de acceso a la app (APP_LOGIN_*)

# Iniciar servidor de desarrollo
npm run dev
```

## ⚙️ Configuración

Editá el archivo `.env.local`:

### Desarrollo local (archivos)

```env
# Acceso a la app (Basic Auth)
# IMPORTANTE: configurá estas 2 variables con valores fuertes para que solo puedas entrar vos.
APP_LOGIN_USER=tu_usuario
APP_LOGIN_PASSWORD=tu_password_largo

# Tu CUIT (11 dígitos, sin guiones)
ARCA_CUIT=20400492140

# Rutas a certificados (archivos .crt y .key)
ARCA_CERT_PATH=./certs/tu_certificado.crt
ARCA_KEY_PATH=./certs/tu_clave.key

# URLs de ARCA (Producción)
ARCA_WSAA_URL=https://wsaa.afip.gov.ar/ws/services/LoginCms




```

### Vercel + Auth Service (recomendado para producción)

Para Vercel, usá un **Auth Service** desplegado en Railway o Render que hace la autenticación con OpenSSL:

1. Desplegá el auth service (ver `auth-service/README.md`):
   - Creá un proyecto en [Railway](https://railway.app) o [Render](https://render.com)
   - Root directory: `auth-service`
   - Variables: `ARCA_CUIT`, `ARCA_WSAA_URL`, `ARCA_CERT_BASE64`, `ARCA_KEY_BASE64`, `ARCA_AUTH_API_KEY`

2. **En Vercel** → Project → Settings → Environment Variables:
   - `ARCA_AUTH_SERVICE_URL` = URL del auth service (ej: `https://xxx.up.railway.app`)
   - `ARCA_AUTH_API_KEY` = la misma clave que en el auth service
   - `ARCA_CUIT` = tu CUIT (lo usa la app para otras APIs)

No necesitás certificados en Vercel; van solo en el auth service.

## 📱 Uso

### Flujo Factura E (Deel Inc.):

1. **Abrí la app** - Se conecta automáticamente a ARCA
2. **Deel Inc. ya está seleccionado**
3. **Editá la descripción** si es necesario (default: "software developing services")
4. **Ingresá el monto USD** (ej: 1600)
5. **El tipo de cambio se carga automático**
6. **Tocá "EMITIR FACTURA E"**
7. **Listo!** - Te muestra el CAE y número de factura

### Agregar nuevos clientes:

Editá el archivo `lib/db/clientes.ts` y agregá a `clientesGuardados`:

```typescript
{
  id: "cliente-nuevo",
  nombre: "Nombre Empresa",
  direccion: "Dirección",
  ciudad: "Ciudad",
  estado: "Estado",
  codigoPostal: "CP",
  pais: {
    nombre: "PAIS",
    codigoCUIT: "5500000XXXX",  // Código ARCA del país
    codigoISO: "XX"
  },
  idImpositivo: "ID tributario del país",
  servicioDefault: "descripción servicio",
  moneda: "USD"
}
```

## 🏗️ Estructura del Proyecto

```
arca-facturador/
├── app/
│   ├── api/              # API Routes (Next.js)
│   ├── layout.tsx        # Layout principal
│   ├── page.tsx          # Dashboard mobile-first
│   └── globals.css       # Estilos Tailwind
├── lib/
│   ├── arca/             # Módulos ARCA
│   │   ├── wsaa.ts       # Autenticación
│   │   ├── wsfe.ts       # Facturación
│   │   ├── crypto.ts     # Firma digital
│   │   └── soap.ts       # Utilidades SOAP
│   ├── db/
│   │   └── clientes.ts   # Clientes guardados
│   └── types/
│       └── factura.ts    # TypeScript interfaces
├── certs/                # Certificados (no commitear!)
└── .env.local            # Configuración
```

## 🔧 Comandos

```bash
npm run dev      # Servidor de desarrollo
npm run build    # Build para producción
npm run start    # Iniciar en producción
npm run lint     # Linting
npm run typecheck # TypeScript check
```

## 📝 Notas Importantes

1. **Certificados**: Guardá tus archivos `.crt` y `.key` en la carpeta `certs/` y **nunca los commitees**
2. **Autenticación**: El token dura 12 horas. La app se re-autentica automáticamente
3. **Tipo de cambio**: Se obtiene automáticamente de ARCA, pero podés ajustarlo manualmente si es necesario
4. **Punto de venta**: La Factura E usa el PV 5 por defecto

## ⚠️ Troubleshooting

### "Error de autenticación con ARCA"
- Verificá que los certificados sean válidos y no estén vencidos
- Verificá que el CUIT esté correcto en `.env.local`

### "Error al emitir factura"
- Revisá que el punto de venta 5 esté habilitado para Factura E en ARCA
- Verificá que el tipo de cambio sea mayor a 0

### "No se pudo conectar con ARCA"
- Verificá tu conexión a internet
- Probá con `curl https://wsaa.afip.gov.ar/ws/services/LoginCms`

### Vercel: "Authentication failed"
- Usá el Auth Service (ver `auth-service/README.md`): desplegá en Railway o Render y configurá `ARCA_AUTH_SERVICE_URL` y `ARCA_AUTH_API_KEY` en Vercel
- No uses certificados en Vercel; van solo en el auth service

## 🎨 UI Mobile-First

La interfaz está diseñada para uso desde el celular:
- Botones grandes (fáciles de tocar)
- Formularios con campos grandes
- Información agrupada visualmente
- Colores de estado claros (verde=éxito, rojo=error)

## 📄 Licencia

Uso personal. No para redistribución comercial.

---

**Hecho con ❤️ para simplular la facturación a ARCA**
