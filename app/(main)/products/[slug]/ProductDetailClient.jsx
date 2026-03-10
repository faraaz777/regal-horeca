/**
 * Product Detail Client
 *
 * Client-side interactivity for product page. Receives initialProduct from server
 * for SEO (content in initial HTML); when present, skips loading and main fetch.
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { HeartIcon, PlusIcon, MinusIcon, WhatsAppIcon, ShoppingCartIcon } from '@/components/Icons';
import { Truck, ShieldCheck, Share2 } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';
import { useEnquiry, createEnquiryAndRedirect } from '@/lib/hooks/useEnquiry';
import LightCaptureModal from '@/components/LightCaptureModal';
import ProductCard from '@/components/ProductCard';
import ProductGallery from '@/components/ProductGallery';
import ReactMarkdown from 'react-markdown';
import DOMPurify from 'dompurify';
import { isHtml, stripHtml } from '@/lib/utils/html';
import toast from 'react-hot-toast';

function normalizeTitlePart(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/\s*·\s*/g, ' · ')
    .trim();
}

function isLikelyLabel(value) {
  const v = normalizeTitlePart(value);
  if (!v) return false;

  const words = v.split(/\s+/).filter(Boolean);
  if (words.length > 4) return false;
  if (v.length > 28) return false;

  // Consider it a "label" if it has no lowercase letters (common for collections like "OCEAN")
  // or if it's very short and looks like an acronym-ish tag.
  const hasLower = /[a-z]/.test(v);
  if (!hasLower) return true;

  const alpha = v.replace(/[^A-Za-z]/g, '');
  if (alpha.length >= 2) {
    const upperCount = (alpha.match(/[A-Z]/g) || []).length;
    if (upperCount / alpha.length >= 0.85 && words.length <= 3) return true;
  }
  return false;
}

function splitProductTitle(rawTitle) {
  const title = normalizeTitlePart(rawTitle);
  if (!title) return { primary: '', secondary: '' };

  // Primary strategy: pipe-delimited titles (your catalog convention)
  if (title.includes('|')) {
    const parts = title
      .split(/\s*\|\s*/g)
      .map(normalizeTitlePart)
      .filter(Boolean);

    const primary = parts[0] || title;
    // Keep secondary succinct: prefer "everything after first pipe" but cap to last 2 parts if too long.
    const rest = parts.slice(1);
    const secondary = rest.length <= 2 ? rest.join(' · ') : rest.slice(-2).join(' · ');
    return { primary, secondary };
  }

  // Fallback: handle "Name - Label" / "Name: Label" patterns (only when the tail looks label-like)
  const fallbackSeparators = [' - ', ' – ', ' — ', ': '];
  for (const sep of fallbackSeparators) {
    if (!title.includes(sep)) continue;
    const [left, ...rightParts] = title.split(sep).map(normalizeTitlePart).filter(Boolean);
    const right = rightParts.join(sep).trim();
    if (left && right && isLikelyLabel(right)) {
      return { primary: left, secondary: right };
    }
  }

  return { primary: title, secondary: '' };
}

export default function ProductDetailClient({ initialProduct = null }) {
  const params = useParams();
  const searchParams = useSearchParams();
  const { slug } = params;
  const { isInWishlist, addToWishlist, removeFromWishlist, addToCart, removeFromCart, isInCart, categories } = useAppContext();
  const { handleEnquiry } = useEnquiry();
  const [product, setProduct] = useState(initialProduct);
  const [loading, setLoading] = useState(!initialProduct);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState('specs');
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedSize, setSelectedSize] = useState('');
  const [showCaptureModal, setShowCaptureModal] = useState(false);
  const [pendingEnquiry, setPendingEnquiry] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isBusinessContext = searchParams?.get('business') ||
    (product?.businessTypeSlugs && product.businessTypeSlugs.length > 0);
  const defaultUserType = isBusinessContext ? 'business' : 'unknown';

  // When no initialProduct, fetch product (client navigation or fallback)
  useEffect(() => {
    if (initialProduct || !slug) return;
    let cancelled = false;
    async function fetchProduct() {
      try {
        const response = await fetch(`/api/products/${slug}`);
        const data = await response.json();
        if (cancelled) return;
        if (data.success) {
          setProduct(data.product);
          const productData = data.product;
          if (productData.colorVariants && productData.colorVariants.length > 0) {
            const defaultVariant = productData.colorVariants.find(v => v.isDefault) || productData.colorVariants[0];
            setSelectedColor(defaultVariant);
          }
        }
      } catch (error) {
        if (!cancelled) console.error('Error fetching product:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchProduct();
    return () => { cancelled = true; };
  }, [slug, initialProduct]);

  // Set default color variant when product has colorVariants (for initialProduct from server)
  useEffect(() => {
    if (!product?.colorVariants?.length || selectedColor != null) return;
    const defaultVariant = product.colorVariants.find(v => v.isDefault) || product.colorVariants[0];
    setSelectedColor(defaultVariant);
  }, [product?.colorVariants, selectedColor]);

  // Fetch related products
  useEffect(() => {
    if (product?.relatedProductIds && product.relatedProductIds.length > 0) {
      const productIds = product.relatedProductIds
        .map(id => id._id || id)
        .filter(Boolean)
        .slice(0, 4);
      if (productIds.length === 0) {
        setRelatedProducts([]);
        return;
      }
      let cancelled = false;
      (async () => {
        try {
          const promises = productIds.map(id =>
            fetch(`/api/products/${id}`).then(res => res.json())
          );
          const results = await Promise.all(promises);
          if (cancelled) return;
          const fetched = results
            .filter(r => r.success && r.product)
            .map(r => r.product);
          setRelatedProducts(fetched);
        } catch (error) {
          if (!cancelled) console.error('Failed to fetch related products:', error);
          setRelatedProducts([]);
        }
      })();
      return () => { cancelled = true; };
    }
    setRelatedProducts([]);
  }, [product]);

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
  const inCart = isInCart(productId, selectedColor);
  const { primary: primaryTitle, secondary: secondaryTitle } = splitProductTitle(product.title);
  const secondaryIsLabel = isLikelyLabel(secondaryTitle);
  const isPriceOnRequest = product.price == null || product.price === 0;

  const getDisplayImages = () => {
    if (selectedColor && selectedColor.images && selectedColor.images.length > 0) {
      return selectedColor.images.filter(Boolean);
    }
    return [product.heroImage, ...(product.gallery || [])].filter(Boolean);
  };
  const allImages = getDisplayImages();

  // Prefer server-provided categoryPath; fallback to context-based path
  const getCategoryPathFromContext = () => {
    const catRef = product.category || product.categoryId;
    if (!catRef || !categories?.length) return [];
    const categoryId = catRef._id || catRef.id || catRef;
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
  const categoryPath = (product.categoryPath && product.categoryPath.length > 0)
    ? product.categoryPath
    : getCategoryPathFromContext();

  const handleWishlistToggle = () => {
    if (isLiked) removeFromWishlist(productId);
    else addToWishlist(productId);
  };

  const handleAddToCart = () => {
    if (inCart) {
      removeFromCart(productId, selectedColor);
      toast.success('Removed from cart!');
    } else {
      addToCart(productId, quantity, { selectedColor: selectedColor, price: product.price });
      toast.success('Added to cart!');
    }
  };

  const handleEnquire = () => {
    handleEnquiry({
      source: 'product-detail',
      defaultUserType: defaultUserType,
      products: [{
        productId,
        productName: product.title,
        quantity,
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
      await createEnquiryAndRedirect({ ...pendingEnquiry, phone, name, userType });
      setPendingEnquiry(null);
    }
  };

  const handleQuantityChange = (delta) => {
    setQuantity(prev => Math.max(1, prev + delta));
  };

  const handleColorSelect = (variant) => {
    if (selectedColor?.colorName === variant.colorName) setSelectedColor(null);
    else setSelectedColor(variant);
  };

  const formatPrice = (price) => {
    if (price == null || price === 0) return 'Price on request';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price).replace('₹', '₹ ');
  };

  const specificationsObj = product?.specifications
    ?.filter(spec => spec.label?.toLowerCase() !== 'available sizes')
    ?.reduce((acc, spec) => {
      acc[spec.label] = `${spec.value} ${spec.unit || ''}`.trim();
      return acc;
    }, {}) || {};

  return (
    <div className="min-h-screen bg-warm-white animate-in font-sans selection:bg-royal-gold selection:text-white">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <nav className="flex text-xs uppercase tracking-widest text-black/40 mb-6" aria-label="Breadcrumb">
          <ol className="flex items-center flex-wrap gap-2">
            <li><Link href="/" className="hover:text-royal-gold transition-colors">Home</Link></li>
            <li><span className="text-black/10">/</span></li>
            {categoryPath.length > 0 ? (
              <>
                {categoryPath.map((cat, index) => (
                  <li key={cat._id || cat.id || cat.slug || index} className="flex items-center gap-2">
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
          <div className="lg:col-span-7 mb-4 lg:mb-0">
            <div className="sticky top-24">
              <ProductGallery
                images={allImages}
                title={product.title}
                isPremium={product.isPremium}
                featured={product.featured}
              />
            </div>
          </div>

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

              <h1 className="mb-4">
                <span className="block text-2xl sm:text-3xl lg:text-4xl font-light text-rich-black leading-[1.1] tracking-tight">
                  {primaryTitle || product.title}
                </span>
                {secondaryTitle && (
                  <span
                    className={[
                      'block mt-2 text-sm sm:text-base',
                      secondaryIsLabel ? 'uppercase tracking-[0.22em]' : 'tracking-wide',
                      'text-black/55',
                    ].join(' ')}
                  >
                    {secondaryTitle}
                  </span>
                )}
              </h1>

              <div className="flex flex-wrap items-baseline gap-3 mb-8 pb-6 border-b border-black/5">
                <span
                  className={[
                    'font-serif italic text-rich-black',
                    isPriceOnRequest ? 'text-2xl sm:text-3xl' : 'text-4xl',
                  ].join(' ')}
                >
                  {formatPrice(product.price)}
                </span>
                {(() => {
                  const originalPrice = product.originalPrice && product.originalPrice > product.price
                    ? product.originalPrice
                    : (product.price ? product.price * 1.2 : null);
                  if (originalPrice && originalPrice > product.price) {
                    const discount = Math.round(((originalPrice - product.price) / originalPrice) * 100);
                    return (
                      <>
                        <span className="text-base text-black/30 line-through decoration-1">
                          {formatPrice(originalPrice)}
                        </span>
                        {discount >= 20 && (
                          <span className="ml-auto flex items-center gap-1.5 text-[10px] font-bold text-white bg-royal-gold px-2.5 py-1 rounded-sm uppercase tracking-wider">
                            Premium Offer
                          </span>
                        )}
                      </>
                    );
                  }
                  return null;
                })()}
              </div>

              <div className="space-y-6 mb-8">
                {product.colorVariants && product.colorVariants.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-rich-black uppercase tracking-widest">Color</span>
                      {selectedColor && (
                        <span className="text-xs font-serif italic text-black/60">{selectedColor.colorName}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {product.colorVariants.map((variant, index) => (
                        <button
                          key={index}
                          onClick={() => handleColorSelect(variant)}
                          className={`group relative w-10 h-10 rounded-full transition-all duration-300 ${
                            selectedColor?.colorName === variant.colorName
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

                {product.availableSizes && product.availableSizes.trim() && (() => {
                  const sizes = product.availableSizes.split(',').map(s => s.trim()).filter(Boolean);
                  if (sizes.length === 0) return null;
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
                            <option key={index} value={size}>{size}</option>
                          ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                          <PlusIcon className="w-3 h-3 text-black/40" />
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="mt-4 pt-6 border-t border-black/5">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="flex items-center bg-white border border-black/10 h-14 w-20 sm:w-24 rounded flex-shrink-0">
                    <button
                      onClick={() => handleQuantityChange(-1)}
                      className="w-8 h-full flex items-center justify-center text-black/30 hover:text-black transition-colors"
                    >
                      <MinusIcon className="w-3 h-3" />
                    </button>
                    <span className="flex-1 text-center font-semibold text-rich-black text-sm">{quantity}</span>
                    <button
                      onClick={() => handleQuantityChange(1)}
                      className="w-8 h-full flex items-center justify-center text-black/30 hover:text-black transition-colors"
                    >
                      <PlusIcon className="w-3 h-3" />
                    </button>
                  </div>
                  <button
                    onClick={handleAddToCart}
                    className="flex-1 h-14 min-w-0 transition-all duration-300 flex items-center justify-center gap-1.5 sm:gap-3 font-bold tracking-widest uppercase text-[10px] sm:text-xs md:text-sm px-2 sm:px-4 bg-accent text-white hover:bg-red-600 shadow-lg shadow-accent/20"
                  >
                    <ShoppingCartIcon className="w-3.5 h-3.5 sm:w-[18px] sm:h-[18px] flex-shrink-0" />
                    <span className="truncate">Add to Collection</span>
                  </button>
                  <div className="relative group flex-shrink-0">
                    <button
                      onClick={handleWishlistToggle}
                      className={`h-14 w-12 sm:w-14 border transition-colors flex items-center justify-center rounded ${
                        isLiked ? 'border-royal-gold text-royal-gold bg-royal-gold/5' : 'border-black/10 text-black/40 hover:text-rich-black hover:border-rich-black bg-white'
                      }`}
                    >
                      <HeartIcon isFilled={isLiked} className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    <div className="absolute right-0 bottom-full mb-2 px-3 py-1.5 bg-rich-black text-white text-xs font-medium rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-10">
                      {isLiked ? 'Saved' : 'Save'}
                      <div className="absolute -bottom-1 right-4 w-2 h-2 bg-rich-black rotate-45"></div>
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <button
                    onClick={handleEnquire}
                    className="w-full h-12 border border-black/80 text-rich-black bg-transparent hover:bg-rich-black hover:text-white transition-all duration-300 flex items-center justify-center gap-2 font-bold tracking-widest uppercase text-[10px] sm:text-xs rounded"
                  >
                    <WhatsAppIcon size={16} />
                    Request Detail
                  </button>
                </div>
              </div>

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
                        const text = stripHtml(product.summary || '') || product.title;
                        navigator.share({ title: product.title, text, url: window.location.href });
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

        <div className="mt-1 sm:mt-12 max-w-4xl mx-auto">
          <div className="flex justify-center mb-6">
            <div className="inline-flex bg-white rounded-full p-1 border border-black/5 shadow-sm">
              <button
                onClick={() => setActiveTab('specs')}
                className={`px-6 py-3 rounded-full text-xs font-bold uppercase tracking-widest transition-all duration-300 ${
                  activeTab === 'specs' ? 'bg-rich-black text-white shadow-md' : 'text-black/40 hover:text-black hover:bg-black/5'
                }`}
              >
                Specifications
              </button>
              <button
                onClick={() => setActiveTab('description')}
                className={`px-6 py-3 rounded-full text-xs font-bold uppercase tracking-widest transition-all duration-300 ${
                  activeTab === 'description' ? 'bg-rich-black text-white shadow-md' : 'text-black/40 hover:text-black hover:bg-black/5'
                }`}
              >
                Description
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 sm:p-8 shadow-[0_4px_30px_rgba(0,0,0,0.02)] border border-black/5">
            {activeTab === 'specs' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="text-center mb-4 sm:mb-6">
                  <h3 className="font-serif italic text-xl sm:text-2xl text-royal-gold mb-1 sm:mb-2">Technical Details</h3>
                  <p className="text-black/40 text-xs sm:text-sm">Precise craftsmanship and dimensions</p>
                </div>
                {Object.keys(specificationsObj).length > 0 ? (
                  <div className="max-w-3xl mx-auto space-y-2 sm:space-y-4">
                    {Object.entries(specificationsObj).map(([key, value]) => (
                      <div key={key} className="flex flex-row items-baseline justify-between py-2.5 sm:py-4 border-b border-black/5 hover:bg-warm-white/50 transition-colors px-3 sm:px-4 rounded-lg group">
                        <span className="text-[10px] sm:text-xs font-bold uppercase text-black/50 group-hover:text-royal-gold transition-colors flex-shrink-0 mr-3 sm:mr-4">{key}</span>
                        <span className="text-[10px] sm:text-xs font-bold uppercase text-black/70 text-right max-w-[60%] flex-shrink">{value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-black/30 py-10">No specifications available.</div>
                )}
              </div>
            )}

            {activeTab === 'description' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
                <div className="text-center mb-6">
                  <h3 className="font-serif italic text-2xl text-royal-gold mb-2">The Experience</h3>
                  <div className="w-12 h-0.5 bg-royal-gold/30 mx-auto mt-4"></div>
                </div>
                <div className="prose prose-lg prose-p:text-black/60 prose-p:leading-loose prose-headings:text-black prose-strong:text-black prose-ul:text-black prose-li:text-black/60 text-center max-w-none">
                  {product.description ? (
                    isHtml(product.description) ? (
                      <div
                        className="product-description-html"
                        dangerouslySetInnerHTML={{
                          __html: mounted
                            ? DOMPurify.sanitize(product.description, {
                                ALLOWED_TAGS: [
                                  'p',
                                  'br',
                                  'strong',
                                  'em',
                                  'u',
                                  's',
                                  'ul',
                                  'ol',
                                  'li',
                                  'table',
                                  'thead',
                                  'tbody',
                                  'tr',
                                  'th',
                                  'td',
                                  'h1',
                                  'h2',
                                  'h3',
                                ],
                              })
                            : product.description,
                        }}
                      />
                    ) : (
                      <ReactMarkdown>{product.description}</ReactMarkdown>
                    )
                  ) : (
                    <p>No description available for this product.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {relatedProducts.length > 0 && (
          <div className="mt-10 pt-8 border-t border-black/5">
            <div className="flex items-center justify-between mb-12">
              <h2 className="text-xl sm:text-2xl font-light text-rich-black uppercase tracking-widest">You May Also Like</h2>
              <Link href="/catalog" className="hidden sm:block text-xs font-bold uppercase tracking-widest text-royal-gold hover:text-accent transition-colors">
                View Full Collection
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-10">
              {relatedProducts.map((relatedProduct) => (
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

      <LightCaptureModal
        isOpen={showCaptureModal}
        onClose={() => { setShowCaptureModal(false); setPendingEnquiry(null); }}
        onSubmit={handleCaptureSubmit}
        defaultUserType={defaultUserType}
      />
    </div>
  );
}
