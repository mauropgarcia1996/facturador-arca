import fs from 'fs/promises';
import path from 'path';
import { get, put } from '@vercel/blob';
import {
  ComprobanteE,
  FacturasIndex,
  StoredComprobante,
} from '@/lib/types/comprobante';
import { comprobanteKey } from '@/lib/utils/comprobante';

const BLOB_PATHNAME = 'facturas/index.json';
const LOCAL_INDEX_PATH = path.join(process.cwd(), '.data/facturas-index.json');

function emptyIndex(): FacturasIndex {
  return { lastSyncedAt: null, items: [] };
}

function sortItems(items: StoredComprobante[]): StoredComprobante[] {
  return [...items].sort((a, b) => {
    if (a.fechaCbte !== b.fechaCbte) {
      return b.fechaCbte.localeCompare(a.fechaCbte);
    }
    return b.cbteNro - a.cbteNro;
  });
}

function usesBlobStorage(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function parseIndex(raw: string): FacturasIndex {
  const parsed = JSON.parse(raw) as FacturasIndex;
  if (!Array.isArray(parsed.items)) return emptyIndex();
  return {
    lastSyncedAt: parsed.lastSyncedAt ?? null,
    items: sortItems(parsed.items),
  };
}

async function readLocalIndex(): Promise<FacturasIndex> {
  try {
    const raw = await fs.readFile(LOCAL_INDEX_PATH, 'utf8');
    return parseIndex(raw);
  } catch {
    return emptyIndex();
  }
}

async function writeLocalIndex(index: FacturasIndex): Promise<void> {
  await fs.mkdir(path.dirname(LOCAL_INDEX_PATH), { recursive: true });
  await fs.writeFile(LOCAL_INDEX_PATH, JSON.stringify(index, null, 2), 'utf8');
}

async function readBlobIndex(): Promise<FacturasIndex> {
  const result = await get(BLOB_PATHNAME, {
    access: 'private',
    useCache: false,
  });
  if (!result || result.statusCode !== 200 || !result.stream) {
    return emptyIndex();
  }

  const raw = await new Response(result.stream).text();
  return parseIndex(raw);
}

async function writeBlobIndex(index: FacturasIndex): Promise<void> {
  await put(BLOB_PATHNAME, JSON.stringify(index), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  });
}

async function readIndex(): Promise<FacturasIndex> {
  if (usesBlobStorage()) {
    try {
      return await readBlobIndex();
    } catch (error) {
      console.error('[facturas storage] Failed to read Blob index:', error);
      throw error;
    }
  }
  return readLocalIndex();
}

async function writeIndex(index: FacturasIndex): Promise<void> {
  const payload: FacturasIndex = {
    lastSyncedAt: index.lastSyncedAt,
    items: sortItems(index.items),
  };

  if (usesBlobStorage()) {
    await writeBlobIndex(payload);
    return;
  }
  await writeLocalIndex(payload);
}

export async function listStoredFacturas(): Promise<FacturasIndex> {
  return readIndex();
}

export async function getStoredComprobante(
  puntoVta: number,
  cbteTipo: number,
  cbteNro: number
): Promise<StoredComprobante | null> {
  const index = await readIndex();
  const key = comprobanteKey(puntoVta, cbteTipo, cbteNro);
  return (
    index.items.find(
      (item) => comprobanteKey(item.puntoVta, item.cbteTipo, item.cbteNro) === key
    ) ?? null
  );
}

export async function upsertStoredComprobante(comprobante: ComprobanteE): Promise<StoredComprobante> {
  const index = await readIndex();
  const stored: StoredComprobante = {
    ...comprobante,
    syncedAt: new Date().toISOString(),
  };
  const key = comprobanteKey(stored.puntoVta, stored.cbteTipo, stored.cbteNro);
  const nextItems = index.items.filter(
    (item) => comprobanteKey(item.puntoVta, item.cbteTipo, item.cbteNro) !== key
  );
  nextItems.push(stored);

  await writeIndex({
    lastSyncedAt: index.lastSyncedAt,
    items: nextItems,
  });

  return stored;
}

export async function markFacturasSynced(): Promise<FacturasIndex> {
  const index = await readIndex();
  const updated: FacturasIndex = {
    ...index,
    lastSyncedAt: new Date().toISOString(),
  };
  await writeIndex(updated);
  return updated;
}

export async function replaceSyncedComprobantes(
  puntoVta: number,
  cbteTipo: number,
  comprobantes: ComprobanteE[]
): Promise<FacturasIndex> {
  const index = await readIndex();
  const syncedAt = new Date().toISOString();
  const incoming: StoredComprobante[] = comprobantes.map((comprobante) => ({
    ...comprobante,
    syncedAt,
  }));
  const kept = index.items.filter(
    (item) => !(item.puntoVta === puntoVta && item.cbteTipo === cbteTipo)
  );
  const updated: FacturasIndex = {
    lastSyncedAt: syncedAt,
    items: sortItems([...kept, ...incoming]),
  };
  await writeIndex(updated);
  return updated;
}

export function getStorageMode(): 'blob' | 'local' {
  return usesBlobStorage() ? 'blob' : 'local';
}
