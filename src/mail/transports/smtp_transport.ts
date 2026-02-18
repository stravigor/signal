import nodemailer from 'nodemailer'
import type { MailTransport, MailMessage, MailResult, SmtpConfig } from '../types.ts'

/**
 * SMTP transport via nodemailer.
 * Supports all standard SMTP features including TLS, auth, and attachments.
 */
export class SmtpTransport implements MailTransport {
  private transporter: nodemailer.Transporter

  constructor(config: SmtpConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth?.user ? { user: config.auth.user, pass: config.auth.pass } : undefined,
    })
  }

  async send(message: MailMessage): Promise<MailResult> {
    const info = await this.transporter.sendMail({
      from: message.from,
      to: Array.isArray(message.to) ? message.to.join(', ') : message.to,
      cc: message.cc ? (Array.isArray(message.cc) ? message.cc.join(', ') : message.cc) : undefined,
      bcc: message.bcc
        ? Array.isArray(message.bcc)
          ? message.bcc.join(', ')
          : message.bcc
        : undefined,
      replyTo: message.replyTo,
      subject: message.subject,
      html: message.html,
      text: message.text,
      attachments: message.attachments?.map(a => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
        cid: a.cid,
      })),
    })

    return {
      messageId: info.messageId,
      accepted: Array.isArray(info.accepted) ? info.accepted.map(String) : [],
      rejected: Array.isArray(info.rejected) ? info.rejected.map(String) : [],
    }
  }
}
