import { promises as fs } from "fs";
import path from "path";
import type { MailAccount, MailMessage } from "./types";

interface MailStore {
  accounts: MailAccount[];
  messages: MailMessage[];
}

interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: string[]): Promise<unknown>;
  quit(): Promise<void>;
}

const storePath = path.join(process.cwd(), "data", "mail-store.json");

const emptyStore: MailStore = {
  accounts: [],
  messages: []
};

// ---- Redis integration (optional) ----

let RedisConstructor: (new (url: string) => RedisLike) | null = null;

try {
  const ioredis = require("ioredis");
  RedisConstructor = ioredis.default || ioredis;
} catch {
  // ioredis not installed — will use JSON file only
}

function getRedisUrl() {
  return process.env.REDIS_URL || process.env["REDIS_URL"] || "";
}

function getRedisPrefix() {
  return process.env.REDIS_PREFIX || process.env["REDIS_PREFIX"] || "mail";
}

function getRedisTtl() {
  const raw = process.env.REDIS_TTL || process.env["REDIS_TTL"] || "2592000";
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 2592000;
}

function redisAvailable() {
  return Boolean(RedisConstructor && getRedisUrl());
}

async function redisRead(): Promise<MailStore | null> {
  if (!redisAvailable() || !RedisConstructor) return null;
  const client = new RedisConstructor(getRedisUrl());
  try {
    const raw = await client.get(`${getRedisPrefix()}:store`);
    if (raw) {
      return JSON.parse(raw) as MailStore;
    }
    return emptyStore;
  } catch {
    return null;
  } finally {
    await client.quit().catch(() => {});
  }
}

async function redisWrite(store: MailStore) {
  if (!redisAvailable() || !RedisConstructor) return;
  const client = new RedisConstructor(getRedisUrl());
  try {
    await client.set(`${getRedisPrefix()}:store`, JSON.stringify(store), "EX", String(getRedisTtl()));
  } finally {
    await client.quit().catch(() => {});
  }
}

// ---- File storage (fallback) ----

async function ensureStoreDir() {
  await fs.mkdir(path.dirname(storePath), { recursive: true });
}

export async function readStore(): Promise<MailStore> {
  // Try Redis first
  const redisResult = await redisRead();
  if (redisResult) return redisResult;

  // Fall back to JSON file
  await ensureStoreDir();
  try {
    const raw = await fs.readFile(storePath, "utf8");
    if (!raw.trim()) return emptyStore;
    return JSON.parse(raw) as MailStore;
  } catch {
    return emptyStore;
  }
}

export async function writeStore(store: MailStore) {
  // Write to Redis if available
  if (redisAvailable()) {
    await redisWrite(store);
    return;
  }

  // Fall back to JSON file
  await ensureStoreDir();
  await fs.writeFile(storePath, JSON.stringify(store, null, 2), "utf8");
}

export function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}
