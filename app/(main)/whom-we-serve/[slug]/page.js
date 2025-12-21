/**
 * Dynamic Whom We Serve Category Page
 * 
 * Displays category-specific content matching the SHAPES design
 */

'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from "next/image";
import Link from "next/link";
import { WhatsAppIcon, ChevronDownIcon } from '@/components/Icons';
import { useAppContext } from '@/context/AppContext';
import { getWhatsAppBusinessLink } from '@/lib/utils/whatsapp';
import toast from 'react-hot-toast';

// Category-specific content data
const categoryData = {
  hotels: {
    title: "Shapes for Hotels",
    subtitle: "Elevating Hospitality Excellence One Experience at a Time",
    heroImage: "https://images.unsplash.com/photo-1606490203669-94bd3f0d8b5d?auto=format&fit=crop&w=2000&q=80",
    introText: "Refined hospitality solutions for luxury hotels—crafted to complement exceptional service with enduring elegance and operational precision.",
    restaurantTypes: [
      {
        title: "Luxury Hotels",
        description: "Designed to complement the sophistication and precision of elevated hospitality experiences.",
        image: "https://images.unsplash.com/photo-1606490203669-94bd3f0d8b5d?auto=format&fit=crop&w=800&q=80"
      },
      {
        title: "Boutique Hotels",
        description: "Thoughtfully crafted to align with unique concepts and immersive atmospheres enhancing their distinct identity.",
        image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80"
      },
      {
        title: "Resort Properties",
        description: "Adaptable and versatile solutions that reflect the bold creativity of modern hospitality styles.",
        image: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=800&q=80"
      },
      {
        title: "Hotel Chains",
        description: "Uniform excellence across all locations and formats to meet the scale and standards of growing brands.",
        image: "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=800&q=80"
      }
    ]
  },
  restaurants: {
    title: "Shapes for Restaurants",
    subtitle: "Turning Dining Spaces into Experiences",
    heroImage: "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=2000&q=80",
    introText: "Refined cutlery solutions for elevated dining spaces—crafted to complement exceptional cuisine with enduring elegance and design precision.",
    restaurantTypes: [
      {
        title: "Fine Dining Restaurants",
        description: "Designed to complement the sophistication and precision of elevated dining experiences.",
        image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80"
      },
      {
        title: "Theme-based Cafes",
        description: "Thoughtfully crafted to align with unique concepts and immersive atmospheres enhancing their distinct identity.",
        image: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80"
      },
      {
        title: "Fusion Cuisine Outlets",
        description: "Adaptable and versatile solutions that reflect the bold creativity of modern culinary styles.",
        image: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=800&q=80"
      },
      {
        title: "Multi-brand Chain Restaurants",
        description: "Uniform excellence across all locations and formats to meet the scale and standards of growing brands.",
        image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80"
      }
    ]
  },
  catering: {
    title: "Shapes for Catering",
    subtitle: "Event Excellence, Delivered Anywhere",
    heroImage: "https://images.unsplash.com/photo-1616627984393-ade1843f0aac?auto=format&fit=crop&w=2000&q=80",
    introText: "Versatile catering equipment for exceptional events—designed for portability, reliability, and stunning presentation at any venue.",
    restaurantTypes: [
      {
        title: "Event Catering",
        description: "Comprehensive solutions for weddings, corporate events, and special occasions.",
        image: "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=800&q=80"
      },
      {
        title: "Banquet Services",
        description: "Large-scale equipment designed for grand celebrations and formal gatherings.",
        image: "https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=800&q=80"
      },
      {
        title: "Mobile Catering",
        description: "Portable solutions that deliver exceptional results at any location.",
        image: "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=800&q=80"
      },
      {
        title: "Corporate Catering",
        description: "Professional equipment for business events and corporate functions.",
        image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80"
      }
    ]
  },
  gifting: {
    title: "Shapes for Gifting",
    subtitle: "Premium Gifts That Leave Lasting Impressions",
    heroImage: "https://images.unsplash.com/photo-1606490203669-94bd3f0d8b5d?auto=format&fit=crop&w=2000&q=80",
    introText: "Curated gifting solutions combining elegance and quality—perfect for corporate gifts, wedding favors, and special occasions.",
    restaurantTypes: [
      {
        title: "Corporate Gifts",
        description: "Premium solutions for business gifting and corporate recognition programs.",
        image: "https://images.unsplash.com/photo-1606490203669-94bd3f0d8b5d?auto=format&fit=crop&w=800&q=80"
      },
      {
        title: "Wedding Favors",
        description: "Elegant pieces that make perfect wedding favors and keepsakes.",
        image: "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=800&q=80"
      },
      {
        title: "Special Occasions",
        description: "Thoughtfully curated collections for memorable celebrations.",
        image: "https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=800&q=80"
      },
      {
        title: "Gift Sets",
        description: "Beautifully packaged collections perfect for any occasion.",
        image: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=800&q=80"
      }
    ]
  },
  cafes: {
    title: "Shapes for Cafes",
    subtitle: "Creating Memorable Coffee Experiences",
    heroImage: "https://images.unsplash.com/photo-1541534401786-f9a9fb3c1cdf?auto=format&fit=crop&w=2000&q=80",
    introText: "Cafe equipment and tableware that enhance brand identity—combining aesthetic appeal with operational efficiency for exceptional customer experiences.",
    restaurantTypes: [
      {
        title: "Coffee Shops",
        description: "Equipment designed for the perfect coffee experience.",
        image: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80"
      },
      {
        title: "Artisan Cafes",
        description: "Thoughtfully crafted solutions for unique cafe concepts.",
        image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80"
      },
      {
        title: "Dessert Cafes",
        description: "Elegant presentation solutions for sweet experiences.",
        image: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=800&q=80"
      },
      {
        title: "Cafe Chains",
        description: "Consistent quality across multiple locations.",
        image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80"
      }
    ]
  },
  bakeries: {
    title: "Shapes for Bakeries",
    subtitle: "Displaying Freshness with Style",
    heroImage: "https://images.unsplash.com/photo-1603808033198-937c4864c1a5?auto=format&fit=crop&w=2000&q=80",
    introText: "Bakery equipment and display solutions—combining production efficiency with attractive presentation to showcase your baked goods beautifully.",
    restaurantTypes: [
      {
        title: "Artisan Bakeries",
        description: "Equipment for craft bakeries focusing on quality and tradition.",
        image: "https://images.unsplash.com/photo-1603808033198-937c4864c1a5?auto=format&fit=crop&w=800&q=80"
      },
      {
        title: "Patisseries",
        description: "Elegant solutions for pastry and dessert presentation.",
        image: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=800&q=80"
      },
      {
        title: "Bakery Chains",
        description: "Scalable solutions for multi-location operations.",
        image: "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=800&q=80"
      },
      {
        title: "Commercial Bakeries",
        description: "High-volume equipment for production facilities.",
        image: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=800&q=80"
      }
    ]
  }
};

const partners = [
  { name: "Marriott", icon: "🏨" },
  { name: "Taj Hotels", icon: "🏢" },
  { name: "ITC Hotels", icon: "🏨" },
  { name: "Oberoi", icon: "🏢" },
  { name: "Hyatt", icon: "🏨" },
  { name: "Radisson", icon: "🏢" }
];

const valuePropositions = [
  {
    icon: "📦",
    title: "Built for consistency across service styles",
    description: "Engineered to deliver reliable performance and uniform quality, no matter the service format or setting."
  },
  {
    icon: "🌍",
    title: "Global trends, local adaptations",
    description: "Blending international design inspirations with regional preferences to meet diverse market needs."
  },
  {
    icon: "⭐",
    title: "Elevating Brand Presence Through Design",
    description: "Creating cohesive and memorable dining moments by aligning every detail with your brand's identity."
  },
  {
    icon: "🛡️",
    title: "Precision-crafted for lasting durability",
    description: "Combining expert craftsmanship and premium materials to ensure cutlery that withstands the demands of daily service and style."
  },
  {
    icon: "✨",
    title: "Crafted to Enhance Distinctive Culinary Displays",
    description: "Designed to enhance your unique culinary style, elevating every dish with thoughtful elegance."
  }
];

const features = [
  {
    title: "Engineered for Maximum Durability",
    description: "Crafted with premium materials and precision engineering, our products withstand the toughest demands of high-volume hospitality environments.",
    icon: "🛡️"
  },
  {
    title: "Dishwasher-safe, commercial grade quality",
    description: "Built to handle rigorous cleaning cycles while maintaining their elegant appearance."
  },
  {
    title: "Growth-Ready Stock Solutions",
    description: "Scalable inventory management to support your business expansion."
  },
  {
    title: "On-demand replenishment capabilities",
    description: "Flexible supply chain solutions that adapt to your operational needs."
  }
];

export default function CategoryPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug || '';
  const category = categoryData[slug] || categoryData.restaurants;
  const { cart, products, categories: allCategories, businessTypes } = useAppContext();

  // Get current category name from the page
  const currentCategoryName = category.title.replace('Shapes for ', '');

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    companyName: '',
    state: '',
    query: '',
    categories: [currentCategoryName],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);
  const [isCartDropdownOpen, setIsCartDropdownOpen] = useState(false);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [includeCart, setIncludeCart] = useState(true);
  const categoryDropdownRef = useRef(null);

  // Close category dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target)) {
        setIsCategoryDropdownOpen(false);
      }
    };

    if (isCategoryDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCategoryDropdownOpen]);

  // Get departments (top-level categories) - limit to 4 for display
  const departments = useMemo(() => {
    if (!allCategories || allCategories.length === 0) return [];
    return allCategories.filter(cat => {
      const catParent = cat.parent?._id || cat.parent || null;
      return catParent === null && (cat.level === 'department' || cat.level === 'category');
    }).slice(0, 4);
  }, [allCategories]);

  // Get cart items with product details
  const cartItems = useMemo(() => {
    return cart.map(cartItem => {
      const product = products.find(p => {
        const pid = p._id || p.id;
        return pid?.toString() === cartItem.productId?.toString();
      });
      return product ? {
        productId: cartItem.productId,
        productName: product.title || product.name || 'Product',
        quantity: cartItem.quantity,
      } : null;
    }).filter(Boolean);
  }, [cart, products]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCategoryToggle = (categoryName) => {
    setFormData(prev => {
      const currentCategories = prev.categories || [];
      if (currentCategories.includes(categoryName)) {
        return {
          ...prev,
          categories: currentCategories.filter(cat => cat !== categoryName)
        };
      } else {
        return {
          ...prev,
          categories: [...currentCategories, categoryName]
        };
      }
    });
  };

  const scrollToForm = () => {
    const formElement = document.getElementById('contact');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const submitEnquiry = async (e) => {
    e.preventDefault();
    
    if (!formData.fullName || !formData.email || !formData.phone || !formData.state) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      // Combine selected categories with the current page category
      const allCategories = formData.categories.length > 0 
        ? formData.categories 
        : [category.title.replace('Shapes for ', '')];

      const enquiryData = {
        name: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        company: formData.companyName,
        state: formData.state,
        message: formData.query,
        categories: allCategories,
        cartItems: includeCart && cartItems.length > 0 ? cartItems : [],
        source: 'whom-we-serve', // Specific source for "whom we serve" pages
        userType: 'business', // This is a "whom we serve" page, so default to business
      };

      const response = await fetch('/api/enquiries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(enquiryData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit enquiry');
      }

      let whatsappMessage = 'Hello! I would like to make an enquiry:\n\n';
      whatsappMessage += `Name: ${formData.fullName}\n`;
      whatsappMessage += `Email: ${formData.email}\n`;
      whatsappMessage += `Phone: ${formData.phone}\n`;
      if (formData.companyName) {
        whatsappMessage += `Company: ${formData.companyName}\n`;
      }
      whatsappMessage += `State: ${formData.state}\n`;
      if (allCategories.length > 0) {
        whatsappMessage += `Categories: ${allCategories.join(', ')}\n`;
      }
      
      if (includeCart && cartItems.length > 0) {
        whatsappMessage += `\n📦 Products I'm interested in:\n`;
        cartItems.forEach((item, index) => {
          whatsappMessage += `${index + 1}. ${item.productName} (Quantity: ${item.quantity})\n`;
        });
        whatsappMessage += `\nTotal Items: ${cartItems.reduce((sum, item) => sum + item.quantity, 0)}\n`;
      }
      
      if (formData.query) {
        whatsappMessage += `\nMessage: ${formData.query}\n`;
      }
      
      const whatsappUrl = getWhatsAppBusinessLink(whatsappMessage);
      window.open(whatsappUrl, '_blank');
      
      setFormData({
        fullName: '',
        email: '',
        phone: '',
        companyName: '',
        state: '',
        query: '',
        categories: [currentCategoryName],
      });
      
      toast.success('Enquiry submitted successfully! Opening WhatsApp...');
    } catch (error) {
      console.error('Error submitting enquiry:', error);
      toast.error(error.message || 'Failed to submit enquiry. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!categoryData[slug]) {
    return (
      <div className="bg-white min-h-screen py-12 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-black mb-4">Category Not Found</h1>
          <Link href="/whom-we-serve" className="text-accent hover:underline">
            ← Back to Whom We Serve
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className=" lg:pt-[100px] md:pt-0 sm:pt-10 pt-20 pb-10 ">
      {/* Hero Section */}
      <section className="relative min-h-[300px] max-h-[300px] md:min-h-[700px] flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${category.heroImage})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/40" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-8 lg:px-12 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-[3.5rem] font-bold text-white tracking-tight leading-tight mb-6">
            {category.title}
          </h1>
          <p className="text-lg md:text-xl text-white/90 leading-relaxed mb-10 max-w-2xl mx-auto">
            {category.subtitle}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => router.push('/catalog')}
              className="inline-flex items-center justify-center whitespace-nowrap text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover-elevate active-elevate-2 border border-accent min-h-10 rounded-md bg-accent text-white font-semibold px-8 gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" x2="12" y1="15" y2="3"></line>
              </svg>
              Download Catalog
            </button>
            <button
              onClick={scrollToForm}
              className="inline-flex items-center justify-center whitespace-nowrap text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover-elevate active-elevate-2 border border-white/30 shadow-xs active:shadow-none min-h-10 rounded-md bg-white/10 backdrop-blur-sm text-white font-semibold px-8 gap-2"
            >
              Enquire Now
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M5 12h14"></path>
                <path d="m12 5 7 7-7 7"></path>
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* Restaurant Types Section */}
      <section className="py-16 md:py-24 lg:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-12">
          <div className="text-center mb-12 md:mb-16">
            <p className="text-base md:text-lg text-black/70 leading-relaxed max-w-3xl mx-auto">
              {category.introText}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {category.restaurantTypes.map((type, index) => (
              <div key={index} className="group relative aspect-[4/3] rounded-md overflow-hidden cursor-pointer">
                <Image
                  src={type.image}
                  alt={type.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
                  <h4 className="text-lg md:text-xl font-semibold text-white mb-2">
                    {type.title}
                  </h4>
                  <p className="text-sm text-white/80 leading-relaxed opacity-0 max-h-0 group-hover:opacity-100 group-hover:max-h-24 transition-all duration-300 overflow-hidden">
                    {type.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* Partners Section */}
      <section className="py-16 md:py-24 bg-[#F5F5F5]">
        <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-12">
          <p className="text-center text-sm font-semibold uppercase tracking-wider text-black/60 mb-10">
            Proud Partners in Hospitality
          </p>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-8 md:gap-12 items-center justify-items-center">
            {partners.map((partner, index) => (
              <div key={index} className="flex flex-col items-center gap-2 opacity-60 hover:opacity-100 transition-opacity duration-300 grayscale hover:grayscale-0">
                <div className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center text-2xl md:text-3xl">
                  {partner.icon}
                </div>
                <span className="text-xs font-medium text-black/60">{partner.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Value Propositions Section */}
      {/* <section className="py-16 md:py-24 lg:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-12">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-[2.5rem] font-bold text-black tracking-tight mb-4">
              Embodying Distinction in {category.title.replace('Shapes for ', '')}
            </h2>
            <p className="text-base md:text-lg text-black/70 leading-relaxed max-w-2xl mx-auto">
              Crafted to elevate every experience with unmatched elegance, bringing a distinctive touch to your operations.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {valuePropositions.map((prop, index) => (
              <div key={index} className="rounded-xl bg-white text-black shadow-sm border border-black/10 hover:shadow-lg transition-shadow duration-300">
                <div className="p-6 md:p-8">
                  <div className="text-4xl mb-4">{prop.icon}</div>
                  <h4 className="text-lg md:text-xl font-semibold text-black mb-3">
                    {prop.title}
                  </h4>
                  <p className="text-sm md:text-base text-black/70 leading-relaxed">
                    {prop.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section> */}

      {/* Product Collections Section */}
      {departments.length > 0 && (
        <section id="products" className="py-16 md:py-24 lg:py-32 bg-[#F5F5F5]">
          <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-12">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12 md:mb-16">
              <div>
                <h2 className="text-3xl md:text-4xl lg:text-[2.5rem] font-bold text-black tracking-tight mb-4">
                  Dining Experience Collections
                </h2>
                <p className="text-base md:text-lg text-black/70 leading-relaxed max-w-xl">
                  Crafted for elegance, durability, and effortless maintenance—designed to enhance every dining occasion.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={scrollToForm}
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover-elevate active-elevate-2 bg-accent text-white border border-accent min-h-9 px-4 py-2"
                >
                  Enquire Now
                </button>
                <button
                  onClick={() => router.push('/catalog')}
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover-elevate active-elevate-2 border border-black/20 shadow-xs active:shadow-none min-h-9 px-4 py-2 gap-2"
                >
                  Download Catalog
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <path d="M5 12h14"></path>
                    <path d="m12 5 7 7-7 7"></path>
                  </svg>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              {departments.map((dept) => {
                const deptSlug = dept.slug || dept.name?.toLowerCase().replace(/\s+/g, '-');
                return (
                  <Link
                    key={dept._id || dept.id}
                    href={`/catalog?department=${deptSlug}`}
                    className="group relative aspect-[3/4] md:aspect-[4/3] rounded-md overflow-hidden"
                  >
                    {dept.image ? (
                      <Image
                        src={dept.image}
                        alt={dept.name}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-black/20 to-black/40" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                      <h4 className="text-xl md:text-2xl font-semibold text-white mb-3">
                        {dept.name}
                      </h4>
                      <span className="inline-flex items-center gap-2 text-accent font-medium text-sm md:text-base group-hover:gap-3 transition-all duration-300">
                        Learn More
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                          <path d="M5 12h14"></path>
                          <path d="m12 5 7 7-7 7"></path>
                        </svg>
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Statistics Section */}
      <section className="py-16 md:py-24 bg-black">
        <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-12">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-[2.5rem] font-bold text-white tracking-tight">
              Powering Quality and Growth
            </h2>
            <p className="text-base md:text-lg text-white/70 mt-4 max-w-2xl mx-auto">
              Robust infrastructure and advanced systems drive consistent quality while supporting scalable business expansion.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            <div className="text-center">
              <div className="text-4xl md:text-5xl lg:text-6xl font-bold text-accent mb-3">100K+</div>
              <p className="text-sm md:text-base text-white/80">sq. ft. state of the art facility</p>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl lg:text-6xl font-bold text-accent mb-3">400+</div>
              <p className="text-sm md:text-base text-white/80">Hospitality and Trade Dealers</p>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl lg:text-6xl font-bold text-accent mb-3">25+</div>
              <p className="text-sm md:text-base text-white/80">countries spanning</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 md:py-24 lg:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-12">
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-16">
            <div className="lg:w-1/3">
              <div className="flex flex-col gap-2">
                {features.map((feature, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveFeature(index)}
                    className={`text-left px-4 py-4 transition-all duration-300 ${
                      index === activeFeature 
                        ? 'bg-black/5 pl-6 border-l-4 border-l-accent' 
                        : 'hover:bg-black/5'
                    }`}
                  >
                    <span className={`text-sm md:text-base font-semibold ${
                      index === activeFeature ? 'text-black' : 'text-black/70'
                    }`}>
                      {feature.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="lg:w-2/3">
              <div className="bg-black/5 rounded-md p-8 md:p-12 min-h-[300px] flex flex-col justify-center">
                <div className="text-5xl mb-6">{features[activeFeature].icon}</div>
                <h3 className="text-2xl md:text-3xl font-bold text-black mb-4">
                  {features[activeFeature].title}
                </h3>
                <p className="text-base md:text-lg text-black/70 leading-relaxed">
                  {features[activeFeature].description}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Catering CTA Section */}
      {slug === 'restaurants' && (
        <section id="catering" className="py-16 md:py-24 bg-[#F5F5F5]">
          <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-12">
            <div className="relative rounded-md overflow-hidden min-h-[300px] md:min-h-[400px] flex items-center">
              <div 
                className="absolute inset-0 bg-cover bg-center max-h-[400px]"
                style={{ backgroundImage: `url(${categoryData.catering.heroImage})` }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-transparent" />
              <div className="relative z-10 p-8 md:p-12 lg:p-16 max-w-xl">
                <h2 className="text-3xl md:text-4xl lg:text-[2.5rem] font-bold text-white tracking-tight mb-6">
                  Shapes for Catering
                </h2>
                <div className="flex flex-wrap gap-4">
                  <Link
                    href="/whom-we-serve/catering"
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover-elevate active-elevate-2 border border-white/30 shadow-xs active:shadow-none min-h-9 px-4 py-2 bg-white/10 backdrop-blur-sm text-white font-semibold gap-2"
                  >
                    Learn More
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                      <path d="M5 12h14"></path>
                      <path d="m12 5 7 7-7 7"></path>
                    </svg>
                  </Link>
                  <button
                    onClick={scrollToForm}
                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover-elevate active-elevate-2 bg-accent text-white border border-accent min-h-9 px-4 py-2"
                  >
                    Enquire Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Contact Form Section */}
      <section id="contact" className="py-16 md:py-24 lg:py-32 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 md:px-8 lg:px-12">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl lg:text-[2.5rem] font-bold text-black tracking-tight mb-4">
              Get in Touch
            </h2>
            <p className="text-base md:text-lg text-black/70">
              Have questions about our products? We'd love to hear from you.
            </p>
          </div>
          
          <form onSubmit={submitEnquiry} className="bg-white rounded-lg p-6 md:p-8 shadow-sm">
            <div className="space-y-6">
              {/* Two Column Grid Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Column 1 - Contact Details */}
                <div className="space-y-6">
                  {/* Name */}
                  <div>
                    <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="fullName"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition hover:border-gray-400"
                      placeholder="Enter your full name"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition hover:border-gray-400"
                      placeholder="Enter your email address"
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition hover:border-gray-400"
                      placeholder="Enter your phone number"
                    />
                  </div>
                </div>

                {/* Column 2 - Additional Details */}
                <div className="space-y-6">
                  {/* Company & State - Side by Side */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Company */}
                    <div>
                      <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-2">
                        Company (Optional)
                      </label>
                      <input
                        type="text"
                        id="companyName"
                        name="companyName"
                        value={formData.companyName}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition hover:border-gray-400"
                        placeholder="Company name"
                      />
                    </div>

                    {/* State */}
                    <div>
                      <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-2">
                        State <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="state"
                        name="state"
                        value={formData.state}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition hover:border-gray-400"
                        placeholder="Your state"
                      />
                    </div>
                  </div>

                  {/* Categories Multi-Select */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Categories (Optional)
                    </label>
                    <div className="relative" ref={categoryDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-left flex items-center justify-between hover:border-gray-400 transition-colors focus:ring-2 focus:ring-accent focus:border-transparent outline-none"
                      >
                        <span className="text-sm text-gray-700">
                          {formData.categories.length > 0 
                            ? `${formData.categories.length} categor${formData.categories.length === 1 ? 'y' : 'ies'} selected`
                            : 'Select categories'
                          }
                        </span>
                        <ChevronDownIcon 
                          className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${
                            isCategoryDropdownOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      
                      {/* Dropdown */}
                      {isCategoryDropdownOpen && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          <div className="p-2 space-y-1">
                            {businessTypes && businessTypes.length > 0 ? (
                              businessTypes.map((businessType) => {
                                const businessTypeName = businessType.name;
                                const isSelected = formData.categories.includes(businessTypeName);
                                return (
                                  <label
                                    key={businessType._id || businessType.id || businessTypeName}
                                    className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer transition-colors"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => handleCategoryToggle(businessTypeName)}
                                      className="w-4 h-4 text-accent border-gray-300 rounded focus:ring-accent focus:ring-2 transition-all hover:scale-110"
                                    />
                                    <span className="text-sm text-gray-700">{businessTypeName}</span>
                                  </label>
                                );
                              })
                            ) : (
                              <p className="text-sm text-gray-500 p-2">No categories available</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Selected Categories Display */}
                    {formData.categories.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {formData.categories.map((catName, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-accent/10 text-accent text-xs rounded-full"
                          >
                            {catName}
                            <button
                              type="button"
                              onClick={() => handleCategoryToggle(catName)}
                              className="hover:text-accent/80 transition-colors"
                              aria-label={`Remove ${catName}`}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Message */}
                  <div>
                    <label htmlFor="query" className="block text-sm font-medium text-gray-700 mb-2">
                      Message (Optional)
                    </label>
                    <textarea
                      id="query"
                      name="query"
                      value={formData.query}
                      onChange={handleChange}
                      rows={formData.categories.length > 0 ? 3 : 4}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition resize-none hover:border-gray-400"
                      placeholder="Tell us about your requirements..."
                    />
                  </div>
                </div>
              </div>

              {/* Cart Items Dropdown - Full Width */}
              {cartItems.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg overflow-hidden transition-all duration-300 hover:shadow-md">
                  <button
                    type="button"
                    onClick={() => setIsCartDropdownOpen(!isCartDropdownOpen)}
                    className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-blue-100 transition-colors duration-200 group"
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <span className="text-base sm:text-lg">📦</span>
                      <h3 className="text-xs sm:text-sm font-semibold text-gray-900">
                        Cart Items ({cartItems.reduce((sum, item) => sum + item.quantity, 0)} items)
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
                      <label 
                        className="flex items-center gap-1.5 sm:gap-2 cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={includeCart}
                          onChange={(e) => {
                            e.stopPropagation();
                            setIncludeCart(e.target.checked);
                          }}
                          className="w-4 h-4 text-accent border-gray-300 rounded focus:ring-accent focus:ring-2 transition-all duration-200 hover:scale-110"
                        />
                        <span className="text-xs text-gray-700 font-medium">Include</span>
                      </label>
                      <ChevronDownIcon 
                        className={`w-4 h-4 sm:w-5 sm:h-5 text-gray-600 transition-transform duration-300 ease-in-out ${
                          isCartDropdownOpen ? 'rotate-180' : ''
                        } group-hover:text-gray-900`}
                      />
                    </div>
                  </button>

                  <div
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${
                      isCartDropdownOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                    }`}
                  >
                    <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-2 border-t border-blue-200">
                      {includeCart ? (
                        <>
                          <div className="space-y-2 sm:space-y-2.5 mt-2">
                            {cartItems.map((item, index) => (
                              <button
                                type="button"
                                key={index} 
                                onClick={() => {
                                  window.dispatchEvent(new CustomEvent('openCartDrawer'));
                                }}
                                className="w-full text-left text-xs sm:text-sm text-gray-700 flex justify-between items-center p-2 rounded-md bg-white/60 hover:bg-white transition-all duration-200 hover:shadow-sm hover:translate-x-1 active:scale-[0.98] cursor-pointer group"
                              >
                                <span className="font-medium group-hover:text-accent transition-colors truncate pr-2">{item.productName}</span>
                                <span className="font-semibold text-accent px-2 py-0.5 bg-accent/10 rounded-full group-hover:bg-accent/20 transition-colors flex-shrink-0">
                                  Qty: {item.quantity}
                                </span>
                              </button>
                            ))}
                          </div>
                          <p className="text-xs text-green-700 mt-3 flex items-center gap-1 font-medium">
                            <span>✓</span>
                            These items will be included in your enquiry
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-gray-600 mt-2 flex items-center gap-1">
                          <span>ℹ</span>
                          Cart items will not be included in your enquiry
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex justify-center">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto min-w-[200px] bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-semibold py-3 px-8 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg active:scale-[0.98]"
                >
                  <WhatsAppIcon className="w-5 h-5" />
                  <span>{isSubmitting ? 'Submitting...' : 'Submit Enquiry'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
