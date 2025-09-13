import { io, Socket } from 'socket.io-client';
import { 
  ClientToServerEvents, 
  ServerToClientEvents, 
  ConnectionState,
  SocketError 
} from '@/types/socket';

export type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

class SocketManager {
  private socket: ClientSocket | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private listeners: { [key: string]: ((...args: any[]) => void)[] } = {};

  constructor() {
    // Initialize event listeners storage
    this.listeners = {};
  }

  public connect(url?: string): ClientSocket {
    if (this.socket?.connected) {
      return this.socket;
    }

    const serverUrl = url || (
      process.env.NODE_ENV === 'production' 
        ? process.env.NEXT_PUBLIC_APP_URL 
        : 'http://localhost:6050'
    );

    console.log('🔌 Attempting to connect to Socket.IO server at:', serverUrl);

    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      upgrade: true,
      autoConnect: true,
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      randomizationFactor: 0.5,
    });

    this.setupEventListeners();
    return this.socket;
  }

  private setupEventListeners() {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('Connected to server:', this.socket?.id);
      this.connectionState = 'connected';
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      this.emit('connection-status', 'connected');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason);
      this.connectionState = 'disconnected';
      this.emit('connection-status', 'disconnected');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      this.connectionState = 'error';
      this.emit('connection-status', 'error');
      
      // Implement exponential backoff
      this.reconnectAttempts++;
      if (this.reconnectAttempts <= this.maxReconnectAttempts) {
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 10000);
        console.log(`Reconnect attempt ${this.reconnectAttempts} in ${this.reconnectDelay}ms`);
      }
    });

    this.socket.on('reconnect', () => {
      console.log('Reconnected to server');
      this.connectionState = 'connected';
      this.emit('connection-status', 'connected');
    });

    this.socket.on('reconnecting', (attemptNumber) => {
      console.log(`Reconnecting... Attempt ${attemptNumber}`);
      this.connectionState = 'reconnecting';
      this.emit('connection-status', 'reconnecting');
    });

    this.socket.on('reconnect_failed', () => {
      console.error('Failed to reconnect to server');
      this.connectionState = 'disconnected';
      this.emit('connection-status', 'disconnected');
    });

    // Error handling
    this.socket.on('error', (error: SocketError) => {
      console.error('Socket error:', error);
      this.emit('socket-error', error);
    });

    // Keep connection alive
    this.socket.on('pong', () => {
      // Server responded to ping
    });

    // Set up ping interval
    setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping');
      }
    }, 30000); // Ping every 30 seconds
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connectionState = 'disconnected';
      this.listeners = {};
    }
  }

  public emit(event: string, ...args: any[]) {
    console.log(`📤 Attempting to emit ${event}:`, args);
    console.log(`🔍 Socket connected: ${this.socket?.connected}, Socket ID: ${this.socket?.id}`);
    console.log(`🔍 Socket instance:`, this.socket);
    console.log(`🔍 Socket rooms:`, (this.socket as any)?.rooms);
    
    if (this.socket?.connected) {
      try {
        // Direct emit call
        console.log(`🚀 Calling socket.emit('${event}', ...${JSON.stringify(args)})`);
        this.socket.emit(event, ...args);
        console.log(`✅ Emitted ${event} successfully`);
        
        // Add a small delay and check if any acknowledgment or response comes back
        setTimeout(() => {
          console.log(`⏰ 1 second after emitting ${event} - socket still connected: ${this.socket?.connected}`);
        }, 1000);
      } catch (error) {
        console.error(`❌ Error emitting ${event}:`, error);
      }
    } else {
      console.warn(`❌ Cannot emit ${event}: socket not connected`);
      console.warn(`❌ Socket state:`, {
        exists: !!this.socket,
        connected: this.socket?.connected,
        id: this.socket?.id
      });
    }
  }

  public on<K extends keyof ServerToClientEvents>(
    event: K, 
    callback: ServerToClientEvents[K]
  ) {
    // Handle internal events (like connection-status) differently
    const internalEvents = ['connection-status', 'socket-error'];
    
    if (!internalEvents.includes(event as string)) {
      // Register with Socket.IO for server events
      if (this.socket) {
        // @ts-ignore - TypeScript has issues with this pattern
        this.socket.on(event, callback);
      }
    }
    
    // Always store listener for both internal events and re-subscription after reconnect
    if (!this.listeners[event as string]) {
      this.listeners[event as string] = [];
    }
    this.listeners[event as string].push(callback as any);
  }

  public off<K extends keyof ServerToClientEvents>(
    event: K, 
    callback?: ServerToClientEvents[K]
  ) {
    if (this.socket) {
      // @ts-ignore - TypeScript has issues with this pattern
      this.socket.off(event, callback);
    }

    // Remove from stored listeners
    if (this.listeners[event as string] && callback) {
      this.listeners[event as string] = this.listeners[event as string].filter(
        (listener) => listener !== callback
      );
    }
  }

  public getSocket(): ClientSocket | null {
    return this.socket;
  }

  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  public isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // Re-subscribe to all stored listeners (useful after reconnect)
  private resubscribeListeners() {
    if (!this.socket) return;

    Object.entries(this.listeners).forEach(([event, callbacks]) => {
      callbacks.forEach((callback) => {
        this.socket?.on(event as any, callback);
      });
    });
  }

  // Custom event emitter for internal events
  private emit(event: string, ...args: any[]) {
    const callbacks = this.listeners[event] || [];
    callbacks.forEach(callback => {
      try {
        callback(...args);
      } catch (error) {
        console.error(`Error in ${event} callback:`, error);
      }
    });
  }
}

// Singleton instance
let socketManager: SocketManager | null = null;

export function getSocketManager(): SocketManager {
  if (!socketManager) {
    socketManager = new SocketManager();
  }
  return socketManager;
}

// Convenience function to get connected socket
export function getSocket(): ClientSocket | null {
  return getSocketManager().getSocket();
}

// Initialize connection
export function initializeSocket(url?: string): ClientSocket {
  return getSocketManager().connect(url);
}

// Clean up connection
export function disconnectSocket() {
  getSocketManager().disconnect();
}