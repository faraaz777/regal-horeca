/**
 * Product Detail Client
 *
 * Client-side interactivity for product page. Receives initialProduct from server
 * for SEO (content in initial HTML); when present, skips loading and main fetch.
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Share2,
  FileText,
  Download,
  Truck,
  Globe2,
  MessageCircle,
  Settings,
  AlignLeft,
  Package,
  RotateCcw,
  Factory,
  BadgeCheck,
  X,
  Hotel,
  UtensilsCrossed,
  ChefHat,
  Users,
  Store,
  Coffee,
  CakeSlice,
  Wine,
  Soup,
  Utensils,
  Boxes,
  Sparkles,
  GlassWater,
  CookingPot,
  LayoutGrid,
  Phone,
  Mail,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAppContext } from '@/context/AppContext';
import ProductCard from '@/components/ProductCard';
import ProductGallery from '@/components/ProductGallery';
import FaqAccordion from '@/components/FaqAccordion';
import ReactMarkdown from 'react-markdown';
import DOMPurify from 'dompurify';
import { isHtml, stripHtml } from '@/lib/utils/html';
import { getWhatsAppBusinessLink, openWhatsAppLink } from '@/lib/utils/whatsapp';
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
  const { isInWishlist, addToWishlist, removeFromWishlist, categories, addToCart, removeFromCart, isInCart } = useAppContext();
  const [product, setProduct] = useState(initialProduct);
  const [loading, setLoading] = useState(!initialProduct);
  const [activeTab, setActiveTab] = useState('specs');
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedSize, setSelectedSize] = useState('');
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [frequentlyOrderedProducts, setFrequentlyOrderedProducts] = useState([]);
  const [mounted, setMounted] = useState(false);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
  const [activeDetailPhotoIndex, setActiveDetailPhotoIndex] = useState(0);
  const [activeTestimonialIndex, setActiveTestimonialIndex] = useState(0);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [quoteSubmitting, setQuoteSubmitting] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [isAttachmentModalOpen, setIsAttachmentModalOpen] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [attachmentGateForm, setAttachmentGateForm] = useState({ name: '', mobile: '' });
  const [isAttachmentViewerOpen, setIsAttachmentViewerOpen] = useState(false);
  const [activeAttachment, setActiveAttachment] = useState(null);

  const quoteStorageKey = `regal_quote_form_v1:${slug || 'unknown'}`;
  const attachmentGateStorageKey = 'regal_attachment_access_v1';

  const defaultQuoteForm = useMemo(() => ({
    name: '',
    businessName: '',
    email: '',
    mobile: '',
    address: '',
    city: '',
    state: '',
    country: '',
    businessType: '',
    buyingRole: '',
    budget: '',
    timeline: '',
    productInterests: [],
    requirement: '',
    preferredContactMethod: '',
    requirementDetails: '',
  }), []);

  const [quoteForm, setQuoteForm] = useState(() => {
    if (typeof window === 'undefined') return defaultQuoteForm;
    try {
      const raw = window.localStorage.getItem(quoteStorageKey);
      if (!raw) return defaultQuoteForm;
      const parsed = JSON.parse(raw);
      const saved = parsed?.data || parsed;
      if (!saved || typeof saved !== 'object') return defaultQuoteForm;
      return {
        ...defaultQuoteForm,
        ...saved,
        productInterests: Array.isArray(saved.productInterests) ? saved.productInterests : defaultQuoteForm.productInterests,
      };
    } catch {
      return defaultQuoteForm;
    }
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(attachmentGateStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.name || parsed?.mobile) {
        setAttachmentGateForm({
          name: String(parsed?.name || ''),
          mobile: String(parsed?.mobile || ''),
        });
      }
    } catch {
      // ignore invalid local storage payload
    }
  }, []);

  const testimonials = useMemo(
    () =>
      (Array.isArray(product?.testimonials) ? product.testimonials : [])
        .map((t) => ({
          quote: String(t?.quote || '').trim(),
          authorName: String(t?.authorName || '').trim(),
          authorRole: String(t?.authorRole || '').trim(),
          companyName: String(t?.companyName || '').trim(),
          companyLogo: String(t?.companyLogo || '').trim(),
        }))
        .filter((t) => t.quote),
    [product?.testimonials]
  );

  const tabs = useMemo(
    () => [
      { id: 'specs', label: 'Specifications', Icon: Settings },
      { id: 'description', label: 'Description', Icon: AlignLeft },
      { id: 'usage', label: 'Usage & Care', Icon: Package },
      { id: 'delivery', label: 'Delivery & Returns', Icon: Truck },
      { id: 'manufacturer', label: 'Manufacturer', Icon: Factory },
      { id: 'why', label: 'Why Buy From Us', Icon: BadgeCheck },
    ],
    []
  );

  useEffect(() => {
    if (testimonials.length <= 1) return;
    const id = window.setInterval(() => {
      setActiveTestimonialIndex((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, [testimonials.length]);

  // Auto-rotate detail photos on mobile
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const photos = Array.isArray(product?.detailPhotos) ? product.detailPhotos : [];
    if (photos.length !== 3) return;
    if (window.innerWidth >= 640) return; // only mobile

    const id = window.setInterval(() => {
      setActiveDetailPhotoIndex((prev) => (prev + 1) % photos.length);
    }, 3500);
    return () => window.clearInterval(id);
  }, [product?.detailPhotos]);

  // Restore cached quote form on load (so users don't lose progress)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(quoteStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;
      const saved = parsed.data || parsed; // backward compatible
      if (!saved || typeof saved !== 'object') return;
      setQuoteForm(prev => ({
        ...prev,
        ...saved,
        productInterests: Array.isArray(saved.productInterests) ? saved.productInterests : prev.productInterests,
      }));
    } catch {
      // ignore corrupted cache
    }
  }, [quoteStorageKey]);

  // Auto-save quote form (debounced)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          quoteStorageKey,
          JSON.stringify({ updatedAt: Date.now(), data: quoteForm })
        );
      } catch {
        // ignore storage failures (private mode/quota)
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [quoteForm, quoteStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => {
      if (window.innerWidth >= 640) setIsMobileSheetOpen(false);
      // Close desktop modal if user switches to mobile layout
      if (window.innerWidth < 640) setIsQuoteModalOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!isQuoteModalOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setIsQuoteModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isQuoteModalOpen]);

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

  // Fetch frequently ordered together products
  useEffect(() => {
    if (product?.frequentlyOrderedTogetherProductIds && product.frequentlyOrderedTogetherProductIds.length > 0) {
      const productIds = product.frequentlyOrderedTogetherProductIds
        .map(id => id._id || id)
        .filter(Boolean)
        .slice(0, 6);
      if (productIds.length === 0) {
        setFrequentlyOrderedProducts([]);
        return;
      }

      let cancelled = false;
      (async () => {
        try {
          const promises = productIds.map(id => fetch(`/api/products/${id}`).then(res => res.json()));
          const results = await Promise.all(promises);
          if (cancelled) return;
          const fetched = results
            .filter(r => r.success && r.product)
            .map(r => r.product);
          setFrequentlyOrderedProducts(fetched);
        } catch (error) {
          if (!cancelled) console.error('Failed to fetch frequently ordered together products:', error);
          setFrequentlyOrderedProducts([]);
        }
      })();

      return () => { cancelled = true; };
    }
    setFrequentlyOrderedProducts([]);
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

  const handleContactNow = () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    const msg = `Hi, I'm interested in this product:\n\n${product?.title || 'Product'}\nSKU: ${product?.sku || '—'}\n\n${url}\n\nPlease share pricing and availability.`;
    openWhatsAppLink(getWhatsAppBusinessLink(msg));
  };

  const openCartDrawer = () => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new Event('openCartDrawer'));
  };

  const handleAddToQuote = () => {
    const id = product?._id || product?.id;
    if (!id) return;
    const alreadyInCart = isInCart(id, selectedColor || null);
    if (alreadyInCart) {
      removeFromCart(id, selectedColor || null);
      toast.success('Removed from quote');
      return;
    }
    addToCart(id, 1, { selectedColor: selectedColor || null, price: product?.price || null });
    toast.success('Added to quote');
    openCartDrawer();
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

  const getFilterValues = (key) => {
    const found = product?.filters?.find(f => String(f?.key || '').toLowerCase() === String(key).toLowerCase());
    const values = found?.values?.filter(Boolean) || [];
    return values.join(', ');
  };

  const specGridEntries = (() => {
    const entries = Object.entries(specificationsObj);

    const usage = getFilterValues('Usage');
    if (usage) entries.push(['Use Case', usage]);

    const availableSizes = product?.availableSizes?.trim();
    if (availableSizes) entries.push(['Available Sizes', availableSizes]);

    // de-dupe by key (keep first)
    const seen = new Set();
    return entries.filter(([k]) => {
      const key = String(k || '').trim();
      if (!key) return false;
      const lower = key.toLowerCase();
      if (seen.has(lower)) return false;
      seen.add(lower);
      return true;
    });
  })();

  // (Location suggestions removed; plain inputs only)

  const activeTabMeta = tabs.find(t => t.id === activeTab) || tabs[0];

  const handleTabClick = (id) => {
    setActiveTab(id);
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      setIsMobileSheetOpen(true);
    }
  };

  const updateQuoteField = (key, value) => {
    setQuoteForm(prev => ({ ...prev, [key]: value }));
  };

  const toggleQuoteMulti = (key, value) => {
    setQuoteForm(prev => {
      const set = new Set(prev[key] || []);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      return { ...prev, [key]: Array.from(set) };
    });
  };

  const openQuoteModal = () => {
    setQuoteError('');
    setIsQuoteModalOpen(true);
  };

  const closeQuoteModal = () => {
    if (quoteSubmitting) return;
    setIsQuoteModalOpen(false);
  };

  const closeAttachmentModal = () => {
    setAttachmentError('');
    setIsAttachmentModalOpen(false);
  };

  const isAttachmentUserLoggedIn = () => {
    const nameOk = String(attachmentGateForm.name || '').trim().length >= 2;
    const digits = String(attachmentGateForm.mobile || '').replace(/\D/g, '');
    return nameOk && digits.length === 10;
  };

  const openAttachmentInSite = (attachment) => {
    if (!attachment?.url) return;
    const proxySrc = `/api/attachment/proxy?src=${encodeURIComponent(attachment.url)}`;
    const proxyDownloadSrc = `/api/attachment/proxy?download=1&src=${encodeURIComponent(attachment.url)}`;
    const isPdf = String(attachment.url || '').toLowerCase().includes('.pdf');
    const isImage = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].some((ext) =>
      String(attachment.url || '').toLowerCase().includes(ext)
    );
    setActiveAttachment({
      label: attachment.label || 'Attachment',
      url: attachment.url,
      proxySrc,
      proxyDownloadSrc,
      isPdf,
      isImage,
    });
    setIsAttachmentViewerOpen(true);
  };

  const handleAttachmentAccess = (attachment) => {
    if (!attachment?.url) return;
    if (isAttachmentUserLoggedIn()) {
      openAttachmentInSite(attachment);
      return;
    }
    setPendingAttachment(attachment);
    setAttachmentError('');
    setIsAttachmentModalOpen(true);
  };

  const handleAttachmentGateSubmit = (e) => {
    e.preventDefault();
    const name = String(attachmentGateForm.name || '').trim();
    const mobileDigits = String(attachmentGateForm.mobile || '').replace(/\D/g, '');

    if (name.length < 2) {
      setAttachmentError('Please enter your name.');
      return;
    }
    if (mobileDigits.length !== 10) {
      setAttachmentError('Please enter a valid 10-digit mobile number.');
      return;
    }

    const payload = { name, mobile: mobileDigits, updatedAt: Date.now() };
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(attachmentGateStorageKey, JSON.stringify(payload));
      }
    } catch {
      // ignore storage failure
    }

    setAttachmentGateForm({ name, mobile: mobileDigits });
    setAttachmentError('');
    setIsAttachmentModalOpen(false);
    if (pendingAttachment?.url) {
      openAttachmentInSite(pendingAttachment);
      setPendingAttachment(null);
    }
  };

  const buildQuoteMessage = () => {
    const lines = [];
    lines.push('Quote Request Details');
    lines.push(`Business Type: ${quoteForm.businessType}`);
    lines.push(`Company Type / Buying Role: ${quoteForm.buyingRole}`);
    lines.push(`Budget: ${quoteForm.budget}`);
    lines.push(`Timeline: ${quoteForm.timeline}`);
    lines.push(`Product Interests: ${(quoteForm.productInterests || []).join(', ')}`);
    lines.push(`Requirement: ${quoteForm.requirement}`);
    lines.push(`Preferred Contact Method: ${quoteForm.preferredContactMethod}`);
    lines.push('');
    lines.push('Address');
    lines.push(`${quoteForm.address}`);
    lines.push(`${quoteForm.city}, ${quoteForm.state}, ${quoteForm.country}`);
    lines.push('');
    lines.push('Requirement Details');
    lines.push(quoteForm.requirementDetails);
    return lines.filter(Boolean).join('\n');
  };

  const handleQuoteSubmit = async (e) => {
    e.preventDefault();
    setQuoteError('');

    // Basic required validation
    const required = [
      ['name', 'Name'],
      ['businessName', 'Business Name'],
      ['email', 'Email'],
      ['mobile', 'Mobile'],
      ['address', 'Address'],
      ['city', 'City'],
      ['state', 'State'],
      ['country', 'Country'],
      ['businessType', 'Business Type'],
      ['buyingRole', 'Company Type / Buying Role'],
      ['budget', 'Budget'],
      ['timeline', 'Timeline'],
      ['preferredContactMethod', 'Preferred Contact Method'],
      ['requirementDetails', 'Requirement Details'],
    ];
    for (const [k, label] of required) {
      const v = quoteForm[k];
      if (Array.isArray(v) ? v.length === 0 : !String(v || '').trim()) {
        setQuoteError(`${label} is required.`);
        return;
      }
    }

    if (!/^\S+@\S+\.\S+$/.test(String(quoteForm.email).trim())) {
      setQuoteError('Please enter a valid email.');
      return;
    }
    const phoneDigits = String(quoteForm.mobile).replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      setQuoteError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setQuoteSubmitting(true);
    try {
      const payload = {
        source: 'product-detail',
        userType: 'business',
        name: quoteForm.name.trim(),
        email: quoteForm.email.trim(),
        phone: quoteForm.mobile.trim(),
        company: quoteForm.businessName.trim(),
        state: quoteForm.state.trim(),
        categories: quoteForm.productInterests,
        message: buildQuoteMessage(),
        products: [
          {
            productId: productId,
            productName: product?.title || 'Product',
            quantity: 1,
          },
        ],
      };

      const res = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to send request');

      setIsQuoteModalOpen(false);
      // keep entered values for convenience; can be reset later if needed
    } catch (err) {
      setQuoteError(err?.message || 'Failed to send request.');
    } finally {
      setQuoteSubmitting(false);
    }
  };

  const renderTabContent = () => {
    if (activeTab === 'specs') {
      return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          {specGridEntries.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-3">
              {specGridEntries.map(([key, value]) => (
                <div key={key} className="space-y-0.5">
                  <div className="text-[12px] text-black/80 leading-snug">{key}</div>
                  <div className="text-[13px] text-rich-black font-semibold ">{value}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-black/30 py-10">No specifications available.</div>
          )}
        </div>
      );
    }

    if (activeTab === 'description') {
      return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-3xl">
          <div className="prose prose-base prose-p:text-black/60 prose-p:leading-relaxed prose-headings:text-black prose-strong:text-black prose-ul:text-black prose-li:text-black/60 max-w-none">
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
      );
    }

    if (activeTab === 'usage') {
      return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 text-sm text-black/60">
          <p className="mb-2 font-medium text-rich-black">Usage & Care</p>
          <p>Add usage/care instructions for this product here.</p>
        </div>
      );
    }

    if (activeTab === 'delivery') {
      return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 text-sm text-black/70 space-y-6">
          <div>
            <p className="mb-2 font-semibold text-rich-black">Delivery Timeline</p>
            <ul className="space-y-2">
              <li><span className="text-accent mr-2">✓</span><strong>Telangana:</strong> Same-day delivery available for orders placed before 2 PM</li>
              <li><span className="text-accent mr-2">✓</span><strong>Other Indian States:</strong> 3-4 business days</li>
              <li><span className="text-accent mr-2">✓</span><strong>International:</strong> 10-15 business days</li>
            </ul>
          </div>

          <div>
            <p className="mb-2 font-semibold text-rich-black">Returns &amp; Exchange</p>
            <ul className="space-y-2">
              <li><span className="text-accent mr-2">✓</span>30-day return policy for manufacturing defects</li>
              <li><span className="text-accent mr-2">✓</span>Product must be unused and in original packaging</li>
              <li><span className="text-accent mr-2">✓</span>Size exchange available within 15 days of delivery</li>
              <li><span className="text-accent mr-2">✓</span>Contact our support team to initiate returns</li>
            </ul>
          </div>

          <div>
            <p className="mb-2 font-semibold text-rich-black">Bulk Orders</p>
            <p>
              For bulk orders and custom requirements, please contact our B2B sales team.
              We offer special pricing and flexible delivery options for large quantity orders.
            </p>
          </div>
        </div>
      );
    }

    if (activeTab === 'manufacturer') {
      return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 text-sm text-black/60">
          <p className="mb-2 font-medium text-rich-black">Manufacturer</p>
          <p>Manufacturer/brand information will appear here.</p>
        </div>
      );
    }

    if (activeTab === 'why') {
      return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 text-sm text-black/60">
          <p className="mb-2 font-medium text-rich-black">Why Buy From Us</p>
          <p>Key reasons to buy from Regal Horeca will appear here.</p>
        </div>
      );
    }

    return null;
  };

  const handleShare = () => {
    if (typeof window === 'undefined') return;
    if (navigator.share) {
      const text = stripHtml(product.summary || '') || product.title;
      navigator.share({ title: product.title, text, url: window.location.href });
    }
  };

  return (
    <div className="min-h-screen bg-white animate-in font-montserrat selection:bg-royal-gold selection:text-white">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 pb-20 sm:pb-12">
        <nav className="flex text-xs uppercase tracking-widest text-black/40 mb-3 sm:mb-4" aria-label="Breadcrumb">
          <ol className="flex items-center flex-wrap gap-2">
            <li><Link href="/" className="hover:text-royal-gold transition-colors">Home</Link></li>
            <li><span className="text-black/10">/</span></li>
            {categoryPath.length > 0 ? (
              <>
                {categoryPath.map((cat, index) => {
                  const isLastCategory = index === categoryPath.length - 1;
                  return (
                  <li key={cat._id || cat.id || cat.slug || index} className="flex items-center gap-2">
                    {index > 0 && <span className="text-black/10">/</span>}
                    <Link
                      href={`/catalog?category=${cat.slug}`}
                      className={`transition-colors ${
                        isLastCategory
                          ? 'text-rich-black font-semibold'
                          : 'hover:text-royal-gold text-black/40'
                      }`}
                      aria-current={isLastCategory ? 'page' : undefined}
                    >
                      {cat.name}
                    </Link>
                  </li>
                  );
                })}
              </>
            ) : (
              <>
                <li>
                  <Link
                    href="/catalog"
                    className="text-rich-black font-semibold"
                    aria-current="page"
                  >
                    Products
                  </Link>
                </li>
              </>
            )}
          </ol>
        </nav>

        <div className="lg:grid lg:grid-cols-12 lg:gap-x-6 xl:gap-x-8">
          <div className="lg:col-span-6 mb-4 lg:mb-0">
            {/* Keep entire hero/gallery block fixed at top while right side scrolls */}
            <div className="sticky top-0">
              <ProductGallery
                images={allImages}
                title={product.title}
                isPremium={product.isPremium}
                featured={product.featured}
                isLiked={isLiked}
                onToggleWishlist={handleWishlistToggle}
                onShare={handleShare}
              />
            </div>
          </div>

          {/* Right column scrolls normally while left image stays sticky */}
          <div className="lg:col-span-6 flex flex-col h-full lg:-mt-14">
            <div className="animate-in slide-in-from-right-8 duration-700 delay-100">
              {product.brand && (
                <div className="mb-4">
                  <span className="inline-flex items-center px-3 py-1 border border-black rounded-full text-[11px] font-bold text-black bg-white">
                    {product.brand}
                  </span>
                </div>
              )}

              <h1 className="mb-2">
                <span className="block font-sans text-xl sm:text-xl lg:text-[32px] font-semibold leading-tight tracking-tight" style={{ color: '#1C273C' }}>
                  {primaryTitle || product.title}
                </span>
                {secondaryTitle && (
               <></>
                )}
              </h1>

              <div className="flex flex-wrap items-center gap-x-2 text-sm text-[#5F748D] mb-4">
                {product.sku && <span>SKU: {product.sku}</span>}
                {product.sku && product.barcode && <span className="text-[#D7DCE1]">|</span>}
                {product.barcode && <span>Barcode: {product.barcode}</span>}
                {(product.sku || product.barcode) && <span className="text-[#D7DCE1]">|</span>}
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor:
                        product.status === 'In Stock'
                          ? '#4CAF50'
                          : product.status === 'Pre-Order'
                            ? '#FF9800'
                            : '#9E9E9E',
                    }}
                    aria-hidden
                  />
                  {product.status === 'In Stock'
                    ? 'Usually Available'
                    : product.status === 'Pre-Order'
                      ? 'Pre-Order'
                      : product.status || 'Usually Available'}
                </span>
              </div>

              <hr className="border-0 h-px bg-[#D7DCE1] mb-6" />

              {/* Price section + Blog | Testimonials | FAQ */}
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
                <div>
                  <p className="text-[10px] sm:text-xs uppercase tracking-widest text-black/50 mb-1">
                    Starting from
                  </p>
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-xl sm:text-2xl font-bold text-accent">
                      {isPriceOnRequest ? 'Price on request' : `${formatPrice(product.price)}/kg`}
                    </span>
                    {!isPriceOnRequest && product.price != null && product.price > 0 && (
                      <span className="text-sm text-[#5F748D]">
                        ≈ ${(product.price / 84).toFixed(1)}/kg
                      </span>
                    )}
                  </div>
                  {/* {product.summary && (
                    <p className="text-sm text-[#5F748D] mt-1.5">
                      {stripHtml(product.summary).slice(0, 60)}
                      {(stripHtml(product.summary).length > 60) ? '…' : ''}
                    </p>
                  )}
                  {!product.summary && !isPriceOnRequest && (
                    <p className="text-sm text-[#5F748D] mt-1.5">
                      Suitable for banquets (80-100 plates)
                    </p>
                  )} */}
                </div>
                <div className="flex items-center gap-x-2 text-xs sm:text-sm text-accent flex-shrink-0 flex-wrap">
                  {product?.blogUrl ? (
                    <a
                      href={product.blogUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline"
                    >
                      Blog
                    </a>
                  ) : null}
                  {testimonials.length > 0 && (
                    <>
                      {product?.blogUrl ? <span className="text-[#D7DCE1]">|</span> : null}
                      <a href="#product-testimonials" className="hover:underline">
                        Testimonials
                      </a>
                    </>
                  )}
                  {product?.faqs?.length > 0 && (
                    <>
                      {(product?.blogUrl || testimonials.length > 0) ? <span className="text-[#D7DCE1]">|</span> : null}
                      <a href="#product-faq" className="hover:underline">
                        FAQ
                      </a>
                    </>
                  )}
                </div>
              </div>

              {/* Product description - right below price with a little gap */}
              {(product.description || product.summary) && (
                <div className="mt-5 mb-8">
                  <div className="text-sm sm:text-base text-[#5F748D] leading-relaxed">
                    {product.description ? (
                      isHtml(product.description) ? (
                        <div
                          className="product-description-html prose prose-sm max-w-none prose-p:text-[#5F748D] prose-p:my-2"
                          dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(product.description, {
                              ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a'],
                              ALLOWED_ATTR: ['href'],
                            }),
                          }}
                        />
                      ) : (
                        <div className="prose prose-sm max-w-none prose-p:text-[#5F748D] prose-p:my-2">
                          <ReactMarkdown>{product.description}</ReactMarkdown>
                        </div>
                      )
                    ) : (
                      <p>{stripHtml(product.summary || '')}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Colour (left) + Attachments (right) - one row below description, aligned */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8 items-start">
                <div className="flex flex-col">
                  <p className="text-md font-bold text-rich-black  t mb-2 min-h-[1.25rem] flex items-center">
                    Colour: <span className="font-normal normal-case text-black/60 ml-0.5">{selectedColor ? selectedColor.colorName : '—'}</span>
                  </p>
                  {product.colorVariants && product.colorVariants.length > 0 ? (
                    <div className="flex flex-wrap gap-2 items-center min-h-[2.5rem]">
                      {product.colorVariants.map((variant, index) => (
                        <button
                          key={index}
                          onClick={() => handleColorSelect(variant)}
                          className={`group relative w-9 h-9 rounded-[10px] border transition-all duration-300 flex-shrink-0 ${
                            selectedColor?.colorName === variant.colorName
                              ? 'border-accent ring-1 ring-accent/40 bg-accent/5'
                              : 'border-black/10 hover:border-accent hover:bg-accent/5'
                          }`}
                          title={`${variant.colorName}${variant.isDefault ? ' (Default)' : ''}`}
                        >
                          <span
                            className="absolute inset-0 rounded-[10px] shadow-sm border border-black/5"
                            style={{ backgroundColor: variant.colorHex }}
                          />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="min-h-[2.5rem] flex items-center">
                      <p className="text-sm text-black/50">—</p>
                    </div>
                  )}
                </div>
                {(product.sizeChartUrl || product.brochureUrl) ? (
                  <div className="flex flex-col">
                    <p className="text-md font-bold text-rich-black   mb-2 min-h-[1.25rem] flex items-center">
                      Attachments
                    </p>
                    <div className="flex flex-wrap gap-3 items-center min-h-[2.5rem]">
                      {product.sizeChartUrl ? (
                        <button
                          type="button"
                          onClick={() => handleAttachmentAccess({ url: product.sizeChartUrl, label: 'Size Chart' })}
                          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold border border-black/10 rounded-md bg-white hover:border-accent hover:text-accent transition-colors"
                        >
                          <FileText size={16} className="flex-shrink-0" />
                          Size Chart
                        </button>
                      ) : null}
                      {product.brochureUrl ? (
                        <button
                          type="button"
                          onClick={() => handleAttachmentAccess({ url: product.brochureUrl, label: 'Brochure' })}
                          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold border border-black/10 rounded-md bg-white hover:border-accent hover:text-accent transition-colors"
                        >
                          <Download size={16} className="flex-shrink-0" />
                          Brochure
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  // keep 2-column grid aligned when attachments missing (desktop/tablet)
                  <div className="hidden sm:block" />
                )}
              </div>

              {/* Sizes - full width right below Colour + Attachments */}
              {product.availableSizes && product.availableSizes.trim() && (() => {
                const sizes = product.availableSizes.split(',').map(s => s.trim()).filter(Boolean);
                if (sizes.length === 0) return null;
                return (
                  <div className="mb-8">
                    <label className="block text-sm font-bold text-rich-black  mb-2">
                      Size
                    </label>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                      {sizes.map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setSelectedSize(size)}
                          className={`px-3 py-2 text-xs font-semibold rounded-md border transition-colors ${
                            selectedSize === size
                              ? 'bg-accent text-white border-accent'
                              : 'bg-white text-black/70 border-black/10 hover:border-accent hover:text-accent'
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Moving delivery banner directly below Sizes */}
              <div className="mb-8 -mx-4 sm:mx-0">
                <div className="relative overflow-hidden rounded-lg bg-[#F6F7F9] shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
                  <div className="py-3 sm:py-2.5 px-4 sm:px-4">
                    <div className="flex items-center gap-10 whitespace-nowrap banner-track">
                      <div className="inline-flex items-center gap-2.5 text-sm sm:text-sm font-medium text-black/70">
                        <Truck size={18} className="text-accent flex-shrink-0" />
                        <span>
                          <span className="font-semibold">Telangana:</span> Same-day delivery
                        </span>
                      </div>
                      <span className="mx-1 text-black/20" aria-hidden>|</span>
                      <div className="inline-flex items-center gap-2.5 text-sm sm:text-sm font-medium text-black/70">
                        <Truck size={18} className="text-accent flex-shrink-0" />
                        <span>
                          <span className="font-semibold">Other states:</span> 3–4 days
                        </span>
                      </div>
                      <span className="mx-1 text-black/20" aria-hidden>|</span>
                      <div className="inline-flex items-center gap-2.5 text-sm sm:text-sm font-medium text-black/70">
                        <Globe2 size={18} className="text-accent flex-shrink-0" />
                        <span>
                          <span className="font-semibold">International:</span> 10–15 days
                        </span>
                      </div>
                      {/* Duplicate set for seamless loop */}
                      <span className="mx-1 text-black/20" aria-hidden>|</span>
                      <div className="inline-flex items-center gap-2.5 text-sm sm:text-sm font-medium text-black/70">
                        <Truck size={18} className="text-accent flex-shrink-0" />
                        <span>
                          <span className="font-semibold">Telangana:</span> Same-day delivery
                        </span>
                      </div>
                      <span className="mx-1 text-black/20" aria-hidden>|</span>
                      <div className="inline-flex items-center gap-2.5 text-sm sm:text-sm font-medium text-black/70">
                        <Truck size={18} className="text-accent flex-shrink-0" />
                        <span>
                          <span className="font-semibold">Other states:</span> 3–4 days
                        </span>
                      </div>
                      <span className="mx-1 text-black/20" aria-hidden>|</span>
                      <div className="inline-flex items-center gap-2.5 text-sm sm:text-sm font-medium text-black/70">
                        <Globe2 size={18} className="text-accent flex-shrink-0" />
                        <span>
                          <span className="font-semibold">International:</span> 10–15 days
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Primary CTAs (desktop/tablet) */}
              <div className="hidden sm:block">
                <div className="flex flex-row w-full gap-3">
                  <button
                    type="button"
                    onClick={handleContactNow}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold bg-accent text-white shadow-sm hover:bg-[#d5153d] transition-colors rounded-lg flex-1"
                  >
                    <MessageCircle size={18} className="text-white" />
                    <span>Contact Now</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleAddToQuote}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold border border-black/10 bg-white text-rich-black hover:border-accent hover:text-accent transition-colors rounded-lg flex-1"
                  >
                    <FileText size={18} className="text-black" />
                    <span>
                      {isInCart(productId, selectedColor || null) ? 'Remove from Quote' : 'Add to Quote'}
                    </span>
                  </button>
                </div>
              </div>

              <style jsx>{`
                .banner-track {
                  display: inline-flex;
                  animation: regal-banner-marquee 24s linear infinite;
                }

                @keyframes regal-banner-marquee {
                  0% {
                    transform: translateX(0);
                  }
                  100% {
                    transform: translateX(-50%);
                  }
                }
              `}</style>

            </div>
          </div>
        </div>

        <div className="mt-4   sm:mt-6 w-full">
          {/* Tabs bar (like reference image) */}
          <div className="bg-white border-y border-black/20 sm:border-black/10 rounded-none overflow-hidden">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 w-full">
              {tabs.map(({ id, label, Icon }) => {
                const isActive = activeTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleTabClick(id)}
                    className={`flex flex-col items-center justify-center m-1 border-r-2 border-black/10 gap-2   px-3 py-6 sm:py-4 text-sm sm:text-xs font-bold text-center leading-tight min-h-[104px] sm:min-h-[64px] transition-colors last:border-r-0 w-full ${
                      isActive ? 'bg-accent/90 text-white' : 'bg-white text-black/80 hover:text-black hover:bg-black/[0.02]'
                    }`}
                  >
                    <Icon size={24} className={isActive ? 'text-white' : 'text-accent'} />
                    <span className="whitespace-nowrap">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div className="bg-white mt-0  border-b border-black/10 rounded-none p-4 sm:p-6 hidden sm:block">
            {renderTabContent()}
          </div>

          {/* Mobile bottom sheet */}
          <div className={`sm:hidden fixed inset-0 z-50 ${isMobileSheetOpen ? '' : 'pointer-events-none'}`}>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setIsMobileSheetOpen(false)}
              className={`absolute inset-0 bg-black/30 transition-opacity duration-300 ${
                isMobileSheetOpen ? 'opacity-100' : 'opacity-0'
              }`}
            />

            <div
              className={`absolute left-0 right-0 bottom-0 bg-white rounded-t-2xl shadow-[0_-10px_30px_rgba(0,0,0,0.18)] transition-transform duration-300 ease-out ${
                isMobileSheetOpen ? 'translate-y-0' : 'translate-y-full'
              }`}
            >
              <div className="flex items-center justify-between px-4 py-4 border-b border-black/10">
                <div className="flex items-center gap-2">
                  {activeTabMeta?.Icon ? (
                    <activeTabMeta.Icon size={18} className="text-accent" />
                  ) : null}
                  <div className="text-base font-semibold text-rich-black">
                    {activeTabMeta?.label || 'Details'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileSheetOpen(false)}
                  className="w-9 h-9 inline-flex items-center justify-center rounded-md border border-black/10 bg-white"
                  aria-label="Close panel"
                >
                  <X size={18} className="text-black/60" />
                </button>
              </div>

              <div className="px-4 py-5 max-h-[70vh] overflow-auto">
                {renderTabContent()}
              </div>
            </div>
          </div>
        </div>

        {/* Desktop-only quote banner (below specifications) */}
        <div className="hidden sm:block mt-6">
          <div className="w-full border-y border-black/10 py-4">
            <div className="w-full bg-[#F6F7F9] rounded-xl px-6 py-5 flex items-center justify-between gap-6">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                  <FileText size={20} className="text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-black/50 mb-0.5">Have a large list of items?</p>
                  <p className="text-sm sm:text-base font-semibold text-rich-black truncate">
                    Get a personalized quote just for you.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={openQuoteModal}
                className="inline-flex items-center justify-center px-6 h-10 rounded-lg bg-accent text-white text-sm font-semibold shadow-sm hover:bg-[#d5153d] transition-colors flex-shrink-0"
              >
                Request a Quote
              </button>
            </div>
          </div>
        </div>

        {/* Mobile quote banner */}
        <div className="sm:hidden mt-6">
          <div className="w-full border-y border-black/10 py-2.5">
            <div className="w-full bg-[#F6F7F9] rounded-lg px-3 py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                  <FileText size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-black/50 leading-none mb-1">Have a large list of items?</p>
                  <p className="text-[12px] leading-[1.25] font-semibold text-rich-black">
                    Get a personalized quote just for you.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={openQuoteModal}
                className="inline-flex items-center justify-center px-3 h-8 rounded-md bg-accent text-white text-[10px] font-semibold shadow-sm hover:bg-[#d5153d] transition-colors flex-shrink-0"
              >
                Request a Quote
              </button>
            </div>
          </div>
        </div>

        {frequentlyOrderedProducts.length > 0 && (
          <div className="mt-5 pt-4 border-b border-black/10 pb-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base sm:text-lg font-semibold text-rich-black uppercase tracking-widest">
                Frequently Ordered Together
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
              {frequentlyOrderedProducts.map((p) => (
                <ProductCard key={p._id || p.id} product={p} compact />
              ))}
            </div>
          </div>
        )}

        {relatedProducts.length > 0 && (
          <div className="mt-5 pt-4 border-b border-black/10 pb-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base sm:text-lg font-semibold text-rich-black uppercase tracking-widest">
                Related Products
              </h2>
              <Link
                href="/catalog"
                className="hidden sm:block text-xs font-bold uppercase tracking-widest text-royal-gold hover:text-accent transition-colors"
              >
                View Full Collection
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
              {relatedProducts.map((relatedProduct) => (
                <ProductCard key={relatedProduct._id || relatedProduct.id} product={relatedProduct} compact />
              ))}
            </div>
            <div className="mt-8 text-center sm:hidden">
              <Link
                href="/catalog"
                className="text-xs font-bold uppercase tracking-widest text-royal-gold hover:text-accent transition-colors border-b border-royal-gold/20 pb-1"
              >
                View Full Collection
              </Link>
            </div>
          </div>
        )}

        {/* Desktop quote modal */}
        <div className={`hidden sm:block fixed inset-0 z-50 ${isQuoteModalOpen ? '' : 'pointer-events-none'}`}>
          <button
            type="button"
            aria-label="Close"
            onClick={closeQuoteModal}
            className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${
              isQuoteModalOpen ? 'opacity-100' : 'opacity-0'
            }`}
          />

          <div
            className={`absolute left-1/2 top-1/2 w-[min(700px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 transition-all duration-200 ${
              isQuoteModalOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.98]'
            }`}
            role="dialog"
            aria-modal="true"
            aria-label="Request a Quote"
          >
            <div className="bg-white rounded-xl border border-black/10 shadow-[0_20px_70px_rgba(0,0,0,0.25)] overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-black/10">
                <div className="text-lg font-semibold text-rich-black">Request a Quote</div>
                <button
                  type="button"
                  onClick={closeQuoteModal}
                  className="w-10 h-10 inline-flex items-center justify-center rounded-md hover:bg-black/[0.03] transition-colors"
                  aria-label="Close modal"
                >
                  <X size={18} className="text-black/50" />
                </button>
              </div>

              <form onSubmit={handleQuoteSubmit}>
                <div className="px-6 py-5 max-h-[70vh] overflow-auto">
                  {quoteError && (
                    <div className="mb-4 border border-red-200 bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3">
                      {quoteError}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-1">
                      <label className="block text-sm font-semibold text-black/70 mb-1">
                        Name <span className="text-accent">*</span>
                      </label>
                      <input
                        value={quoteForm.name}
                        onChange={(e) => updateQuoteField('name', e.target.value)}
                        placeholder="Your name"
                        className="w-full h-10 px-3 rounded-lg border border-black/10 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-sm font-semibold text-black/70 mb-1">
                        Business Name <span className="text-accent">*</span>
                      </label>
                      <input
                        value={quoteForm.businessName}
                        onChange={(e) => updateQuoteField('businessName', e.target.value)}
                        placeholder="Business name"
                        className="w-full h-10 px-3 rounded-lg border border-black/10 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                      />
                    </div>

                    <div className="col-span-1">
                      <label className="block text-sm font-semibold text-black/70 mb-1">
                        Email <span className="text-accent">*</span>
                      </label>
                      <input
                        value={quoteForm.email}
                        onChange={(e) => updateQuoteField('email', e.target.value)}
                        placeholder="your@email.com"
                        className="w-full h-10 px-3 rounded-lg border border-black/10 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-sm font-semibold text-black/70 mb-1">
                        Mobile <span className="text-accent">*</span>
                      </label>
                      <input
                        value={quoteForm.mobile}
                        onChange={(e) => updateQuoteField('mobile', e.target.value)}
                        placeholder="10-digit mobile"
                        className="w-full h-10 px-3 rounded-lg border border-black/10 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-sm font-semibold text-black/70 mb-1">
                        Address <span className="text-accent">*</span>
                      </label>
                      <input
                        value={quoteForm.address}
                        onChange={(e) => updateQuoteField('address', e.target.value)}
                        placeholder="Complete business address"
                        className="w-full h-10 px-3 rounded-lg border border-black/10 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                      />
                    </div>

                    <div className="col-span-2">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-black/70 mb-1">
                            Country <span className="text-accent">*</span>
                          </label>
                          <input
                            value={quoteForm.country}
                            onChange={(e) => updateQuoteField('country', e.target.value)}
                            placeholder="Country"
                            className="w-full h-10 px-3 rounded-lg border border-black/10 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-black/70 mb-1">
                            State <span className="text-accent">*</span>
                          </label>
                          <input
                            value={quoteForm.state}
                            onChange={(e) => updateQuoteField('state', e.target.value)}
                            placeholder="State"
                            className="w-full h-10 px-3 rounded-lg border border-black/10 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-black/70 mb-1">
                            City <span className="text-accent">*</span>
                          </label>
                          <input
                            value={quoteForm.city}
                            onChange={(e) => updateQuoteField('city', e.target.value)}
                            placeholder="City"
                            className="w-full h-10 px-3 rounded-lg border border-black/10 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="col-span-2 mt-2">
                      <label className="block text-sm font-semibold text-black/70 mb-2">
                        Business Type <span className="text-accent">*</span>
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { label: 'Hotels', Icon: Hotel },
                          { label: 'Restaurants', Icon: UtensilsCrossed },
                          { label: 'Caterers', Icon: ChefHat },
                          { label: 'Banquets', Icon: Users },
                          { label: 'QSR', Icon: Store },
                          { label: 'Cafes', Icon: Coffee },
                          { label: 'Bakery', Icon: CakeSlice },
                          { label: 'Bars', Icon: Wine },
                        ].map(({ label, Icon }) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => updateQuoteField('businessType', label)}
                            className={`h-[74px] rounded-lg border text-xs font-semibold transition-colors flex flex-col items-center justify-center gap-1 ${
                              quoteForm.businessType === label
                                ? 'border-accent bg-accent/5 text-accent'
                                : 'border-black/10 bg-white text-black/60 hover:border-black/20'
                            }`}
                          >
                            <Icon size={20} className={quoteForm.businessType === label ? 'text-accent' : 'text-black/60'} />
                            <span>{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="col-span-2 mt-2 grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-black/70 mb-1">
                          Company Type / Buying Role <span className="text-accent">*</span>
                        </label>
                        <select
                          value={quoteForm.buyingRole}
                          onChange={(e) => updateQuoteField('buyingRole', e.target.value)}
                          className="w-full h-10 px-3 rounded-lg border border-black/10 bg-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm"
                        >
                          <option value="">Select your role</option>
                          <option>Owner</option>
                          <option>Procurement</option>
                          <option>Chef</option>
                          <option>Manager</option>
                          <option>Distributor</option>
                          <option>Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-black/70 mb-1">
                          Budget <span className="text-accent">*</span>
                        </label>
                        <select
                          value={quoteForm.budget}
                          onChange={(e) => updateQuoteField('budget', e.target.value)}
                          className="w-full h-10 px-3 rounded-lg border border-black/10 bg-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm"
                        >
                          <option value="">Select budget</option>
                          <option>Under ₹50k</option>
                          <option>₹50k–₹2L</option>
                          <option>₹2L–₹10L</option>
                          <option>₹10L+</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-black/70 mb-1">
                          Timeline <span className="text-accent">*</span>
                        </label>
                        <select
                          value={quoteForm.timeline}
                          onChange={(e) => updateQuoteField('timeline', e.target.value)}
                          className="w-full h-10 px-3 rounded-lg border border-black/10 bg-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm"
                        >
                          <option value="">Select timeline</option>
                          <option>Immediately</option>
                          <option>1–2 weeks</option>
                          <option>1 month</option>
                          <option>2–3 months</option>
                          <option>Not sure</option>
                        </select>
                      </div>
                    </div>

                    <div className="col-span-2 mt-2">
                      <label className="block text-sm font-semibold text-black/70 mb-2">
                        Product Interests <span className="text-accent">*</span>
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { label: 'Cookware', Icon: Soup },
                          { label: 'Tableware', Icon: Utensils },
                          { label: 'Buffetware', Icon: Boxes },
                          { label: 'Cleaning', Icon: Sparkles },
                          { label: 'Glassware', Icon: GlassWater },
                          { label: 'Kitchen Equipment', Icon: CookingPot },
                          { label: 'Full Setup', Icon: LayoutGrid },
                        ].map(({ label, Icon }) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => toggleQuoteMulti('productInterests', label)}
                            className={`h-[74px] rounded-lg border text-xs font-semibold transition-colors flex flex-col items-center justify-center gap-1 ${
                              quoteForm.productInterests.includes(label)
                                ? 'border-accent bg-accent/5 text-accent'
                                : 'border-black/10 bg-white text-black/60 hover:border-black/20'
                            }`}
                          >
                            <Icon size={20} className={quoteForm.productInterests.includes(label) ? 'text-accent' : 'text-black/60'} />
                            <span>{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="col-span-2 mt-2">
                      <label className="block text-base font-semibold text-black/70 mb-2">
                        Requirement <span className="text-accent">*</span>
                      </label>
                      <div className="flex items-center gap-6">
                        {['New Setup', 'Refill Current Setup'].map((v) => (
                          <label key={v} className="inline-flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="radio"
                              name="quote-requirement"
                              value={v}
                              checked={quoteForm.requirement === v}
                              onChange={() => updateQuoteField('requirement', v)}
                              className="accent-accent"
                            />
                            <span className="text-sm font-medium text-rich-black">{v}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="col-span-2 mt-2">
                      <label className="block text-base font-semibold text-black/70 mb-2">
                        Preferred Contact Method <span className="text-accent">*</span>
                      </label>
                      <div className="flex items-center gap-6">
                        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="radio"
                            name="quote-contact"
                            value="Call"
                            checked={quoteForm.preferredContactMethod === 'Call'}
                            onChange={() => updateQuoteField('preferredContactMethod', 'Call')}
                            className="accent-accent"
                          />
                          <Phone size={16} className="text-black/70" />
                          <span className="text-sm font-medium text-rich-black">Call</span>
                        </label>
                        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="radio"
                            name="quote-contact"
                            value="WhatsApp"
                            checked={quoteForm.preferredContactMethod === 'WhatsApp'}
                            onChange={() => updateQuoteField('preferredContactMethod', 'WhatsApp')}
                            className="accent-accent"
                          />
                          <MessageCircle size={16} className="text-black/70" />
                          <span className="text-sm font-medium text-rich-black">WhatsApp</span>
                        </label>
                        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="radio"
                            name="quote-contact"
                            value="Email"
                            checked={quoteForm.preferredContactMethod === 'Email'}
                            onChange={() => updateQuoteField('preferredContactMethod', 'Email')}
                            className="accent-accent"
                          />
                          <Mail size={16} className="text-black/70" />
                          <span className="text-sm font-medium text-rich-black">Email</span>
                        </label>
                      </div>
                    </div>

                    <div className="col-span-2 mt-2">
                      <label className="block text-sm font-semibold text-black/70 mb-1">
                        Requirement Details <span className="text-accent">*</span>
                      </label>
                      <textarea
                        value={quoteForm.requirementDetails}
                        onChange={(e) => updateQuoteField('requirementDetails', e.target.value)}
                        placeholder="Tell us what you need..."
                        rows={5}
                        className="w-full px-3 py-2 rounded-lg border border-black/10 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-black/10 bg-white">
                  <div className="flex items-center justify-end gap-4">
                    <button
                      type="button"
                      onClick={closeQuoteModal}
                      className="h-11 px-8 rounded-lg border border-black/10 bg-white text-rich-black font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={quoteSubmitting}
                      className="h-11 px-10 rounded-lg bg-accent text-white font-semibold shadow-sm hover:bg-[#d5153d] disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {quoteSubmitting ? 'Sending…' : 'Send Request'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Attachment access modal */}
        <div className={`fixed inset-0 z-50 ${isAttachmentModalOpen ? '' : 'pointer-events-none'}`}>
          <button
            type="button"
            aria-label="Close"
            onClick={closeAttachmentModal}
            className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${
              isAttachmentModalOpen ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <div
            className={`absolute left-1/2 top-1/2 w-[min(520px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 transition-all duration-200 ${
              isAttachmentModalOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.98]'
            }`}
            role="dialog"
            aria-modal="true"
            aria-label="Download Attachment"
          >
            <div className="bg-white rounded-xl border border-black/10 shadow-[0_20px_70px_rgba(0,0,0,0.25)] overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-black/10">
                <div className="text-2xl font-semibold text-rich-black">Download Attachment</div>
                <button
                  type="button"
                  onClick={closeAttachmentModal}
                  className="w-10 h-10 inline-flex items-center justify-center rounded-md hover:bg-black/[0.03] transition-colors"
                  aria-label="Close modal"
                >
                  <X size={18} className="text-black/50" />
                </button>
              </div>

              <form onSubmit={handleAttachmentGateSubmit}>
                <div className="px-6 py-5">
                  {attachmentError ? (
                    <div className="mb-4 border border-red-200 bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3">
                      {attachmentError}
                    </div>
                  ) : null}

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-black/70 mb-1">
                        Name <span className="text-accent">*</span>
                      </label>
                      <input
                        value={attachmentGateForm.name}
                        onChange={(e) => setAttachmentGateForm((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter your name"
                        className="w-full h-11 px-3 rounded-lg border border-black/10 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-black/70 mb-1">
                        Mobile Number <span className="text-accent">*</span>
                      </label>
                      <div className="grid grid-cols-[84px_1fr] gap-2">
                        <select
                          className="h-11 px-2 rounded-lg border border-black/10 bg-white"
                          defaultValue="+91"
                          aria-label="Country code"
                        >
                          <option value="+91">+91</option>
                        </select>
                        <input
                          value={attachmentGateForm.mobile}
                          onChange={(e) => setAttachmentGateForm((prev) => ({ ...prev, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                          placeholder="1234567890"
                          className="w-full h-11 px-3 rounded-lg border border-black/10 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                        />
                      </div>
                      <p className="mt-1 text-xs text-black/45">Enter 10-digit mobile number</p>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-black/10 bg-white">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={closeAttachmentModal}
                      className="h-11 rounded-lg border border-black/10 bg-white text-rich-black font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="h-11 rounded-lg bg-accent text-white font-semibold shadow-sm hover:bg-[#d5153d]"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Attachment viewer popup */}
        <div className={`fixed inset-0 z-[60] ${isAttachmentViewerOpen ? '' : 'pointer-events-none'}`}>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setIsAttachmentViewerOpen(false)}
            className={`absolute inset-0 bg-black/45 transition-opacity duration-200 ${
              isAttachmentViewerOpen ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <div
            className={`absolute left-1/2 top-1/2 w-[min(1100px,calc(100vw-28px))] h-[min(88vh,900px)] -translate-x-1/2 -translate-y-1/2 transition-all duration-200 ${
              isAttachmentViewerOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.98]'
            }`}
            role="dialog"
            aria-modal="true"
            aria-label={activeAttachment?.label || 'Attachment'}
          >
            <div className="bg-white rounded-xl border border-black/10 shadow-[0_20px_70px_rgba(0,0,0,0.25)] overflow-hidden h-full flex flex-col">
              <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-black/10">
                <div className="text-base sm:text-lg font-semibold text-rich-black">
                  {activeAttachment?.label || 'Attachment'}
                </div>
                <div className="flex items-center gap-2">
                  {activeAttachment?.proxyDownloadSrc ? (
                    <a
                      href={activeAttachment.proxyDownloadSrc}
                      download
                      className="inline-flex items-center gap-2 px-3 sm:px-4 h-9 rounded-lg border border-black/10 bg-white text-xs sm:text-sm font-semibold text-rich-black hover:border-accent hover:text-accent transition-colors"
                    >
                      <Download size={16} />
                      Download
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setIsAttachmentViewerOpen(false)}
                    className="w-9 h-9 inline-flex items-center justify-center rounded-md hover:bg-black/[0.03] transition-colors"
                    aria-label="Close modal"
                  >
                    <X size={18} className="text-black/50" />
                  </button>
                </div>
              </div>

              <div className="flex-1 bg-[#f5f5f5]">
                {!activeAttachment?.proxySrc ? (
                  <div className="h-full flex items-center justify-center text-black/50 text-sm">
                    Attachment not found.
                  </div>
                ) : activeAttachment.isPdf ? (
                  <iframe
                    src={activeAttachment.proxySrc}
                    title={activeAttachment.label || 'Attachment'}
                    className="w-full h-full"
                  />
                ) : activeAttachment.isImage ? (
                  <div className="w-full h-full flex items-center justify-center p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={activeAttachment.proxySrc}
                      alt={activeAttachment.label || 'Attachment'}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center gap-4 px-6 text-center">
                    <p className="text-black/60 text-sm">Preview not available for this file type.</p>
                    <a
                      href={activeAttachment.proxySrc}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 h-10 rounded-lg border border-black/10 bg-white text-sm font-semibold text-rich-black hover:border-accent hover:text-accent transition-colors"
                    >
                      Open File
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* FAQs (per-product, reusable) */}
        {product?.faqs?.length > 0 && (
          <div id="product-faq" className="mt-10 scroll-mt-28">
            <FaqAccordion faqs={product.faqs} />
          </div>
        )}

        {/* Detail photos (exactly 3) shown below FAQs */}
        {Array.isArray(product?.detailPhotos) && product.detailPhotos.length === 3 && (
          <div className="mt-8">
            {/* Mobile carousel */}
            <div className="sm:hidden">
              <div className="relative overflow-hidden rounded-xl bg-black/5">
                <div
                  className="flex transition-transform duration-700 ease-out"
                  style={{ transform: `translateX(-${activeDetailPhotoIndex * 100}%)` }}
                >
                  {product.detailPhotos.map((src, idx) => (
                    <div
                      key={`${src}-${idx}`}
                      className="w-full flex-shrink-0"
                    >
                      <div className="relative w-full aspect-[9/16] overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt={`${product.title} detail ${idx + 1}`}
                          className="w-full h-full object-cover"
                          loading={idx === activeDetailPhotoIndex ? 'eager' : 'lazy'}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Dots */}
                <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-2">
                  {product.detailPhotos.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveDetailPhotoIndex(idx)}
                      aria-label={`Show image ${idx + 1}`}
                      className={`h-2 w-2 rounded-full transition-colors ${
                        idx === activeDetailPhotoIndex ? 'bg-accent' : 'bg-white/70'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Desktop grid */}
            <div className="hidden sm:grid grid-cols-3 gap-4">
              {product.detailPhotos.map((src, idx) => (
                <div
                  key={`${src}-${idx}`}
                  className="relative w-full aspect-[9/16] overflow-hidden rounded-xl bg-black/5"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`${product.title} detail ${idx + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Testimonials */}
        {testimonials.length > 0 && (
          <div
            id="product-testimonials"
            className="mt-10 border-t border-black/10 pt-6 scroll-mt-28"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-2xl font-semibold text-rich-black">
                  What Makes <span className="text-accent">Regal</span> Reliable?
                </h3>
                <p className="text-sm text-black/50 mt-1">
                  Hear from the businesses that rely on Regal for dependable quality, supply, and service.
                </p>
              </div>
              <span className="text-sm text-black/40">
                {activeTestimonialIndex + 1} of {testimonials.length}
              </span>
            </div>

            <div className="relative w-full">
              {testimonials.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveTestimonialIndex((prev) =>
                        prev === 0 ? testimonials.length - 1 : prev - 1
                      )
                    }
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white border border-black/10 shadow-sm inline-flex items-center justify-center z-10"
                    aria-label="Previous testimonial"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveTestimonialIndex((prev) => (prev + 1) % testimonials.length)
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white border border-black/10 shadow-sm inline-flex items-center justify-center z-10"
                    aria-label="Next testimonial"
                  >
                    <ChevronRight size={16} />
                  </button>
                </>
              )}

              <div className="bg-black rounded-xl text-white p-6 sm:p-8 min-h-[150px] flex items-center justify-between gap-6">
                <div className="flex-1">
                  <p className="text-lg leading-relaxed">"{testimonials[activeTestimonialIndex].quote}"</p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <div className="font-semibold text-xl">
                      {testimonials[activeTestimonialIndex].authorName || testimonials[activeTestimonialIndex].companyName}
                    </div>
                    {testimonials[activeTestimonialIndex].authorRole && (
                      <div className="text-white/70 text-sm">{testimonials[activeTestimonialIndex].authorRole}</div>
                    )}
                  </div>
                  {testimonials[activeTestimonialIndex].companyLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={testimonials[activeTestimonialIndex].companyLogo}
                      alt={testimonials[activeTestimonialIndex].companyName || 'Company logo'}
                      className="w-20 h-20 rounded-full object-cover border border-white/20 bg-white"
                    />
                  ) : null}
                </div>
              </div>
            </div>

            {testimonials.length > 1 && (
              <div className="mt-4 flex items-center justify-center gap-2">
                {testimonials.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveTestimonialIndex(idx)}
                    className={`h-2.5 w-2.5 rounded-full transition-colors ${
                      idx === activeTestimonialIndex ? 'bg-accent' : 'bg-black/20'
                    }`}
                    aria-label={`Go to testimonial ${idx + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Mobile fixed bottom actions */}
        <div className="sm:hidden fixed inset-x-0 bottom-0 z-40 bg-white/95 backdrop-blur border-t border-black/10">
          <div className="max-w-7xl mx-auto px-4 py-2">
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
              <button
                type="button"
                onClick={handleContactNow}
                className="inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-accent text-white text-xs font-semibold shadow-sm"
              >
                <MessageCircle size={16} className="text-white" />
                Contact
              </button>
              <button
                type="button"
                onClick={handleAddToQuote}
                className="inline-flex items-center justify-center gap-2 h-10 rounded-lg border border-black/10 bg-white text-rich-black text-xs font-semibold"
              >
                <FileText size={16} className="text-black/70" />
                {isInCart(productId, selectedColor || null) ? 'Remove from Quote' : 'Add to Quote'}
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="inline-flex items-center justify-center h-10 w-10 rounded-lg border border-black/10 bg-white text-rich-black"
                aria-label="Share"
              >
                <Share2 size={16} className="text-black/70" />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
