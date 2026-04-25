import { providersForProtocol } from "./providers";
import type { AccountInput, ImportRequest, MailProtocol } from "./types";

function splitImportLine(line: string) {
  return line
    .split("----")
    .map((part) => part.trim())
    .filter(Boolean);
}

function validateType(type: MailProtocol) {
  if (!["imap", "pop", "graph"].includes(type)) {
    throw new Error("导入类型必须是 imap、pop 或 graph。");
  }
}

export function parseAccountsImport(input: ImportRequest): AccountInput[] {
  validateType(input.type);
  const provider = providersForProtocol(input.type).some((item) => item.id === input.provider)
    ? input.provider
    : providersForProtocol(input.type)[0].id;

  return input.lines
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const parts = splitImportLine(line);

      if (input.type === "graph") {
        if (parts.length < 4) {
          throw new Error(`第 ${index + 1} 行格式错误，Graph API 格式应为：email----password----client_id----token`);
        }

        const [email, password, clientId, accessToken] = parts;
        return {
          email,
          displayName: email,
          protocol: "graph",
          provider,
          password,
          clientId,
          refreshToken: accessToken,
          accessToken
        };
      }

      if (parts.length < 4) {
        throw new Error(`第 ${index + 1} 行格式错误，IMAP/POP 格式应为：邮箱----占位密码----刷新令牌----客户端ID`);
      }

      const [email, password, refreshToken, clientId] = parts;
      return {
        email,
        displayName: email,
        protocol: input.type,
        provider,
        password,
        refreshToken,
        clientId
      };
    });
}
