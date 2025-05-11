import React, { useState, useEffect } from 'react';
import { useProducts } from '../context/ProductContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useCart } from '../context/CartContext.tsx';
import socketService from '../services/socket.ts';
import { cartAPI } from '../services/api.ts';

interface CartItem {
  id: string;
  name: string;
  price: number;
  rfidTag: string;
  quantity: number;
}

const RfidSimulator: React.FC = () => {
  const { products, loading, error, getProducts } = useProducts();
  const { authState } = useAuth();
  const { rfidScan, handleDeviceRequest } = useCart();
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [action, setAction] = useState<'add' | 'remove'>('add');
  const [logs, setLogs] = useState<string[]>([]);
  const [socketConnected, setSocketConnected] = useState(false);
  const [simulatedCart, setSimulatedCart] = useState<CartItem[]>([]);
  const [simulationMode, setSimulationMode] = useState<'manual' | 'scenario' | 'device'>('manual');
  const [customerId, setCustomerId] = useState<string>('2');
  const [deviceId, setDeviceId] = useState<string>('cart_001');
  const [scenarioRunning, setScenarioRunning] = useState(false);
  const [useHttp, setUseHttp] = useState<boolean>(true);

  // Fetch products on component mount
  useEffect(() => {
    getProducts();
  }, []);

  // Check socket connection status
  useEffect(() => {
    const checkConnection = () => {
      const isConnected = socketService.isConnected();
      setSocketConnected(isConnected);
      
      if (isConnected) {
        addLog('Socket connected');
      } else {
        addLog('Socket not connected');
      }
    };

    // Check initial connection
    checkConnection();

    // Set up event listeners for socket connection changes
    socketService.on('connect', () => {
      setSocketConnected(true);
      addLog('Socket connected');
    });

    socketService.on('disconnect', () => {
      setSocketConnected(false);
      addLog('Socket disconnected');
    });

    // Set up event listener for product scans
    socketService.on('product_scanned', (data) => {
      addLog(`Product scanned: ${data.product.name} (${data.action})`);
      
      // Update simulated cart
      if (data.action === 'add') {
        addToSimulatedCart(data.product);
      } else if (data.action === 'remove') {
        removeFromSimulatedCart(data.product.id);
      }
    });

    socketService.on('cart_updated', (data) => {
      addLog(`Cart updated for user ${data.userId}`);
    });

    socketService.on('error', (data) => {
      addLog(`Error: ${data.message}`);
    });

    // Cleanup on unmount
    return () => {
      socketService.off('connect', () => {});
      socketService.off('disconnect', () => {});
      socketService.off('product_scanned', () => {});
      socketService.off('cart_updated', () => {});
      socketService.off('error', () => {});
    };
  }, []);

  // Add log message
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prevLogs => [`[${timestamp}] ${message}`, ...prevLogs.slice(0, 49)]);
  };

  // Add product to simulated cart
  const addToSimulatedCart = (product: any) => {
    setSimulatedCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id);
      
      if (existingItem) {
        return prevCart.map(item => 
          item.id === product.id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      } else {
        return [...prevCart, { ...product, quantity: 1 }];
      }
    });
  };

  // Remove product from simulated cart
  const removeFromSimulatedCart = (productId: string) => {
    setSimulatedCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === productId);
      
      if (existingItem && existingItem.quantity > 1) {
        return prevCart.map(item => 
          item.id === productId 
            ? { ...item, quantity: item.quantity - 1 } 
            : item
        );
      } else {
        return prevCart.filter(item => item.id !== productId);
      }
    });
  };

  // Calculate cart total
  const calculateTotal = () => {
    return simulatedCart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  // Handle RFID simulation for a single product
  const handleSimulate = async () => {
    if (!selectedProduct) {
      addLog('Error: No product selected');
      return;
    }

    const product = products.find(p => p.id === selectedProduct);
    
    if (!product) {
      addLog('Error: Product not found');
      return;
    }

    try {
      // Simulate an HTTP request instead of a WebSocket if the useHttp flag is set
      if (useHttp) {
        addLog(`Using HTTP mode to simulate RFID scan: ${product.name} (${action})`);
        
        if (simulationMode === 'device') {
          // Simulate a direct device request (like from NodeMCU)
          const result = await handleDeviceRequest(product.rfidTag, action, deviceId);
          
          if (result.success) {
            addLog(`Successfully ${action === 'add' ? 'added' : 'removed'} ${product.name} using device ${deviceId}`);
            
            // Update local cart preview
            if (action === 'add') {
              addToSimulatedCart(product);
            } else {
              removeFromSimulatedCart(product.id);
            }
          } else {
            addLog(`Error: ${result.error}`);
            if (result.isServerError) {
              addLog('Server error. The server may be starting up. Try again in a moment.');
            }
          }
        } else {
          // Use regular user-based RFID scan
          const result = await rfidScan(product.rfidTag, action);
          
          if (result.success) {
            addLog(`Successfully ${action === 'add' ? 'added' : 'removed'} ${product.name}`);
            
            // Update local cart preview
            if (action === 'add') {
              addToSimulatedCart(product);
            } else {
              removeFromSimulatedCart(product.id);
            }
          } else {
            addLog(`Error: ${result.error}`);
            if (result.isServerError) {
              addLog('Server error. The server may be starting up. Try again in a moment.');
            }
          }
        }
      } else {
        // Original WebSocket implementation
    socketService.emit('rfid_scan', {
      rfidTag: product.rfidTag,
      action,
          userId: customerId
        });
        addLog(`Simulated RFID scan via WebSocket: ${product.name} (${action})`);
        
        // Update local cart preview immediately (even before socket confirmation)
        if (action === 'add') {
          addToSimulatedCart(product);
        } else {
          removeFromSimulatedCart(product.id);
        }
      }
    } catch (err) {
      console.error('Simulation error:', err);
      addLog(`Error during simulation: ${err.message || 'Unknown error'}`);
    }
  };

  // Simulate NodeMCU device test scan
  const simulateNodeMcuTestScan = async () => {
    try {
      addLog(`Simulating NodeMCU test scan from device ${deviceId}...`);
      const result = await handleDeviceRequest('TEST_TAG', 'add', deviceId);
      
      if (result.success) {
        addLog(`NodeMCU test scan successful!`);
      } else {
        addLog(`NodeMCU test scan failed: ${result.error}`);
        if (result.isServerError) {
          addLog('Server error. The server may be starting up. Try again in a moment.');
        }
      }
    } catch (err) {
      console.error('NodeMCU test error:', err);
      addLog(`Error during NodeMCU test: ${err.message || 'Unknown error'}`);
    }
  };

  // Run a shopping scenario
  const runShoppingScenario = async () => {
    if (scenarioRunning) return;
    
    setScenarioRunning(true);
    setSimulatedCart([]);
    addLog('Starting shopping scenario...');
    
    // Select 3-5 random products to add to cart
    const availableProducts = products.filter(p => p.quantity > 0);
    if (availableProducts.length < 3) {
      addLog('Error: Not enough products available');
      setScenarioRunning(false);
      return;
    }
    
    // Shuffle products and take 3-5
    const shuffled = [...availableProducts].sort(() => 0.5 - Math.random());
    const selectedItems = shuffled.slice(0, Math.min(5, Math.max(3, Math.floor(Math.random() * 3) + 3)));
    
    // Add products to cart one by one with delay
    for (const product of selectedItems) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      try {
        if (useHttp) {
          if (simulationMode === 'device') {
            await handleDeviceRequest(product.rfidTag, 'add', deviceId);
          } else {
            await rfidScan(product.rfidTag, 'add');
          }
        } else {
          socketService.emit('rfid_scan', {
            rfidTag: product.rfidTag,
            action: 'add',
            userId: customerId
          });
        }
        
        addLog(`Scenario: Added ${product.name} to cart`);
        addToSimulatedCart(product);
      } catch (err) {
        addLog(`Error adding ${product.name}: ${err.message || 'Unknown error'}`);
      }
    }
    
    // Randomly remove 0-2 products
    if (selectedItems.length > 2) {
      const itemsToRemove = shuffled.slice(0, Math.floor(Math.random() * 2));
      
      for (const product of itemsToRemove) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        try {
          if (useHttp) {
            if (simulationMode === 'device') {
              await handleDeviceRequest(product.rfidTag, 'remove', deviceId);
            } else {
              await rfidScan(product.rfidTag, 'remove');
            }
          } else {
            socketService.emit('rfid_scan', {
              rfidTag: product.rfidTag,
              action: 'remove',
              userId: customerId
            });
          }
          
          addLog(`Scenario: Removed ${product.name} from cart`);
          removeFromSimulatedCart(product.id);
        } catch (err) {
          addLog(`Error removing ${product.name}: ${err.message || 'Unknown error'}`);
        }
      }
    }
    
    addLog('Shopping scenario completed');
    setScenarioRunning(false);
  };

  // Clear cart
  const clearCart = () => {
    setSimulatedCart([]);
    addLog('Cleared simulated cart');
  };

  // Clear logs
  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">RFID Simulator</h1>
        <p className="text-gray-600 mt-1">Simulate RFID scans for testing</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-medium text-gray-800 mb-4">Simulator Controls</h2>
          
          <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Simulation Mode</label>
                <div className="flex space-x-4">
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      value="manual"
                      checked={simulationMode === 'manual'}
                      onChange={() => setSimulationMode('manual')}
                      className="form-radio h-4 w-4 text-primary-600"
                    />
                    <span className="ml-2 text-sm text-gray-700">Manual</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      value="scenario"
                      checked={simulationMode === 'scenario'}
                      onChange={() => setSimulationMode('scenario')}
                      className="form-radio h-4 w-4 text-primary-600"
                    />
                    <span className="ml-2 text-sm text-gray-700">Scenario</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      value="device"
                      checked={simulationMode === 'device'}
                      onChange={() => setSimulationMode('device')}
                      className="form-radio h-4 w-4 text-primary-600"
                    />
                    <span className="ml-2 text-sm text-gray-700">Device</span>
                  </label>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Communication Method</label>
                <div className="flex space-x-4">
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      checked={useHttp}
                      onChange={() => setUseHttp(true)}
                      className="form-radio h-4 w-4 text-primary-600"
                    />
                    <span className="ml-2 text-sm text-gray-700">HTTP (NodeMCU)</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      checked={!useHttp}
                      onChange={() => setUseHttp(false)}
                      className="form-radio h-4 w-4 text-primary-600"
                    />
                    <span className="ml-2 text-sm text-gray-700">WebSocket</span>
                  </label>
                </div>
              </div>

              {simulationMode === 'device' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="deviceId">
                    Device ID
                  </label>
                  <input
                    type="text"
                    id="deviceId"
                    value={deviceId}
                    onChange={(e) => setDeviceId(e.target.value)}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  />
                </div>
              )}

              {simulationMode !== 'device' && !useHttp && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="customerId">
                    Customer ID
                  </label>
                  <input
                    type="text"
                    id="customerId"
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  />
                </div>
              )}
              
              {simulationMode === 'manual' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="product">
                      Product
                    </label>
              <select
                id="product"
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              >
                      <option value="">Select a product</option>
                {products.map(product => (
                  <option key={product.id} value={product.id}>
                          {product.name} - ${product.price.toFixed(2)} - (RFID: {product.rfidTag})
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
              <div className="flex space-x-4">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    value="add"
                    checked={action === 'add'}
                    onChange={() => setAction('add')}
                    className="form-radio h-4 w-4 text-primary-600"
                  />
                        <span className="ml-2 text-sm text-gray-700">Add to cart</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    value="remove"
                    checked={action === 'remove'}
                    onChange={() => setAction('remove')}
                          className="form-radio h-4 w-4 text-primary-600"
                  />
                        <span className="ml-2 text-sm text-gray-700">Remove from cart</span>
                </label>
              </div>
            </div>
            
                  <button
                    type="button"
                    onClick={handleSimulate}
                    disabled={!selectedProduct}
                    className={`w-full py-2 px-4 rounded-md text-white font-medium ${
                      !selectedProduct ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700'
                    }`}
                  >
                    Simulate RFID Scan
                  </button>
                </>
              )}
              
              {simulationMode === 'scenario' && (
              <button
                  type="button"
                  onClick={runShoppingScenario}
                  disabled={scenarioRunning || (!socketConnected && !useHttp)}
                  className={`w-full py-2 px-4 rounded-md text-white font-medium ${
                    scenarioRunning || (!socketConnected && !useHttp) ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700'
                  }`}
                >
                  {scenarioRunning ? 'Running Scenario...' : 'Run Shopping Scenario'}
                </button>
              )}
              
              {simulationMode === 'device' && (
                <>
                  <button
                    type="button"
                    onClick={simulateNodeMcuTestScan}
                    className="w-full py-2 px-4 rounded-md text-white font-medium bg-primary-600 hover:bg-primary-700"
                  >
                    Simulate NodeMCU Test Scan
                  </button>
                  
                  {!useHttp && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm text-yellow-800">
                      Note: NodeMCU now uses HTTP instead of WebSockets. Switch to HTTP mode for accurate simulation.
                    </div>
                  )}
                </>
              )}
              
              {!useHttp && (
                <div className="mt-4">
                  <div className={`text-sm ${socketConnected ? 'text-green-600' : 'text-red-600'}`}>
                    {socketConnected ? 'Socket Connected' : 'Socket Disconnected'}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-medium text-gray-800">Cart Preview</h2>
              <button 
                onClick={clearCart}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Clear
              </button>
            </div>
            
            {simulatedCart.length === 0 ? (
              <p className="text-gray-500 text-sm">Cart is empty</p>
            ) : (
              <div className="space-y-3">
                {simulatedCart.map(item => (
                  <div key={item.id} className="flex justify-between border-b pb-2">
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-sm text-gray-500">Qty: {item.quantity}</div>
                    </div>
                    <div className="text-right">
                      ${(item.price * item.quantity).toFixed(2)}
                    </div>
                  </div>
                ))}
                
                <div className="flex justify-between pt-2 font-medium">
                  <div>Total:</div>
                  <div>${calculateTotal().toFixed(2)}</div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="lg:col-span-2">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-medium text-gray-800">Activity Log</h2>
            <button
              onClick={clearLogs}
                className="text-sm text-gray-600 hover:text-gray-800"
            >
              Clear
            </button>
          </div>
          
            <div className="bg-gray-50 rounded-md p-4 h-96 overflow-y-auto font-mono text-sm">
            {logs.length === 0 ? (
                <p className="text-gray-500">No activity logged yet</p>
            ) : (
              <div className="space-y-1">
                {logs.map((log, index) => (
                    <div key={index} className="break-words">{log}</div>
                ))}
              </div>
            )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RfidSimulator; 