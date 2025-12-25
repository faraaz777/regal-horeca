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
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:max-w-md bg-gradient-to-b from-white to-warm-white z-50 shadow-2xl transform transition-transform duration-300 ease-in-out overflow-hidden flex flex-col touch-pan-y ${isOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 sm:py-5 bg-white border-b-2 border-black/5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 bg-accent rounded-full"></div>
            <h2 className="text-lg sm:text-xl font-bold text-black font-serif">
              Your Cart
              <span className="ml-2 text-sm sm:text-base font-sans font-normal text-black/60">
                ({totalItems} {totalItems === 1 ? 'item' : 'items'})
              </span>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-black/50 hover:text-black hover:bg-black/5 transition-all duration-200 p-2 rounded-full"
            aria-label="Close cart"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Cart Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-3 border-accent border-t-transparent rounded-full animate-spin"></div>
                <p className="text-black/60 text-sm">Loading your cart...</p>
              </div>
            </div>
          ) : cartItems.length > 0 ? (
            <div className="px-4 sm:px-5 py-4 space-y-4">
              {cartItems.map((item) => {
                const product = item.product;
                const productId = product._id || product.id;
                const productImage = product.heroImage || product.image || (product.images && product.images[0]) || '/placeholder-product.jpg';
                const productName = product.title || product.name || 'Product';

                // Get product slug with fallback - use ID if slug is missing (API handles both)
                const productSlug = product.slug || productId?.toString();

                // Get stock info if available
                const stock = product.stock || product.inStock;
                const stockText = stock !== undefined ? `${stock} in stock` : null;

                return (
                  <div 
                    key={`${productId}_${item.selectedColor?.colorName || 'default'}`} 
                    className="group bg-white rounded-xl border border-black/5 shadow-sm hover:shadow-md transition-all duration-200 p-4 sm:p-5"
                  >
                    <div className="flex gap-4">
                      {/* Product Image */}
                      <Link
                        href={`/products/${productSlug}`}
                        className="flex-shrink-0 relative"
                        onClick={onClose}
                      >
                        <div className="relative w-24 h-24 sm:w-28 sm:h-28 bg-gradient-to-br from-warm-white to-white border-2 border-black/5 rounded-xl overflow-hidden shadow-sm group-hover:shadow-md transition-shadow duration-200">
                          <Image
                            src={productImage}
                            alt={productName}
                            fill
                            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                            sizes="(max-width: 640px) 96px, 112px"
                          />
                        </div>
                      </Link>

                      {/* Product Details */}
                      <div className="flex-1 min-w-0 flex flex-col">
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <Link
                              href={`/products/${productSlug}`}
                              onClick={onClose}
                              className="flex-1 min-w-0"
                            >
                              <h3 className="text-sm sm:text-base font-bold text-black mb-1 line-clamp-2 hover:text-accent transition-colors group-hover:underline">
                                {productName}
                              </h3>
                            </Link>
                            <button
                              onClick={() => handleQuantityChange(productId, 0, item.selectedColor)}
                              className="flex-shrink-0 text-black/30 hover:text-accent hover:bg-accent/5 transition-all duration-200 p-1.5 rounded-full"
                              aria-label="Remove item"
                            >
                              <XIcon className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Additional Info */}
                          <div className="space-y-1.5 mb-3">
                            {/* Color Variant */}
                            {item.selectedColor && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-black/50 font-medium">Color:</span>
                                <div className="flex items-center gap-1.5">
                                  <div
                                    className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                                    style={{ backgroundColor: item.selectedColor.colorHex }}
                                    title={item.selectedColor.colorName}
                                  />
                                  <span className="text-xs text-black/70 font-medium">{item.selectedColor.colorName}</span>
                                </div>
                              </div>
                            )}

                            {/* Stock Info */}
                            {stockText && (
                              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-green-50 border border-green-200 rounded-full">
                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                                <span className="text-[10px] sm:text-xs text-green-700 font-semibold">
                                  {stockText}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Quantity Controls */}
                        <div className="flex items-center justify-end pt-3 border-t border-black/5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-black/50 font-medium">Quantity:</span>
                            <div className="flex items-center bg-warm-white border-2 border-black/10 rounded-lg overflow-hidden shadow-sm">
                              <button
                                onClick={() => handleQuantityChange(productId, item.quantity - 1, item.selectedColor)}
                                className="p-2 hover:bg-black/5 active:bg-black/10 transition-colors text-black/70 hover:text-black touch-manipulation"
                                aria-label="Decrease quantity"
                              >
                                <MinusIcon className="w-4 h-4" />
                              </button>
                              <div className="px-3 py-2 min-w-[3rem] text-center">
                                <span className="text-sm font-bold text-black">{item.quantity}</span>
                              </div>
                              <button
                                onClick={() => handleQuantityChange(productId, item.quantity + 1, item.selectedColor)}
                                className="p-2 hover:bg-black/5 active:bg-black/10 transition-colors text-black/70 hover:text-black touch-manipulation"
                                aria-label="Increase quantity"
                              >
                                <PlusIcon className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 sm:py-20 px-4 sm:px-6 text-center">
              <div className="w-24 h-24 sm:w-32 sm:h-32 mb-6 rounded-full bg-gradient-to-br from-warm-white to-white border-4 border-black/5 flex items-center justify-center">
                <svg className="w-12 h-12 sm:w-16 sm:h-16 text-black/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-black mb-2 font-serif">Your cart is empty</h3>
              <p className="text-sm sm:text-base text-black/60 mb-8 max-w-sm">Start adding products to your cart and discover our amazing collection!</p>
              <Link
                href="/catalog"
                onClick={onClose}
                className="inline-flex items-center gap-2 bg-accent hover:bg-accent/90 text-white font-bold py-3 px-8 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-sm sm:text-base"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Browse Products
              </Link>
            </div>
          )}
        </div>

        {/* Footer - Order Summary */}
        {cartItems.length > 0 && (
          <div className="border-t-2 border-black/5 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
            <div className="px-4 sm:px-5 py-4 sm:py-5 space-y-4">
              {/* Order Summary */}
              <div className="bg-gradient-to-br from-warm-white to-white border-2 border-black/5 rounded-xl p-4 space-y-3">
                {/* Business/Bulk Order Note (for first-time users OR returning normal customers) */}
                {(!savedProfile || (savedProfile && savedProfile.userType !== 'business')) && (
                  <div className="flex items-start gap-2 p-3 bg-gradient-to-r from-accent/5 to-accent/10 border border-accent/20 rounded-lg">
                    <svg className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs sm:text-sm text-black/80 font-medium leading-relaxed">
                      Special deals available for business & bulk orders
                    </p>
                  </div>
                )}

                {/* Saved Profile Info (for returning users) */}
                {savedProfile && savedProfile.phone ? (
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 border-2 border-blue-200 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-xs sm:text-sm font-semibold text-blue-900">Enquiry will be sent using:</span>
                      </div>
                      <button
                        onClick={handleChangeInfo}
                        className="text-xs sm:text-sm text-blue-600 hover:text-blue-700 font-semibold underline transition-colors"
                      >
                        Change
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-200 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base sm:text-lg font-bold text-blue-900">
                            +91 {savedProfile.phone}
                          </span>
                          {savedProfile.userType === 'business' && (
                            <span className="px-2.5 py-1 bg-green-500 text-white rounded-full text-[10px] font-bold uppercase tracking-wide shadow-sm">
                              Business
                            </span>
                          )}
                        </div>
                        {savedProfile.name && (
                          <div className="mt-1 text-xs sm:text-sm text-blue-700 font-medium">
                            {savedProfile.name}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Checkout Button */}
              <button
                className="w-full bg-gradient-to-r from-accent to-accent/90 hover:from-accent/90 hover:to-accent text-white font-bold py-4 px-6 rounded-xl transition-all duration-200 touch-manipulation flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-base sm:text-lg group"
                onClick={handleWhatsAppCheckout}
              >
                <WhatsAppIcon className="w-5 h-5 sm:w-6 sm:h-6 group-hover:scale-110 transition-transform" />
                <span>Enquire for these items</span>
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </div>
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
