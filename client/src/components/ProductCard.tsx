import React from 'react';
import { Product } from '../types';
import { useAuth } from '../context/AuthContext.tsx';
import { useCart } from '../context/CartContext.tsx';

interface ProductCardProps {
  product: Product;
  onEdit?: (product: Product) => void;
  onDelete?: (productId: string) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onEdit, onDelete }) => {
  const { authState } = useAuth();
  const { addToCart } = useCart();

  const handleAddToCart = () => {
    addToCart(product.id);
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-4">
        <div className="flex justify-between items-start">
          <h3 className="text-lg font-semibold text-gray-800">{product.name}</h3>
          <span className="bg-primary-100 text-primary-800 text-xs px-2 py-1 rounded-full">
            ₹{product.price.toFixed(2)}
          </span>
        </div>
        
        <div className="mt-2 text-sm text-gray-600">
          <p>RFID Tag: {product.rfidTag}</p>
          <p className="mt-1">
            Stock: 
            <span className={`font-medium ${product.quantity > 5 ? 'text-green-600' : 'text-red-600'}`}>
              {' '}{product.quantity} units
            </span>
          </p>
        </div>
        
        <div className="mt-4 flex justify-between items-center">
          {authState.user?.role === 'admin' ? (
            <div className="flex space-x-2">
              {onEdit && (
                <button 
                  onClick={() => onEdit(product)}
                  className="bg-primary-500 hover:bg-primary-600 text-white px-3 py-1 rounded-md text-sm transition"
                >
                  Edit
                </button>
              )}
              {onDelete && (
                <button 
                  onClick={() => onDelete(product.id)}
                  className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-sm transition"
                >
                  Delete
                </button>
              )}
            </div>
          ) : (
            <button 
              onClick={handleAddToCart}
              disabled={product.quantity === 0}
              className={`flex items-center text-sm px-3 py-1 rounded-md transition ${
                product.quantity === 0 
                  ? 'bg-gray-300 cursor-not-allowed' 
                  : 'bg-primary-500 hover:bg-primary-600 text-white'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
              </svg>
              {product.quantity === 0 ? 'Out of stock' : 'Add to cart'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductCard; 