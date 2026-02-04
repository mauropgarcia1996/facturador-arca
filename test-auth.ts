// Script para probar autenticación con ARCA
import { execSync } from 'child_process';
import { mkdtempSync, writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const CUIT = '20400492140';
const CERT_PATH = './certs/facturador_48c3b2819966f619.crt';
const KEY_PATH = './certs/MiClavePrivada.key';

function formatARCADate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}-03:00`;
}

async function testAuth() {
  console.log('🔍 Probando autenticación con ARCA...\n');
  
  const now = new Date();
  const generationTime = new Date(now.getTime() - 5 * 60 * 1000);
  const expirationTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const uniqueId = Math.floor(Date.now() / 1000);
  
  const loginTicketRequest = `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${uniqueId}</uniqueId>
    <generationTime>${formatARCADate(generationTime)}</generationTime>
    <expirationTime>${formatARCADate(expirationTime)}</expirationTime>
  </header>
  <service>wsfe</service>
</loginTicketRequest>`;

  console.log('📄 LoginTicketRequest:');
  console.log(loginTicketRequest);
  console.log('');
  
  const tempDir = mkdtempSync(join(tmpdir(), 'arca-test-'));
  
  try {
    const dataFile = join(tempDir, 'data.txt');
    const cmsFile = join(tempDir, 'data.p7s');
    
    writeFileSync(dataFile, loginTicketRequest);
    
    console.log('🔐 Firmando con OpenSSL...');
    
    // Método 1: SMIME detached
    try {
      execSync(
        `openssl smime -sign -in "${dataFile}" -out "${cmsFile}" -signer "${CERT_PATH}" -inkey "${KEY_PATH}" -outform PEM -nodetach`,
        { stdio: 'pipe' }
      );
      
      const fs = require('fs');
      const cms = fs.readFileSync(cmsFile, 'utf-8');
      console.log('✅ Firma CMS generada exitosamente');
      console.log('📦 Primeros 200 caracteres del CMS:');
      console.log(cms.substring(0, 200) + '...\n');
      
    } catch (opensslError: any) {
      console.error('❌ Error al firmar:', opensslError.stderr?.toString() || opensslError.message);
      process.exit(1);
    }
    
    console.log('✅ Prueba completada');
    
  } finally {
    try {
      unlinkSync(join(tempDir, 'data.txt'));
      unlinkSync(join(tempDir, 'data.p7s'));
    } catch {}
  }
}

testAuth();
