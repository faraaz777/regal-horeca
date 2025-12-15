/**
 * Cart Drawer Component
 * 
 * A slide-in drawer from the right that displays the shopping cart.
 * Redesigned to match the provided design reference.
 */

'use client';

import { useMemo, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useAppContext } from '@/context/AppContext';
import { PlusIcon, MinusIcon, XIcon, WhatsAppIcon } from '@/components/Icons';
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
      .replace('₹', '₹');
  };

  const handleQuantityChange = (productId, newQuantity) => {
    if (newQuantity < 1) {
      removeFromCart(productId);
      toast.success('Item removed from cart');
    } else {
      updateCartQuantity(productId, newQuantity);
    }
  };

  const handleWhatsAppCheckout = () => {
    // Format cart items for WhatsApp message
    let message = 'Hello! I would like to place an order:\n\n';
    
    cartItems.forEach((item, index) => {
      const product = item.product;
      const productName = product.title || product.name || 'Product';
      const price = item.price || product.price || 0;
      const colorInfo = item.selectedColor ? ` - Color: ${item.selectedColor.colorName}` : '';
      message += `${index + 1}. ${productName}${colorInfo} (Qty: ${item.quantity}) - ${formatPrice(price)}\n`;
    });
    
    message += `\nTotal Items: ${totalItems}\nTotal: ${formatPrice(subtotal)}\n\nPlease confirm the order.`;
    
    // Generate WhatsApp link to business number
    const whatsappUrl = getWhatsAppBusinessLink(message);
    window.open(whatsappUrl, '_blank');
    onClose();
  };

  const subtotal = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      // Use stored price if available, otherwise fall back to product price
      const price = item.price || item.product.price || 0;
      return sum + (price * item.quantity);
    }, 0);
  }, [cartItems]);

  const totalItems = getCartTotalItems();
  
  // Free shipping threshold (₹500)
  const FREE_SHIPPING_THRESHOLD = 500;
  const shippingProgress = Math.min((subtotal / FREE_SHIPPING_THRESHOLD) * 100, 100);
  const isEligibleForFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;
  const remainingForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);

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
        className={`fixed top-0 right-0 h-full w-full sm:max-w-md bg-white z-50 shadow-2xl transform transition-transform duration-300 ease-in-out overflow-hidden flex flex-col touch-pan-y ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-gray-200">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">
            Shopping cart ({totalItems})
          </h2>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-900 transition-colors p-1"
            aria-label="Close cart"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Free Shipping Banner */}
        {cartItems.length > 0 && (
          <div className="px-4 sm:px-5 py-2 bg-green-50 border-b border-green-100">
            {isEligibleForFreeShipping ? (
              <div className="text-xs sm:text-sm font-medium text-green-700">
                ✓ You are eligible for free shipping!
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="text-xs sm:text-sm font-medium text-green-700">
                  You are eligible for free shipping!
                </div>
                <div className="w-full bg-green-200 rounded-full h-1.5 sm:h-2">
                  <div 
                    className="bg-green-600 h-1.5 sm:h-2 rounded-full transition-all duration-300"
                    style={{ width: `${shippingProgress}%` }}
                  />
                </div>
                <div className="text-[10px] sm:text-xs text-green-600">
                  Add {formatPrice(remainingForFreeShipping)} more for free shipping
                </div>
              </div>
            )}
          </div>
        )}

        {/* Cart Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-gray-600">Loading...</p>
            </div>
          ) : cartItems.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {cartItems.map((item) => {
                const product = item.product;
                const productId = product._id || product.id;
                const productImage = product.heroImage || product.image || (product.images && product.images[0]) || '/placeholder-product.jpg';
                const productName = product.title || product.name || 'Product';
                const itemPrice = item.price || product.price || 0;
                const originalPrice = product.mrp || product.originalPrice;
                const isOnSale = originalPrice && originalPrice > itemPrice;
                
                // Get stock info if available
                const stock = product.stock || product.inStock;
                const stockText = stock !== undefined ? `${stock} in stock` : null;

                return (
                  <div key={`${productId}_${item.selectedColor?.colorName || 'default'}`} className="px-4 sm:px-5 py-3 sm:py-4">
                    <div className="flex gap-3 sm:gap-4">
                      {/* Product Image */}
                      <Link 
                        href={`/products/${product.slug}`} 
                        className="flex-shrink-0"
                        onClick={onClose}
                      >
                        <div className="relative w-20 h-20 sm:w-24 sm:h-24 bg-gray-100 rounded-lg overflow-hidden">
                          <Image
                            src={productImage}
                            alt={productName}
                            fill
                            className="object-cover w-full h-full"
                            sizes="(max-width: 640px) 80px, 96px"
                          />
                        </div>
                      </Link>

                      {/* Product Details */}
                      <div className="flex-1 min-w-0">
                        <Link 
                          href={`/products/${product.slug}`}
                          onClick={onClose}
                        >
                          <h3 className="text-xs sm:text-sm font-semibold text-gray-900 mb-1 line-clamp-2 hover:text-primary transition-colors">
                            {productName}
                          </h3>
                        </Link>

                        {/* Additional Info */}
                        <div className="space-y-0.5 sm:space-y-1 mb-1.5 sm:mb-2">
                          {/* Color Variant */}
                          {item.selectedColor && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] sm:text-xs text-gray-600">Color:</span>
                              <div 
                                className="w-3 h-3 rounded-full border border-gray-300"
                                style={{ backgroundColor: item.selectedColor.colorHex }}
                                title={item.selectedColor.colorName}
                              />
                              <span className="text-[10px] sm:text-xs text-gray-700">{item.selectedColor.colorName}</span>
                            </div>
                          )}
                          
                          {/* Stock Info */}
                          {stockText && (
                            <div className="text-[10px] sm:text-xs text-red-600 font-medium">
                              {stockText}
                            </div>
                          )}
                        </div>

                        {/* Quantity and Price Row */}
                        <div className="flex items-center justify-between mt-2 sm:mt-3">
                          {/* Quantity Controls */}
                          <div className="flex items-center border border-gray-300 rounded-md">
                            <button
                              onClick={() => handleQuantityChange(productId, item.quantity - 1)}
                              className="p-1 sm:p-1.5 hover:bg-gray-100 active:bg-gray-200 transition-colors text-gray-600 hover:text-gray-900 touch-manipulation"
                              aria-label="Decrease quantity"
                            >
                              <MinusIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </button>
                            <input
                              type="number"
                              value={item.quantity}
                              readOnly
                              className="w-10 sm:w-12 text-center text-xs sm:text-sm text-gray-900 border-0 focus:ring-0 focus:outline-none"
                            />
                            <button
                              onClick={() => handleQuantityChange(productId, item.quantity + 1)}
                              className="p-1 sm:p-1.5 hover:bg-gray-100 active:bg-gray-200 transition-colors text-gray-600 hover:text-gray-900 touch-manipulation"
                              aria-label="Increase quantity"
                            >
                              <PlusIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </button>
                          </div>

                          {/* Price */}
                          <div className="text-right">
                            <div className="text-xs sm:text-sm font-semibold text-gray-900">
                              {formatPrice(itemPrice)}
                            </div>
                            {isOnSale && (
                              <div className="text-[10px] sm:text-xs text-gray-500 line-through">
                                {formatPrice(originalPrice)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 sm:py-16 px-4 sm:px-6 text-center">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Your cart is empty</h3>
              <p className="text-sm sm:text-base text-gray-600 mb-6">Start adding products to your cart!</p>
              <Link
                href="/catalog"
                onClick={onClose}
                className="inline-block bg-primary hover:bg-primary/90 text-white font-semibold py-2 px-6 rounded-lg transition-colors text-sm sm:text-base"
              >
                Browse Products
              </Link>
            </div>
          )}
        </div>

        {/* Footer - Order Summary */}
        {cartItems.length > 0 && (
          <div className="border-t border-gray-200 px-4 sm:px-5 py-4 sm:py-5 bg-white">
            <div className="mb-3 sm:mb-4 space-y-1.5 sm:space-y-2">
              <div className="flex justify-between text-xs sm:text-sm text-gray-600">
                <span>Subtotal</span>
                <span className="font-semibold text-gray-900">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm sm:text-base font-bold text-gray-900 pt-1.5 sm:pt-2 border-t border-gray-200">
                <span>Total</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
            </div>

            <button
              className="w-full bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-semibold py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg transition-colors touch-manipulation flex items-center justify-center gap-2 shadow-sm text-sm sm:text-base"
              onClick={handleWhatsAppCheckout}
            >
              <WhatsAppIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Checkout</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
