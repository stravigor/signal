import ServiceProvider from '@stravigor/kernel/core/service_provider'
import type Application from '@stravigor/kernel/core/application'
import BroadcastManager from '../broadcast/broadcast_manager.ts'
import type { BootOptions } from '../broadcast/broadcast_manager.ts'
import Router from '@stravigor/http/http/router'

export default class BroadcastProvider extends ServiceProvider {
  readonly name = 'broadcast'

  constructor(private options?: BootOptions) {
    super()
  }

  override boot(app: Application): void {
    const router = app.resolve(Router)
    BroadcastManager.boot(router, this.options)
  }

  override shutdown(): void {
    BroadcastManager.reset()
  }
}
