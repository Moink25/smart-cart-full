import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';

const Navbar: React.FC = () => {
  const { authState, logout } = useAuth();
  const navigate = useNavigate();
  
  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  
  return (
    <nav className="bg-blue-600 text-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center space-x-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
              <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
            </svg>
            <Link to="/" className="text-xl font-bold">Smart Cart</Link>
          </div>
          
          <div className="hidden md:flex items-center space-x-6">
            {authState.isAuthenticated ? (
              <>
                <Link to="/" className="hover:text-blue-200 transition">Home</Link>
                
                {authState.user?.role === 'admin' ? (
                  <>
                    <Link to="/admin/products" className="hover:text-blue-200 transition">Products</Link>
                    <Link to="/admin/simulator" className="hover:text-blue-200 transition">RFID Simulator</Link>
                  </>
                ) : (
                  <>
                    <Link to="/cart" className="hover:text-blue-200 transition">Cart</Link>
                  </>
                )}
                
                <div className="flex items-center space-x-2">
                  <span className="text-sm">{authState.user?.username}</span>
                  <button 
                    onClick={handleLogout}
                    className="bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded-md transition"
                  >
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <Link 
                to="/login" 
                className="bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded-md transition"
              >
                Login
              </Link>
            )}
          </div>
          
          {/* Mobile menu button */}
          <div className="md:hidden">
            <button className="outline-none mobile-menu-button">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
              </svg>
            </button>
          </div>
        </div>
        
        {/* Mobile menu */}
        <div className="hidden mobile-menu md:hidden">
          <ul className="py-2">
            <li><Link to="/" className="block px-2 py-3 hover:bg-primary-800 transition">Home</Link></li>
            
            {authState.isAuthenticated && (
              <>
                {authState.user?.role === 'admin' ? (
                  <>
                    <li><Link to="/admin/products" className="block px-2 py-3 hover:bg-primary-800 transition">Products</Link></li>
                    <li><Link to="/admin/simulator" className="block px-2 py-3 hover:bg-primary-800 transition">RFID Simulator</Link></li>
                  </>
                ) : (
                  <>
                    <li><Link to="/cart" className="block px-2 py-3 hover:bg-primary-800 transition">Cart</Link></li>
                  </>
                )}
                <li>
                  <button 
                    onClick={handleLogout}
                    className="block w-full text-left px-2 py-3 hover:bg-primary-800 transition"
                  >
                    Logout
                  </button>
                </li>
              </>
            )}
            
            {!authState.isAuthenticated && (
              <li><Link to="/login" className="block px-2 py-3 hover:bg-primary-800 transition">Login</Link></li>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 