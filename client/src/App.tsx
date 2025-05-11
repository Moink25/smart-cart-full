import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { ProductProvider, useProducts } from './context/ProductContext.tsx';
import { CartProvider } from './context/CartContext.tsx';
import { PaymentProvider } from './context/PaymentContext.tsx';
import Navbar from './components/Navbar.tsx';
import ProtectedRoute from './components/ProtectedRoute.tsx';
import Login from './pages/Login.tsx';
import AdminProducts from './pages/AdminProducts.tsx';
import RfidSimulator from './pages/RfidSimulator.tsx';
import CustomerHome from './pages/CustomerHome.tsx';
import Cart from './pages/Cart.tsx';
import socketService from './services/socket.ts';

// Data initialization component
const DataInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authState } = useAuth();
  const { getProducts } = useProducts();

  useEffect(() => {
    // Connect socket and load products when authenticated
    if (authState.isAuthenticated && authState.token) {
      // Connect socket
      if (!socketService.isConnected()) {
        socketService.connect(authState.token);
      }
      
      // Load products
      getProducts();
      
      console.log("User authenticated, initialized data:", { 
        user: authState.user?.username,
        role: authState.user?.role,
        socketConnected: socketService.isConnected()
      });
    }
  }, [authState.isAuthenticated, authState.token]);

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <ProductProvider>
          <CartProvider>
            <PaymentProvider>
              <DataInitializer>
                <div className="min-h-screen bg-gray-50">
                  <Navbar />
                  <Routes>
                    {/* Public routes */}
                    <Route path="/login" element={<Login />} />
                    
                    {/* Customer routes */}
                    <Route element={<ProtectedRoute allowedRoles={['customer']} />}>
                      <Route path="/" element={<CustomerHome />} />
                      <Route path="/cart" element={<Cart />} />
                    </Route>
                    
                    {/* Admin routes */}
                    <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                      <Route path="/admin/products" element={<AdminProducts />} />
                      <Route path="/admin/simulator" element={<RfidSimulator />} />
                      <Route path="/admin" element={<Navigate to="/admin/products" replace />} />
                    </Route>
                    
                    {/* Redirect to login if no match */}
                    <Route path="*" element={<Navigate to="/login" replace />} />
                  </Routes>
                </div>
              </DataInitializer>
            </PaymentProvider>
          </CartProvider>
        </ProductProvider>
      </AuthProvider>
    </Router>
  );
};

export default App;