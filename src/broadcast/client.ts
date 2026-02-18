/**
 * Browser-side Broadcast client.
 *
 * Connects to the server's broadcast WebSocket endpoint,
 * manages channel subscriptions, auto-reconnects, and routes
 * events to subscription listeners.
 *
 * Zero dependencies — works in any browser.
 *
 * @example
 * import { Broadcast } from '@stravigor/signal/broadcast/client'
 *
 * const bc = new Broadcast()
 *
 * const chat = bc.subscribe('chat/1')
 * chat.on('new_message', (data) => console.log(data))
 * chat.send('send', { text: 'Hello!' })
 *
 * bc.on('connected', () => console.log('Online'))
 * bc.on('disconnected', () => console.log('Offline'))
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BroadcastOptions {
  /** WebSocket URL. Default: auto-detected from current host + `/_broadcast`. */
  url?: string
  /** Maximum reconnection attempts. Default: Infinity */
  maxReconnectAttempts?: number
}

type Callback = (...args: any[]) => void

// ---------------------------------------------------------------------------
// Subscription
// ---------------------------------------------------------------------------

/**
 * A subscription to a single broadcast channel.
 *
 * Listen for server events, send messages to the channel,
 * or leave the channel entirely.
 *
 * @example
 * const sub = bc.subscribe('chat/1')
 * sub.on('message', (data) => { ... })
 * sub.send('typing', { active: true })
 * sub.leave()
 */
export class Subscription {
  private listeners = new Map<string, Set<Callback>>()

  constructor(
    /** The channel name this subscription is bound to. */
    readonly channel: string,
    private sendFn: (msg: object) => void,
    private leaveFn: () => void
  ) {}

  /**
   * Listen for a specific event on this channel.
   * Returns a function that removes the listener when called.
   *
   * @example
   * const stop = sub.on('message', (data) => console.log(data))
   * stop() // remove listener
   */
  on(event: string, callback: Callback): () => void {
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }
    set.add(callback)
    return () => {
      set!.delete(callback)
    }
  }

  /**
   * Send a message to the server on this channel.
   *
   * @example
   * sub.send('typing', { active: true })
   */
  send(event: string, data?: unknown): void {
    this.sendFn({ t: 'msg', c: this.channel, e: event, d: data })
  }

  /** Unsubscribe from this channel. */
  leave(): void {
    this.sendFn({ t: 'unsub', c: this.channel })
    this.listeners.clear()
    this.leaveFn()
  }

  /** @internal Dispatch an incoming event to registered listeners. */
  _dispatch(event: string, data: unknown): void {
    const set = this.listeners.get(event)
    if (set) for (const cb of set) cb(data)
  }
}

// ---------------------------------------------------------------------------
// Broadcast
// ---------------------------------------------------------------------------

/**
 * Broadcast client — manages a single WebSocket connection
 * with multiplexed channel subscriptions.
 *
 * @example
 * const bc = new Broadcast()
 * const chat = bc.subscribe('chat/1')
 * chat.on('message', (data) => console.log(data))
 */
export class Broadcast {
  private ws: WebSocket | null = null
  private url: string
  private maxReconnectAttempts: number
  private reconnectAttempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private subscriptions = new Map<string, Subscription>()
  private listeners = new Map<string, Set<Callback>>()
  private queue: string[] = []
  private _connected = false
  private _clientId: string | null = null

  constructor(options?: BroadcastOptions) {
    this.url = options?.url ?? this.autoUrl()
    this.maxReconnectAttempts = options?.maxReconnectAttempts ?? Infinity
    this.connect()
  }

  /** Whether the WebSocket connection is currently open. */
  get connected(): boolean {
    return this._connected
  }

  /** The unique client ID assigned by the server, or null if not yet connected. */
  get clientId(): string | null {
    return this._clientId
  }

  /**
   * Subscribe to a broadcast channel.
   *
   * Returns an existing subscription if already subscribed.
   * On reconnect, all active subscriptions are automatically re-established.
   *
   * @example
   * const notifications = bc.subscribe('notifications')
   * notifications.on('alert', (data) => showToast(data.text))
   */
  subscribe(channel: string): Subscription {
    const existing = this.subscriptions.get(channel)
    if (existing) return existing

    const sub = new Subscription(
      channel,
      msg => this.send(msg),
      () => this.subscriptions.delete(channel)
    )

    this.subscriptions.set(channel, sub)

    if (this._connected) {
      this.rawSend({ t: 'sub', c: channel })
    }

    return sub
  }

  /**
   * Listen for connection lifecycle events.
   *
   * Events:
   * - `connected` — WebSocket connection established
   * - `disconnected` — WebSocket connection lost
   * - `reconnecting` — reconnection attempt (callback receives attempt number)
   * - `subscribed` — channel subscription confirmed (callback receives channel name)
   * - `error` — subscription error (callback receives `{ channel, reason }`)
   *
   * Returns a function that removes the listener.
   */
  on(event: string, callback: Callback): () => void {
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }
    set.add(callback)
    return () => {
      set!.delete(callback)
    }
  }

  /** Close the connection permanently (no reconnection). */
  close(): void {
    this.reconnectAttempt = Infinity
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
    this.ws = null
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private autoUrl(): string {
    // @ts-ignore browser-only API
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    // @ts-ignore browser-only API
    return `${proto}//${location.host}/_broadcast`
  }

  private connect(): void {
    this.ws = new WebSocket(this.url)

    this.ws.onopen = () => {
      this._connected = true
      this.reconnectAttempt = 0
      this.emit('connected')
    }

    this.ws.onmessage = event => {
      try {
        const msg = JSON.parse(event.data)
        this.handleMessage(msg)
      } catch {}
    }

    this.ws.onclose = () => {
      const wasConnected = this._connected
      this._connected = false
      if (wasConnected) this.emit('disconnected')
      this.scheduleReconnect()
    }

    this.ws.onerror = () => {
      this.ws?.close()
    }
  }

  private handleMessage(msg: any): void {
    switch (msg.t) {
      case 'welcome':
        this._clientId = msg.id
        // Re-subscribe to all active channels
        for (const channel of this.subscriptions.keys()) {
          this.rawSend({ t: 'sub', c: channel })
        }
        // Flush queued messages
        for (const raw of this.queue) {
          this.ws!.send(raw)
        }
        this.queue = []
        break

      case 'ok':
        this.emit('subscribed', msg.c)
        break

      case 'err':
        this.emit('error', { channel: msg.c, reason: msg.r })
        break

      case 'msg':
        this.subscriptions.get(msg.c)?._dispatch(msg.e, msg.d)
        break

      case 'ping':
        this.rawSend({ t: 'pong' })
        break
    }
  }

  private send(msg: object): void {
    const raw = JSON.stringify(msg)
    if (this._connected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(raw)
    } else {
      this.queue.push(raw)
    }
  }

  private rawSend(msg: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempt >= this.maxReconnectAttempts) return

    this.reconnectAttempt++
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempt - 1), 30_000)
    this.emit('reconnecting', this.reconnectAttempt)
    this.reconnectTimer = setTimeout(() => this.connect(), delay)
  }

  private emit(event: string, data?: unknown): void {
    const set = this.listeners.get(event)
    if (set) for (const cb of set) cb(data)
  }
}
