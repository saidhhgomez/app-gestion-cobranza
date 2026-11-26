import type { SQLiteDatabase } from 'expo-sqlite';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import initSqlJs, { type BindParams, type Database, type SqlJsStatic } from 'sql.js';
let engine: SqlJsStatic;
const connections = new Map<string, { current: Database }>();
export const root = path.resolve('.test-output', `native-adapters-${crypto.randomUUID()}`);
export async function initialize() {
  engine = await initSqlJs({
    wasmBinary: new Uint8Array(fs.readFileSync(require.resolve('sql.js/dist/sql-wasm.wasm')))
      .buffer,
  });
  fs.mkdirSync(root, { recursive: true });
}
export function clean() {
  for (const value of connections.values()) value.current.close();
  connections.clear();
  fs.rmSync(root, { recursive: true, force: true });
}
export class Directory {
  uri: string;
  constructor(...parts: (string | File | Directory)[]) {
    this.uri = path.resolve(...parts.map((p) => (typeof p === 'string' ? p : p.uri)));
  }
  get exists() {
    return fs.existsSync(this.uri) && fs.statSync(this.uri).isDirectory();
  }
  get name() {
    return path.basename(this.uri);
  }
  create(options?: { idempotent?: boolean; intermediates?: boolean }) {
    fs.mkdirSync(this.uri, { recursive: !!options?.idempotent || !!options?.intermediates });
  }
  list() {
    return fs
      .readdirSync(this.uri, { withFileTypes: true })
      .map((e) => (e.isDirectory() ? new Directory(this.uri, e.name) : new File(this.uri, e.name)));
  }
  delete() {
    fs.rmSync(this.uri, { recursive: true, force: true });
  }
  async move(destination: Directory) {
    await Promise.resolve();
    fs.renameSync(this.uri, destination.uri);
    this.uri = destination.uri;
  }
}
export class File {
  uri: string;
  constructor(...parts: (string | File | Directory)[]) {
    this.uri = path.resolve(...parts.map((p) => (typeof p === 'string' ? p : p.uri)));
  }
  get exists() {
    return fs.existsSync(this.uri) && fs.statSync(this.uri).isFile();
  }
  get size() {
    return fs.statSync(this.uri).size;
  }
  get lastModified() {
    return fs.statSync(this.uri).mtimeMs;
  }
  get name() {
    return path.basename(this.uri);
  }
  create(options?: { overwrite?: boolean }) {
    fs.writeFileSync(this.uri, '', { flag: options?.overwrite ? 'w' : 'wx' });
  }
  async write(value: string | Uint8Array) {
    await Promise.resolve();
    fs.writeFileSync(this.uri, value);
  }
  writeSync(value: string | Uint8Array) {
    fs.writeFileSync(this.uri, value);
  }
  async bytes() {
    return new Uint8Array(fs.readFileSync(this.uri));
  }
  async text() {
    return fs.readFileSync(this.uri, 'utf8');
  }
  async copy(destination: File) {
    await Promise.resolve();
    fs.copyFileSync(this.uri, destination.uri);
  }
  delete() {
    fs.unlinkSync(this.uri);
  }
  async move(destination: File) {
    await Promise.resolve();
    fs.renameSync(this.uri, destination.uri);
    this.uri = destination.uri;
  }
  moveSync(destination: File) {
    fs.renameSync(this.uri, destination.uri);
    this.uri = destination.uri;
  }
}
function params(args: unknown[]): BindParams {
  return (args.length === 1 && Array.isArray(args[0]) ? args[0] : args) as BindParams;
}
function adapter(state: { current: Database }, filename: string): SQLiteDatabase {
  const result = {
    databasePath: filename,
    execAsync: async (sql: string) => {
      state.current.exec(sql);
    },
    runAsync: async (sql: string, ...args: unknown[]) => {
      state.current.run(sql, params(args));
      return { changes: state.current.getRowsModified(), lastInsertRowId: 0 };
    },
    getAllAsync: async (sql: string, ...args: unknown[]) => {
      const st = state.current.prepare(sql);
      try {
        st.bind(params(args));
        const rows = [];
        while (st.step()) rows.push(st.getAsObject());
        return rows;
      } finally {
        st.free();
      }
    },
    getFirstAsync: async (sql: string, ...args: unknown[]) => {
      const st = state.current.prepare(sql);
      try {
        st.bind(params(args));
        return st.step() ? st.getAsObject() : null;
      } finally {
        st.free();
      }
    },
    serializeAsync: async () => state.current.export(),
    closeAsync: async () => {
      if (!connections.has(filename)) state.current.close();
    },
    _state: state,
  };
  return result as unknown as SQLiteDatabase;
}
const openDatabaseAsync = jest.fn(async (name: string, _options?: unknown, directory?: string) => {
  const filename = path.resolve(directory ?? root, name);
  let state = connections.get(filename);
  if (!state || (directory && !fs.existsSync(filename))) {
    if (state) state.current.close();
    state = { current: new engine.Database() };
    connections.set(filename, state);
    fs.writeFileSync(filename, state.current.export());
  }
  return adapter(state, filename);
});
const deserializeDatabaseAsync = jest.fn(async (bytes: Uint8Array) =>
  adapter({ current: new engine.Database(bytes) }, path.join(root, crypto.randomUUID())),
);
export const backupDatabaseAsync = jest.fn(
  async ({
    sourceDatabase,
    destDatabase,
  }: {
    sourceDatabase: SQLiteDatabase;
    destDatabase: SQLiteDatabase;
  }) => {
    const get = (db: SQLiteDatabase) => (db as unknown as { _state: { current: Database } })._state;
    const source = get(sourceDatabase);
    const destination = get(destDatabase);
    const bytes = source.current.export();
    destination.current.close();
    destination.current = new engine.Database(bytes);
    if (fs.existsSync(destDatabase.databasePath))
      fs.writeFileSync(destDatabase.databasePath, bytes);
  },
);
export const sqlite = { openDatabaseAsync, deserializeDatabaseAsync, backupDatabaseAsync };
export const fileSystem = { Directory, File, Paths: { document: root, cache: root } };
export const nativeCrypto = {
  randomUUID: () => crypto.randomUUID(),
  getRandomBytesAsync: async (n: number) => new Uint8Array(crypto.randomBytes(n)),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_algorithm: string, value: string) =>
    crypto.createHash('sha256').update(value).digest('hex'),
  digest: async (_algorithm: string, value: ArrayBuffer) =>
    new Uint8Array(crypto.createHash('sha256').update(new Uint8Array(value)).digest()).buffer,
};
