export type MailProtocol = "imap" | "pop" | "graph";

export type ProviderId =
  | "outlook-imap-legacy"
  | "outlook-imap-modern"
  | "outlook-graph"
  | "gmail"
  | "yahoo"
  | "qq"
  | "netease-163"
  | "icloud"
  | "custom";

export type ServerSecurity = "ssl" | "starttls" | "none";

export interface MailServerConfig {
  host: string;
  port: number;
  security: ServerSecurity;
}

export interface ProviderPreset {
  id: ProviderId;
  label: string;
  protocols: MailProtocol[];
  imap?: MailServerConfig;
  pop?: MailServerConfig;
  smtp?: MailServerConfig;
  graphBaseUrl?: string;
  helpText: string;
}

export interface MailAccount {
  id: string;
  email: string;
  displayName: string;
  protocol: MailProtocol;
  provider: ProviderId;
  password?: string;
  refreshToken?: string;
  clientId?: string;
  accessToken?: string;
  imap?: MailServerConfig;
  pop?: MailServerConfig;
  smtp?: MailServerConfig;
  graphBaseUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export type MailFolder = "inbox" | "sent" | "draft" | "archive" | "junk" | "trash";

export interface MailMessage {
  id: string;
  externalId?: string;
  accountId: string;
  folder: MailFolder;
  from: string;
  to: string;
  subject: string;
  body: string;
  bodyHtml?: string;
  read: boolean;
  createdAt: string;
  sentAt?: string;
}

export interface AccountInput {
  email: string;
  displayName?: string;
  protocol: MailProtocol;
  provider: ProviderId;
  password?: string;
  refreshToken?: string;
  clientId?: string;
  accessToken?: string;
  imap?: MailServerConfig;
  pop?: MailServerConfig;
  smtp?: MailServerConfig;
  graphBaseUrl?: string;
}

export interface SendMailInput {
  accountId: string;
  to: string;
  subject: string;
  body: string;
}

export interface ImportRequest {
  type: MailProtocol;
  provider: ProviderId;
  lines: string;
}
