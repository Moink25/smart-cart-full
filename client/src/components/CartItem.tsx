import React from 'react';
import { CartItem as CartItemType } from '../types';
import { useCart } from '../context/CartContext.tsx';

interface CartItemProps {
  item: CartItemType;
}

const CartItem: React.FC<CartItemProps> = ({ item }) => {
  const { addToCart, removeFromCart } = useCart();

  const handleIncreaseQuantity = () => {
    addToCart(item.id, 1);
  };

  const handleDecreaseQuantity = () => {
    removeFromCart(item.id, 1);
  };

  return (
    <div className="flex items-center py-4 border-b border-gray-200">
      <div className="flex-1">
        <h3 className="text-lg font-medium text-gray-800">{item.name}</h3>
        <p className="text-sm text-gray-500">RFID: {item.rfidTag}</p>
      </div>
      
      <div className="flex items-center">
        <div className="flex items-center border border-gray-300 rounded-md">
          <button 
            onClick={handleDecreaseQuantity}
            className="px-3 py-1 text-gray-600 hover:bg-gray-100 transition"
          >
            -
          </button>
          <span className="px-3 py-1 text-gray-800">{item.quantity}</span>
          <button 
            onClick={handleIncreaseQuantity}
            className="px-3 py-1 text-gray-600 hover:bg-gray-100 transition"
          >
            +
          </button>
        </div>
      </div>
      
      <div className="w-24 text-right">
        <span className="font-medium text-gray-800">₹{(item.price * item.quantity).toFixed(2)}</span>
      </div>
    </div>
  );
};

export default CartItem; 