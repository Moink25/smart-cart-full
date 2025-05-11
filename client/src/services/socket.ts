import { io, Socket } from 'socket.io-client';
import { Product, Cart } from '../types';

// Use the hosted server
const SOCKET_URL = 'https://smart-cart-test.onrender.com';

interface ServerToClientEvents {
  product_scanned: (data: { product: Product; action: 'add' | 'remove' }) => void;
  cart_updated: (data: { userId: string; carts: Cart[] }) => void;
  inventory_updated: (data: { products: Product[] }) => void;
  error: (data: { message: string }) => void;
}

interface ClientToServerEvents {
  rfid_scan: (data: { rfidTag: string; action: 'add' | 'remove'; userId: string }) => void;
  inventory_update: (data: { productId: string; quantity: number }) => void;
  payment_completed: (data: { userId: string; orderId: string; paymentId: string }) => void;
}

class SocketService {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private listeners: { [key: string]: Function[] } = {};
  
  constructor() {
    // Auto-initialize with token from localStorage if available
    const token = localStorage.getItem('token');
    if (token) {
      this.connect(token);
    }
  }

  connect(token: string): void {
    if (this.socket) {
      console.log('Closing existing socket connection before creating new one');
      this.socket.disconnect();
    }

    console.log('Initializing socket connection...');
    try {
      this.socket = io(SOCKET_URL, {
        auth: {
          token
        },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000
      });

      this.setupListeners();
      
      // Add reconnection logic
      this.socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        this.triggerListeners('error', { message: 'Failed to connect to server' });
      });
      
      // Log connection status
      this.socket.on('connect', () => {
        console.log('Socket connected successfully');
      });
    } catch (error) {
      console.error('Error initializing socket:', error);
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private setupListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Connected to WebSocket server');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
    });

    this.socket.on('product_scanned', (data) => {
      this.triggerListeners('product_scanned', data);
    });

    this.socket.on('cart_updated', (data) => {
      this.triggerListeners('cart_updated', data);
    });

    this.socket.on('inventory_updated', (data) => {
      this.triggerListeners('inventory_updated', data);
    });

    this.socket.on('error', (data) => {
      this.triggerListeners('error', data);
    });
  }

  on(event: string, callback: Function): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  off(event: string, callback: Function): void {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  private triggerListeners(event: string, data: any): void {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(callback => callback(data));
  }

  emit(event: 'rfid_scan' | 'inventory_update' | 'payment_completed', data: any): void {
    if (!this.socket || !this.socket.connected) {
      // Try to reconnect if not connected
      const token = localStorage.getItem('token');
      if (token) {
        this.connect(token);
        console.log('Attempting to reconnect socket before emitting event');
      } else {
        console.error('Socket not connected and no auth token available');
        return;
      }
    }
    this.socket.emit(event, data);
  }

  isConnected(): boolean {
    try {
      return this.socket !== null && this.socket.connected === true;
    } catch (e) {
      console.error('Error checking socket connection:', e);
      return false;
    }
  }
  
  // Force reconnect method
  forceReconnect(): void {
    const token = localStorage.getItem('token');
    if (token) {
      this.connect(token);
    } else {
      console.error('Cannot reconnect: No auth token available');
    }
  }
}

export const socketService = new SocketService();
export default socketService; 