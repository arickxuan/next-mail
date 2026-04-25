import type { MailProtocol, ProviderId, ProviderPreset } from "./types";

export const providerPresets: ProviderPreset[] = [
  {
    id: "outlook-imap-legacy",
    label: "Outlook 旧版 IMAP",
    protocols: ["imap", "pop"],
    imap: { host: "outlook.office365.com", port: 993, security: "ssl" },
    pop: { host: "outlook.office365.com", port: 995, security: "ssl" },
    smtp: { host: "smtp-mail.outlook.com", port: 587, security: "starttls" },
    helpText: "旧版 Outlook IMAP 使用 outlook.office365.com。"
  },
  {
    id: "outlook-imap-modern",
    label: "Outlook 新版 IMAP",
    protocols: ["imap", "pop"],
    imap: { host: "outlook.live.com", port: 993, security: "ssl" },
    pop: { host: "outlook.live.com", port: 995, security: "ssl" },
    smtp: { host: "smtp-mail.outlook.com", port: 587, security: "starttls" },
    helpText: "新版 Outlook IMAP 使用 outlook.live.com。"
  },
  {
    id: "outlook-graph",
    label: "Microsoft Graph API",
    protocols: ["graph"],
    graphBaseUrl: "https://graph.microsoft.com/v1.0",
    helpText: "通过 Microsoft Graph /me/sendMail 发送邮件。"
  },
  {
    id: "gmail",
    label: "Gmail",
    protocols: ["imap", "pop"],
    imap: { host: "imap.gmail.com", port: 993, security: "ssl" },
    pop: { host: "pop.gmail.com", port: 995, security: "ssl" },
    smtp: { host: "smtp.gmail.com", port: 587, security: "starttls" },
    helpText: "建议使用 Gmail 应用专用密码或 OAuth 凭据。"
  },
  {
    id: "yahoo",
    label: "Yahoo",
    protocols: ["imap", "pop"],
    imap: { host: "imap.mail.yahoo.com", port: 993, security: "ssl" },
    pop: { host: "pop.mail.yahoo.com", port: 995, security: "ssl" },
    smtp: { host: "smtp.mail.yahoo.com", port: 587, security: "starttls" },
    helpText: "Yahoo 通常需要应用专用密码。"
  },
  {
    id: "qq",
    label: "QQ 邮箱",
    protocols: ["imap", "pop"],
    imap: { host: "imap.qq.com", port: 993, security: "ssl" },
    pop: { host: "pop.qq.com", port: 995, security: "ssl" },
    smtp: { host: "smtp.qq.com", port: 465, security: "ssl" },
    helpText: "QQ 邮箱一般使用授权码作为密码。"
  },
  {
    id: "netease-163",
    label: "网易 163",
    protocols: ["imap", "pop"],
    imap: { host: "imap.163.com", port: 993, security: "ssl" },
    pop: { host: "pop.163.com", port: 995, security: "ssl" },
    smtp: { host: "smtp.163.com", port: 465, security: "ssl" },
    helpText: "163 邮箱一般使用客户端授权码。"
  },
  {
    id: "icloud",
    label: "iCloud",
    protocols: ["imap"],
    imap: { host: "imap.mail.me.com", port: 993, security: "ssl" },
    smtp: { host: "smtp.mail.me.com", port: 587, security: "starttls" },
    helpText: "iCloud 邮箱需要 Apple 应用专用密码。"
  },
  {
    id: "custom",
    label: "自定义邮箱",
    protocols: ["imap", "pop", "graph"],
    imap: { host: "", port: 993, security: "ssl" },
    pop: { host: "", port: 995, security: "ssl" },
    smtp: { host: "", port: 587, security: "starttls" },
    graphBaseUrl: "",
    helpText: "可自定义域名、端口和 SSL/STARTTLS。"
  }
];

export function getProvider(provider: ProviderId) {
  return providerPresets.find((item) => item.id === provider) ?? providerPresets[providerPresets.length - 1];
}

export function providersForProtocol(protocol: MailProtocol) {
  return providerPresets.filter((provider) => provider.protocols.includes(protocol));
}
