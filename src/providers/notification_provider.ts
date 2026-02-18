import ServiceProvider from '@stravigor/kernel/core/service_provider'
import type Application from '@stravigor/kernel/core/application'
import NotificationManager from '../notification/notification_manager.ts'

export interface NotificationProviderOptions {
  /** Whether to auto-create the notifications table. Default: `true` */
  ensureTable?: boolean
}

export default class NotificationProvider extends ServiceProvider {
  readonly name = 'notification'
  override readonly dependencies = ['database']

  constructor(private options?: NotificationProviderOptions) {
    super()
  }

  override register(app: Application): void {
    app.singleton(NotificationManager)
  }

  override async boot(app: Application): Promise<void> {
    app.resolve(NotificationManager)

    if (this.options?.ensureTable !== false) {
      await NotificationManager.ensureTable()
    }
  }
}
