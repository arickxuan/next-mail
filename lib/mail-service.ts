import { ImapFlow } from "imapflow";
import { simpleParser, type AddressObject, type ParsedMail } from "mailparser";
import nodemailer from "nodemailer";
import { getProvider } from "./providers";
import { createId, readStore, writeStore } from "./store";
import type { AccountInput, MailAccount, MailMessage, SendMailInput } from "./types";

function withPreset(input: AccountInput): AccountInput {
  const preset = getProvider(input.provider);

  return {
    ...input,
    imap: input.imap ?? preset.imap,
    pop: input.pop ?? preset.pop,
    smtp: input.smtp ?? preset.smtp,
    graphBaseUrl: input.graphBaseUrl ?? preset.graphBaseUrl
  };
}

export async function listAccounts() {
  const store = await readStore();
  return store.accounts;
}

export async function createAccount(input: AccountInput) {
  const store = await readStore();
  const now = new Date().toISOString();
  const hydrated = withPreset(input);

  const account: MailAccount = {
    id: createId("acct"),
    email: hydrated.email,
    displayName: hydrated.displayName || hydrated.email,
    protocol: hydrated.protocol,
    provider: hydrated.provider,
    password: hydrated.password,
    refreshToken: hydrated.refreshToken,
    clientId: hydrated.clientId,
    accessToken: hydrated.accessToken,
    imap: hydrated.imap,
    pop: hydrated.pop,
    smtp: hydrated.smtp,
    graphBaseUrl: hydrated.graphBaseUrl,
    createdAt: now,
    updatedAt: now
  };

  store.accounts.unshift(account);
  await writeStore(store);
  return account;
}

export async function updateAccount(id: string, input: Partial<AccountInput>) {
  const store = await readStore();
  const index = store.accounts.findIndex((account) => account.id === id);

  if (index === -1) {
    throw new Error("账户不存在。");
  }

  const next = withPreset({
    ...store.accounts[index],
    ...input
  } as AccountInput);

  store.accounts[index] = {
    ...store.accounts[index],
    ...next,
    updatedAt: new Date().toISOString()
  };

  await writeStore(store);
  return store.accounts[index];
}

export async function deleteAccount(id: string) {
  const store = await readStore();
  store.accounts = store.accounts.filter((account) => account.id !== id);
  store.messages = store.messages.filter((message) => message.accountId !== id);
  await writeStore(store);
}

export async function importAccounts(inputs: AccountInput[]) {
  const created: MailAccount[] = [];

  for (const input of inputs) {
    created.push(await createAccount(input));
  }

  return created;
}

export async function listMessages(accountId?: string, folder?: string, page = 1, pageSize = 20) {
  const store = await readStore();
  let filtered = accountId
    ? store.messages.filter((message) => message.accountId === accountId)
    : store.messages;

  if (folder && folder !== "all") {
    filtered = filtered.filter((message) => message.folder === folder);
  }

  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const messages = filtered.slice(start, start + pageSize).map(
    // Strip body fields for list response — lightweight metadata only
    ({ body: _body, bodyHtml: _bodyHtml, ...meta }) => ({ ...meta, body: "", bodyHtml: undefined })
  );

  return { messages, total, page: Number(page), totalPages };
}

export async function getMessageById(id: string) {
  const store = await readStore();
  const message = store.messages.find((m) => m.id === id);
  if (!message) {
    throw new Error("邮件记录不存在。");
  }
  return message;
}

function stripHtml(value = "") {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function graphAddress(address?: { emailAddress?: { address?: string; name?: string } }) {
  return address?.emailAddress?.address || address?.emailAddress?.name || "";
}

interface GraphMessage {
  id: string;
  subject?: string;
  bodyPreview?: string;
  body?: {
    content?: string;
    contentType?: "html" | "text";
  };
  from?: {
    emailAddress?: {
      address?: string;
      name?: string;
    };
  };
  toRecipients?: Array<{
    emailAddress?: {
      address?: string;
      name?: string;
    };
  }>;
  receivedDateTime?: string;
  isRead?: boolean;
}

function formatParsedAddress(value?: AddressObject | AddressObject[]) {
  const addresses = Array.isArray(value) ? value : value ? [value] : [];
  return addresses
    .flatMap((item) => item.value)
    .map((item) => item.address || item.name)
    .filter(Boolean)
    .join(", ");
}

function parsedBody(message: ParsedMail) {
  return message.text?.trim() || stripHtml(message.html ? String(message.html) : "") || message.textAsHtml || "";
}

function parsedHtml(message: ParsedMail) {
  return message.html ? String(message.html) : undefined;
}

function toIsoDate(value?: string | Date) {
  return value ? new Date(value).toISOString() : new Date().toISOString();
}

async function syncImapAccountMessages(store: Awaited<ReturnType<typeof readStore>>, account: MailAccount) {
  if (!account.imap?.host || !account.password) {
    throw new Error("IMAP 账户缺少服务器或密码/授权码。");
  }

  const client = new ImapFlow({
    host: account.imap.host,
    port: account.imap.port,
    secure: account.imap.security === "ssl",
    auth: {
      user: account.email,
      pass: account.password
    },
    logger: false
  });

  await client.connect();

  try {
    const mailbox = await client.mailboxOpen("INBOX");
    const total = mailbox.exists || 0;

    if (!total) {
      return store.messages.filter((message) => message.accountId === account.id);
    }

    const start = Math.max(1, total - 29);

    for await (const remote of client.fetch(`${start}:*`, { uid: true, flags: true, internalDate: true, source: true })) {
      if (!remote.source) {
        continue;
      }

      const parsed = await simpleParser(remote.source);
      const externalId = `imap:${remote.uid}`;
      const existingIndex = store.messages.findIndex((message) => message.accountId === account.id && message.externalId === externalId);
      const message: MailMessage = {
        id: existingIndex >= 0 ? store.messages[existingIndex].id : createId("msg"),
        externalId,
        accountId: account.id,
        folder: "inbox",
        from: formatParsedAddress(parsed.from) || account.email,
        to: formatParsedAddress(parsed.to) || account.email,
        subject: parsed.subject || "(无主题)",
        body: parsedBody(parsed),
        bodyHtml: parsedHtml(parsed),
        read: remote.flags?.has("\\Seen") ?? false,
        createdAt: toIsoDate(parsed.date || remote.internalDate)
      };

      if (existingIndex >= 0) {
        store.messages[existingIndex] = message;
      } else {
        store.messages.push(message);
      }
    }

    store.messages.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
    await writeStore(store);
    return store.messages.filter((message) => message.accountId === account.id);
  } finally {
    await client.logout().catch(() => undefined);
  }
}

export async function syncAccountMessages(accountId: string) {
  const store = await readStore();
  const account = store.accounts.find((item) => item.id === accountId);

  if (!account) {
    throw new Error("账户不存在。");
  }

  if (account.protocol === "imap") {
    return syncImapAccountMessages(store, account);
  }

  if (account.protocol !== "graph") {
    return store.messages.filter((message) => message.accountId === accountId);
  }

  const accessToken = await getGraphAccessToken(account);
  const baseUrl = account.graphBaseUrl || "https://graph.microsoft.com/v1.0";
  const fields = ["id", "subject", "bodyPreview", "body", "from", "toRecipients", "receivedDateTime", "isRead"].join(",");
  const response = await fetch(`${baseUrl}/me/mailFolders/inbox/messages?$top=30&$orderby=receivedDateTime desc&$select=${fields}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Graph API 拉取失败：${response.status} ${detail}`);
  }

  const payload = (await response.json()) as { value?: GraphMessage[] };
  const remoteMessages = payload.value ?? [];

  for (const remote of remoteMessages) {
    const existingIndex = store.messages.findIndex((message) => message.accountId === account.id && message.externalId === remote.id);
    const body = remote.body?.contentType === "html" ? stripHtml(remote.body.content) : remote.body?.content || remote.bodyPreview || "";
    const message: MailMessage = {
      id: existingIndex >= 0 ? store.messages[existingIndex].id : createId("msg"),
      externalId: remote.id,
      accountId: account.id,
      folder: "inbox",
      from: graphAddress(remote.from) || account.email,
      to: remote.toRecipients?.map(graphAddress).filter(Boolean).join(", ") || account.email,
      subject: remote.subject || "(无主题)",
      body,
      bodyHtml: remote.body?.contentType === "html" ? remote.body.content : undefined,
      read: Boolean(remote.isRead),
      createdAt: remote.receivedDateTime || new Date().toISOString()
    };

    if (existingIndex >= 0) {
      store.messages[existingIndex] = message;
    } else {
      store.messages.push(message);
    }
  }

  store.messages.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  await writeStore(store);
  return store.messages.filter((message) => message.accountId === accountId);
}

export async function createDraft(input: SendMailInput) {
  const store = await readStore();
  const account = store.accounts.find((item) => item.id === input.accountId);

  if (!account) {
    throw new Error("账户不存在。");
  }

  const now = new Date().toISOString();
  const draft: MailMessage = {
    id: createId("msg"),
    accountId: input.accountId,
    folder: "draft",
    from: account.email,
    to: input.to,
    subject: input.subject,
    body: input.body,
    read: true,
    createdAt: now
  };

  store.messages.unshift(draft);
  await writeStore(store);
  return draft;
}

export async function updateMessage(id: string, input: Partial<SendMailInput>) {
  const store = await readStore();
  const index = store.messages.findIndex((message) => message.id === id);

  if (index === -1) {
    throw new Error("邮件记录不存在。");
  }

  if (store.messages[index].folder !== "draft") {
    throw new Error("只能编辑草稿邮件。");
  }

  store.messages[index] = {
    ...store.messages[index],
    to: input.to ?? store.messages[index].to,
    subject: input.subject ?? store.messages[index].subject,
    body: input.body ?? store.messages[index].body
  };

  await writeStore(store);
  return store.messages[index];
}

export async function deleteMessage(id: string) {
  const store = await readStore();
  const message = store.messages.find((item) => item.id === id);

  if (!message) {
    throw new Error("邮件记录不存在。");
  }

  const account = store.accounts.find((item) => item.id === message.accountId);

  if (account && message.folder === "inbox" && message.externalId) {
    await deleteRemoteMessage(account, message.externalId);
  }

  message.folder = "trash";
  await writeStore(store);
}

async function deleteRemoteMessage(account: MailAccount, externalId: string) {
  if (account.protocol === "graph") {
    const accessToken = await getGraphAccessToken(account);
    const baseUrl = account.graphBaseUrl || "https://graph.microsoft.com/v1.0";
    const response = await fetch(`${baseUrl}/me/messages/${encodeURIComponent(externalId)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Graph API 删除失败：${response.status} ${detail}`);
    }

    return;
  }

  if (account.protocol === "imap") {
    const uid = Number(externalId.replace(/^imap:/, ""));

    if (!Number.isFinite(uid) || !account.imap?.host || !account.password) {
      throw new Error("IMAP 删除失败：缺少 UID、服务器或密码/授权码。");
    }

    const client = new ImapFlow({
      host: account.imap.host,
      port: account.imap.port,
      secure: account.imap.security === "ssl",
      auth: {
        user: account.email,
        pass: account.password
      },
      logger: false
    });

    await client.connect();

    try {
      await client.mailboxOpen("INBOX");
      await client.messageDelete([uid], { uid: true });
    } finally {
      await client.logout().catch(() => undefined);
    }
  }
}

function looksLikeJwt(token?: string) {
  return Boolean(token && token.split(".").length === 3);
}

async function getGraphAccessToken(account: MailAccount) {
  if (looksLikeJwt(account.accessToken)) {
    return account.accessToken;
  }

  const refreshToken = account.refreshToken || account.accessToken;

  if (!refreshToken || !account.clientId) {
    throw new Error("Graph API 账户缺少 access token，或缺少 client_id/刷新令牌。");
  }

  const response = await fetch("https://login.microsoftonline.com/consumers/oauth2/v2.0/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: account.clientId,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: "offline_access https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send"
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Graph API token 刷新失败：${response.status} ${detail}`);
  }

  const payload = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
  };

  if (!payload.access_token) {
    throw new Error("Graph API token 刷新失败：响应中没有 access_token。");
  }

  account.accessToken = payload.access_token;
  account.refreshToken = payload.refresh_token || refreshToken;

  const store = await readStore();
  const index = store.accounts.findIndex((item) => item.id === account.id);

  if (index >= 0) {
    store.accounts[index] = {
      ...store.accounts[index],
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token || refreshToken,
      updatedAt: new Date().toISOString()
    };
    await writeStore(store);
  }

  return payload.access_token;
}

async function sendWithGraph(account: MailAccount, input: SendMailInput) {
  const accessToken = await getGraphAccessToken(account);
  const baseUrl = account.graphBaseUrl || "https://graph.microsoft.com/v1.0";
  const response = await fetch(`${baseUrl}/me/sendMail`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: {
        subject: input.subject,
        body: {
          contentType: "Text",
          content: input.body
        },
        toRecipients: input.to.split(",").map((address) => ({
          emailAddress: { address: address.trim() }
        }))
      },
      saveToSentItems: true
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Graph API 发送失败：${response.status} ${detail}`);
  }
}

async function sendWithSmtp(account: MailAccount, input: SendMailInput) {
  if (!account.smtp?.host || !account.password) {
    throw new Error("IMAP/POP 账户发送需要 SMTP 主机和密码/授权码。");
  }

  const transporter = nodemailer.createTransport({
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.security === "ssl",
    auth: {
      user: account.email,
      pass: account.password
    }
  });

  await transporter.sendMail({
    from: account.email,
    to: input.to,
    subject: input.subject,
    text: input.body
  });
}

export async function sendMessage(input: SendMailInput) {
  const store = await readStore();
  const account = store.accounts.find((item) => item.id === input.accountId);

  if (!account) {
    throw new Error("账户不存在。");
  }

  if (account.protocol === "graph") {
    await sendWithGraph(account, input);
  } else {
    await sendWithSmtp(account, input);
  }

  const now = new Date().toISOString();
  const sent: MailMessage = {
    id: createId("msg"),
    accountId: account.id,
    folder: "sent",
    from: account.email,
    to: input.to,
    subject: input.subject,
    body: input.body,
    read: true,
    createdAt: now,
    sentAt: now
  };

  store.messages.unshift(sent);
  await writeStore(store);
  return sent;
}
