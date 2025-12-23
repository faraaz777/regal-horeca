/**
 * Cart Drawer Component
 * 
 * A slide-in drawer from the right that displays the shopping cart.
 * Redesigned to match the provided design reference.
 */

'use client';

import { useMemo, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useAppContext } from '@/context/AppContext';
import { PlusIcon, MinusIcon, XIcon, WhatsAppIcon } from '@/components/Icons';
import { getWhatsAppBusinessLink } from '@/lib/utils/whatsapp';
import { useEnquiry, createEnquiryAndRedirect } from '@/lib/hooks/useEnquiry';
import LightCaptureModal, { getSavedLeadProfile } from './LightCaptureModal';
import toast from 'react-hot-toast';

export default function CartDrawer({ isOpen, onClose }) {
  const { cart, products, loading, updateCartQuantity, removeFromCart, getCartTotalItems } = useAppContext();
  const { handleEnquiry } = useEnquiry();
  const [showCaptureModal, setShowCaptureModal] = useState(false);
  const [pendingEnquiry, setPendingEnquiry] = useState(null);
  const [savedProfile, setSavedProfile] = useState(null);

  // Check for saved profile when drawer opens
  useEffect(() => {
    if (isOpen) {
      const profile = getSavedLeadProfile();
      setSavedProfile(profile);
    }
  }, [isOpen]);

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

  const handleQuantityChange = (productId, newQuantity, selectedColor = null) => {
    if (newQuantity < 1) {
      removeFromCart(productId, selectedColor);
      toast.success('Item removed from cart');
    } else {
      updateCartQuantity(productId, newQuantity, selectedColor);
    }
  };

  const handleWhatsAppCheckout = async () => {
    const cartItemsForEnquiry = cartItems.map(item => ({
      productId: item.productId,
      productName: item.product.title || item.product.name || 'Product',
      quantity: item.quantity,
      color: item.selectedColor?.colorName,
    }));

    // If user has saved profile, skip modal and go directly to WhatsApp
    if (savedProfile && savedProfile.phone) {
      try {
        await createEnquiryAndRedirect({
          source: 'cart',
          phone: savedProfile.phone,
          name: savedProfile.name,
          userType: savedProfile.userType || 'unknown',
          cartItems: cartItemsForEnquiry,
        });
        onClose();
      } catch (error) {
        console.error('Error creating enquiry:', error);
        toast.error('Failed to create enquiry. Please try again.');
      }
    } else {
      // First-time user - show modal
      handleEnquiry({
        source: 'cart',
        defaultUserType: 'unknown',
        cartItems: cartItemsForEnquiry,
        onShowCapture: (data) => {
          setPendingEnquiry(data);
          setShowCaptureModal(true);
        },
      });
    }
  };

  const handleChangeInfo = () => {
    const cartItemsForEnquiry = cartItems.map(item => ({
      productId: item.productId,
      productName: item.product.title || item.product.name || 'Product',
      quantity: item.quantity,
      color: item.selectedColor?.colorName,
    }));

    handleEnquiry({
      source: 'cart',
      defaultUserType: savedProfile?.userType || 'unknown',
      cartItems: cartItemsForEnquiry,
      onShowCapture: (data) => {
        setPendingEnquiry(data);
        setShowCaptureModal(true);
      },
    });
  };

  const handleCaptureSubmit = async ({ phone, name, userType }) => {
    if (pendingEnquiry) {
      await createEnquiryAndRedirect({
        ...pendingEnquiry,
        phone,
        name,
        userType,
      });
      setPendingEnquiry(null);
      // Refresh saved profile after submission
      const profile = getSavedLeadProfile();
      setSavedProfile(profile);
      onClose();
    }
  };

  const subtotal = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      // Use stored price if available, otherwise fall back to product price
      const price = item.price || item.product.price || 0;
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
        className={`fixed top-0 right-0 h-full w-full sm:max-w-md bg-white z-50 shadow-2xl transform transition-transform duration-300 ease-in-out overflow-hidden flex flex-col touch-pan-y ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-black/10">
          <h2 className="text-base sm:text-lg font-semibold text-black">
            Shopping cart ({totalItems})
          </h2>
          <button
            onClick={onClose}
            className="text-black/60 hover:text-black transition-colors p-1"
            aria-label="Close cart"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Cart Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-black/60">Loading...</p>
            </div>
          ) : cartItems.length > 0 ? (
            <div className="divide-y divide-black/10">
              {cartItems.map((item) => {
                const product = item.product;
                const productId = product._id || product.id;
                const productImage = product.heroImage || product.image || (product.images && product.images[0]) || '/placeholder-product.jpg';
                const productName = product.title || product.name || 'Product';
                const itemPrice = item.price || product.price || 0;
                const originalPrice = product.mrp || product.originalPrice;
                const isOnSale = originalPrice && originalPrice > itemPrice;
                
                // Get product slug with fallback - use ID if slug is missing (API handles both)
                const productSlug = product.slug || productId?.toString();
                
                // Get stock info if available
                const stock = product.stock || product.inStock;
                const stockText = stock !== undefined ? `${stock} in stock` : null;

                return (
                  <div key={`${productId}_${item.selectedColor?.colorName || 'default'}`} className="px-4 sm:px-5 py-3 sm:py-4">
                    <div className="flex gap-3 sm:gap-4">
                      {/* Product Image */}
                      <Link 
                        href={`/products/${productSlug}`} 
                        className="flex-shrink-0"
                        onClick={onClose}
                      >
                        <div className="relative w-20 h-20 sm:w-24 sm:h-24 bg-white border border-black/10 rounded-lg overflow-hidden">
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
                          href={`/products/${productSlug}`}
                          onClick={onClose}
                        >
                          <h3 className="text-xs sm:text-sm font-semibold text-black mb-1 line-clamp-2 hover:text-accent transition-colors">
                            {productName}
                          </h3>
                        </Link>

                        {/* Additional Info */}
                        <div className="space-y-0.5 sm:space-y-1 mb-1.5 sm:mb-2">
                          {/* Color Variant */}
                          {item.selectedColor && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] sm:text-xs text-black/60">Color:</span>
                              <div 
                                className="w-3 h-3 rounded-full border border-black/20"
                                style={{ backgroundColor: item.selectedColor.colorHex }}
                                title={item.selectedColor.colorName}
                              />
                              <span className="text-[10px] sm:text-xs text-black/70">{item.selectedColor.colorName}</span>
                            </div>
                          )}
                          
                          {/* Stock Info */}
                          {stockText && (
                            <div className="text-[10px] sm:text-xs text-accent font-medium">
                              {stockText}
                            </div>
                          )}
                        </div>

                        {/* Quantity Controls */}
                        <div className="flex items-center mt-2 sm:mt-3">
                          <div className="flex items-center border border-black/20 rounded-md">
                            <button
                              onClick={() => handleQuantityChange(productId, item.quantity - 1, item.selectedColor)}
                              className="p-1 sm:p-1.5 hover:bg-black/5 active:bg-black/10 transition-colors text-black/60 hover:text-black touch-manipulation"
                              aria-label="Decrease quantity"
                            >
                              <MinusIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </button>
                            <input
                              type="number"
                              value={item.quantity}
                              readOnly
                              className="w-10 sm:w-12 text-center text-xs sm:text-sm text-black border-0 focus:ring-0 focus:outline-none"
                            />
                            <button
                              onClick={() => handleQuantityChange(productId, item.quantity + 1, item.selectedColor)}
                              className="p-1 sm:p-1.5 hover:bg-black/5 active:bg-black/10 transition-colors text-black/60 hover:text-black touch-manipulation"
                              aria-label="Increase quantity"
                            >
                              <PlusIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </button>
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
              <h3 className="text-lg sm:text-xl font-semibold text-black mb-2">Your cart is empty</h3>
              <p className="text-sm sm:text-base text-black/60 mb-6">Start adding products to your cart!</p>
              <Link
                href="/catalog"
                onClick={onClose}
                className="inline-block bg-accent hover:bg-accent/90 text-white font-semibold py-2 px-6 rounded-lg transition-colors text-sm sm:text-base"
              >
                Browse Products
              </Link>
            </div>
          )}
        </div>

        {/* Footer - Order Summary */}
        {cartItems.length > 0 && (
          <div className="border-t border-black/10 px-4 sm:px-5 py-4 sm:py-5 bg-white">
            {/* Business/Bulk Order Note (for first-time users OR returning normal customers) */}
            {(!savedProfile || (savedProfile && savedProfile.userType !== 'business')) && (
              <div className="mb-3 sm:mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-xs sm:text-sm text-gray-700">
                  Special deals available for business & bulk orders
                </p>
              </div>
            )}

            {/* Saved Profile Info (for returning users) */}
            {savedProfile && savedProfile.phone ? (
              <div className="mb-3 sm:mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-700">
                    <span className="font-medium">Enquiry will be sent using:</span>
                  </div>
                  <button
                    onClick={handleChangeInfo}
                    className="text-xs sm:text-sm text-blue-600 hover:text-blue-700 font-medium underline"
                  >
                    Change info
                  </button>
                </div>
                <div className="flex items-center gap-2 text-sm sm:text-base">
                  <span className="text-lg">📞</span>
                  <span className="font-semibold text-black">
                    +91 {savedProfile.phone}
                  </span>
                  {savedProfile.userType === 'business' && (
                    <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-medium">
                      Business enquiry
                    </span>
                  )}
                </div>
                {savedProfile.name && (
                  <div className="mt-1 text-xs sm:text-sm text-gray-600">
                    {savedProfile.name}
                  </div>
                )}
              </div>
            ) : null}

            <button
              className="w-full bg-accent hover:bg-accent/90 active:bg-accent text-white font-semibold py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg transition-colors touch-manipulation flex items-center justify-center gap-2 shadow-sm text-sm sm:text-base"
              onClick={handleWhatsAppCheckout}
            >
              <WhatsAppIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Enquire for these items</span>
            </button>
          </div>
        )}
      </div>

      {/* Light Capture Modal */}
      <LightCaptureModal
        isOpen={showCaptureModal}
        onClose={() => {
          setShowCaptureModal(false);
          setPendingEnquiry(null);
        }}
        onSubmit={handleCaptureSubmit}
        defaultUserType={savedProfile?.userType || 'unknown'}
      />
    </>
  );
}
