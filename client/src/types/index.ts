export interface User {
  id: string;
  username: string;
  role: 'admin' | 'customer';
}

export interface Product {
  id: string;
  name: string;
  price: number;
  rfidTag: string;
  quantity: number;
  image?: string;
  weight?: number;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Cart {
  userId: string;
  items: CartItem[];
  total: number;
  deviceId?: string;
  id?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

export interface AuthContextType {
  authState: AuthState;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

export interface RfidResponse {
  success: boolean;
  data?: any;
  error?: string;
  isServerError?: boolean;
}

export interface CartContextType {
  cart: Cart | null;
  loading: boolean;
  error: string | null;
  fetchCart: () => Promise<void>;
  addToCart: (productId: string, quantity?: number) => Promise<void>;
  removeFromCart: (productId: string, quantity?: number) => Promise<void>;
  clearCart: () => Promise<void>;
  rfidScan: (rfidTag: string, action: 'add' | 'remove') => Promise<RfidResponse>;
  connectToCart: (deviceId: string) => Promise<void>;
  disconnectCart: () => Promise<void>;
  checkout: () => Promise<void>;
  handleDeviceRequest: (rfidTag: string, action: string, deviceId: string) => Promise<RfidResponse>;
  clearError: () => void;
}

export interface ProductContextType {
  products: Product[];
  loading: boolean;
  error: string | null;
  getProducts: () => Promise<void>;
  getProduct: (id: string) => Promise<Product | undefined>;
  addProduct: (product: Omit<Product, 'id'>) => Promise<Product>;
  updateProduct: (id: string, product: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  clearError: () => void;
}

export interface PaymentInfo {
  orderId: string;
  amount: number;
  currency: string;
}

export interface PaymentContextType {
  createOrder: () => Promise<PaymentInfo>;
  verifyPayment: (paymentId: string, orderId: string, signature: string) => Promise<boolean>;
  loading: boolean;
  error: string | null;
} 