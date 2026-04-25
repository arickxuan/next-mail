"use client";

import { useEffect, useMemo, useState } from "react";
import { ADMIN_TOKEN_KEY, clearAdminToken, getStoredAdminToken } from "@/lib/auth";
import { getProvider, providersForProtocol } from "@/lib/providers";
import type { AccountInput, ImportRequest, MailAccount, MailFolder, MailMessage, MailProtocol, ProviderId } from "@/lib/types";

type ActiveModal = "add" | "import" | null;
type RightMode = "message" | "compose";

const FOLDER_LABELS: Record<MailFolder, string> = {
  inbox: "收件箱",
  sent: "已发送",
  draft: "草稿",
  archive: "归档",
  junk: "垃圾邮件",
  trash: "已删除"
};

const ALL_FOLDERS: MailFolder[] = ["inbox", "sent", "draft", "archive", "junk", "trash"];

const defaultAccount: AccountInput = {
  email: "",
  displayName: "",
  protocol: "imap",
  provider: "gmail",
  password: "",
  refreshToken: "",
  clientId: "",
  accessToken: ""
};

const defaultCompose = {
  accountId: "",
  to: "",
  subject: "",
  body: ""
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const adminToken = getStoredAdminToken();
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(adminToken ? { [ADMIN_TOKEN_KEY]: adminToken } : {}),
      ...(init?.headers ?? {})
    }
  });
  const payload = await response.json();

  if (!response.ok) {
    if (response.status === 401) {
      clearAdminToken();
      window.location.href = "/login";
    }

    throw new Error(payload.error ?? "请求失败");
  }

  return payload as T;
}

function folderLabel(folder: MailMessage["folder"]) {
  return FOLDER_LABELS[folder] ?? folder;
}

function looksLikeHtml(value?: string) {
  return Boolean(value && /<\/?[a-z][\s\S]*>/i.test(value));
}

export default function MailClient() {
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [accountForm, setAccountForm] = useState<AccountInput>(defaultAccount);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedMessageId, setSelectedMessageId] = useState("");
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [compose, setCompose] = useState(defaultCompose);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [importType, setImportType] = useState<MailProtocol>("imap");
  const [importProvider, setImportProvider] = useState<ProviderId>("gmail");
  const [importLines, setImportLines] = useState("");
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [rightMode, setRightMode] = useState<RightMode>("message");
  const [activeFolder, setActiveFolder] = useState<MailFolder>("inbox");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalMessages, setTotalMessages] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [notice, setNotice] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<MailMessage | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const activeAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) ?? accounts[0],
    [accounts, selectedAccountId]
  );
  const selectedMessage = useMemo(
    () => messages.find((message) => message.id === selectedMessageId) ?? messages[0],
    [messages, selectedMessageId]
  );
  const currentPreset = getProvider(accountForm.provider);
  const visibleProviders = providersForProtocol(accountForm.protocol);
  const protocolConfig = accountForm.protocol === "pop" ? accountForm.pop : accountForm.imap;

  async function loadMessages(accountId: string, folder?: MailFolder, pageNum?: number) {
    if (!accountId) {
      setMessages([]);
      setTotalMessages(0);
      setTotalPages(1);
      return;
    }

    setMessagesLoading(true);

    try {
      const folderParam = folder ?? activeFolder;
      const pageParam = pageNum ?? currentPage;
      const payload = await requestJson<{ messages: MailMessage[]; total: number; totalPages: number }>(
        `/api/messages?accountId=${accountId}&folder=${folderParam}&page=${pageParam}&pageSize=20`
      );
      setMessages(payload.messages);
      setTotalMessages(payload.total);
      setTotalPages(payload.totalPages);
      setSelectedMessageId((current) => (payload.messages.some((message) => message.id === current) ? current : payload.messages[0]?.id || ""));
      setSelectedMessageIds([]);
      setSelectedDetail(null);
    } finally {
      setMessagesLoading(false);
    }
  }

  async function loadDetail(messageId: string) {
    setDetailLoading(true);
    try {
      const payload = await requestJson<{ message: MailMessage }>(`/api/messages/${messageId}`);
      setSelectedDetail(payload.message);
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "获取邮件详情失败。" });
    } finally {
      setDetailLoading(false);
    }
  }

  async function loadAccounts(preferredAccountId?: string) {
    const payload = await requestJson<{ accounts: MailAccount[] }>("/api/accounts");
    const nextSelected = preferredAccountId || selectedAccountId || payload.accounts[0]?.id || "";

    setAccounts(payload.accounts);
    setSelectedAccountId(nextSelected);
    setCompose((current) => ({ ...current, accountId: current.accountId || nextSelected }));
    void loadMessages(nextSelected).catch((error) => setNotice({ type: "error", text: error.message }));
  }

  useEffect(() => {
    if (!getStoredAdminToken()) {
      window.location.href = "/login";
      return;
    }

    loadAccounts().catch((error) => setNotice({ type: "error", text: error.message }));
  }, []);

  function updateAccountForm(patch: Partial<AccountInput>) {
    setAccountForm((current) => {
      const next = { ...current, ...patch };
      const preset = getProvider(next.provider);
      return {
        ...next,
        imap: next.imap ?? preset.imap,
        pop: next.pop ?? preset.pop,
        smtp: next.smtp ?? preset.smtp,
        graphBaseUrl: next.graphBaseUrl ?? preset.graphBaseUrl
      };
    });
  }

  function changeProtocol(protocol: MailProtocol) {
    const provider = providersForProtocol(protocol)[0]?.id ?? "custom";
    updateAccountForm({ protocol, provider });
  }

  function changeProvider(provider: ProviderId) {
    const preset = getProvider(provider);
    updateAccountForm({
      provider,
      imap: preset.imap,
      pop: preset.pop,
      smtp: preset.smtp,
      graphBaseUrl: preset.graphBaseUrl
    });
  }

  function openAddPanel(account?: MailAccount) {
    if (account) {
      setEditingId(account.id);
      setAccountForm(account);
      setSelectedAccountId(account.id);
    } else {
      setEditingId(null);
      setAccountForm(defaultAccount);
    }

    setActiveModal("add");
  }

  function closeModal() {
    setActiveModal(null);
    setEditingId(null);
    setAccountForm(defaultAccount);
  }

  async function submitAccount() {
    setLoading(true);
    setNotice(null);

    try {
      const payload = await requestJson<{ account: MailAccount }>(editingId ? `/api/accounts/${editingId}` : "/api/accounts", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(accountForm)
      });
      await loadAccounts(payload.account.id);
      closeModal();
      setNotice({ type: "success", text: editingId ? "账户已更新。" : "账户已添加。" });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "账户保存失败。" });
    } finally {
      setLoading(false);
    }
  }

  async function deleteAccount(id: string) {
    if (!confirm("确认删除此账户及本地邮件记录？")) return;

    await requestJson(`/api/accounts/${id}`, { method: "DELETE" });
    await loadAccounts();
    setNotice({ type: "success", text: "账户已删除。" });
  }

  async function submitImport() {
    setLoading(true);
    setNotice(null);

    try {
      const payload: ImportRequest = {
        type: importType,
        provider: importProvider,
        lines: importLines
      };
      const result = await requestJson<{ accounts: MailAccount[] }>("/api/accounts/import", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      await loadAccounts(result.accounts[0]?.id);
      setImportLines("");
      setActiveModal(null);
      setNotice({ type: "success", text: `已导入 ${result.accounts.length} 个账户。` });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "导入失败。" });
    } finally {
      setLoading(false);
    }
  }

  function startCompose(message?: MailMessage) {
    if (message?.folder === "draft") {
      setEditingMessageId(message.id);
      setCompose({
        accountId: message.accountId,
        to: message.to,
        subject: message.subject,
        body: message.body
      });
    } else {
      setEditingMessageId(null);
      setCompose({ ...defaultCompose, accountId: activeAccount?.id || "" });
    }

    setRightMode("compose");
  }

  async function submitMessage(send: boolean) {
    const accountId = compose.accountId || activeAccount?.id || "";
    setLoading(true);
    setNotice(null);

    try {
      const isUpdatingDraft = editingMessageId && !send;
      await requestJson(isUpdatingDraft ? `/api/messages/${editingMessageId}` : send ? "/api/messages/send" : "/api/messages", {
        method: isUpdatingDraft ? "PUT" : "POST",
        body: JSON.stringify({ ...compose, accountId })
      });
      await loadMessages(accountId);
      setEditingMessageId(null);
      setCompose({ ...defaultCompose, accountId });
      setRightMode("message");
      setNotice({ type: "success", text: send ? "邮件已发送并记录到已发送。" : isUpdatingDraft ? "草稿已更新。" : "草稿已保存。" });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "邮件处理失败。" });
    } finally {
      setLoading(false);
    }
  }

  async function deleteMessage(id: string) {
    try {
      await requestJson(`/api/messages/${id}`, { method: "DELETE" });
      await loadMessages(activeAccount?.id || "");
      setNotice({ type: "success", text: "邮件记录已删除。" });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "删除失败。" });
    }
  }

  async function deleteSelectedMessages() {
    if (!selectedMessageIds.length || !confirm(`确认删除选中的 ${selectedMessageIds.length} 封邮件？`)) return;

    setLoading(true);
    setNotice(null);

    try {
      for (const id of selectedMessageIds) {
        await requestJson(`/api/messages/${id}`, { method: "DELETE" });
      }

      await loadMessages(activeAccount?.id || "");
      setNotice({ type: "success", text: "已删除选中邮件。" });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "批量删除失败。" });
    } finally {
      setLoading(false);
    }
  }

  async function sendDraft(message: MailMessage) {
    setLoading(true);
    setNotice(null);

    try {
      await requestJson("/api/messages/send", {
        method: "POST",
        body: JSON.stringify({
          accountId: message.accountId,
          to: message.to,
          subject: message.subject,
          body: message.body
        })
      });
      await requestJson(`/api/messages/${message.id}`, { method: "DELETE" });
      await loadMessages(message.accountId);
      setNotice({ type: "success", text: "草稿已发送。" });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "草稿发送失败。" });
    } finally {
      setLoading(false);
    }
  }

  function toggleSelectedMessage(id: string) {
    setSelectedMessageIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleSelectAll() {
    setSelectedMessageIds((current) => (current.length === messages.length ? [] : messages.map((message) => message.id)));
  }

  function selectAccount(account: MailAccount) {
    setSelectedAccountId(account.id);
    setCompose((current) => ({ ...current, accountId: account.id }));
    setActiveFolder("inbox");
    setCurrentPage(1);
    setRightMode("message");
    setSelectedDetail(null);
    void loadMessages(account.id, "inbox", 1).catch((error) => setNotice({ type: "error", text: error.message }));
  }

  const detailHtml = selectedMessage?.bodyHtml || (looksLikeHtml(selectedMessage?.body) ? selectedMessage?.body : "");

  return (
    <main className="mail-workspace">
      <header className="workspace-header">
        <div>
          <h1>多账户邮件管理</h1>
          <p>支持 IMAP、POP、Microsoft Graph API 和自定义服务器。</p>
        </div>
        {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}
      </header>

      <section className="three-pane">
        <aside className="pane left-pane">
          <div className="left-toolbar">
            <button onClick={() => openAddPanel()}>添加</button>
            <button className="secondary" onClick={() => setActiveModal("import")}>
              导入
            </button>
          </div>

          <div className="pane-title">
            <h2>账户列表</h2>
            <span className="muted">{accounts.length} 个</span>
          </div>
          <div className="account-list">
            {accounts.length === 0 && <p className="muted">还没有账户，请先添加或导入。</p>}
            {accounts.map((account) => (
              <article key={account.id} className={`account-card ${account.id === activeAccount?.id ? "active" : ""}`}>
                <button className="account-main" onClick={() => selectAccount(account)}>
                  <strong>{account.displayName || account.email}</strong>
                  <span>{account.email}</span>
                </button>
                <div>
                  <span className="tag">{account.protocol.toUpperCase()}</span>
                  <span className="tag">{getProvider(account.provider).label}</span>
                </div>
                <div className="actions small-actions">
                  <button className="secondary compact" onClick={() => openAddPanel(account)}>
                    编辑
                  </button>
                  <button className="danger compact" onClick={() => deleteAccount(account.id)}>
                    删除
                  </button>
                </div>
              </article>
            ))}
          </div>
        </aside>

        <section className="pane middle-pane">
          <div className="mail-toolbar">
            <button onClick={() => startCompose()}>写邮件</button>
            <button className="secondary" disabled={!messages.length} onClick={toggleSelectAll}>
              {selectedMessageIds.length === messages.length && messages.length ? "取消全选" : "全选"}
            </button>
            <button className="danger" disabled={loading || !selectedMessageIds.length} onClick={deleteSelectedMessages}>
              删除选中
            </button>
          </div>

          <div className="folder-tabs">
            {ALL_FOLDERS.map((folder) => (
              <button
                key={folder}
                className={`folder-tab ${folder === activeFolder ? "active" : ""}`}
                onClick={() => {
                  setActiveFolder(folder);
                  setCurrentPage(1);
                  setSelectedMessageId("");
                  void loadMessages(activeAccount?.id || "", folder, 1).catch((error) => setNotice({ type: "error", text: error.message }));
                }}
              >
                {FOLDER_LABELS[folder]}
              </button>
            ))}
          </div>

          <div className="pane-title">
            <h2>{activeAccount?.email || "邮件列表"}</h2>
            <span className="muted">{messagesLoading ? "同步中..." : `${totalMessages} 封`}</span>
          </div>

          <div className="message-list">
            {messages.length === 0 && <p className="muted">当前文件夹暂无邮件。</p>}
            {messages.map((message) => (
              <article key={message.id} className={`mail-row ${message.id === selectedMessage?.id ? "active" : ""}`}>
                <input
                  aria-label="选择邮件"
                  checked={selectedMessageIds.includes(message.id)}
                  type="checkbox"
                  onChange={() => toggleSelectedMessage(message.id)}
                />
                <button
                  className="mail-row-main"
                  onClick={() => {
                    setSelectedMessageId(message.id);
                    setRightMode("message");
                    void loadDetail(message.id).catch((error) => setNotice({ type: "error", text: error.message }));
                  }}
                >
                  <strong>{message.subject}</strong>
                  <span>
                    {folderLabel(message.folder)} · {message.folder === "inbox" ? message.from : message.to}
                  </span>
                  <small>{new Date(message.createdAt).toLocaleString()}</small>
                </button>
              </article>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button className="secondary" disabled={currentPage <= 1} onClick={() => {
                const newPage = currentPage - 1;
                setCurrentPage(newPage);
                void loadMessages(activeAccount?.id || "", activeFolder, newPage).catch((error) => setNotice({ type: "error", text: error.message }));
              }}>
                上一页
              </button>
              <span>
                第 {currentPage} / {totalPages} 页
              </span>
              <button className="secondary" disabled={currentPage >= totalPages} onClick={() => {
                const newPage = currentPage + 1;
                setCurrentPage(newPage);
                void loadMessages(activeAccount?.id || "", activeFolder, newPage).catch((error) => setNotice({ type: "error", text: error.message }));
              }}>
                下一页
              </button>
            </div>
          )}
        </section>

        <section className="pane right-pane">
          {rightMode === "compose" ? (
            <div className="detail-stack">
              <div className="pane-title">
                <h2>{editingMessageId ? "编辑草稿" : "写邮件"}</h2>
                <button className="secondary compact" onClick={() => setRightMode("message")}>
                  关闭
                </button>
              </div>
              <select value={compose.accountId || activeAccount?.id || ""} onChange={(event) => setCompose({ ...compose, accountId: event.target.value })}>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.email}
                  </option>
                ))}
              </select>
              <input value={compose.to} onChange={(event) => setCompose({ ...compose, to: event.target.value })} placeholder="收件人，多个用逗号分隔" />
              <input value={compose.subject} onChange={(event) => setCompose({ ...compose, subject: event.target.value })} placeholder="主题" />
              <textarea className="compose-body" value={compose.body} onChange={(event) => setCompose({ ...compose, body: event.target.value })} placeholder="正文" />
              <div className="actions">
                <button disabled={loading || !accounts.length} onClick={() => submitMessage(true)}>
                  发送
                </button>
                <button className="secondary" disabled={loading || !accounts.length} onClick={() => submitMessage(false)}>
                  {editingMessageId ? "更新草稿" : "保存草稿"}
                </button>
              </div>
            </div>
          ) : selectedMessage ? (
            <article className="message-detail">
              <div className="pane-title">
                <h2>{selectedMessage.subject}</h2>
                <span className="tag">{folderLabel(selectedMessage.folder)}</span>
              </div>
              <div className="message-meta">
                <p>发件人：{selectedMessage.from}</p>
                <p>收件人：{selectedMessage.to}</p>
                <p>时间：{new Date(selectedMessage.createdAt).toLocaleString()}</p>
              </div>
              <div className="actions">
                {selectedMessage.folder === "draft" && (
                  <>
                    <button className="secondary" onClick={() => startCompose(selectedMessage)}>
                      编辑草稿
                    </button>
                    <button disabled={loading} onClick={() => sendDraft(selectedMessage)}>
                      发送草稿
                    </button>
                  </>
                )}
                <button className="danger" onClick={() => deleteMessage(selectedMessage.id)}>
                  删除
                </button>
              </div>
              {detailLoading ? (
                <p className="muted">加载正文中...</p>
              ) : selectedDetail ? (
                selectedDetail.bodyHtml || looksLikeHtml(selectedDetail.body) ? (
                  <iframe className="html-frame" sandbox="" srcDoc={selectedDetail.bodyHtml || selectedDetail.body} title="邮件 HTML 正文" />
                ) : (
                  <pre className="plain-body">{selectedDetail.body}</pre>
                )
              ) : (
                <p className="muted">正在获取邮件正文...</p>
              )}
            </article>
          ) : (
            <div className="empty-detail">
              <h2>选择一封邮件</h2>
              <p className="muted">右侧会显示邮件正文，HTML 邮件会以隔离 iframe 渲染。</p>
            </div>
          )}
        </section>
      </section>

      {activeModal === "add" && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingId ? "编辑账户" : "添加账户"}</h2>
              <button className="secondary compact" onClick={closeModal}>
                关闭
              </button>
            </div>
            <div className="stack">
              <div className="row">
                <label>
                  协议
                  <select value={accountForm.protocol} onChange={(event) => changeProtocol(event.target.value as MailProtocol)}>
                    <option value="imap">IMAP</option>
                    <option value="pop">POP</option>
                    <option value="graph">Graph API</option>
                  </select>
                </label>
                <label>
                  类型
                  <select value={accountForm.provider} onChange={(event) => changeProvider(event.target.value as ProviderId)}>
                    {visibleProviders.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                邮箱
                <input value={accountForm.email} onChange={(event) => updateAccountForm({ email: event.target.value })} />
              </label>
              <label>
                显示名称
                <input value={accountForm.displayName} onChange={(event) => updateAccountForm({ displayName: event.target.value })} />
              </label>
              <div className="row">
                <label>
                  密码/授权码
                  <input type="password" value={accountForm.password} onChange={(event) => updateAccountForm({ password: event.target.value })} />
                </label>
                <label>
                  客户端 ID
                  <input value={accountForm.clientId} onChange={(event) => updateAccountForm({ clientId: event.target.value })} />
                </label>
              </div>
              <label>
                {accountForm.protocol === "graph" ? "Graph token" : "刷新令牌"}
                <input
                  value={accountForm.protocol === "graph" ? accountForm.accessToken : accountForm.refreshToken}
                  onChange={(event) =>
                    updateAccountForm(accountForm.protocol === "graph" ? { accessToken: event.target.value } : { refreshToken: event.target.value })
                  }
                />
              </label>
              {accountForm.protocol !== "graph" ? (
                <>
                  <div className="row">
                    <label>
                      收信服务器
                      <input
                        value={protocolConfig?.host ?? ""}
                        onChange={(event) =>
                          updateAccountForm({
                            [accountForm.protocol]: { ...(protocolConfig ?? { port: 993, security: "ssl" }), host: event.target.value }
                          })
                        }
                      />
                    </label>
                    <label>
                      收信端口
                      <input
                        type="number"
                        value={protocolConfig?.port ?? ""}
                        onChange={(event) =>
                          updateAccountForm({
                            [accountForm.protocol]: { ...(protocolConfig ?? { host: "", security: "ssl" }), port: Number(event.target.value) }
                          })
                        }
                      />
                    </label>
                  </div>
                  <div className="row">
                    <label>
                      SMTP 服务器
                      <input
                        value={accountForm.smtp?.host ?? ""}
                        onChange={(event) =>
                          updateAccountForm({
                            smtp: { ...(accountForm.smtp ?? { port: 587, security: "starttls" }), host: event.target.value }
                          })
                        }
                      />
                    </label>
                    <label>
                      SMTP 端口
                      <input
                        type="number"
                        value={accountForm.smtp?.port ?? ""}
                        onChange={(event) =>
                          updateAccountForm({
                            smtp: { ...(accountForm.smtp ?? { host: "", security: "starttls" }), port: Number(event.target.value) }
                          })
                        }
                      />
                    </label>
                  </div>
                </>
              ) : (
                <label>
                  Graph API Base URL
                  <input value={accountForm.graphBaseUrl ?? ""} onChange={(event) => updateAccountForm({ graphBaseUrl: event.target.value })} />
                </label>
              )}
              <p className="muted">{currentPreset.helpText}</p>
              <button disabled={loading} onClick={submitAccount}>
                {editingId ? "保存修改" : "添加账户"}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeModal === "import" && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>导入账户</h2>
              <button className="secondary compact" onClick={() => setActiveModal(null)}>
                关闭
              </button>
            </div>
            <div className="stack">
              <div className="row">
                <select
                  value={importType}
                  onChange={(event) => {
                    const nextType = event.target.value as MailProtocol;
                    setImportType(nextType);
                    setImportProvider(providersForProtocol(nextType)[0].id);
                  }}
                >
                  <option value="imap">IMAP</option>
                  <option value="pop">POP</option>
                  <option value="graph">Graph API</option>
                </select>
                <select value={importProvider} onChange={(event) => setImportProvider(event.target.value as ProviderId)}>
                  {providersForProtocol(importType).map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.label}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                value={importLines}
                onChange={(event) => setImportLines(event.target.value)}
                placeholder={"Graph API: email----password----client_id----token\nIMAP/POP: 邮箱----占位密码----刷新令牌----客户端ID"}
              />
              <button disabled={loading || !importLines.trim()} onClick={submitImport}>
                导入账户
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
