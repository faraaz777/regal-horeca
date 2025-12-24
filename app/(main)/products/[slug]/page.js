/**
 * Product Detail Page
 * 
 * Displays detailed information about a single product.
 * Shows images, specifications, color variants, and related products.
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { HeartIcon, PlusIcon, MinusIcon, WhatsAppIcon, ShoppingCartIcon } from '@/components/Icons';
import { ArrowRight, Check, Truck, ShieldCheck, Share2 } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';
import { getWhatsAppBusinessLink } from '@/lib/utils/whatsapp';
import { useEnquiry, createEnquiryAndRedirect } from '@/lib/hooks/useEnquiry';
import LightCaptureModal from '@/components/LightCaptureModal';
import ProductCard from '@/components/ProductCard';
import ProductCardSkeleton from '@/components/ProductCardSkeleton';
import ProductGallery from '@/components/ProductGallery';
import AiAssistant from '@/components/AiAssistant';
import ReactMarkdown from 'react-markdown';
import toast from 'react-hot-toast';

export default function ProductDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { slug } = params;
  const { isInWishlist, addToWishlist, removeFromWishlist, addToCart, removeFromCart, isInCart, products, loading: contextLoading, categories } = useAppContext();
  const { handleEnquiry } = useEnquiry();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState('specs');
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedSize, setSelectedSize] = useState('');
  const [showCaptureModal, setShowCaptureModal] = useState(false);
  const [pendingEnquiry, setPendingEnquiry] = useState(null);

  // Detect if this is a business context (from URL param or product has businessTypeSlugs)
  const isBusinessContext = searchParams?.get('business') ||
    (product?.businessTypeSlugs && product.businessTypeSlugs.length > 0);
  const defaultUserType = isBusinessContext ? 'business' : 'unknown';

  useEffect(() => {
    async function fetchProduct() {
      try {
        const response = await fetch(`/api/products/${slug}`);
        const data = await response.json();
        if (data.success) {
          setProduct(data.product);

          // Auto-select the default color variant if exists
          const productData = data.product;
          if (productData.colorVariants && productData.colorVariants.length > 0) {
            // Find the variant with isDefault: true, or fallback to first variant
            const defaultVariant = productData.colorVariants.find(v => v.isDefault)
              || productData.colorVariants[0];
            setSelectedColor(defaultVariant);
          }
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
      <div className="min-h-screen bg-white">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="animate-pulse">
            <div className="lg:grid lg:grid-cols-2 lg:gap-x-12 xl:gap-x-16">
              <div className="mb-10 lg:mb-0">
                <div className="aspect-square bg-white border border-black/10 rounded-lg"></div>
              </div>
              <div className="space-y-4">
                <div className="h-8 w-3/4 bg-white border border-black/10 rounded"></div>
                <div className="h-6 w-1/2 bg-white border border-black/10 rounded"></div>
                <div className="h-12 w-1/4 bg-white border border-black/10 rounded"></div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-white">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Product Not Found</h1>
            <Link href="/catalog" className="text-accent hover:text-black transition-colors">
              Back to Catalog
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const productId = product._id || product.id;
  const isLiked = isInWishlist(productId);
  // Check if the specific variant (with selected color) is in cart
  const inCart = isInCart(productId, selectedColor);

  // Get images based on selected color variant, or default to product images
  const getDisplayImages = () => {
    if (selectedColor && selectedColor.images && selectedColor.images.length > 0) {
      return selectedColor.images.filter(Boolean);
    }
    return [product.heroImage, ...(product.gallery || [])].filter(Boolean);
  };
  const allImages = getDisplayImages();

  // Get category for breadcrumbs
  const getCategoryPath = () => {
    if (!product.category || !categories.length) return [];
    const categoryId = product.category._id || product.category;
    const category = categories.find(c => (c._id || c.id) === categoryId);
    if (!category) return [];

    const path = [];
    let current = category;
    while (current) {
      path.unshift(current);
      const parentId = current.parent?._id || current.parent;
      if (parentId) {
        current = categories.find(c => (c._id || c.id) === parentId);
      } else {
        current = null;
      }
    }
    return path;
  };

  const categoryPath = getCategoryPath();
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
    if (inCart) {
      // Remove the specific variant (with selected color)
      removeFromCart(productId, selectedColor);
      toast.success('Removed from cart!');
    } else {
      addToCart(productId, quantity, {
        selectedColor: selectedColor,
        price: product.price
      });
      toast.success('Added to cart!');
    }
  };

  const handleBuyNow = () => {
    // Use new enquiry flow instead of direct WhatsApp
    handleEnquiry({
      source: 'product-detail',
      defaultUserType: defaultUserType,
      products: [{
        productId: productId,
        productName: product.title,
        quantity: quantity,
        color: selectedColor?.colorName,
      }],
      onShowCapture: (data) => {
        setPendingEnquiry(data);
        setShowCaptureModal(true);
      },
    });
  };

  const handleEnquire = () => {
    handleEnquiry({
      source: 'product-detail',
      defaultUserType: defaultUserType,
      products: [{
        productId: productId,
        productName: product.title,
        quantity: quantity,
        color: selectedColor?.colorName,
      }],
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
    }
  };

  const handleQuantityChange = (delta) => {
    setQuantity(prev => Math.max(1, prev + delta));
  };

  const handleColorSelect = (variant) => {
    // Toggle: if clicking the same color, unselect it
    if (selectedColor?.colorName === variant.colorName) {
      setSelectedColor(null);
    } else {
      setSelectedColor(variant);
    }
  };

  const formatPrice = (price) => {
    if (price == null || price === 0) return 'Price on request';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price).replace('₹', '₹ ');
  };

  // Convert specifications to object format for specs tab
  // Filter out "Available sizes" from specifications display
  const specificationsObj = product?.specifications
    ?.filter(spec => spec.label?.toLowerCase() !== 'available sizes')
    ?.reduce((acc, spec) => {
      acc[spec.label] = `${spec.value} ${spec.unit || ''}`.trim();
      return acc;
    }, {}) || {};

  // Convert specifications to features list
  // Filter out "Available sizes" from features
  const features = product?.specifications
    ?.filter(spec => spec.label?.toLowerCase() !== 'available sizes')
    ?.map(spec => `${spec.label}: ${spec.value} ${spec.unit || ''}`) || [];

  // Default rating
  const rating = 5;
  const reviewCount = 0;
  const sku = product.sku || product._id?.toString().slice(-8) || 'N/A';

  // Product context string for AI assistant
  const productContextString = `
    Product: ${product.title}
    Price: ${formatPrice(product.price)}
    Features: ${features.join(', ')}
    Specs: ${JSON.stringify(specificationsObj)}
    Description: ${product.description || ''}
  `;

  return (
    <div className="min-h-screen bg-warm-white animate-in font-sans selection:bg-royal-gold selection:text-white">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Breadcrumbs - Compact & Styled */}
        <nav className="flex text-xs uppercase tracking-widest text-black/40 mb-6" aria-label="Breadcrumb">
          <ol className="flex items-center flex-wrap gap-2">
            <li><Link href="/" className="hover:text-royal-gold transition-colors">Home</Link></li>
            <li><span className="text-black/10">/</span></li>
            {categoryPath.length > 0 ? (
              <>
                {categoryPath.map((cat, index) => (
                  <li key={cat._id || cat.id} className="flex items-center gap-2">
                    {index > 0 && <span className="text-black/10">/</span>}
                    <Link href={`/catalog?category=${cat.slug}`} className="hover:text-royal-gold transition-colors">
                      {cat.name}
                    </Link>
                  </li>
                ))}
                <li><span className="text-black/10">/</span></li>
              </>
            ) : (
              <>
                <li><Link href="/catalog" className="hover:text-royal-gold transition-colors">Products</Link></li>
                <li><span className="text-black/10">/</span></li>
              </>
            )}
            <li className="text-rich-black font-semibold truncate" aria-current="page">{product.title}</li>
          </ol>
        </nav>

        <div className="lg:grid lg:grid-cols-12 lg:gap-x-12 xl:gap-x-16">
          {/* Left Column: Gallery (7 Cols) */}
          <div className="lg:col-span-7 mb-10 lg:mb-0">
            <div className="sticky top-24">
              <ProductGallery
                images={allImages}
                title={product.title}
                isPremium={product.isPremium}
                featured={product.featured}
              />
            </div>
          </div>

          {/* Right Column: Product Info (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col h-full">
            <div className="animate-in slide-in-from-right-8 duration-700 delay-100">
              {product.brand && (
                <div className="inline-flex items-center gap-2 mb-4">
                  <span className="h-px w-6 bg-accent/40"></span>
                  <span className="text-[10px] font-bold text-accent uppercase tracking-[0.25em]">
                    {product.brand}
                  </span>
                </div>
              )}

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-light text-rich-black mb-4 leading-[1.1] tracking-tight">
                {product.title}
              </h1>

              {/* Price Block */}
              <div className="flex flex-wrap items-baseline gap-3 mb-8 pb-6 border-b border-black/5">
                <span className="font-serif italic text-4xl text-rich-black">
                  {formatPrice(product.price)}
                </span>
                {product.price && (
                  <>
                    <span className="text-base text-black/30 line-through decoration-1">
                      {formatPrice(product.price * 1.2)}
                    </span>
                    <span className="ml-auto flex items-center gap-1.5 text-[10px] font-bold text-white bg-royal-gold px-2.5 py-1 rounded-sm uppercase tracking-wider">
                      Premium Offer
                    </span>
                  </>
                )}
              </div>

              {/* Removed Highlights Block from here as requested - moving to Tabs */}

              <div className="space-y-6 mb-8">
                {/* Color Variants */}
                {product.colorVariants && product.colorVariants.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-rich-black uppercase tracking-widest">
                        Finish
                      </span>
                      {selectedColor && (
                        <span className="text-xs font-serif italic text-black/60">
                          {selectedColor.colorName}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {product.colorVariants.map((variant, index) => (
                        <button
                          key={index}
                          onClick={() => handleColorSelect(variant)}
                          className={`group relative w-10 h-10 rounded-full transition-all duration-300 ${selectedColor?.colorName === variant.colorName
                            ? 'ring-1 ring-rich-black ring-offset-4 scale-105'
                            : 'hover:scale-105 opacity-80 hover:opacity-100'
                            }`}
                          title={`${variant.colorName}${variant.isDefault ? ' (Default)' : ''}`}
                        >
                          <span
                            className="absolute inset-0 rounded-full shadow-sm border border-black/5"
                            style={{ backgroundColor: variant.colorHex }}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sizes */}
                {product.availableSizes && product.availableSizes.trim() && (() => {
                  const sizes = product.availableSizes.split(',').map(s => s.trim()).filter(Boolean);
                  if (sizes.length > 0) {
                    return (
                      <div>
                        <label className="block text-xs font-bold text-rich-black uppercase tracking-widest mb-3">
                          Dimensions
                        </label>
                        <div className="relative">
                          <select
                            value={selectedSize}
                            onChange={(e) => setSelectedSize(e.target.value)}
                            className="w-full p-3.5 bg-white border border-black/10 rounded-none text-rich-black hover:border-accent transition-colors focus:outline-none focus:border-accent appearance-none cursor-pointer text-sm font-medium tracking-wide"
                          >
                            <option value="">Select Configuration</option>
                            {sizes.map((size, index) => (
                              <option key={index} value={size}>
                                {size}
                              </option>
                            ))}
                          </select>
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                            <PlusIcon className="w-3 h-3 text-black/40" />
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* NEW CTA LAYOUT - Distinct Actions */}
              <div className="mt-4 pt-6 border-t border-black/5">
                <div className="grid grid-cols-[auto_1fr] gap-3 mb-3">
                  {/* Quantity - Distinct Block */}
                  <div className="flex items-center bg-white border border-black/10 h-14 w-28">
                    <button
                      onClick={() => handleQuantityChange(-1)}
                      className="w-8 h-full flex items-center justify-center text-black/30 hover:text-black transition-colors"
                    >
                      <MinusIcon className="w-3 h-3" />
                    </button>
                    <span className="flex-1 text-center font-semibold text-rich-black">{quantity}</span>
                    <button
                      onClick={() => handleQuantityChange(1)}
                      className="w-8 h-full flex items-center justify-center text-black/30 hover:text-black transition-colors"
                    >
                      <PlusIcon className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Add to Cart - Primary Brand Color */}
                  <button
                    onClick={handleAddToCart}
                    className={`h-14 transition-all duration-300 flex items-center justify-center gap-3 font-bold tracking-widest uppercase text-xs sm:text-sm ${inCart
                      ? 'bg-rich-black text-white hover:bg-black'
                      : 'bg-accent text-white hover:bg-red-600 shadow-lg shadow-accent/20'
                      }`}
                  >
                    <ShoppingCartIcon size={18} />
                    {inCart ? 'In Your Cart' : 'Add to Collection'}
                  </button>
                </div>

                {/* Secondary Actions Row */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleEnquire}
                    className="h-12 border border-black/10 text-rich-black bg-transparent hover:bg-rich-black hover:text-white transition-all duration-300 flex items-center justify-center gap-2 font-bold tracking-widest uppercase text-[10px] sm:text-xs"
                  >
                    <WhatsAppIcon size={16} />
                    Request Detail
                  </button>

                  <button
                    onClick={handleWishlistToggle}
                    className={`h-12 border transition-colors flex items-center justify-center gap-2 font-bold tracking-widest uppercase text-[10px] sm:text-xs ${isLiked
                      ? 'border-royal-gold text-royal-gold bg-royal-gold/5'
                      : 'border-black/10 text-black/40 hover:text-rich-black hover:border-rich-black'
                      }`}
                  >
                    <HeartIcon isFilled={isLiked} className="w-4 h-4" />
                    {isLiked ? 'Saved' : 'Save'}
                  </button>
                </div>
              </div>

              {/* Trust Indicators - Horizontal Strip */}
              <div className="flex items-center justify-between gap-4 mt-8 py-4 px-1 border-y border-black/5">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-royal-gold" />
                  <span className="text-[10px] uppercase tracking-wider font-bold text-black/60">Authentic</span>
                </div>
                <div className="w-px h-3 bg-black/10"></div>
                <div className="flex items-center gap-2">
                  <Truck size={14} className="text-royal-gold" />
                  <span className="text-[10px] uppercase tracking-wider font-bold text-black/60">Global Ship</span>
                </div>
                <div className="w-px h-3 bg-black/10"></div>
                <div className="group relative">
                  <button
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: product.title,
                          text: product.description,
                          url: window.location.href,
                        });
                      }
                    }}
                    className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-black/5 shadow-[0_2px_10px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_15px_rgba(0,0,0,0.1)] transition-all duration-300 active:scale-95 group"
                  >
                    <Share2 size={16} className="text-accent group-hover:rotate-12 transition-transform" />
                    <span className="text-[10px] uppercase tracking-widest font-bold text-accent">Share</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Centralized Tabs Section - Specs & Description */}
        <div className="mt-20 sm:mt-24 max-w-4xl mx-auto">
          {/* Tab Header */}
          <div className="flex justify-center mb-12">
            <div className="inline-flex bg-white rounded-full p-1 border border-black/5 shadow-sm">
              <button
                onClick={() => setActiveTab('specs')}
                className={`px-6 py-3 rounded-full text-xs font-bold uppercase tracking-widest transition-all duration-300 ${activeTab === 'specs'
                  ? 'bg-rich-black text-white shadow-md'
                  : 'text-black/40 hover:text-black hover:bg-black/5'
                  }`}
              >
                Specifications
              </button>
              <button
                onClick={() => setActiveTab('description')}
                className={`px-6 py-3 rounded-full text-xs font-bold uppercase tracking-widest transition-all duration-300 ${activeTab === 'description'
                  ? 'bg-rich-black text-white shadow-md'
                  : 'text-black/40 hover:text-black hover:bg-black/5'
                  }`}
              >
                Description
              </button>
            </div>
          </div>

          {/* Content Container */}
          <div className="bg-white rounded-2xl p-8 sm:p-16 shadow-[0_4px_30px_rgba(0,0,0,0.02)] border border-black/5 min-h-[300px]">

            {/* Specs Content */}
            {activeTab === 'specs' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="text-center mb-10">
                  <h3 className="font-serif italic text-2xl text-royal-gold mb-2">Technical Details</h3>
                  <p className="text-black/40 text-sm">Precise craftsmanship and dimensions</p>
                </div>

                {Object.keys(specificationsObj).length > 0 ? (
                  <div className="max-w-3xl mx-auto space-y-4">
                    {Object.entries(specificationsObj).map(([key, value]) => (
                      <div key={key} className="flex flex-col sm:flex-row sm:items-baseline justify-between py-4 border-b border-black/5 hover:bg-warm-white/50 transition-colors px-4 rounded-lg group">
                        <span className="text-xs font-bold uppercase tracking-[0.2em] text-black/30 group-hover:text-royal-gold transition-colors mb-1 sm:mb-0">
                          {key}
                        </span>
                        <span className="font-medium text-rich-black text-base text-left sm:text-right sm:max-w-[60%]">
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-black/30 py-10">No specifications available.</div>
                )}

              </div>
            )}

            {/* Description Content */}
            {activeTab === 'description' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
                <div className="text-center mb-10">
                  <h3 className="font-serif italic text-2xl text-royal-gold mb-2">The Experience</h3>
                  <div className="w-12 h-0.5 bg-royal-gold/30 mx-auto mt-4"></div>
                </div>
                <div className="prose prose-lg prose-p:text-black/60 prose-p:leading-loose prose-headings:text-black prose-strong:text-black prose-ul:text-black prose-li:text-black/60 text-center max-w-none">
                  {product.description ? (
                    <ReactMarkdown>{product.description}</ReactMarkdown>
                  ) : (
                    <p>No description available for this product.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Related Section */}
        {contextLoading ? null : relatedProducts.length > 0 && (
          <div className="mt-32 pt-16 border-t border-black/5">
            <div className="flex items-center justify-between mb-12">
              <h2 className="text-xl sm:text-2xl font-light text-rich-black uppercase tracking-widest">You May Also Like</h2>
              <Link href="/catalog" className="hidden sm:block text-xs font-bold uppercase tracking-widest text-royal-gold hover:text-accent transition-colors">
                View Full Collection
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-10">
              {relatedProducts.map(relatedProduct => (
                <ProductCard key={relatedProduct._id || relatedProduct.id} product={relatedProduct} />
              ))}
            </div>
            <div className="mt-8 text-center sm:hidden">
              <Link href="/catalog" className="text-xs font-bold uppercase tracking-widest text-royal-gold hover:text-accent transition-colors border-b border-royal-gold/20 pb-1">
                View Full Collection
              </Link>
            </div>
          </div>
        )}
      </main>

      <AiAssistant productContext={productContextString} />

      {/* Light Capture Modal */}
      <LightCaptureModal
        isOpen={showCaptureModal}
        onClose={() => {
          setShowCaptureModal(false);
          setPendingEnquiry(null);
        }}
        onSubmit={handleCaptureSubmit}
        defaultUserType={defaultUserType}
      />
    </div>
  );
}
