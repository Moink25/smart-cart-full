import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext.tsx';
import { usePayment } from '../context/PaymentContext.tsx';
import CartItem from '../components/CartItem.tsx';
import { paymentAPI } from '../services/api.ts';
import { PaymentInfo } from '../types';

declare global {
  interface Window {
    Razorpay: any;
  }
}

const Cart: React.FC = () => {
  const { cart, loading, error, clearCart, fetchCart, clearError } = useCart();
  const { createOrder, verifyPayment, loading: paymentLoading, error: paymentError } = usePayment();
  const [razorpayKey, setRazorpayKey] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [paymentMessage, setPaymentMessage] = useState('');
  const navigate = useNavigate();
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [retryAttempt, setRetryAttempt] = useState(0);

  // Load Razorpay script and key on mount
  useEffect(() => {
    const loadRazorpayScript = () => {
      return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => {
          resolve(true);
        };
        script.onerror = () => {
          resolve(false);
        };
        document.body.appendChild(script);
      });
    };

    const getRazorpayKey = async () => {
      try {
        const { key } = await paymentAPI.getKey();
        setRazorpayKey(key);
      } catch (error) {
        console.error('Failed to get Razorpay key:', error);
      }
    };

    const initPayment = async () => {
      await loadRazorpayScript();
      await getRazorpayKey();
    };

    initPayment();
  }, []);

  // Fetch cart data once on mount
  useEffect(() => {
    console.log('Cart page: Initial cart data fetch');
    fetchCart();
  }, []);
  
  // This effect runs when the refresh counter changes (manual refresh only)
  useEffect(() => {
    if (refreshCounter > 0) {
      console.log('Cart page: Manual refresh triggered');
      fetchCart();
    }
  }, [refreshCounter]);
  
  // Auto-retry on error (max 3 attempts)
  useEffect(() => {
    if (error && retryAttempt < 3) {
      const timer = setTimeout(() => {
        console.log(`Retrying cart fetch (attempt ${retryAttempt + 1})...`);
        setRetryAttempt(prev => prev + 1);
        clearError(); // Clear previous error
        fetchCart();
      }, 2000); // Wait 2 seconds before retry
      
      return () => clearTimeout(timer);
    }
  }, [error, retryAttempt, clearError, fetchCart]);

  // Handle payment
  const handlePayment = async () => {
    if (!cart || cart.items.length === 0) {
      setPaymentStatus('error');
      setPaymentMessage('Your cart is empty');
      return;
    }

    setPaymentStatus('processing');
    setPaymentMessage('Creating order...');

    try {
      // First, ensure cart is up to date to avoid issues with stale data
      await fetchCart();
      console.log("Cart refreshed before payment:", cart);
      
      // Double check cart has items
      if (!cart || !cart.items || cart.items.length === 0) {
        throw new Error('Your cart is empty or could not be loaded.');
      }
      
      // Check if Razorpay script is loaded
      if (!window.Razorpay) {
        console.log('Razorpay SDK not loaded, attempting to load it now...');
        // Try loading again
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        document.body.appendChild(script);
        
        setPaymentMessage('Loading payment gateway...');
        // Wait for script to load
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = () => reject(new Error('Failed to load Razorpay script'));
          // Set a timeout just in case
          setTimeout(() => reject(new Error('Razorpay script load timeout')), 5000);
        });
        
        if (!window.Razorpay) {
          throw new Error('Unable to load payment gateway. Please try again or refresh the page.');
        }
      }

      // Check if we have the Razorpay key
      if (!razorpayKey) {
        setPaymentMessage('Getting payment configuration...');
        try {
          const { key } = await paymentAPI.getKey();
          console.log("Received Razorpay key:", key ? "Valid key received" : "No key received");
          setRazorpayKey(key);
        } catch (keyError) {
          console.error("Failed to get Razorpay key:", keyError);
          throw new Error('Unable to retrieve payment configuration. Please try again later.');
        }
      }

      // Try to create the order with retry logic
      let orderData: PaymentInfo | null = null;
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        try {
          attempts++;
          console.log(`Payment order creation attempt ${attempts}/${maxAttempts}`);
          
          // Force cart refresh before creating order on retries
          if (attempts > 1) {
            await fetchCart();
            setPaymentMessage(`Refreshing cart and retrying... (${attempts}/${maxAttempts})`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          orderData = await createOrder();
          console.log("Order created successfully:", orderData);
          break; // Success, exit the loop
        } catch (orderError) {
          console.error(`Payment order creation attempt ${attempts} failed:`, orderError);
          
          if (attempts >= maxAttempts) {
            throw orderError;
          }
          
          // Wait before retrying
          setPaymentMessage(`Error occurred. Retrying in 2 seconds... (${attempts}/${maxAttempts})`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      if (!orderData) {
        throw new Error('Failed to create order after multiple attempts');
      }
      
      // Verify we have everything needed for Razorpay
      if (!window.Razorpay) {
        throw new Error('Payment gateway failed to load');
      }
      
      if (!razorpayKey) {
        throw new Error('Missing payment configuration');
      }

      console.log("Opening Razorpay payment form with options:", {
        key: "HIDDEN",
        amount: orderData.amount * 100,
        currency: orderData.currency || 'INR',
        orderId: orderData.orderId
      });

      // Create and open Razorpay checkout
      const razorpay = new window.Razorpay({
        key: razorpayKey,
        amount: orderData.amount * 100, // in smallest currency unit
        currency: orderData.currency || 'INR',
        name: 'Smart Cart',
        description: 'Purchase from Smart Cart',
        order_id: orderData.orderId,
        handler: async (response) => {
          console.log("Payment successful, verifying:", response);
          setPaymentMessage('Verifying payment...');
          
          try {
            // Verify payment
            const isVerified = await verifyPayment(
              response.razorpay_payment_id,
              response.razorpay_order_id,
              response.razorpay_signature
            );
            
            if (isVerified) {
              console.log("Payment verification successful");
              setPaymentStatus('success');
              setPaymentMessage('Payment successful! Your order has been placed.');
              // Reset cart after successful payment
              await clearCart();
              // Redirect to home page after 2 seconds
              setTimeout(() => {
                navigate('/');
              }, 2000);
            } else {
              console.error("Payment verification failed without error");
              setPaymentStatus('error');
              setPaymentMessage('Payment verification failed. Please contact support if your account was charged.');
            }
          } catch (error) {
            console.error("Payment verification error:", error);
            setPaymentStatus('error');
            setPaymentMessage(`Payment verification failed: ${error.message || 'Unknown error'}`);
          }
        },
        prefill: {
          name: 'Customer',
          email: 'customer@example.com',
          contact: '9999999999'
        },
        theme: {
          color: '#0284c7'
        },
        modal: {
          ondismiss: function() {
            console.log("Razorpay modal dismissed by user");
            setPaymentStatus('idle');
            setPaymentMessage('');
          }
        }
      });
      
      razorpay.on('payment.failed', (response) => {
        console.error('Payment failed:', response.error);
        setPaymentStatus('error');
        setPaymentMessage(`Payment failed: ${response.error.description || 'Unknown error'}`);
      });
      
      // Open the payment form
      razorpay.open();
      console.log("Razorpay payment form opened");
    } catch (error) {
      console.error('Payment process error:', error);
      setPaymentStatus('error');
      const errorMessage = error.message || 'Unknown error occurred';
      setPaymentMessage(`Failed to process payment: ${errorMessage}`);
    }
  };

  // Force refresh cart now
  const forceRefreshCart = () => {
    console.log('Manually refreshing cart');
    setRetryAttempt(0); // Reset retry counter
    clearError(); // Clear any existing errors
    setRefreshCounter(prev => prev + 1);
  };

  // Handle clear cart
  const handleClearCart = () => {
    clearCart();
  };
  
  // Handle direct checkout without payment (for testing)
  const handleDirectCheckout = async () => {
    try {
      setPaymentStatus('processing');
      setPaymentMessage('Processing checkout...');
      
      await clearCart();
      
      setPaymentStatus('success');
      setPaymentMessage('Checkout successful! Cart has been reset.');
      
      // Redirect to home page after 2 seconds
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (error) {
      setPaymentStatus('error');
      setPaymentMessage('Failed to complete checkout');
    }
  };

  // Get detailed error message
  const getErrorMessage = () => {
    if (error?.toLowerCase().includes('network error')) {
      return 'Network error: Please check your internet connection and try again.';
    } else if (error?.toLowerCase().includes('server')) {
      return 'Server error: The server might be starting up or experiencing issues. Please try again in a moment.';
    } else if (error?.toLowerCase().includes('not found')) {
      return 'Your cart could not be found. It may have been cleared or expired.';
    } else if (error?.toLowerCase().includes('timeout')) {
      return 'Request timeout: The server took too long to respond. Please try again.';
    }
    return `Error loading cart: ${error}`;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Your Cart</h1>
        <div className="flex space-x-4">
          <button 
            onClick={forceRefreshCart} 
            className="text-blue-600 hover:text-blue-800 flex items-center"
            disabled={loading}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 mr-1 ${loading ? 'animate-spin' : ''}`} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
            {loading ? 'Refreshing...' : 'Refresh Cart'}
          </button>
          <Link to="/" className="text-primary-600 hover:text-primary-700 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Continue Shopping
          </Link>
        </div>
      </div>
      
      {loading ? (
        <div className="flex flex-col justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mb-4"></div>
          <p className="text-gray-600">Loading your cart...</p>
        </div>
      ) : error ? (
        <div className="bg-red-100 text-red-700 p-6 rounded-lg mb-6 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto mb-3 text-red-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <p className="text-lg mb-4 font-medium">{getErrorMessage()}</p>
          <div className="flex justify-center">
            <button
              onClick={forceRefreshCart}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition mr-4"
            >
              Retry Now
            </button>
            <Link to="/" className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md transition">
              Return to Homepage
            </Link>
          </div>
          {retryAttempt > 0 && (
            <p className="text-sm mt-3 text-gray-600">
              Retry attempt {retryAttempt} of 3
              {retryAttempt === 3 && '. Maximum retry attempts reached.'}
            </p>
          )}
        </div>
      ) : !cart || cart.items.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h2 className="mt-4 text-xl font-medium text-gray-800">Your cart is empty</h2>
          <p className="mt-2 text-gray-600">Add some products to your cart or scan items with RFID</p>
          <div className="mt-4 flex justify-center space-x-4">
            <Link to="/" className="inline-block bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md transition">
              Browse Products
            </Link>
            <button
              onClick={forceRefreshCart}
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition"
            >
              Refresh Cart
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="mb-4 pb-4 border-b border-gray-200">
                <h2 className="text-xl font-medium text-gray-800">Shopping Cart ({cart.items.reduce((acc, item) => acc + item.quantity, 0)} items)</h2>
              </div>
              
              <div className="space-y-4">
                {cart.items.map(item => (
                  <CartItem key={item.id} item={item} />
                ))}
              </div>
              
              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleClearCart}
                  className="text-red-600 hover:text-red-800 transition"
                >
                  Clear Cart
                </button>
              </div>
            </div>
          </div>
          
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-4">
              <h2 className="text-xl font-medium text-gray-800 mb-4">Order Summary</h2>
              
              <div className="space-y-3">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>₹{cart.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Shipping</span>
                  <span>Free</span>
                </div>
                <div className="border-t border-gray-200 pt-3 flex justify-between font-medium text-lg">
                  <span>Total</span>
                  <span>₹{cart.total.toFixed(2)}</span>
                </div>
              </div>
              
              <div className="mt-6 space-y-3">
                <button
                  onClick={handlePayment}
                  disabled={paymentLoading || paymentStatus === 'processing' || cart.items.length === 0}
                  className={`w-full py-3 px-4 rounded-md text-white font-medium transition ${
                    paymentLoading || paymentStatus === 'processing' || cart.items.length === 0
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-primary-600 hover:bg-primary-700'
                  }`}
                >
                  {paymentLoading || paymentStatus === 'processing' ? (
                    <div className="flex items-center justify-center">
                      <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </div>
                  ) : (
                    'Proceed to Payment'
                  )}
                </button>
                
                {/* Test option to bypass Razorpay for demo purposes */}
                <button
                  onClick={handleDirectCheckout}
                  disabled={paymentLoading || paymentStatus === 'processing' || cart.items.length === 0}
                  className={`w-full py-2 px-4 rounded-md text-white font-medium transition text-sm ${
                    paymentLoading || paymentStatus === 'processing' || cart.items.length === 0
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  Checkout without Payment (Demo)
                </button>
              </div>
              
              {(paymentStatus === 'success' || paymentStatus === 'error' || paymentError) && (
                <div className={`mt-4 p-3 rounded-md ${
                  paymentStatus === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {paymentMessage || paymentError}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cart;