import type { NotificationChannel, Notifiable, NotificationPayload } from '../types.ts'
import { PendingMail } from '../../mail/helpers.ts'

/**
 * Delivers notifications via the existing Mail module.
 *
 * Reads the email address from `notifiable.routeNotificationForEmail()`
 * and builds a {@link PendingMail} from the {@link MailEnvelope}.
 */
export class EmailChannel implements NotificationChannel {
  readonly name = 'email'

  async send(notifiable: Notifiable, payload: NotificationPayload): Promise<void> {
    const envelope = payload.mail
    if (!envelope) return

    const address = notifiable.routeNotificationForEmail?.()
    if (!address) return

    const pending = new PendingMail(address).subject(envelope.subject)

    if (envelope.from) pending.from(envelope.from)
    if (envelope.cc) pending.cc(envelope.cc)
    if (envelope.bcc) pending.bcc(envelope.bcc)
    if (envelope.replyTo) pending.replyTo(envelope.replyTo)

    if (envelope.template) {
      pending.template(envelope.template, envelope.templateData ?? {})
    } else if (envelope.html) {
      pending.html(envelope.html)
    }

    if (envelope.text) pending.text(envelope.text)

    await pending.send()
  }
}
