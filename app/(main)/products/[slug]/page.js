/**
 * Product Detail Page
 * 
 * Displays detailed information about a single product.
 * Shows images, specifications, color variants, and related products.
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { HeartIcon, PlusIcon, MinusIcon } from '@/components/Icons';
import { ArrowRight, Check, Truck, ShieldCheck, Share2 } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';
import { getWhatsAppBusinessLink } from '@/lib/utils/whatsapp';
import ProductCard from '@/components/ProductCard';
import ProductCardSkeleton from '@/components/ProductCardSkeleton';
import ProductGallery from '@/components/ProductGallery';
import AiAssistant from '@/components/AiAssistant';
import toast from 'react-hot-toast';

export default function ProductDetailPage() {
  const params = useParams();
  const { slug } = params;
  const { isInWishlist, addToWishlist, removeFromWishlist, addToCart, isInCart, products, loading: contextLoading, categories } = useAppContext();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState('description');
  const [selectedColor, setSelectedColor] = useState(null);

  useEffect(() => {
    async function fetchProduct() {
      try {
        const response = await fetch(`/api/products/${slug}`);
        const data = await response.json();
        if (data.success) {
          setProduct(data.product);
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
                <div className="aspect-square bg-gray-200 rounded-lg"></div>
              </div>
              <div className="space-y-4">
                <div className="h-8 w-3/4 bg-gray-200 rounded"></div>
                <div className="h-6 w-1/2 bg-gray-200 rounded"></div>
                <div className="h-12 w-1/4 bg-gray-200 rounded"></div>
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
            <Link href="/catalog" className="text-brand-orange hover:underline">
              Back to Catalog
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const productId = product._id || product.id;
  const isLiked = isInWishlist(productId);
  const inCart = isInCart(productId);
  const allImages = [product.heroImage, ...(product.gallery || [])].filter(Boolean);
  
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
    addToCart(productId, quantity, {
      selectedColor: selectedColor,
      price: product.price
    });
    toast.success('Added to cart!');
  };

  const handleBuyNow = () => {
    const message = `Hello! I'm interested in purchasing:\n\n${product.title}\nQuantity: ${quantity}\n${selectedColor ? `Color: ${selectedColor.colorName}\n` : ''}Price: ${formatPrice(product.price)}\n\nPlease proceed with the order.`;
    const whatsappUrl = getWhatsAppBusinessLink(message);
    window.open(whatsappUrl, '_blank');
  };

  const handleQuantityChange = (delta) => {
    setQuantity(prev => Math.max(1, prev + delta));
  };

  const handleColorSelect = (variant) => {
    setSelectedColor(variant);
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
  const specificationsObj = product?.specifications?.reduce((acc, spec) => {
    acc[spec.label] = `${spec.value} ${spec.unit || ''}`.trim();
    return acc;
  }, {}) || {};

  // Convert specifications to features list
  const features = product?.specifications?.map(spec => `${spec.label}: ${spec.value} ${spec.unit || ''}`) || [];
  
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
        <nav className="flex text-sm text-gray-500 mb-8" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-2">
            <li><Link href="/" className="hover:text-brand-orange">Home</Link></li>
            <li><span className="text-gray-300">/</span></li>
            {categoryPath.length > 0 ? (
              <>
                {categoryPath.map((cat, index) => (
                  <li key={cat._id || cat.id}>
                    <span className="text-gray-300">/</span>
                    <Link href={`/catalog?category=${cat.slug}`} className="hover:text-brand-orange ml-2">
                      {cat.name}
                    </Link>
                  </li>
                ))}
                <li><span className="text-gray-300">/</span></li>
              </>
            ) : (
              <>
                <li><Link href="/catalog" className="hover:text-brand-orange">Products</Link></li>
                <li><span className="text-gray-300">/</span></li>
              </>
            )}
            <li className="text-gray-900 font-medium truncate" aria-current="page">{product.title}</li>
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
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">{product.title}</h1>

            <div className="flex items-end gap-4 mb-8">
              <span className="text-4xl font-bold text-gray-900">{formatPrice(product.price)}</span>
              {product.price && (
                <>
                  <span className="text-sm text-gray-500 mb-2 line-through">{formatPrice(product.price * 1.2)}</span>
                  <span className="text-sm font-semibold text-green-600 mb-2 px-2 py-0.5 bg-green-100 rounded">Save 20%</span>
                </>
              )}
            </div>

            <div className="prose prose-sm text-gray-600 mb-8">
              <p>{product.description || 'No description available.'}</p>
            </div>

            {/* Color Variants */}
            {product.colorVariants && product.colorVariants.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-3 text-gray-900 uppercase tracking-wide">
                  Color
                </h3>
                <div className="flex gap-3">
                  {product.colorVariants.map((variant, index) => (
                    <button
                      key={index}
                      onClick={() => handleColorSelect(variant)}
                      className={`w-12 h-12 rounded-full border-2 transition-all duration-200 ${
                        selectedColor?.colorName === variant.colorName 
                          ? 'border-brand-orange ring-2 ring-brand-orange ring-offset-2' 
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                      style={{ backgroundColor: variant.colorHex }}
                      title={variant.colorName}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-b border-gray-200 py-6 mb-8">
              <div className="flex flex-col gap-4">
                {/* Quantity */}
                <div className="flex items-center border border-gray-300 rounded-md w-max">
                  <button 
                    onClick={() => handleQuantityChange(-1)}
                    className="p-3 text-gray-600 hover:text-brand-orange transition-colors"
                  >
                    <MinusIcon className="w-4 h-4" />
                  </button>
                  <span className="w-12 text-center font-medium text-gray-900">{quantity}</span>
                  <button 
                    onClick={() => handleQuantityChange(1)}
                    className="p-3 text-gray-600 hover:text-brand-orange transition-colors"
                  >
                    <PlusIcon className="w-4 h-4" />
                  </button>
                </div>

                {/* Buttons Row */}
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                  {/* Add to Cart - Half Size */}
                  <button 
                    onClick={handleAddToCart}
                    className="flex-1 sm:flex-[0.5] border border-[#F97316] text-[#F97316] font-bold py-3 px-6 rounded-md transition-colors flex items-center justify-center gap-2 hover:bg-[#F97316]/5"
                  >
                    <span className="text-base">{inCart ? 'Added to Cart' : 'Add to Cart'}</span>
                    <ArrowRight size={18} />
                  </button>

                  {/* Buy Now */}
                  <button 
                    onClick={handleBuyNow}
                    className="flex-1 sm:flex-[0.5] border-2 border-green-600 text-green-600 hover:bg-green-50 font-bold py-3 px-6 rounded-md transition-colors flex items-center justify-center gap-2"
                  >
                    <span className="text-base">Buy Now</span>
                    <ArrowRight size={18} />
                  </button>

                  {/* Wishlist/Share */}
                  <div className="flex gap-2">
                    <button 
                      onClick={handleWishlistToggle}
                      className={`p-3 border rounded-md transition-colors ${
                        isLiked
                          ? 'border-brand-orange text-brand-orange bg-orange-50'
                          : 'border-gray-300 text-gray-600 hover:text-brand-orange hover:border-brand-orange'
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
                      className="p-3 border border-gray-300 rounded-md text-gray-600 hover:text-brand-orange hover:border-brand-orange transition-colors"
                    >
                      <Share2 size={20} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 text-sm">
              <div className="flex items-center gap-3 text-gray-700">
                <div className="p-2 bg-gray-100 rounded-full text-brand-orange"><Truck size={18} /></div>
                <span>Free shipping on orders over ₹500</span>
              </div>
              <div className="flex items-center gap-3 text-gray-700">
                <div className="p-2 bg-gray-100 rounded-full text-brand-orange"><ShieldCheck size={18} /></div>
                <span>Lifetime warranty on manufacturing</span>
              </div>
            </div>

            {/* Tabs */}
            <div>
              <div className="flex border-b border-gray-200 mb-6">
                <button 
                  onClick={() => setActiveTab('description')}
                  className={`pb-4 px-4 font-medium text-sm transition-colors relative ${
                    activeTab === 'description' ? 'text-brand-orange' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Description
                  {activeTab === 'description' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-orange"></div>}
                </button>
                <button 
                  onClick={() => setActiveTab('specs')}
                  className={`pb-4 px-4 font-medium text-sm transition-colors relative ${
                    activeTab === 'specs' ? 'text-brand-orange' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Specifications
                  {activeTab === 'specs' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-orange"></div>}
                </button>
                <button 
                  onClick={() => setActiveTab('shipping')}
                  className={`pb-4 px-4 font-medium text-sm transition-colors relative ${
                    activeTab === 'shipping' ? 'text-brand-orange' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Shipping
                  {activeTab === 'shipping' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-orange"></div>}
                </button>
              </div>

              <div className="min-h-[200px]">
                {activeTab === 'description' && (
                  <div className="space-y-4 text-gray-600 leading-relaxed">
                    <p>
                      {product.description || 'No description available for this product.'}
                    </p>
                    {features.length > 0 && (
                      <>
                        <h4 className="font-bold text-gray-900 mt-4">Key Features:</h4>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {features.map((feature, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <Check size={16} className="text-brand-orange mt-1 flex-shrink-0" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                )}

                {activeTab === 'specs' && (
                  <div className="overflow-hidden bg-gray-50 rounded-lg border border-gray-200">
                    {Object.keys(specificationsObj).length > 0 ? (
                      <table className="min-w-full divide-y divide-gray-200">
                        <tbody className="divide-y divide-gray-200">
                          {Object.entries(specificationsObj).map(([key, value]) => (
                            <tr key={key}>
                              <td className="px-6 py-4 text-sm font-medium text-gray-900 bg-gray-100 w-1/3">{key}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">{value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="px-6 py-4 text-sm text-gray-600">No specifications available.</div>
                    )}
                  </div>
                )}

                {activeTab === 'shipping' && (
                  <div className="text-gray-600 space-y-4">
                    <p><strong>Processing Time:</strong> Orders are processed within 1-2 business days.</p>
                    <p><strong>Shipping Methods:</strong> We offer Standard Ground (5-7 days) and Expedited (2-3 days) shipping options via FedEx or UPS.</p>
                    <p><strong>Freight Shipping:</strong> Large bulk orders may be shipped via freight carrier. Our team will contact you to coordinate delivery.</p>
                    <div className="bg-orange-50 border border-brand-orange/20 p-4 rounded-md text-sm text-orange-800">
                      Note: Due to the size of this item, it may be subject to dimensional weight shipping charges if ordered in single quantities.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Related Section Title */}
        {contextLoading ? (
          <div className="mt-12 sm:mt-16 border-t border-gray-200 pt-6 sm:pt-8">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6 sm:mb-8">Related Products</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              {Array.from({ length: 4 }).map((_, index) => (
                <ProductCardSkeleton key={`related-skeleton-${index}`} />
              ))}
            </div>
          </div>
        ) : relatedProducts.length > 0 ? (
          <div className="mt-12 sm:mt-16 border-t border-gray-200 pt-6 sm:pt-8">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6 sm:mb-8">Related Products</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              {relatedProducts.map(relatedProduct => (
                <ProductCard key={relatedProduct._id || relatedProduct.id} product={relatedProduct} />
              ))}
            </div>
          </div>
        ) : null}
      </main>

      <AiAssistant productContext={productContextString} />
    </div>
  );
}
