"use client";

import { useEffect, useState } from "react";
import { ADMIN_TOKEN_KEY, getStoredAdminToken, storeAdminToken } from "@/lib/auth";

export default function LoginPage() {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const storedToken = getStoredAdminToken();

    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  async function verifyToken(nextToken = token) {
    const trimmedToken = nextToken.trim();

    if (!trimmedToken) {
      setError("请输入 X-ADMIN-TOKEN。");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/accounts", {
        headers: {
          [ADMIN_TOKEN_KEY]: trimmedToken
        }
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "token 校验失败。");
      }

      storeAdminToken(trimmedToken);
      window.location.href = "/";
    } catch (error) {
      setError(error instanceof Error ? error.message : "token 错误。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <h1>管理员登录</h1>
        <p className="muted">请输入请求头使用的 X-ADMIN-TOKEN。系统会通过 GET /api/accounts 校验，成功后保存到浏览器本地。</p>
        <div className="stack">
          <label>
            X-ADMIN-TOKEN
            <input
              autoFocus
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  verifyToken();
                }
              }}
              placeholder="输入管理员 token"
            />
          </label>
          {error && <div className="notice error">{error}</div>}
          <button disabled={loading} onClick={() => verifyToken()}>
            {loading ? "校验中..." : "登录"}
          </button>
        </div>
      </section>
    </main>
  );
}
