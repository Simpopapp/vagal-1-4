/**
 * Minimal promise-based IndexedDB wrapper (PRD D13: no `idb` dependency).
 *
 * The surface is deliberately narrow: open, put, get, delete, and index
 * lookups. Everything above this lives in `repo.ts`.
 *
 * Runs in the browser; tests drive it with `fake-indexeddb`.
 */

import { DB_NAME, DB_VERSION, SCHEMA, type StoreName } from "./schema";

let dbPromise: Promise<IDBDatabase> | null = null;

export class DatabaseError extends Error {
  constructor(
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = "DatabaseError";
  }
}

/**
 * Opens (and creates/upgrades) the database once per page.
 *
 * Upgrades are additive: missing stores are created, missing indexes added.
 * Existing records are never touched by an upgrade.
 */
export function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
      reject(new DatabaseError("could not open local storage", error));
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      const tx = request.transaction;
      if (!tx) return;

      for (const [name, def] of Object.entries(SCHEMA)) {
        const store = db.objectStoreNames.contains(name)
          ? tx.objectStore(name)
          : db.createObjectStore(name, {
              keyPath: def.keyPath,
              autoIncrement: def.autoIncrement ?? false,
            });

        for (const [indexName, spec] of Object.entries(def.indexes)) {
          if (!store.indexNames.contains(indexName)) {
            store.createIndex(indexName, spec.keyPath, { unique: spec.unique === true });
          }
        }
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new DatabaseError("could not open local storage", request.error));
    request.onblocked = () =>
      reject(new DatabaseError("local storage upgrade blocked by another open tab"));
  });

  dbPromise.catch(() => {
    // A failed open must not poison later attempts (e.g. a blocked upgrade
    // that succeeds once the other tab closes).
    dbPromise = null;
  });

  return dbPromise;
}

/** Test/shutdown hook: drops the cached connection so the store can be reset. */
export async function closeDatabase(): Promise<void> {
  const pending = dbPromise;
  dbPromise = null;
  if (!pending) return;
  const db = await pending.catch(() => null);
  db?.close();
}

function wrap<T>(request: IDBRequest<T>, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new DatabaseError(`${what} failed`, request.error));
  });
}

async function withStore<R>(
  store: StoreName,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => Promise<R> | R,
): Promise<R> {
  const db = await openDatabase();
  const tx = db.transaction(store, mode);
  const result = await run(tx.objectStore(store));
  // IndexedDB commits on its own schedule; waiting for the transaction keeps
  // a resolved write honest even if the tab is closed right after.
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(new DatabaseError(`${store} transaction aborted`, tx.error));
    tx.onerror = () => reject(new DatabaseError(`${store} transaction failed`, tx.error));
  });
  return result;
}

export function put<T>(store: StoreName, value: T): Promise<T> {
  return withStore(store, "readwrite", (s) => wrap(s.put(value), "put").then(() => value));
}

export function putMany<T>(store: StoreName, values: T[]): Promise<T[]> {
  if (values.length === 0) return Promise.resolve(values);
  return withStore(store, "readwrite", (s) =>
    Promise.all(values.map((v) => wrap(s.put(v), "put"))).then(() => values),
  );
}

export function get<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  return withStore(store, "readonly", (s) => wrap(s.get(key), "get").then((v) => v ?? undefined));
}

export function remove(store: StoreName, key: IDBValidKey): Promise<void> {
  return withStore(store, "readwrite", (s) => wrap(s.delete(key), "delete").then(() => undefined));
}

export function getAll<T>(store: StoreName): Promise<T[]> {
  return withStore(store, "readonly", (s) => wrap(s.getAll(), "getAll"));
}

export function count(store: StoreName): Promise<number> {
  return withStore(store, "readonly", (s) => wrap(s.count(), "count"));
}

export function clear(store: StoreName): Promise<void> {
  return withStore(store, "readwrite", (s) => wrap(s.clear(), "clear").then(() => undefined));
}

/** Reads every record whose indexed value equals `value`. */
export function indexAll<T>(store: StoreName, index: string, value: IDBValidKey): Promise<T[]> {
  return withStore(store, "readonly", (s) => wrap(s.index(index).getAll(value), "index.getAll"));
}

/** Reads the first record whose indexed value equals `value`, if any. */
export async function indexFirst<T>(
  store: StoreName,
  index: string,
  value: IDBValidKey,
): Promise<T | undefined> {
  const rows = await indexAll<T>(store, index, value);
  return rows[0];
}

/** Reads records whose indexed value falls inside `range`, ascending. */
export function indexRange<T>(
  store: StoreName,
  index: string,
  range: IDBKeyRange,
  limit?: number,
): Promise<T[]> {
  return withStore(store, "readonly", (s) =>
    wrap(s.index(index).getAll(range, limit), "index.getAll(range)"),
  );
}

/** Whether an index already holds `value` — used to keep queues idempotent. */
export function indexHas(store: StoreName, index: string, value: IDBValidKey): Promise<boolean> {
  return withStore(store, "readonly", (s) =>
    wrap(s.index(index).count(value), "index.count").then((n) => n > 0),
  );
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
