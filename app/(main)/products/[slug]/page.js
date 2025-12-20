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
import { HeartIcon, PlusIcon, MinusIcon,WhatsAppIcon,ShoppingCartIcon } from '@/components/Icons';
import { ArrowRight, Check, Truck, ShieldCheck, Share2 } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';
import { getWhatsAppBusinessLink } from '@/lib/utils/whatsapp';
import { useEnquiry, createEnquiryAndRedirect } from '@/lib/hooks/useEnquiry';
import LightCaptureModal from '@/components/LightCaptureModal';
import ProductCard from '@/components/ProductCard';
import ProductCardSkeleton from '@/components/ProductCardSkeleton';
import ProductGallery from '@/components/ProductGallery';
import AiAssistant from '@/components/AiAssistant';
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
  const [activeTab, setActiveTab] = useState('description');
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
    <div className="min-h-screen bg-white">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Breadcrumbs */}
        <nav className="flex text-sm text-black/60 mb-8" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-2">
            <li><Link href="/" className="hover:text-accent transition-colors">Home</Link></li>
            <li><span className="text-black/30">/</span></li>
            {categoryPath.length > 0 ? (
              <>
                {categoryPath.map((cat, index) => (
                  <li key={cat._id || cat.id}>
                    <span className="text-black/30">/</span>
                    <Link href={`/catalog?category=${cat.slug}`} className="hover:text-accent transition-colors ml-2">
                      {cat.name}
                    </Link>
                  </li>
                ))}
                <li><span className="text-black/30">/</span></li>
              </>
            ) : (
              <>
                <li><Link href="/catalog" className="hover:text-accent transition-colors">Products</Link></li>
                <li><span className="text-black/30">/</span></li>
              </>
            )}
            <li className="text-black font-medium truncate" aria-current="page">{product.title}</li>
          </ol>
        </nav>

        <div className="lg:grid lg:grid-cols-2 lg:gap-x-12 xl:gap-x-16">
          {/* Left Column: Gallery */}
          <div className="mb-10 lg:mb-0">
            <ProductGallery 
              images={allImages} 
              title={product.title}
              isPremium={product.isPremium}
              featured={product.featured}
            />
          </div>

          {/* Right Column: Product Info */}
          <div>
            {product.brand && (
              <div className="text-sm text-black/60 mb-2 uppercase tracking-wide font-medium">
                {product.brand}
              </div>
            )}
            <h1 className="text-3xl sm:text-4xl font-bold text-black mb-4">{product.title}</h1>

            <div className="flex items-end gap-4 mb-8">
              <span className="text-4xl font-bold text-black">{formatPrice(product.price)}</span>
              {product.price && (
                <>
                  <span className="text-sm text-black/50 mb-2 line-through">{formatPrice(product.price * 1.2)}</span>
                  <span className="text-sm font-semibold text-accent mb-2 px-2 py-0.5 bg-accent/10 rounded">Save 20%</span>
                </>
              )}
            </div>

            <div className="prose prose-sm text-black/70 mb-8">
              <p>{product.summary || 'No description available.'}</p>
            </div>

            {/* Color Variants */}
            {product.colorVariants && product.colorVariants.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-black uppercase tracking-wide">
                    Color
                  </h3>
                  {selectedColor && (
                    <span className="text-sm text-black/60">
                      {selectedColor.colorName}
                      {selectedColor.isDefault && (
                        <span className="ml-1 text-xs text-amber-600">(Default)</span>
                      )}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-3">
                  {product.colorVariants.map((variant, index) => (
                    <button
                      key={index}
                      onClick={() => handleColorSelect(variant)}
                      className={`relative w-12 h-12 rounded-full border-2 transition-all duration-200 ${
                        selectedColor?.colorName === variant.colorName 
                          ? 'border-accent ring-2 ring-accent ring-offset-2' 
                          : variant.isDefault 
                            ? 'border-amber-400 hover:border-amber-500'
                            : 'border-black/20 hover:border-black/40'
                      }`}
                      style={{ backgroundColor: variant.colorHex }}
                      title={`${variant.colorName}${variant.isDefault ? ' (Default)' : ''}`}
                    >
                      {/* Default indicator dot */}
                      {variant.isDefault && selectedColor?.colorName !== variant.colorName && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full border border-white" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Available Sizes Dropdown */}
            {product.availableSizes && product.availableSizes.trim() && (() => {
              const sizes = product.availableSizes.split(',').map(s => s.trim()).filter(Boolean);
              if (sizes.length > 0) {
                return (
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-black uppercase tracking-wide mb-3">
                      Sizes :
                    </label>
                    <select
                      value={selectedSize}
                      onChange={(e) => setSelectedSize(e.target.value)}
                      className="w-full p-3 border border-black/20 rounded-md text-black/60 hover:text-accent hover:border-accent transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent appearance-none bg-white cursor-pointer"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23333' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 12px center',
                        paddingRight: '40px'
                      }}
                    >
                      <option value="">Choose an option</option>
                      {sizes.map((size, index) => (
                        <option key={index} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              }
              return null;
            })()}

            <div className="border-t border-b border-black/10 py-6 mb-8">
              <div className="flex flex-col gap-4">
                {/* Quantity */}
                <div className="flex items-center border border-black/20 rounded-md w-max">
                  <button 
                    onClick={() => handleQuantityChange(-1)}
                    className="p-3 text-black/60 hover:text-accent transition-colors"
                  >
                    <MinusIcon className="w-4 h-4" />
                  </button>
                  <span className="w-12 text-center font-medium text-black">{quantity}</span>
                  <button 
                    onClick={() => handleQuantityChange(1)}
                    className="p-3 text-black/60 hover:text-accent transition-colors"
                  >
            
                    <PlusIcon className="w-4 h-4" />
                  </button>
                </div>

                {/* Buttons Row */}
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                  {/* Add to Cart - Half Size */}
                  <button 
                    onClick={handleAddToCart}
                    className={`flex-1 sm:flex-[0.5] border font-bold py-3 px-6 rounded-md transition-colors flex items-center justify-center gap-2 ${
                      inCart 
                        ? 'border-accent bg-accent text-white hover:bg-accent' 
                        : 'border-accent text-accent hover:bg-accent/5'
                    }`}
                  >
                    <span className="transition-colors"><ShoppingCartIcon size={18}  /></span>
                    <span className="text-base">{inCart ? 'Remove from Cart' : 'Add to Cart'}</span>
                    <ArrowRight size={18} />
                  </button>

                  {/* Enquire */}
                  <button 
                    onClick={handleEnquire}
                    className="flex-1 sm:flex-[0.5] border-2 border-green-400 text-green-400 hover:bg-green-400 hover:text-white font-bold py-3 px-6 rounded-md transition-colors flex items-center justify-center gap-2"
                  >
                    <span className="transition-colors"><WhatsAppIcon size={18}  /></span>
                    <span className="text-base">Enquire</span>
                    <ArrowRight size={18} />
                  </button>

                  {/* Wishlist/Share */}
                  <div className="flex gap-2">
                    <button 
                      onClick={handleWishlistToggle}
                      className={`p-3 border rounded-md transition-colors ${
                        isLiked
                          ? 'border-accent text-accent bg-accent/10'
                          : 'border-black/20 text-black/60 hover:text-accent hover:border-accent'
                      }`}
                    >
                      <HeartIcon isFilled={isLiked} className="w-5 h-5" />
                    </button>
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
                      className="p-3 border border-black/20 rounded-md text-black/60 hover:text-accent hover:border-accent transition-colors"
                    >
                      <Share2 size={20} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 text-sm">
              <div className="flex items-center gap-3 text-black/70">
                <div className="p-2 bg-black/5 rounded-full text-accent"><ShieldCheck size={18} /></div>
                <span>Built to perform</span>
              </div>
              <div className="flex items-center gap-3 text-black/70">
                <div className="p-2 bg-black/5 rounded-full text-accent"><ShieldCheck size={18} /></div>
                <span>Crafted to last</span>
              </div>
            </div>
            {/* Tabs */}
            <div>
              <div className="flex border-b border-black/10 mb-6">
                <button 
                  onClick={() => setActiveTab('description')}
                  className={`pb-4 px-4 font-medium text-sm transition-colors relative ${
                    activeTab === 'description' ? 'text-accent' : 'text-black/60 hover:text-black'
                  }`}
                >
                  Description
                  {activeTab === 'description' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-accent"></div>}
                </button>
                <button 
                  onClick={() => setActiveTab('specs')}
                  className={`pb-4 px-4 font-medium text-sm transition-colors relative ${
                    activeTab === 'specs' ? 'text-accent' : 'text-black/60 hover:text-black'
                  }`}
                >
                  Specifications
                  {activeTab === 'specs' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-accent"></div>}
                </button>
              </div>

              <div className="min-h-[200px]">
                {activeTab === 'description' && (
                  <div className="space-y-4 text-black/70 leading-relaxed">
                    <p>
                      {product.description || 'No description available for this product.'}
                    </p>
                    {features.length > 0 && (
                      <>
                        <h4 className="font-bold text-black mt-4">Key Features:</h4>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {features.map((feature, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <Check size={16} className="text-accent mt-1 flex-shrink-0" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                )}

                {activeTab === 'specs' && (
                  <div className="overflow-hidden bg-white border border-black/10 rounded-lg">
                    {Object.keys(specificationsObj).length > 0 ? (
                      <table className="min-w-full divide-y divide-black/10">
                        <tbody className="divide-y divide-black/10">
                          {Object.entries(specificationsObj).map(([key, value]) => (
                            <tr key={key}>
                              <td className="px-6 py-4 text-sm font-medium text-black bg-black/5 w-1/3">{key}</td>
                              <td className="px-6 py-4 text-sm text-black/70">{value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="px-6 py-4 text-sm text-black/60">No specifications available.</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Related Section Title */}
        {contextLoading ? (
          <div className="mt-12 sm:mt-16 border-t border-black/10 pt-6 sm:pt-8">
            <h2 className="text-xl sm:text-2xl font-bold text-black mb-6 sm:mb-8">Related Products</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              {Array.from({ length: 4 }).map((_, index) => (
                <ProductCardSkeleton key={`related-skeleton-${index}`} />
              ))}
            </div>
          </div>
        ) : relatedProducts.length > 0 ? (
          <div className="mt-12 sm:mt-16 border-t border-black/10 pt-6 sm:pt-8">
            <h2 className="text-xl sm:text-2xl font-bold text-black mb-6 sm:mb-8">Related Products</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              {relatedProducts.map(relatedProduct => (
                <ProductCard key={relatedProduct._id || relatedProduct.id} product={relatedProduct} />
              ))}
            </div>
          </div>
        ) : null}
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
