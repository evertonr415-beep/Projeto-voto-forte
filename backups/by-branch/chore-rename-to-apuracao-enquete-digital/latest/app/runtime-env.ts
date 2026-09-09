import { AsyncLocalStorage } from "node:async_hooks";
import type { drizzle } from "drizzle-orm/d1";

export type RuntimeEnv = { DB?: Parameters<typeof drizzle>[0] };

const key = Symbol.for("voto-forte.runtime-env");
const root = globalThis as typeof globalThis & { [key]?: AsyncLocalStorage<RuntimeEnv> };
const storage = root[key] ??= new AsyncLocalStorage<RuntimeEnv>();

export function runWithRuntimeEnv<T>(env: RuntimeEnv, callback: () => T): T {
  return storage.run(env, callback);
}

export function getRuntimeEnv(): RuntimeEnv {
  return storage.getStore() ?? {};
}
