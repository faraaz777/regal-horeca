/**
 * Cart Drawer Component
 * 
 * A slide-in drawer from the right that displays the shopping cart.
 * Uses a light theme with white background and gray accents.
 */

'use client';

import { useMemo, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useAppContext } from '@/context/AppContext';
import { PlusIcon, MinusIcon, TrashIcon, XIcon, WhatsAppIcon } from '@/components/Icons';
import { getWhatsAppBusinessLink } from '@/lib/utils/whatsapp';
import toast from 'react-hot-toast';

export default function CartDrawer({ isOpen, onClose }) {
  const { cart, products, loading, updateCartQuantity, removeFromCart, getCartTotalItems } = useAppContext();

  const cartItems = useMemo(() => {
    return cart.map(cartItem => {
      const product = products.find(p => {
        const pid = p._id || p.id;
        return pid?.toString() === cartItem.productId?.toString();
      });
      return product ? { ...cartItem, product } : null;
    }).filter(Boolean);
  }, [cart, products]);

  const formatPrice = (price) => {
    if (price == null || price === 0) return 'Price on request';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
      .format(price)
      .replace('₹', '₹ ');
  };

  const handleQuantityChange = (productId, newQuantity) => {
    if (newQuantity < 1) {
      removeFromCart(productId);
      toast.success('Item removed from cart');
    } else {
      updateCartQuantity(productId, newQuantity);
    }
  };

  const handleRemove = (productId) => {
    removeFromCart(productId);
    toast.success('Item removed from cart');
  };

  const handleWhatsAppCheckout = () => {
    // Format cart items for WhatsApp message
    let message = 'Hello! I would like to place an order:\n\n';
    
    cartItems.forEach((item, index) => {
      const product = item.product;
      const productName = product.title || product.name || 'Product';
      message += `${index + 1}. ${productName} (Qty: ${item.quantity})\n`;
    });
    
    message += `\nTotal Items: ${totalItems}\n\nPlease confirm the order.`;
    
    // Generate WhatsApp link to business number
    const whatsappUrl = getWhatsAppBusinessLink(message);
    window.open(whatsappUrl, '_blank');
    onClose();
  };

  const subtotal = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      const price = item.product.price || 0;
      return sum + (price * item.quantity);
    }, 0);
  }, [cartItems]);

  const totalItems = getCartTotalItems();

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white z-50 shadow-2xl transform transition-transform duration-300 ease-in-out overflow-hidden flex flex-col touch-pan-y ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Shopping Cart</h2>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-900 transition-colors p-1"
            aria-label="Close cart"
          >
            <XIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Cart Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-gray-600">Loading...</p>
            </div>
          ) : cartItems.length > 0 ? (
            <div className="p-6 space-y-4">
              {cartItems.map((item) => {
                const product = item.product;
                const productId = product._id || product.id;
                const productImage = product.heroImage || product.image || (product.images && product.images[0]) || '/placeholder-product.jpg';
                const productName = product.title || product.name || 'Product';
                const productPrice = product.price || 0;

                return (
                  <div key={productId} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex gap-4">
                      {/* Product Image */}
                      <Link 
                        href={`/products/${product.slug}`} 
                        className="flex-shrink-0"
                        onClick={onClose}
                      >
                        <div className="relative w-20 h-20 bg-gray-100 rounded overflow-hidden">
                          <Image
                            src={productImage}
                            alt={productName}
                            fill
                            className="object-contain"
                          />
                        </div>
                      </Link>

                      {/* Product Details */}
                      <div className="flex-1 min-w-0">
                        <Link 
                          href={`/products/${product.slug}`}
                          onClick={onClose}
                        >
                          <h3 className="text-gray-900 font-semibold mb-3 line-clamp-2 hover:text-primary transition-colors">
                            {productName}
                          </h3>
                        </Link>

                        {/* Quantity Controls */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center border border-gray-300 rounded-md  ">
                            <button
                              onClick={() => handleQuantityChange(productId, item.quantity - 1)}
                              className="p-1 hover:bg-gray-200 active:bg-gray-300 transition-colors text-gray-600 hover:text-gray-900 touch-manipulation min-w-[28px] min-h-[28px] flex items-center justify-center"
                              aria-label="Decrease quantity"
                            >
                              <MinusIcon className="w-3.5 h-3.5" />
                            </button>
                            <span className="px-2 py-0.5 min-w-[1rem] text-center text-sm  text-gray-900">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => handleQuantityChange(productId, item.quantity + 1)}
                              className="p-1 hover:bg-gray-200 active:bg-gray-300 transition-colors text-gray-600 hover:text-gray-900 touch-manipulation min-w-[28px] min-h-[28px] flex items-center justify-center"
                              aria-label="Increase quantity"
                            >
                              <PlusIcon className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Remove Button */}
                          <button
                            onClick={() => handleRemove(productId)}
                            className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 active:bg-red-100 rounded-md transition-colors touch-manipulation min-w-[28px] min-h-[28px] flex items-center justify-center"
                            aria-label="Remove item"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Your cart is empty</h3>
              <p className="text-gray-600 mb-6">Start adding products to your cart!</p>
              <Link
                href="/catalog"
                onClick={onClose}
                className="inline-block bg-primary hover:bg-primary/90 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
              >
                Browse Products
              </Link>
            </div>
          )}
        </div>

        {/* Footer - Order Summary */}
        {cartItems.length > 0 && (
          <div className="border-t border-gray-200 p-6 bg-gray-50">
            <div className="mb-4">
              <div className="text-gray-600 mb-4">
                <span>Items ({totalItems})</span>
              </div>
            </div>

            <button
              className="w-full bg-green-500 hover:bg-primary/90 active:bg-primary/80 text-white font-semibold py-3 px-6 rounded-lg transition-colors touch-manipulation flex items-center justify-center gap-2"
              onClick={handleWhatsAppCheckout}
            >
              <WhatsAppIcon className="w-5 h-5 "  />
              Quote On WhatsApp
            </button>
          </div>
        )}
      </div>
    </>
  );
}

