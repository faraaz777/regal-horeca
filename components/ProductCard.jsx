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

  // Prepare specifications for display
  const specifications = product.specifications || [];
  // Group specifications in pairs for table display (2 columns)
  const specRows = [];
  for (let i = 0; i < specifications.length; i += 2) {
    const spec1 = specifications[i];
    const spec2 = specifications[i + 1];
    if (spec1) {
      specRows.push({
        label1: spec1.label,
        value1: `${spec1.value}${spec1.unit ? spec1.unit : ''}`,
        label2: spec2?.label || '',
        value2: spec2 ? `${spec2.value}${spec2.unit ? spec2.unit : ''}` : ''
      });
    }
  }

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
              className="object-contain"
            />
          </Link>
          {/* Wishlist button on top left */}
          <button
            onClick={handleWishlistToggle}
            className={`product-card-wishlist ${isLiked ? 'active' : ''}`}
            aria-label={isLiked ? 'Remove from wishlist' : 'Add to wishlist'}
          >
            <HeartIcon isFilled={isLiked} />
          </button>
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
        onClick={() => setSpecsOpen(!specsOpen)}
        onMouseEnter={() => setSpecsOpen(true)}
        onMouseLeave={() => setSpecsOpen(false)}
      >
        <div className="product-card-icon">
          {specsOpen ? <ClearIcon /> : <InfoIcon />}
        </div>
        <div className="product-card-contents">
          {specifications.length > 0 ? (
            <table>
              <tbody>
                {specRows.map((row, index) => (
                  <React.Fragment key={index}>
                    <tr>
                      <th>{row.label1}</th>
                      <th>{row.label2}</th>
                    </tr>
                    <tr>
                      <td>{row.value1}</td>
                      <td>{row.value2}</td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          ) : (
            <div>
              <p>No specifications available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
