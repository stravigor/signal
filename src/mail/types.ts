/** Core message structure passed to transports. */
export interface MailMessage {
  from: string
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  replyTo?: string
  subject: string
  html?: string
  text?: string
  attachments?: MailAttachment[]
}

export interface MailAttachment {
  filename: string
  content: Buffer | string
  contentType?: string
  /** For CID-referenced inline images. */
  cid?: string
}

export interface MailResult {
  messageId?: string
  accepted?: string[]
  rejected?: string[]
}

/**
 * Pluggable transport backend.
 * Implement this interface for custom mail providers.
 */
export interface MailTransport {
  send(message: MailMessage): Promise<MailResult>
}

// -- Per-driver configs -------------------------------------------------------

export interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  auth?: {
    user: string
    pass: string
  }
}

export interface ResendConfig {
  apiKey: string
  baseUrl?: string
}

export interface SendGridConfig {
  apiKey: string
  baseUrl?: string
}

export interface MailgunConfig {
  apiKey: string
  domain: string
  /** Default: 'https://api.mailgun.net'. EU: 'https://api.eu.mailgun.net' */
  baseUrl?: string
}

export interface AlibabaConfig {
  accessKeyId: string
  accessKeySecret: string
  /** Sender address configured in Alibaba DirectMail. */
  accountName: string
  /** Default: 'cn-hangzhou' */
  region?: string
}

export interface LogConfig {
  /** Write to 'console' or a file path. */
  output: 'console' | string
}

// -- Top-level mail config ----------------------------------------------------

export interface MailConfig {
  /** Default transport name: 'smtp' | 'resend' | 'sendgrid' | 'mailgun' | 'alibaba' | 'log' */
  default: string
  /** Default "from" address. */
  from: string
  /** Template prefix for ViewEngine (default: 'emails'). */
  templatePrefix: string
  /** Enable CSS inlining via juice (default: true). */
  inlineCss: boolean
  /** Enable Tailwind CSS compilation before inlining (default: false). */
  tailwind: boolean
  smtp: SmtpConfig
  resend: ResendConfig
  sendgrid: SendGridConfig
  mailgun: MailgunConfig
  alibaba: AlibabaConfig
  log: LogConfig
}
