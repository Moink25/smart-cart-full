import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProducts } from '../context/ProductContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useCart } from '../context/CartContext.tsx';
import ProductCard from '../components/ProductCard.tsx';
import socketService from '../services/socket.ts';
import api from '../services/api.ts';
import { CartItem, Product } from '../types';

const CustomerHome: React.FC = () => {
  const { products, loading, error, getProducts, clearError } = useProducts();
  const { authState } = useAuth();
  const { cart, checkout, clearCart, fetchCart } = useCart();
  const [rfidConnected, setRfidConnected] = useState(false);
  const [rfidStatus, setRfidStatus] = useState('Not connected');
  const [searchTerm, setSearchTerm] = useState('');
  const [cartId, setCartId] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('idle'); // 'idle', 'connecting', 'connected', 'failed'
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [lastScannedItem, setLastScannedItem] = useState<Product | null>(null);
  const [showCartOptions, setShowCartOptions] = useState(false);
  const [manualRefreshCounter, setManualRefreshCounter] = useState(0);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0);
  const [productsLoadingRetry, setProductsLoadingRetry] = useState(0);

  // Fetch products on component mount and when refresh is triggered - prevent infinite loop
  useEffect(() => {
    // Only fetch products once on mount or when refresh counter changes
    const loadProducts = async () => {
      if (!loading) {
        try {
          await getProducts();
          // Reset retry counter on success
          setProductsLoadingRetry(0);
        } catch (error) {
          console.error("Error fetching products in CustomerHome:", error);
        }
      }
    };
    
    loadProducts();
    
    // Clean up on unmount
    return () => {
      clearError();
    };
  }, [manualRefreshCounter]); // Only depends on the manual refresh counter
  
  // This effect handles retries if needed
  useEffect(() => {
    // Only try to retry if we're under the limit and have an error
    if (productsLoadingRetry > 0 && productsLoadingRetry < 3 && error) {
      const retryTimer = setTimeout(() => {
        console.log(`Retrying product fetch (attempt ${productsLoadingRetry + 1}/3)`);
        getProducts().catch(e => console.error("Retry failed:", e));
      }, 2000);
      
      return () => clearTimeout(retryTimer);
    }
  }, [productsLoadingRetry, error]);

  // Handle cart updates
  useEffect(() => {
    if (cart) {
      setCartItems(cart.items || []);
    }
  }, [cart]);

  // Initial cart fetch and infrequent auto-refresh (once per minute max)
  useEffect(() => {
    // Initial fetch on mount
    fetchCart();
    
    // This interval doesn't actually fetch, it just checks if we need to
    const refreshInterval = setInterval(() => {
      const now = Date.now();
      // Only refresh if it's been more than 60 seconds since last refresh
      if (now - lastRefreshTime > 60000) {
        fetchCart();
        setLastRefreshTime(now);
      }
    }, 60000); // Check once per minute
    
    return () => clearInterval(refreshInterval);
  }, []);
  
  // Handle manual cart refresh via counter
  useEffect(() => {
    if (manualRefreshCounter > 0) {
      fetchCart();
      setLastRefreshTime(Date.now());
    }
  }, [manualRefreshCounter, fetchCart]);

  // Check socket connection status
  useEffect(() => {
    const checkConnection = () => {
      const isConnected = socketService.isConnected();
      setRfidConnected(isConnected);
      setRfidStatus(isConnected ? 'Connected to server' : 'Not connected to server');
    };

    // Check initial connection
    checkConnection();

    // Set up event listeners for socket connection changes
    socketService.on('connect', () => {
      setRfidConnected(true);
      setRfidStatus('Connected to server');
    });

    socketService.on('disconnect', () => {
      setRfidConnected(false);
      setRfidStatus('Disconnected from server');
    });

    // Set up event listener for product scans
    socketService.on('product_scanned', (data) => {
      const product = data.product;
      setLastScannedItem(product);
      
      if (data.action === 'add') {
        showToastMessage(`Added to cart: ${product.name}`);
      } else {
        showToastMessage(`Removed from cart: ${product.name}`);
      }
      
      // Update RFID status with the latest scan
      setRfidStatus(`Last scan: ${product.name} (${data.action})`);
      
      // Refresh cart to show latest items
      fetchCart();
      setLastRefreshTime(Date.now());
    });

    // Listen for cart connection status
    socketService.on('cart_connected', (data) => {
      if (data.success) {
        setConnectionStatus('connected');
        setCartId(data.deviceId);
        showToastMessage(`Connected to physical cart: ${data.deviceId}`);
      } else {
        setConnectionStatus('failed');
        showToastMessage('Connection to physical cart failed');
      }
      setConnecting(false);
    });

    // Cleanup on unmount
    return () => {
      socketService.off('connect', () => {});
      socketService.off('disconnect', () => {});
      socketService.off('product_scanned', () => {});
      socketService.off('cart_connected', () => {});
    };
  }, []);

  // Connect to physical cart
  const handleConnectCart = async () => {
    if (!cartId.trim()) {
      showToastMessage('Please enter a cart ID');
      return;
    }

    setConnecting(true);
    setConnectionStatus('connecting');
    
    try {
      // Send request to connect to physical cart
      const response = await api.post('/cart/connect-device', { 
        deviceId: cartId 
      });

      if (response.data.success) {
        // Connection initiated, waiting for NodeMCU response
        showToastMessage('Connection request sent. Waiting for physical cart...');
        
        // NodeMCU should respond through socket event 'cart_connected'
        // The real connection status will be updated in the socket listener
      } else {
        setConnectionStatus('failed');
        showToastMessage(`Failed to connect: ${response.data.message}`);
        setConnecting(false);
      }
    } catch (error) {
      console.error('Error connecting to physical cart:', error);
      setConnectionStatus('failed');
      showToastMessage('Connection failed. Try again.');
      setConnecting(false);
    }
  };

  // Handle checkout process
  const handleCheckout = async () => {
    if (!cartItems.length) {
      showToastMessage('Cart is empty');
      return;
    }
    
    setCheckingOut(true);
    
    try {
      const result = await checkout();
      showToastMessage('Checkout successful! Thank you for your purchase.');
      
      // Automatically disconnect cart after checkout
      // The connection will be reset by the server
      setConnectionStatus('idle');
      setCartId('');
    } catch (error) {
      console.error('Checkout error:', error);
      showToastMessage('Checkout failed. Please try again.');
    } finally {
      setCheckingOut(false);
    }
  };

  // Handle clear cart
  const handleClearCart = async () => {
    try {
      await clearCart();
      showToastMessage('Cart cleared successfully');
      setShowCartOptions(false);
    } catch (error) {
      console.error('Clear cart error:', error);
      showToastMessage('Failed to clear cart');
    }
  };

  // Refresh cart manually
  const handleRefreshCart = async () => {
    try {
      setManualRefreshCounter(prev => prev + 1);
      showToastMessage('Cart refreshed');
    } catch (error) {
      console.error('Refresh cart error:', error);
      showToastMessage('Failed to refresh cart');
    }
  };

  // Manual refresh of products
  const handleRefreshProducts = () => {
    clearError();
    setProductsLoadingRetry(0);
    setManualRefreshCounter(prev => prev + 1);
    showToastMessage('Refreshing products...');
  };

  // Show toast message
  const showToastMessage = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // Filter products based on search term
  const filteredProducts = products.filter(product => 
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.rfidTag.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Welcome, {authState.user?.username}</h1>
          <p className="text-gray-600 mt-1">Browse products and connect to a physical cart</p>
        </div>
        
        <div className="mt-4 md:mt-0 flex flex-col items-end">
          <div className="flex items-center">
            <span className="mr-2">System Status:</span>
            <span className={`px-2 py-1 rounded-full text-xs ${
              rfidConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {rfidStatus}
            </span>
          </div>
          
          {/* Cart Options Button */}
          <div className="mt-2 relative">
            <div className="flex space-x-2">
              <Link to="/cart" className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md text-sm transition">
                View Cart {cartItems.length > 0 && `(${cartItems.length})`}
              </Link>
              <button 
                onClick={() => setShowCartOptions(!showCartOptions)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-2 py-2 rounded-md text-sm transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </button>
            </div>
            
            {showCartOptions && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10">
                <ul className="py-1">
                  <li>
                    <button 
                      onClick={handleRefreshCart}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Refresh Cart
                    </button>
                  </li>
                  <li>
                    <button 
                      onClick={handleClearCart}
                      className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                    >
                      Clear Cart
                    </button>
                  </li>
                </ul>
              </div>
            )}
          </div>
          
          {cartItems.length > 0 && (
            <div className="mt-2 text-sm text-gray-600">
              Total: ₹{cart?.total?.toFixed(2) || '0.00'}
            </div>
          )}
        </div>
      </div>
      
      {/* Physical Cart Connection Panel */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h2 className="text-lg font-medium text-gray-800 mb-2">Smart Cart Connection</h2>
        
        <div className="flex flex-wrap gap-3 items-center">
          {connectionStatus !== 'connected' ? (
            <>
              <div className="flex-grow">
                <input
                  type="text"
                  placeholder="Enter Cart ID"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={cartId}
                  onChange={(e) => setCartId(e.target.value)}
                  disabled={connecting || connectionStatus === 'connecting'}
                />
              </div>
              <button
                onClick={handleConnectCart}
                disabled={connecting || !cartId.trim() || connectionStatus === 'connecting'}
                className={`px-4 py-2 rounded-md text-white font-medium transition ${
                  connecting || !cartId.trim() || connectionStatus === 'connecting'
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {connectionStatus === 'connecting' ? 'Connecting...' : 'Connect Cart'}
              </button>
            </>
          ) : (
            <>
              <div className="flex-grow">
                <div className="flex items-center">
                  <div className="h-3 w-3 bg-green-500 rounded-full mr-2"></div>
                  <span className="text-green-700">Connected to physical cart: {cartId}</span>
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {cartItems.length > 0 ? (
                    <span>
                      {cartItems.length} {cartItems.length === 1 ? 'item' : 'items'} in cart, 
                      total: ₹{cart?.total?.toFixed(2) || '0.00'}
                    </span>
                  ) : (
                    <span>Scan items using the physical RFID reader to add them to your cart</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCheckout}
                  disabled={checkingOut || !cartItems.length}
                  className={`px-4 py-2 rounded-md text-white font-medium transition ${
                    checkingOut || !cartItems.length
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {checkingOut ? 'Processing...' : 'Checkout'}
                </button>
              </div>
            </>
          )}
        </div>
        
        {connectionStatus === 'connecting' && (
          <div className="mt-3 flex items-center text-blue-700">
            <div className="animate-spin mr-2 h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent"></div>
            Waiting for physical cart to respond...
          </div>
        )}
        
        {connectionStatus === 'failed' && (
          <div className="mt-3 text-red-600">
            Connection failed. Make sure the cart is powered on and try again.
          </div>
        )}
      </div>
      
      {/* Last Scanned Item Alert */}
      {lastScannedItem && (
        <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200 flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-800">Last Scanned Item:</h3>
            <p className="text-gray-600">
              {lastScannedItem.name} - ₹{lastScannedItem.price.toFixed(2)}
            </p>
          </div>
          <Link 
            to="/cart" 
            className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded-md text-sm transition"
          >
            View in Cart
          </Link>
        </div>
      )}
      
      {/* Search Bar */}
      <div className="mb-6 flex items-center justify-between">
        <div className="relative flex-1 mr-4">
          <input
            type="text"
            placeholder="Search products by name or RFID tag..."
            className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <button 
          onClick={handleRefreshProducts}
          className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition"
        >
          Refresh Products
        </button>
      </div>
      
      {/* Products Grid */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
          <p className="ml-3 text-gray-600">Loading products...</p>
        </div>
      ) : error ? (
        <div className="bg-red-100 text-red-700 p-4 rounded-md mb-6">
          <p>Error loading products: {error}</p>
          <button 
            onClick={handleRefreshProducts}
            className="mt-2 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition"
          >
            Try Again
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredProducts.length > 0 ? (
            filteredProducts.map(product => (
              <ProductCard key={product.id} product={product} />
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-500">
                {searchTerm 
                  ? `No products found matching "${searchTerm}"` 
                  : 'No products available. Please check back later.'}
              </p>
            </div>
          )}
        </div>
      )}
      
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-md shadow-lg animate-fade-in-up">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default CustomerHome; 