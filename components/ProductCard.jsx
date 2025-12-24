"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { HeartIcon, ShoppingCartIcon, InfoIcon, DoneIcon, ClearIcon } from './Icons';
import { useAppContext } from '@/context/AppContext';
import toast from 'react-hot-toast';
import './ProductCard.css';

export default function ProductCard({ product, onAdd }) {
  const { addToWishlist, removeFromWishlist, isInWishlist, addToCart, removeFromCart, isInCart } = useAppContext();

  // Get product image - support multiple field names
  const productImage =
    product.heroImage ||
    product.image ||
    (product.images && product.images[0]) ||
    '/placeholder-product.jpg';

  // Get product name/title
  const productName = product.title || product.name || 'Product';

  // Get product ID
  const productId = product._id || product.id;
  
  // Get product slug with fallback - use ID if slug is missing (API handles both)
  const productSlug = product.slug || productId?.toString();
  
  const isLiked = isInWishlist(productId);
  // ProductCard doesn't have color selection, so check for item without color variant
  const inCart = isInCart(productId, null);

  // State for clicked animation
  const [clicked, setClicked] = useState(false);

  // Sync clicked state with cart state
  useEffect(() => {
    setClicked(inCart);
  }, [inCart]);

  // State for specs reveal (handling hover/click for mobile support)
  const [specsOpen, setSpecsOpen] = useState(false);

  // Detect mobile/touch device
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.matchMedia("(max-width: 768px)").matches || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Format price
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

  const handleAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onAdd) {
      onAdd(product);
    }
  };

  const handleWishlistToggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isLiked) {
      removeFromWishlist(productId);
      toast.success('Removed from wishlist');
    } else {
      addToWishlist(productId);
      toast.success('Added to wishlist');
    }
  };

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (inCart) {
      removeFromCart(productId, null);
      toast.success('Removed from cart!');
      setClicked(false);
    } else {
      addToCart(productId, 1, {
        price: product.price
      });
      toast.success('Added to cart!');
      setClicked(true);
    }
  };

  const handleRemoveFromCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    removeFromCart(productId, null);
    toast.success('Removed from cart!');
    setClicked(false);
  };

  const toggleSpecs = (e) => {
    if (isMobile) {
      // Don't toggle if clicking the close icon (x)
      if (e.target.closest('.product-card-icon') && specsOpen) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      setSpecsOpen(!specsOpen);
    }
  };

  const closeSpecs = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setSpecsOpen(false);
  };

  // Prepare specifications for display - limit to top 5
  const specifications = (product.specifications || []).slice(0, 5);

  return (
    <div className="product-card-wrapper">
      <div className="product-card-container">
        <div className="product-card-top">
          <Link href={`/products/${productSlug}`} className="block w-full h-full">
            <Image
              src={productImage}
              alt={productName}
              fill
              sizes="300px"
              className="object-cover"
            />
          </Link>
          {/* Wishlist button - Hide when specs are open (on both mobile and desktop) */}
          {!specsOpen && (
            <button
              onClick={handleWishlistToggle}
              className={`product-card-wishlist ${isLiked ? 'active' : ''}`}
              aria-label={isLiked ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <HeartIcon isFilled={isLiked} />
            </button>
          )}
        </div>
        <div className={`product-card-bottom ${clicked ? 'clicked' : ''}`}>
          <div className="product-card-left">
            <div className="product-card-details">
              <h1>{productName}</h1>
              <p>{formatPrice(product.price)}</p>
            </div>
            <div className="product-card-buy" onClick={handleAddToCart}>
              <ShoppingCartIcon />
            </div>
          </div>
          <div className="product-card-right">
            <div className="product-card-remove-wrapper">
              <div className="product-card-done">
                <DoneIcon />
              </div>
              <div className="product-card-remove" onClick={handleRemoveFromCart}>
                <ClearIcon />
              </div>
            </div>
            <div className="product-card-details">
              <h1>{productName}</h1>
              <p>Added to your cart</p>
            </div>
          </div>
        </div>
      </div>
      <div
        className={`product-card-inside ${specsOpen ? 'active' : ''}`}
        onClick={(e) => {
          // Don't toggle if clicking the icon when it's the 'x' (close button)
          if (isMobile && specsOpen && e.target.closest('.product-card-icon')) {
            return;
          }
          toggleSpecs(e);
        }}
        onMouseEnter={() => !isMobile && setSpecsOpen(true)}
        onMouseLeave={() => !isMobile && setSpecsOpen(false)}
      >
        <div 
          className="product-card-icon"
          onClick={(e) => {
            if (isMobile && specsOpen) {
              e.preventDefault();
              e.stopPropagation();
              setSpecsOpen(false);
            }
          }}
          style={{ cursor: 'pointer' }}
        >
          {/* Flip icon ONLY on mobile */}
          {isMobile && specsOpen ? <ClearIcon /> : <InfoIcon />}
        </div>
        <div className="product-card-contents">
          {specifications.length > 0 ? (
            <div className="product-card-specs-list">
              {specifications.map((spec, index) => (
                <div key={index} className="product-card-spec-item">
                  <span className="product-card-spec-label">{spec.label}</span>
                  <span className="product-card-spec-value">
                    {spec.value}{spec.unit ? ` ${spec.unit}` : ''}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="product-card-specs-empty">
              <p>No specifications available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
