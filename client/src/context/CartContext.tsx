import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { CartContextType, Cart, RfidResponse } from '../types';
import { cartAPI } from '../services/api.ts';
import socketService from '../services/socket.ts';
import { useAuth } from './AuthContext.tsx';

// Initial state
interface CartState {
  cart: Cart | null;
  loading: boolean;
  error: string | null;
}

const initialState: CartState = {
  cart: null,
  loading: false,
  error: null
};

// Create context
const CartContext = createContext<CartContextType | undefined>(undefined);

// Action types
type CartAction =
  | { type: 'FETCH_CART_REQUEST' }
  | { type: 'FETCH_CART_SUCCESS'; payload: Cart }
  | { type: 'FETCH_CART_FAILURE'; payload: string }
  | { type: 'UPDATE_CART'; payload: Cart }
  | { type: 'CLEAR_CART_SUCCESS' }
  | { type: 'CLEAR_ERROR' };

// Reducer
const cartReducer = (state: CartState, action: CartAction): CartState => {
  switch (action.type) {
    case 'FETCH_CART_REQUEST':
      return {
        ...state,
        loading: true,
        error: null
      };
    case 'FETCH_CART_SUCCESS':
    case 'UPDATE_CART':
      return {
        ...state,
        cart: action.payload,
        loading: false,
        error: null
      };
    case 'FETCH_CART_FAILURE':
      return {
        ...state,
        loading: false,
        error: action.payload
      };
    case 'CLEAR_CART_SUCCESS':
      return {
        ...state,
        cart: null,
        loading: false,
        error: null
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null
      };
    default:
      return state;
  }
};

// Provider component
export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, initialState);
  const { authState } = useAuth();

  // Fetch cart on auth change
  useEffect(() => {
    if (authState.isAuthenticated && authState.user) {
      fetchCart();
    } else {
      dispatch({ type: 'CLEAR_CART_SUCCESS' });
    }
  }, [authState.isAuthenticated]);

  // Listen for cart updates from socket
  useEffect(() => {
    const handleCartUpdate = (data: { userId: string; carts: Cart[] }) => {
      if (authState.user && data.userId === authState.user.id) {
        const userCart = data.carts.find(cart => cart.userId === authState.user?.id) || {
          userId: authState.user.id,
          items: [],
          total: 0
        };
        dispatch({ type: 'UPDATE_CART', payload: userCart });
      }
    };

    if (authState.isAuthenticated) {
      socketService.on('cart_updated', handleCartUpdate);
    }

    return () => {
      socketService.off('cart_updated', handleCartUpdate);
    };
  }, [authState.isAuthenticated, authState.user]);

  // Fetch cart
  const fetchCart = async () => {
    dispatch({ type: 'FETCH_CART_REQUEST' });

    try {
      console.log('Fetching cart data from server...');
      const cart = await cartAPI.get();
      console.log('Cart data received:', cart);
      
      dispatch({
        type: 'FETCH_CART_SUCCESS',
        payload: cart
      });
      
      return cart;
    } catch (error: any) {
      console.error('Failed to fetch cart:', error);
      dispatch({
        type: 'FETCH_CART_FAILURE',
        payload: error.response?.data?.message || 'Failed to fetch cart'
      });
      return null;
    }
  };

  // Add item to cart
  const addToCart = async (productId: string, quantity: number = 1) => {
    dispatch({ type: 'FETCH_CART_REQUEST' });

    try {
      const updatedCart = await cartAPI.addItem(productId, quantity);
      dispatch({
        type: 'UPDATE_CART',
        payload: updatedCart
      });
    } catch (error: any) {
      dispatch({
        type: 'FETCH_CART_FAILURE',
        payload: error.response?.data?.message || 'Failed to add item to cart'
      });
    }
  };

  // Remove item from cart
  const removeFromCart = async (productId: string, quantity: number = 1) => {
    dispatch({ type: 'FETCH_CART_REQUEST' });

    try {
      const updatedCart = await cartAPI.removeItem(productId, quantity);
      dispatch({
        type: 'UPDATE_CART',
        payload: updatedCart
      });
    } catch (error: any) {
      dispatch({
        type: 'FETCH_CART_FAILURE',
        payload: error.response?.data?.message || 'Failed to remove item from cart'
      });
    }
  };

  // Clear cart
  const clearCart = async () => {
    dispatch({ type: 'FETCH_CART_REQUEST' });

    try {
      await cartAPI.clear();
      dispatch({ type: 'CLEAR_CART_SUCCESS' });
    } catch (error: any) {
      dispatch({
        type: 'FETCH_CART_FAILURE',
        payload: error.response?.data?.message || 'Failed to clear cart'
      });
    }
  };

  // RFID scan
  const rfidScan = async (rfidTag: string, action: 'add' | 'remove'): Promise<RfidResponse> => {
    dispatch({ type: 'FETCH_CART_REQUEST' });

    try {
      console.log(`Processing RFID scan: ${rfidTag}, action: ${action}`);
      const result = await cartAPI.rfidScan(rfidTag, action);
      
      if (result.cart) {
        dispatch({
          type: 'UPDATE_CART',
          payload: result.cart
        });
        console.log('Cart updated from RFID scan response:', result.cart);
      } else {
        // If the cart wasn't returned in the response, fetch it
        console.log('Cart not included in response, fetching updated cart...');
        await fetchCart();
      }
      
      return { success: true, data: result };
    } catch (error: any) {
      // Check if this is a server error (5xx)
      const isServerError = error.response && error.response.status >= 500;
      const errorMessage = isServerError 
        ? 'Server error. The server might be starting up, please try again in a moment.'
        : error.response?.data?.message || 'Failed to process RFID scan';
      
      console.error('RFID scan error:', errorMessage);
      
      dispatch({
        type: 'FETCH_CART_FAILURE',
        payload: errorMessage
      });
      
      return { 
        success: false, 
        error: errorMessage,
        isServerError
      };
    }
  };

  // Handle direct device requests
  const handleDeviceRequest = async (rfidTag: string, action: string, deviceId: string): Promise<RfidResponse> => {
    dispatch({ type: 'FETCH_CART_REQUEST' });
    
    try {
      console.log(`Processing device RFID request: ${rfidTag}, action: ${action}, device: ${deviceId}`);
      
      // Retry logic for 502 errors
      let retries = 0;
      const maxRetries = 3;
      let success = false;
      let result;
      
      while (!success && retries < maxRetries) {
        try {
          result = await cartAPI.handleDeviceRequest(rfidTag, action, deviceId);
          success = true;
        } catch (retryError: any) {
          if (retryError.response && retryError.response.status === 502 && retries < maxRetries - 1) {
            // If we get a 502 and have retries left, wait and try again
            retries++;
            console.log(`Retry attempt ${retries} after 502 error`);
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
          } else {
            // Either not a 502 or we're out of retries, rethrow
            throw retryError;
          }
        }
      }
      
      if (result) {
        if (result.cart) {
          dispatch({
            type: 'UPDATE_CART',
            payload: result.cart
          });
          console.log('Cart updated from device scan response:', result.cart);
        } else {
          // If the cart wasn't returned in the response, fetch it 
          console.log('Cart not included in device scan response, fetching updated cart...');
          await fetchCart();
        }
        
        return { success: true, data: result };
      }
      
      // Always fetch the cart after a successful device scan
      console.log('Refreshing cart after device scan...');
      await fetchCart();
      
      // If we get here without a result, return a default response
      return {
        success: false,
        error: 'Unknown error: No response received from server'
      };
    } catch (error: any) {
      const isServerError = error.response && error.response.status >= 500;
      const errorMessage = isServerError 
        ? 'Server error. The server might be starting up, please try again in a moment.'
        : error.response?.data?.message || 'Failed to process device request';
      
      console.error('Device request error:', errorMessage);
      
      dispatch({
        type: 'FETCH_CART_FAILURE',
        payload: errorMessage
      });
      
      return { 
        success: false, 
        error: errorMessage,
        isServerError 
      };
    }
  };

  // Connect to physical cart
  const connectToCart = async (deviceId: string) => {
    dispatch({ type: 'FETCH_CART_REQUEST' });

    try {
      const result = await cartAPI.connectCart(deviceId);
      if (result.success) {
        dispatch({
          type: 'UPDATE_CART',
          payload: result.cart
        });
      } else {
        dispatch({
          type: 'FETCH_CART_FAILURE',
          payload: result.message || 'Failed to connect to cart'
        });
      }
    } catch (error: any) {
      dispatch({
        type: 'FETCH_CART_FAILURE',
        payload: error.response?.data?.message || 'Failed to connect to cart'
      });
    }
  };

  // Disconnect from physical cart
  const disconnectCart = async () => {
    dispatch({ type: 'FETCH_CART_REQUEST' });

    try {
      await cartAPI.disconnectCart();
      fetchCart(); // Refresh the cart without the device ID
    } catch (error: any) {
      dispatch({
        type: 'FETCH_CART_FAILURE',
        payload: error.response?.data?.message || 'Failed to disconnect from cart'
      });
    }
  };

  // Checkout process
  const checkout = async () => {
    dispatch({ type: 'FETCH_CART_REQUEST' });

    try {
      const result = await cartAPI.checkout();
      dispatch({ type: 'CLEAR_CART_SUCCESS' });
      return result;
    } catch (error: any) {
      dispatch({
        type: 'FETCH_CART_FAILURE',
        payload: error.response?.data?.message || 'Failed to checkout'
      });
      throw error;
    }
  };

  const value: CartContextType = {
    cart: state.cart,
    loading: state.loading,
    error: state.error,
    fetchCart,
    addToCart,
    removeFromCart,
    clearCart,
    rfidScan,
    connectToCart,
    disconnectCart,
    checkout,
    handleDeviceRequest,
    clearError: () => dispatch({ type: 'CLEAR_ERROR' })
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

// Custom hook to use cart context
export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export default CartContext; 