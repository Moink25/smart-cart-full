import React, { createContext, useContext, useReducer } from 'react';
import { PaymentContextType, PaymentInfo } from '../types';
import { paymentAPI } from '../services/api.ts';
import socketService from '../services/socket.ts';
import { useAuth } from './AuthContext.tsx';

// Initial state
interface PaymentState {
  loading: boolean;
  error: string | null;
}

const initialState: PaymentState = {
  loading: false,
  error: null
};

// Create context
const PaymentContext = createContext<PaymentContextType | undefined>(undefined);

// Action types
type PaymentAction =
  | { type: 'PAYMENT_REQUEST' }
  | { type: 'PAYMENT_SUCCESS' }
  | { type: 'PAYMENT_FAILURE'; payload: string }
  | { type: 'CLEAR_ERROR' };

// Reducer
const paymentReducer = (state: PaymentState, action: PaymentAction): PaymentState => {
  switch (action.type) {
    case 'PAYMENT_REQUEST':
      return {
        ...state,
        loading: true,
        error: null
      };
    case 'PAYMENT_SUCCESS':
      return {
        ...state,
        loading: false,
        error: null
      };
    case 'PAYMENT_FAILURE':
      return {
        ...state,
        loading: false,
        error: action.payload
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
export const PaymentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(paymentReducer, initialState);
  const { authState } = useAuth();

  // Create order for payment
  const createOrder = async (): Promise<PaymentInfo> => {
    dispatch({ type: 'PAYMENT_REQUEST' });

    try {
      const orderData = await paymentAPI.createOrder();
      dispatch({ type: 'PAYMENT_SUCCESS' });
      return orderData;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to create payment order';
      dispatch({
        type: 'PAYMENT_FAILURE',
        payload: errorMessage
      });
      throw new Error(errorMessage);
    }
  };

  // Verify payment
  const verifyPayment = async (paymentId: string, orderId: string, signature: string): Promise<boolean> => {
    dispatch({ type: 'PAYMENT_REQUEST' });

    try {
      const result = await paymentAPI.verifyPayment(paymentId, orderId, signature);
      
      // Notify server about completed payment via socket
      if (authState.user) {
        socketService.emit('payment_completed', {
          userId: authState.user.id,
          orderId,
          paymentId
        });
      }
      
      dispatch({ type: 'PAYMENT_SUCCESS' });
      return true;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Payment verification failed';
      dispatch({
        type: 'PAYMENT_FAILURE',
        payload: errorMessage
      });
      return false;
    }
  };

  const value: PaymentContextType = {
    createOrder,
    verifyPayment,
    loading: state.loading,
    error: state.error
  };

  return <PaymentContext.Provider value={value}>{children}</PaymentContext.Provider>;
};

// Custom hook to use payment context
export const usePayment = (): PaymentContextType => {
  const context = useContext(PaymentContext);
  if (context === undefined) {
    throw new Error('usePayment must be used within a PaymentProvider');
  }
  return context;
};

export default PaymentContext; 