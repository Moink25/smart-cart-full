import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProducts } from '../context/ProductContext.tsx';
import socketService from '../services/socket.ts';

const AdminHome: React.FC = () => {
  const { products, loading, error } = useProducts();
  const [socketStatus, setSocketStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Calculate dashboard metrics
  const totalProducts = products.length;
  const totalInventory = products.reduce((sum, product) => sum + product.quantity, 0);
  const lowStockItems = products.filter(product => product.quantity > 0 && product.quantity <= 5).length;
  const outOfStockItems = products.filter(product => product.quantity === 0).length;
  const totalValue = products.reduce((sum, product) => sum + (product.price * product.quantity), 0);

  // Monitor socket connection status
  useEffect(() => {
    // Update socket status initially
    setSocketStatus(socketService.isConnected() ? 'connected' : 'disconnected');

    // Set up event listeners for socket status changes
    const handleConnect = () => {
      setSocketStatus('connected');
      setLastUpdated(new Date());
    };

    const handleDisconnect = () => {
      setSocketStatus('disconnected');
    };

    const handleInventoryUpdate = () => {
      setLastUpdated(new Date());
    };

    // Register event listeners
    socketService.on('connect', handleConnect);
    socketService.on('disconnect', handleDisconnect);
    socketService.on('inventoryUpdate', handleInventoryUpdate);

    // Clean up event listeners
    return () => {
      socketService.off('connect', handleConnect);
      socketService.off('disconnect', handleDisconnect);
      socketService.off('inventoryUpdate', handleInventoryUpdate);
    };
  }, []);

  // Recent low stock products
  const recentLowStockProducts = products
    .filter(product => product.quantity <= 5)
    .sort((a, b) => a.quantity - b.quantity)
    .slice(0, 5);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Admin Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome to the Smart Cart management system</p>
      </div>

      {/* System Status */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">System Status</h2>
          <span className="text-sm text-gray-500">Last updated: {lastUpdated.toLocaleTimeString()}</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${socketStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm font-medium">
            {socketStatus === 'connected' ? 'System Online' : 'System Offline'}
          </span>
        </div>
      </div>
      
      {/* Dashboard Summary */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Inventory Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Products */}
          <div className="bg-white rounded-lg shadow p-5 border-l-4 border-blue-500">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-500 font-medium">Total Products</p>
                <p className="text-2xl font-bold text-gray-800">{totalProducts}</p>
              </div>
              <div className="p-3 rounded-full bg-blue-100">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              </div>
            </div>
          </div>
          
          {/* Total Inventory */}
          <div className="bg-white rounded-lg shadow p-5 border-l-4 border-green-500">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-500 font-medium">Total Inventory</p>
                <p className="text-2xl font-bold text-gray-800">{totalInventory} units</p>
              </div>
              <div className="p-3 rounded-full bg-green-100">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            </div>
          </div>
          
          {/* Inventory Alerts */}
          <div className="bg-white rounded-lg shadow p-5 border-l-4 border-yellow-500">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-500 font-medium">Inventory Alerts</p>
                <p className="text-2xl font-bold text-gray-800">
                  <span className="text-yellow-500">{lowStockItems} low</span>
                  {outOfStockItems > 0 && <span className="text-red-500 ml-2">{outOfStockItems} out</span>}
                </p>
              </div>
              <div className="p-3 rounded-full bg-yellow-100">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
          </div>
          
          {/* Inventory Value */}
          <div className="bg-white rounded-lg shadow p-5 border-l-4 border-purple-500">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-500 font-medium">Inventory Value</p>
                <p className="text-2xl font-bold text-gray-800">₹{totalValue.toFixed(2)}</p>
              </div>
              <div className="p-3 rounded-full bg-purple-100">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Low Stock Alert Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-yellow-50 px-6 py-4 border-b border-yellow-100">
            <h3 className="text-lg font-semibold text-gray-800">Low Stock Alerts</h3>
          </div>
          <div className="p-6">
            {recentLowStockProducts.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {recentLowStockProducts.map(product => (
                  <div key={product.id} className="py-3 flex justify-between items-center">
                    <div>
                      <h4 className="text-sm font-medium text-gray-800">{product.name}</h4>
                      <p className="text-xs text-gray-500">RFID: {product.rfidTag}</p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${
                        product.quantity === 0 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {product.quantity} units
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No low stock items at the moment.</p>
            )}
          </div>
          <div className="bg-gray-50 px-6 py-3 border-t border-gray-100">
            <Link to="/admin/products" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              View all inventory →
            </Link>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-blue-50 px-6 py-4 border-b border-blue-100">
            <h3 className="text-lg font-semibold text-gray-800">Quick Actions</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4">
              <Link to="/admin/products" className="bg-white border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition flex flex-col items-center text-center">
                <div className="p-3 rounded-full bg-blue-100 mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </div>
                <h4 className="font-medium text-gray-800">Manage Products</h4>
                <p className="text-xs text-gray-500 mt-1">Add, edit, or remove products</p>
              </Link>
              
              <Link to="/admin/simulator" className="bg-white border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition flex flex-col items-center text-center">
                <div className="p-3 rounded-full bg-green-100 mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h4 className="font-medium text-gray-800">RFID Simulator</h4>
                <p className="text-xs text-gray-500 mt-1">Test RFID scanning</p>
              </Link>
              
              <div className="bg-white border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition flex flex-col items-center text-center">
                <div className="p-3 rounded-full bg-purple-100 mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h4 className="font-medium text-gray-800">Reports</h4>
                <p className="text-xs text-gray-500 mt-1">View sales and inventory reports</p>
              </div>
              
              <div className="bg-white border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition flex flex-col items-center text-center">
                <div className="p-3 rounded-full bg-red-100 mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <h4 className="font-medium text-gray-800">Notifications</h4>
                <p className="text-xs text-gray-500 mt-1">View system notifications</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminHome; 