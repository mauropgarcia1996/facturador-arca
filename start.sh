#!/bin/bash

echo "🚀 Iniciando ARCA Facturador..."
echo ""
echo "📱 Accesible desde:"
echo "   • Computadora: http://localhost:3000"
echo "   • Celular (misma red WiFi): http://$(ipconfig getifaddr en0):3000"
echo ""
echo "⚠️  IMPORTANTE:"
echo "   - Tu celular debe estar en la MISMA red WiFi que esta computadora"
echo "   - Usá la URL de arriba en tu navegador del celular"
echo ""
echo "Presioná Ctrl+C para detener el servidor"
echo ""

npm run dev
