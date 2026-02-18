# @stravigor/signal

Communication layer for the Strav framework — mail, notifications, and real-time broadcasting.

## Dependencies
- @stravigor/kernel (peer)
- @stravigor/http (peer)
- @stravigor/database (peer)
- @stravigor/queue (peer)

## Commands
- bun test
- bun run typecheck

## Architecture
- src/mail/ — MailManager, transports (SMTP, Resend, SendGrid, Mailgun, Alibaba, Log)
- src/notification/ — NotificationManager, channels (email, database, webhook, Discord)
- src/broadcast/ — WebSocket broadcasting manager and client
- src/providers/ — MailProvider, NotificationProvider, BroadcastProvider

## Conventions
- Mail uses view engine from @stravigor/http for HTML templates
- Notifications can be queued via @stravigor/queue
- Broadcast depends on @stravigor/http's Router for WebSocket upgrade
