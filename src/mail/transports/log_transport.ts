import type { MailTransport, MailMessage, MailResult, LogConfig } from '../types.ts'

/**
 * Development/testing transport — logs email details to console or a file.
 * No external dependencies required.
 */
export class LogTransport implements MailTransport {
  private output: 'console' | string

  constructor(config: LogConfig) {
    this.output = config.output ?? 'console'
  }

  async send(message: MailMessage): Promise<MailResult> {
    const timestamp = new Date().toISOString()
    const separator = '─'.repeat(60)
    const toList = Array.isArray(message.to) ? message.to.join(', ') : message.to

    const lines = [
      separator,
      `[Mail] ${timestamp}`,
      `From:     ${message.from}`,
      `To:       ${toList}`,
    ]

    if (message.cc) {
      const cc = Array.isArray(message.cc) ? message.cc.join(', ') : message.cc
      lines.push(`CC:       ${cc}`)
    }
    if (message.bcc) {
      const bcc = Array.isArray(message.bcc) ? message.bcc.join(', ') : message.bcc
      lines.push(`BCC:      ${bcc}`)
    }
    if (message.replyTo) lines.push(`Reply-To: ${message.replyTo}`)

    lines.push(`Subject:  ${message.subject}`)

    if (message.text) {
      lines.push('', '--- Text ---', message.text)
    }
    if (message.html) {
      lines.push('', '--- HTML ---', message.html)
    }
    if (message.attachments?.length) {
      lines.push('', `--- Attachments (${message.attachments.length}) ---`)
      for (const a of message.attachments) {
        lines.push(`  ${a.filename} (${a.contentType ?? 'unknown'})`)
      }
    }

    lines.push(separator, '')

    const output = lines.join('\n')

    if (this.output === 'console') {
      console.log(output)
    } else {
      const file = Bun.file(this.output)
      const existing = (await file.exists()) ? await file.text() : ''
      await Bun.write(this.output, existing + output + '\n')
    }

    const messageId = `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    return {
      messageId,
      accepted: Array.isArray(message.to) ? message.to : [message.to],
    }
  }
}
