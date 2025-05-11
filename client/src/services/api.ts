import axios from 'axios';

// Support both local and hosted server
// Try local development server first, fall back to hosted server
const API_URL = 'https://smart-cart-test.onrender.com/api';
const LOCAL_API_URL = 'http://localhost:5000/api'; 

// Check if we can use local server
const isLocalDevelopment = process.env.NODE_ENV === 'development';

// Create axios instance with longer timeout
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 20000 // 20 seconds timeout for slow server startup
});

// Add request interceptor for authentication
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Log outgoing requests in development
    if (isLocalDevelopment) {
      console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`, config.data || '');
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for better error handling
api.interceptors.response.use(
  (response) => {
    // Log API responses in development
    if (isLocalDevelopment) {
      console.log(`API Response: ${response.status} ${response.config.url}`, response.data);
    }
    return response;
  },
  (error) => {
    // Handle server startup delays (502 Bad Gateway errors from render.com)
    if (error.response && error.response.status === 502) {
      console.log('Server may be starting up (502 error). Will retry automatically.');
    }
    
    // Log API errors
    console.error('API Error:', {
      url: error.config?.url,
      status: error.response?.status,
      message: error.message,
      data: error.response?.data
    });
    
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (username: string, password: string) => {
    const response = await api.post('/auth/login', { username, password });
    return response.data;
  },
  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  }
};

// Products API
export const productsAPI = {
  getAll: async () => {
    const response = await api.get('/products');
    return response.data;
  },
  getById: async (id: string) => {
    const response = await api.get(`/products/${id}`);
    return response.data;
  },
  create: async (product: any) => {
    const response = await api.post('/products', product);
    return response.data;
  },
  update: async (id: string, product: any) => {
    const response = await api.put(`/products/${id}`, product);
    return response.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/products/${id}`);
    return response.data;
  },
  getByRfidTag: async (tag: string) => {
    const response = await api.get(`/products/rfid/${tag}`);
    return response.data;
  }
};

// Cart API
export const cartAPI = {
  get: async () => {
    const response = await api.get('/cart');
    return response.data;
  },
  addItem: async (productId: string, quantity: number = 1) => {
    const response = await api.post('/cart/add', { productId, quantity });
    return response.data;
  },
  removeItem: async (productId: string, quantity: number = 1) => {
    const response = await api.post('/cart/remove', { productId, quantity });
    return response.data;
  },
  clear: async () => {
    const response = await api.delete('/cart/clear');
    return response.data;
  },
  rfidScan: async (rfidTag: string, action: 'add' | 'remove', deviceId?: string) => {
    const payload = { rfidTag, action };
    if (deviceId) {
      Object.assign(payload, { deviceId });
    }
    const response = await api.post('/cart/rfid-scan', payload);
    return response.data;
  },
  connectCart: async (deviceId: string) => {
    const response = await api.post('/cart/connect-device', { deviceId });
    return response.data;
  },
  disconnectCart: async () => {
    const response = await api.post('/cart/disconnect-device');
    return response.data;
  },
  checkout: async () => {
    const response = await api.post('/cart/checkout');
    return response.data;
  },
  // Updated method to use the same path as NodeMCU
  handleDeviceRequest: async (rfidTag: string, action: string, deviceId: string) => {
    const response = await api.post('/cart/rfid-scan', { 
      rfidTag, 
      action, 
      deviceId 
    });
    return response.data;
  },
  getConnectedDevices: async () => {
    const response = await api.get('/cart/connected-devices');
    return response.data;
  }
};

// Payment API
export const paymentAPI = {
  createOrder: async () => {
    try {
      // First check if the user has a cart with items
      const cartResponse = await api.get('/cart');
      const cart = cartResponse.data;
      
      if (!cart || !cart.items || cart.items.length === 0) {
        throw new Error('Your cart is empty. Please add items before checkout.');
      }
      
      if (!cart.total || cart.total <= 0) {
        throw new Error('Invalid cart total. Please try again or contact support.');
      }
      
      // Proceed with creating the payment order
      const response = await api.post('/payment/create-order');
      return response.data;
    } catch (error: any) {
      console.error('Error creating payment order:', error);
      
      // Handle specific error cases
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        if (error.response.status === 401 || error.response.status === 403) {
          localStorage.removeItem('token'); // Clear invalid token
          throw new Error('Your session has expired. Please log in again.');
        }
        
        if (error.response.status === 400) {
          throw new Error(error.response.data?.message || 'Invalid request. Please check your cart.');
        }
        
        if (error.response.status === 502) {
          throw new Error('The server is starting up. Please try again in a moment.');
        }
        
        if (error.response.data?.message) {
          throw new Error(error.response.data.message);
        }
      }
      
      // Network errors or other issues
      if (error.message) {
        throw new Error(`Payment creation failed: ${error.message}`);
      }
      
      // Generic fallback
      throw new Error('Failed to create payment. Please try again later.');
    }
  },
  verifyPayment: async (paymentId: string, orderId: string, signature: string) => {
    try {
      const response = await api.post('/payment/verify', { paymentId, orderId, signature });
      return response.data;
    } catch (error: any) {
      console.error('Error verifying payment:', error);
      if (error.response && error.response.status === 502) {
        throw new Error('The server is starting up. Please try again in a moment.');
      }
      
      // Return meaningful error message
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      
      throw error;
    }
  },
  getKey: async () => {
    try {
      const response = await api.get('/payment/key');
      return response.data;
    } catch (error: any) {
      console.error('Error getting Razorpay key:', error);
      if (error.response && error.response.status === 502) {
        throw new Error('The server is starting up. Please try again in a moment.');
      }
      throw error;
    }
  }
};

export default api; 