/**
 * Product Detail Page
 * 
 * Displays detailed information about a single product.
 * Shows images, specifications, color variants, and related products.
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { HeartIcon, ChevronLeftIcon, ChevronRightIcon, WhatsAppIcon, ShoppingCartIcon } from '@/components/Icons';
import { useAppContext } from '@/context/AppContext';
import ProductCard from '@/components/ProductCard';
import ProductCardSkeleton from '@/components/ProductCardSkeleton';
import toast from 'react-hot-toast';

export default function ProductDetailPage() {
  const params = useParams();
  const { slug } = params;
  const { isInWishlist, addToWishlist, removeFromWishlist, addToCart, isInCart, products, loading: contextLoading } = useAppContext();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState('');
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState(null);

  useEffect(() => {
    async function fetchProduct() {
      try {
        const response = await fetch(`/api/products/${slug}`);
        const data = await response.json();
        if (data.success) {
          setProduct(data.product);
          const allImages = [data.product.heroImage, ...(data.product.gallery || [])];
          setSelectedImage(allImages[0]);
          setSelectedImageIndex(0);
        }
      } catch (error) {
        console.error('Error fetching product:', error);
      } finally {
        setLoading(false);
      }
    }

    if (slug) {
      fetchProduct();
    }
  }, [slug]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Image skeleton */}
            <div className="space-y-4">
              <div className="aspect-square bg-gray-200 rounded-lg"></div>
              <div className="flex gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="w-20 h-20 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
            {/* Content skeleton */}
            <div className="space-y-4">
              <div className="h-8 w-3/4 bg-gray-200 rounded"></div>
              <div className="h-4 w-1/2 bg-gray-200 rounded"></div>
              <div className="h-6 w-1/4 bg-gray-200 rounded"></div>
              <div className="space-y-2 pt-4">
                <div className="h-4 w-full bg-gray-200 rounded"></div>
                <div className="h-4 w-full bg-gray-200 rounded"></div>
                <div className="h-4 w-3/4 bg-gray-200 rounded"></div>
              </div>
              <div className="flex gap-4 pt-4">
                <div className="h-12 flex-1 bg-gray-200 rounded"></div>
                <div className="h-12 w-40 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Product Not Found</h1>
          <Link href="/catalog" className="text-primary hover:underline">
            Back to Catalog
          </Link>
        </div>
      </div>
    );
  }

  const productId = product._id || product.id;
  const isLiked = isInWishlist(productId);
  const inCart = isInCart(productId);
  const allImages = [product.heroImage, ...(product.gallery || [])];
  const relatedProducts = products.filter(p => {
    const pid = p._id || p.id;
    return product.relatedProductIds?.some(rid => {
      const ridStr = rid._id?.toString() || rid.toString();
      return ridStr === pid?.toString();
    });
  }).slice(0, 4);

  const handleWishlistToggle = () => {
    if (isLiked) {
      removeFromWishlist(productId);
    } else {
      addToWishlist(productId);
    }
  };

  const handleAddToCart = () => {
    addToCart(productId, 1);
    toast.success('Added to cart!');
  };

  const handleColorSelect = (variant) => {
    setSelectedColor(variant);
    if (variant.images && variant.images.length > 0) {
      setSelectedImage(variant.images[0]);
      // Find the index of the selected variant image in allImages
      const variantImageIndex = allImages.findIndex(img => img === variant.images[0]);
      if (variantImageIndex !== -1) {
        setSelectedImageIndex(variantImageIndex);
      }
    }
  };

  const handlePreviousImage = () => {
    const newIndex = selectedImageIndex > 0 ? selectedImageIndex - 1 : allImages.length - 1;
    setSelectedImageIndex(newIndex);
    setSelectedImage(allImages[newIndex]);
  };

  const handleNextImage = () => {
    const newIndex = selectedImageIndex < allImages.length - 1 ? selectedImageIndex + 1 : 0;
    setSelectedImageIndex(newIndex);
    setSelectedImage(allImages[newIndex]);
  };

  const handleThumbnailClick = (img, index) => {
    setSelectedImage(img);
    setSelectedImageIndex(index);
  };

  const handleWhatsAppContact = () => {
    // WhatsApp phone number (you can make this configurable via environment variable)
    const phoneNumber = '911234567890'; // Remove + and spaces, add country code
    const message = encodeURIComponent(`Hello! I'm interested in this product:\n\n${product.title}\nPrice: ${formatPrice(product.price)}\n\nPlease provide more information.`);
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;
    window.open(whatsappUrl, '_blank');
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price).replace('₹', '₹ ');
  };

  const isPremium = product.isPremium;
  
  // Dynamic classes based on premium status
  const pageBgClass = isPremium ? 'bg-secondary' : 'bg-light';
  const contentBgClass = isPremium ? 'bg-premium-dark' : 'bg-white';
  const textPrimaryClass = isPremium ? 'text-premium-text' : 'text-gray-900';
  const textSecondaryClass = isPremium ? 'text-premium-light' : 'text-gray-600';
  const textTertiaryClass = isPremium ? 'text-gray-400' : 'text-gray-500';
  const borderClass = isPremium ? 'border-premium-light' : 'border-gray-200';
  const headingClass = isPremium ? 'text-premium-text' : 'text-gray-900';

  return (
    <div className={`min-h-screen ${pageBgClass}`}>
      <div className="container mx-auto px-4 py-8">
        <div className={`${contentBgClass} rounded-lg p-8 shadow-lg`}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        {/* Image Gallery */}
        <div>
          <div className="relative aspect-square mb-4 group">
            <Image
              src={selectedImage}
              alt={product.title}
              fill
              className="object-cover rounded-lg"
            />
            {allImages.length > 1 && (
              <>
                {/* Left Arrow */}
                <button
                  onClick={handlePreviousImage}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Previous image"
                >
                  <ChevronLeftIcon className="w-6 h-6 text-gray-800" />
                </button>
                {/* Right Arrow */}
                <button
                  onClick={handleNextImage}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Next image"
                >
                  <ChevronRightIcon className="w-6 h-6 text-gray-800" />
                </button>
              </>
            )}
          </div>
          {allImages.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {allImages.map((img, index) => (
                <button
                  key={index}
                  onClick={() => handleThumbnailClick(img, index)}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-colors ${
                    selectedImageIndex === index 
                      ? isPremium ? 'border-premium-light' : 'border-primary'
                      : isPremium ? 'border-transparent hover:border-premium-light/50' : 'border-transparent hover:border-gray-300'
                  }`}
                >
                  <Image
                    src={img}
                    alt={`${product.title} ${index + 1}`}
                    fill
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div>
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className={`text-sm uppercase tracking-wider ${textTertiaryClass}`}>{product.brand}</p>
              <h1 className={`text-3xl font-bold mt-2 ${headingClass}`}>{product.title}</h1>
            </div>
            <button
              onClick={handleWishlistToggle}
              className={`p-2 rounded-full ${isPremium ? 'hover:bg-premium-light/20' : 'hover:bg-gray-100'}`}
              aria-label="Add to wishlist"
            >
              <HeartIcon isFilled={isLiked} className={`w-6 h-6 ${isLiked ? 'text-primary' : isPremium ? 'text-premium-light' : 'text-gray-400'}`} />
            </button>
          </div>

          <p className={`text-2xl font-bold mb-4 ${isPremium ? 'text-premium-text' : 'text-primary'}`}>{formatPrice(product.price)}</p>

          {product.summary && (
            <p className={`mb-6 ${textSecondaryClass}`}>{product.summary}</p>
          )}

          {product.description && (
            <div className="mb-6">
              <h2 className={`text-lg font-semibold mb-2 ${headingClass}`}>Description</h2>
              <p className={`whitespace-pre-line ${textSecondaryClass}`}>{product.description}</p>
            </div>
          )}

          {/* Color Variants */}
          {product.colorVariants && product.colorVariants.length > 0 && (
            <div className="mb-6">
              <h3 className={`text-sm font-semibold mb-2 ${headingClass}`}>Available Colors</h3>
              <div className="flex gap-2">
                {product.colorVariants.map((variant, index) => (
                  <button
                    key={index}
                    onClick={() => handleColorSelect(variant)}
                    className={`w-10 h-10 rounded-full border-2 ${
                      selectedColor?.colorName === variant.colorName 
                        ? isPremium ? 'border-premium-light' : 'border-primary'
                        : isPremium ? 'border-premium-light/50' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: variant.colorHex }}
                    title={variant.colorName}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Specifications */}
          {product.specifications && product.specifications.length > 0 && (
            <div className={`mb-6 ${borderClass} border-t pt-6`}>
              <h3 className={`text-sm font-semibold mb-2 ${headingClass}`}>Specifications</h3>
              <table className="w-full">
                <tbody>
                  {product.specifications.map((spec, index) => (
                    <tr key={index} className={borderClass}>
                      <td className={`py-2 ${textSecondaryClass}`}>{spec.label}</td>
                      <td className={`py-2 text-right font-medium ${textPrimaryClass}`}>
                        {spec.value} {spec.unit || ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Status */}
          <div className="mb-6">
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
              product.status === 'In Stock' 
                ? isPremium ? 'bg-green-900/30 text-green-300' : 'bg-green-100 text-green-800'
                : product.status === 'Out of Stock'
                ? isPremium ? 'bg-red-900/30 text-red-300' : 'bg-red-100 text-red-800'
                : isPremium ? 'bg-yellow-900/30 text-yellow-300' : 'bg-yellow-100 text-yellow-800'
            }`}>
              {product.status}
            </span>
          </div>

          {/* Contact Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 mt-8">
            <button
              onClick={handleAddToCart}
              className={`flex-1 flex items-center justify-center gap-2 font-semibold py-3 px-6 rounded-lg transition-colors ${
                inCart
                  ? isPremium
                    ? 'bg-premium-light/20 border-2 border-premium-light text-premium-light'
                    : 'bg-primary/20 border-2 border-primary text-primary'
                  : isPremium
                    ? 'bg-premium-light hover:bg-premium-light/80 text-premium-dark'
                    : 'bg-primary hover:bg-primary/90 text-white'
              }`}
            >
              <ShoppingCartIcon className="w-5 h-5" />
              <span>{inCart ? 'Added to Cart' : 'Add to Cart'}</span>
            </button>
            <button
              onClick={handleWhatsAppContact}
              className="flex-1 flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20BA5A] text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              <WhatsAppIcon className="w-5 h-5" />
              <span>Enquire on WhatsApp</span>
            </button>
            <button
              onClick={handleWishlistToggle}
              className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg border-2 font-semibold transition-colors ${
                isLiked
                  ? 'bg-primary border-primary text-white hover:bg-primary/90'
                  : isPremium 
                    ? 'bg-transparent border-premium-light text-premium-light hover:bg-premium-light/20'
                    : 'bg-transparent border-secondary text-secondary hover:bg-secondary hover:text-white'
              }`}
            >
              <HeartIcon isFilled={isLiked} className="w-5 h-5" />
              <span>Wishlist</span>
            </button>
          </div>
        </div>
      </div>

      {/* Related Products */}
      {contextLoading ? (
        <div className="mt-12">
          <h2 className={`text-2xl font-bold mb-6 ${headingClass}`}>Related Products</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, index) => (
              <ProductCardSkeleton key={`related-skeleton-${index}`} />
            ))}
          </div>
        </div>
      ) : relatedProducts.length > 0 ? (
        <div className="mt-12">
          <h2 className={`text-2xl font-bold mb-6 ${headingClass}`}>Related Products</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {relatedProducts.map(relatedProduct => (
              <ProductCard key={relatedProduct._id || relatedProduct.id} product={relatedProduct} />
            ))}
          </div>
        </div>
      ) : null}
        </div>
      </div>
    </div>
  );
}

