import { promises as fs } from "fs";
import path from "path";
import type { MailAccount, MailMessage } from "./types";

interface MailStore {
  accounts: MailAccount[];
  messages: MailMessage[];
}

const storePath = path.join(process.cwd(), "data", "mail-store.json");

const emptyStore: MailStore = {
  accounts: [],
  messages: []
};

async function ensureStore() {
  await fs.mkdir(path.dirname(storePath), { recursive: true });

  try {
    await fs.access(storePath);
  } catch {
    await fs.writeFile(storePath, JSON.stringify(emptyStore, null, 2), "utf8");
  }
}

export async function readStore(): Promise<MailStore> {
  await ensureStore();
  const raw = await fs.readFile(storePath, "utf8");
  if (!raw.trim()) {
    return { accounts: [], messages: [] };
  }
  try {
    return JSON.parse(raw) as MailStore;
  } catch {
    return { accounts: [], messages: [] };
  }
}

export async function writeStore(store: MailStore) {
  await ensureStore();
  await fs.writeFile(storePath, JSON.stringify(store, null, 2), "utf8");
}

export function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}
