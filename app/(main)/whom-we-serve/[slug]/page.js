/**
 * Dynamic Whom We Serve Category Page
 * 
 * Displays category-specific content matching the SHAPES design
 */

'use client';

import { useState, useMemo, useRef } from 'react';
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
    subtitle: "Elevating Hospitality, One Table at a Time",
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
  const { cart, products, categories: allCategories } = useAppContext();

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    companyName: '',
    state: '',
    query: '',
    countryCode: '+91',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);
  const [isCartDropdownOpen, setIsCartDropdownOpen] = useState(false);

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

  const scrollToForm = () => {
    const formElement = document.getElementById('contact');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const submitEnquiry = async (e) => {
    e.preventDefault();
    
    if (!formData.fullName || !formData.email || !formData.query) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      const enquiryData = {
        name: formData.fullName,
        email: formData.email,
        phone: formData.phone ? `${formData.countryCode}${formData.phone}` : '',
        company: formData.companyName,
        state: formData.state,
        message: formData.query,
        categories: [category.title.replace('Shapes for ', '')],
        cartItems: cartItems.length > 0 ? cartItems : [],
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
      if (formData.phone) {
        whatsappMessage += `Phone: ${formData.countryCode}${formData.phone}\n`;
      }
      if (formData.companyName) {
        whatsappMessage += `Company: ${formData.companyName}\n`;
      }
      if (formData.state) {
        whatsappMessage += `State: ${formData.state}\n`;
      }
      whatsappMessage += `Categories: ${category.title.replace('Shapes for ', '')}\n`;
      
      if (cartItems.length > 0) {
        whatsappMessage += `\n📦 Products I'm interested in:\n`;
        cartItems.forEach((item, index) => {
          whatsappMessage += `${index + 1}. ${item.productName} (Quantity: ${item.quantity})\n`;
        });
        whatsappMessage += `\nTotal Items: ${cartItems.reduce((sum, item) => sum + item.quantity, 0)}\n`;
      }
      
      if (formData.query) {
        whatsappMessage += `\nQuery: ${formData.query}\n`;
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
        countryCode: '+91',
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
    <div className="">
      {/* Hero Section */}
      <section className="relative min-h-[600px] md:min-h-[700px] flex items-center justify-center overflow-hidden">
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
      <section className="py-16 md:py-24 lg:py-32 bg-white">
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
      </section>

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
                className="absolute inset-0 bg-cover bg-center"
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
      <section id="contact" className="py-16 md:py-24 lg:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-12">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl lg:text-[2.5rem] font-bold text-black tracking-tight mb-4">
                Get in Touch
              </h2>
              <p className="text-base md:text-lg text-black/70">
                Have questions about our products? We'd love to hear from you.
              </p>
            </div>
            <form onSubmit={submitEnquiry} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="fullName" className="text-sm font-semibold text-black">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    id="fullName"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    required
                    className="flex h-9 w-full rounded-md border border-black/20 bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-black/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="companyName" className="text-sm font-semibold text-black">
                    Company Name
                  </label>
                  <input
                    type="text"
                    id="companyName"
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleChange}
                    className="flex h-9 w-full rounded-md border border-black/20 bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-black/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Your Company"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="state" className="text-sm font-semibold text-black">
                    State
                  </label>
                  <input
                    type="text"
                    id="state"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    className="flex h-9 w-full rounded-md border border-black/20 bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-black/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Your State"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-semibold text-black">
                    Email *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="flex h-9 w-full rounded-md border border-black/20 bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-black/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="john@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="phone" className="text-sm font-semibold text-black">
                    Phone
                  </label>
                  <div className="flex gap-2">
                    <select
                      name="countryCode"
                      value={formData.countryCode}
                      onChange={handleChange}
                      className="flex h-9 items-center justify-between rounded-md border border-black/20 bg-white px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 w-[100px]"
                    >
                      <option value="+1">+1 (US)</option>
                      <option value="+44">+44 (UK)</option>
                      <option value="+91">+91 (IN)</option>
                      <option value="+61">+61 (AU)</option>
                      <option value="+81">+81 (JP)</option>
                      <option value="+33">+33 (FR)</option>
                      <option value="+49">+49 (DE)</option>
                      <option value="+86">+86 (CN)</option>
                    </select>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className="flex h-9 w-full rounded-md border border-black/20 bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-black/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 flex-1"
                      placeholder="9876543210"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="query" className="text-sm font-semibold text-black">
                  Your Query *
                </label>
                <textarea
                  id="query"
                  name="query"
                  value={formData.query}
                  onChange={handleChange}
                  required
                  rows={5}
                  className="flex w-full rounded-md border border-black/20 bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-black/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[120px] resize-none"
                  placeholder="Tell us about your requirements..."
                />
              </div>

              {/* Cart Items Dropdown */}
              {cartItems.length > 0 && (
                <div className="bg-accent/10 border border-accent/20 rounded-lg overflow-hidden transition-all duration-300 hover:shadow-md">
                  <button
                    type="button"
                    onClick={() => setIsCartDropdownOpen(!isCartDropdownOpen)}
                    className="w-full flex items-center justify-between p-4 hover:bg-accent/20 transition-colors duration-200 group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">📦</span>
                      <h3 className="text-sm font-semibold text-black">
                        Products in Cart ({cartItems.reduce((sum, item) => sum + item.quantity, 0)} items)
                      </h3>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-accent font-medium px-2 py-1 bg-accent/20 rounded">
                        ✓ Will be included
                      </span>
                      <ChevronDownIcon 
                        className={`w-5 h-5 text-black/60 transition-transform duration-300 ease-in-out ${
                          isCartDropdownOpen ? 'rotate-180' : ''
                        } group-hover:text-black`}
                      />
                    </div>
                  </button>

                  <div
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${
                      isCartDropdownOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                    }`}
                  >
                    <div className="px-4 pb-4 pt-2 border-t border-accent/20">
                      <div className="space-y-2 mt-2">
                        {cartItems.map((item, index) => (
                          <button
                            type="button"
                            key={index} 
                            onClick={() => {
                              window.dispatchEvent(new CustomEvent('openCartDrawer'));
                            }}
                            className="w-full text-left text-sm text-black flex justify-between items-center p-2 rounded-md bg-white/60 hover:bg-white transition-all duration-200 hover:shadow-sm hover:translate-x-1 active:scale-[0.98] cursor-pointer group"
                          >
                            <span className="font-medium group-hover:text-accent transition-colors truncate pr-2">{item.productName}</span>
                            <span className="font-semibold text-accent px-2 py-0.5 bg-accent/10 rounded-full group-hover:bg-accent/20 transition-colors flex-shrink-0">
                              Qty: {item.quantity}
                            </span>
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-accent mt-3 flex items-center gap-1 font-medium">
                        <span>✓</span>
                        These products will be included in your enquiry and WhatsApp message
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover-elevate active-elevate-2 bg-accent text-white border border-accent min-h-9 px-4 py-2 w-full font-semibold gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"></path>
                  <path d="m21.854 2.147-10.94 10.939"></path>
                </svg>
                {isSubmitting ? 'Sending...' : 'Send Enquiry'}
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
