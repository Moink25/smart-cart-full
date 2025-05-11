import React, { useState } from 'react';
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
  const [imageError, setImageError] = useState(false);

  const handleAddToCart = () => {
    addToCart(product.id);
  };

  // Default image fallback - using inline data URL
  const defaultImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%23cccccc'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='24' fill='%23333333'%3ENo Image%3C/text%3E%3C/svg%3E";

  // Get the correct image URL based on whether the URL is already absolute or relative
  const getImageUrl = () => {
    if (!product.image) return defaultImage;
    if (imageError) return defaultImage;
    
    // If it's already an absolute URL, use it directly
    if (product.image.startsWith('http')) return product.image;
    
    // Always use the render.com URL for images
    const API_URL = 'https://smart-cart-test.onrender.com';
    
    // If the image path already starts with '/images/', just add the base URL
    if (product.image.startsWith('/images/')) {
      return `${API_URL}${product.image}`;
    }
    
    // Otherwise, ensure the path has the correct format
    return `${API_URL}/images/${product.image.replace('/images/', '')}`;
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="relative h-48 bg-gray-200">
        <img 
          src={getImageUrl()} 
          alt={product.name}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      </div>

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
          {product.weight && (
            <p className="mt-1">Weight: {product.weight}g</p>
          )}
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