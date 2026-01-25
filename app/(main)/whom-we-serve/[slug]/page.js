/**
 * Dynamic Whom We Serve Category Page
 *
 * Displays category-specific content matching the SHAPES design
 */

"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { WhatsAppIcon, ChevronDownIcon } from "@/components/Icons";
import { useAppContext } from "@/context/AppContext";
import { getWhatsAppBusinessLink, openWhatsAppLink } from "@/lib/utils/whatsapp";
import toast from "react-hot-toast";

// Cloudflare R2 Base URL
const CF_BASE = "https://pub-f321790dd0774841a14d142aad52ade6.r2.dev";

// Category-specific content data
const categoryData = {
  hotels: {
    title: "Designed for Distinguished Hotels",
    subtitle: "Crafting Elevated Hospitality Experiences",
    heroImage: `${CF_BASE}/images/hotelH.png`,
    introText:
      "From luxury hotels to boutique properties, Regal delivers refined hospitality solutions that balance timeless elegance, durability, and operational precision.",
    restaurantTypes: [
      {
        title: "Luxury Hotels",
        description:
          "Sophisticated solutions designed to complement high-end hotel environments and premium guest experiences.",
        image: `${CF_BASE}/images/hotelH.png`,
      },
      {
        title: "Boutique Hotels",
        description:
          "Thoughtfully crafted designs that align with unique concepts and curated atmospheres.",
        image:
          "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80",
      },
      {
        title: "Resort Properties",
        description:
          "Versatile solutions reflecting relaxed luxury, comfort, and experiential design.",
        image:
          "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=800&q=80",
      },
      {
        title: "Hotel Chains",
        description:
          "Consistent quality and design uniformity across multiple locations and formats.",
        image:
          "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=800&q=80",
      },
    ],
  },

  restaurants: {
    title: "Crafted for Exceptional Dining",
    subtitle: "Where Culinary Spaces Meet Refined Design",
    heroImage:
      "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=2000&q=80",
    introText:
      "Premium dining and tableware solutions by Regal—crafted to elevate presentation, performance, and consistency across restaurant formats.",
    restaurantTypes: [
      {
        title: "Fine Dining Restaurants",
        description:
          "Precision-crafted solutions enhancing sophistication and attention to detail.",
        image:
          "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80",
      },
      {
        title: "Theme-based Cafés",
        description:
          "Design-forward solutions aligned with immersive concepts and storytelling.",
        image:
          "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80",
      },
      {
        title: "Fusion Cuisine Outlets",
        description:
          "Adaptable designs reflecting creativity, versatility, and modern dining styles.",
        image:
          "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=800&q=80",
      },
      {
        title: "Multi-brand Chain Restaurants",
        description:
          "Uniform excellence across locations while preserving brand identity.",
        image:
          "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
      },
    ],
  },

  cafes: {
    title: "Curated Café Experiences",
    subtitle: "Thoughtfully Designed for Modern Coffee Culture",
    heroImage:
      "https://images.unsplash.com/photo-1541534401786-f9a9fb3c1cdf?auto=format&fit=crop&w=2000&q=80",
    introText:
      "Cafe solutions by Regal that enhance brand identity, efficiency, and visual appeal for memorable coffee experiences.",
    restaurantTypes: [
      {
        title: "Coffee Shops",
        description:
          "Solutions designed for consistency, speed, and superior beverage presentation.",
        image:
          "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80",
      },
      {
        title: "Artisan Cafés",
        description:
          "Design-led solutions for specialty cafés and concept-driven spaces.",
        image:
          "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
      },
      {
        title: "Dessert Cafés",
        description:
          "Elegant presentation solutions for indulgent dessert experiences.",
        image:
          "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=800&q=80",
      },
      {
        title: "Cafe Chains",
        description:
          "Consistent quality and visual harmony across multiple outlets.",
        image:
          "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80",
      },
    ],
  },

  bakeries: {
    title: "Designed to Showcase Freshness",
    subtitle: "Where Craft, Display, and Quality Come Together",
    heroImage:
      "https://images.unsplash.com/photo-1603808033198-937c4864c1a5?auto=format&fit=crop&w=2000&q=80",
    introText:
      "Bakery equipment and display solutions by Regal—balancing production efficiency with premium presentation.",
    restaurantTypes: [
      {
        title: "Artisan Bakeries",
        description:
          "Craft-focused solutions celebrating quality, tradition, and authenticity.",
        image:
          "https://images.unsplash.com/photo-1603808033198-937c4864c1a5?auto=format&fit=crop&w=800&q=80",
      },
      {
        title: "Patisseries",
        description:
          "Refined display solutions for pastries and premium desserts.",
        image:
          "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=800&q=80",
      },
      {
        title: "Bakery Chains",
        description:
          "Scalable systems ensuring consistency across multiple locations.",
        image:
          "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=800&q=80",
      },
      {
        title: "Commercial Bakeries",
        description:
          "High-volume solutions engineered for large-scale production.",
        image:
          "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=800&q=80",
      },
    ],
  },

  catering: {
    title: "Excellence for Every Event",
    subtitle: "Event-Ready Solutions with Regal Precision",
    heroImage:
      "https://images.unsplash.com/photo-1616627984393-ade1843f0aac?auto=format&fit=crop&w=2000&q=80",
    introText:
      "Versatile catering solutions designed for portability, reliability, and premium presentation across event formats.",
    restaurantTypes: [
      {
        title: "Event Catering",
        description:
          "Comprehensive solutions for weddings, celebrations, and special occasions.",
        image:
          "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=800&q=80",
      },
      {
        title: "Banquet Services",
        description:
          "Large-scale solutions for formal events and grand gatherings.",
        image:
          "https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=800&q=80",
      },
      {
        title: "Mobile Catering",
        description:
          "Portable solutions delivering consistent performance anywhere.",
        image:
          "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=800&q=80",
      },
      {
        title: "Corporate Catering",
        description:
          "Professional-grade solutions for business and institutional events.",
        image:
          "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80",
      },
    ],
  },

  banquets: {
    title: "Crafted for Grand Occasions",
    subtitle: "Refined Solutions for Banquets & Convention Centres",
    heroImage:
      "https://images.unsplash.com/photo-1746549855902-0028190ed877?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    introText:
      "Regal enhances large-scale celebrations and corporate gatherings with elegant, durable tableware designed for impact, consistency, and flawless presentation.",
    restaurantTypes: [
      {
        title: "Wedding Banquets",
        description:
          "Timeless designs that complement lavish décor and unforgettable wedding celebrations.",
        image:
          "https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=800&q=80",
      },
      {
        title: "Convention Centres",
        description:
          "High-performance tableware crafted for large volumes and professional service environments.",
        image:
          "https://images.unsplash.com/photo-1503428593586-e225b39bddfe?auto=format&fit=crop&w=800&q=80",
      },
      {
        title: "Corporate Events",
        description:
          "Sleek and sophisticated solutions for conferences, meetings, and formal gatherings.",
        image:
          "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=800&q=80",
      },
      {
        title: "Celebration Halls",
        description:
          "Versatile collections designed to adapt seamlessly across diverse events and themes.",
        image:
          "https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=800&q=80",
      },
    ],
  },

};

// Touchpoints data for Elevating Experiences section
const TOUCHPOINTS = [
  {
    id: "fine-dining",
    title: "Fine Dining",
    category: "Dining",
    description:
      "Create a refined dining experience with premium tabletop pieces that photograph well, feel balanced in hand, and stay consistent across repeat orders.",
    imageUrl:
      "https://images.unsplash.com/photo-1550966842-28c456698471?auto=format&fit=crop&q=80&w=1200",
  },
  {
    id: "breakfast-buffet",
    title: "Breakfast & Buffet",
    category: "Service",
    description:
      "Support high-volume service with durable, easy-to-handle solutions that look clean on the counter and stay strong through constant washing and refills.",
    imageUrl:
      "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?auto=format&fit=crop&q=80&w=1200",
  },
  {
    id: "in-room-dining",
    title: "In-Room Dining",
    category: "Lodging",
    description:
      "Deliver comfort and quality in-room with practical, guest-friendly essentials that feel premium and are easy for staff to set up and clear.",
    imageUrl:
      "https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&q=80&w=1200",
  },
  {
    id: "banquets-events",
    title: "Banquets & Events",
    category: "Scale",
    description:
      "Scale confidently for large functions with coordinated ranges designed for speed of service, bulk availability, and a polished, uniform look.",
    imageUrl:
      "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&q=80&w=1200",
  },
  {
    id: "lounges-bar",
    title: "Lounges & Bar Service",
    category: "Social",
    description:
      "Upgrade cocktails and small bites with sleek service pieces that suit bar counters, lounges, and late-night service without looking \"generic\".",
    imageUrl:
      "https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&q=80&w=1200",
  },
  {
    id: "all-day-dining",
    title: "All-Day Dining",
    category: "Core",
    description:
      "Keep a reliable core range for breakfast-to-dinner service—everyday essentials that match across covers, shifts, and outlets.",
    imageUrl:
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&q=80&w=1200",
  },
];

const partners = [
  { name: "TAJ", image: `${CF_BASE}/images/Picture1.png` },
  { name: "Clarks", image: `${CF_BASE}/images/Picture2.png` },
  { name: "ROYAL ORCHID HOTELS", image: `${CF_BASE}/images/Picture9.png` },
  { name: "Oberoi HOTELS & RESORTS", image: `${CF_BASE}/images/Picture4.png` },
  { name: "THE LEELA PALACES HOTELS RESORTS", image: `${CF_BASE}/images/Picture5.png` },
  { name: "ORIS HÖLSTEIN 1904", image: `${CF_BASE}/images/Picture6.png` },
  { name: "Marriott HOTELS · RESORTS · SUITES", image: `${CF_BASE}/images/Picture7.png` },
  { name: "Shera town", image: `${CF_BASE}/images/Picture8.png` },
  { name: "Radisson BLU", image: `${CF_BASE}/images/Picture13.png` },
  { name: "Le MERIDIEN", image: `${CF_BASE}/images/Picture15.png` },
  { name: "American M2 Pets", image: `${CF_BASE}/images/Picture10.png` },
  { name: "JUMBO", image: `${CF_BASE}/images/Picture11.png` },
  { name: "ANdAZ. HOTELS & RESORTS", image: `${CF_BASE}/images/Picture12.png` },
  { name: "TEDi", image: `${CF_BASE}/images/Picture14.png` },
];

// Restaurant partners images
const restaurantPartners = [
  { name: "Pista House", image: `${CF_BASE}/restaurants/pistahouse.png` },
  { name: "Azeebo", image: `${CF_BASE}/restaurants/azeebo.png` },
  { name: "Nawabs", image: `${CF_BASE}/restaurants/nawabs.png` },
  { name: "Levant", image: `${CF_BASE}/restaurants/levant.png` },
  { name: "Tansen", image: `${CF_BASE}/restaurants/tansen.jpg` },
  { name: "Paradise", image: `${CF_BASE}/restaurants/paradise.png` },
  { name: "Mandi 36", image: `${CF_BASE}/restaurants/mandi36.png` },
  { name: "Barkas", image: `${CF_BASE}/restaurants/barkas.jpg` },
  { name: "Mehfil", image: `${CF_BASE}/restaurants/Mehfil%20Logo.avif` },
  { name: "Sarvi", image: `${CF_BASE}/restaurants/sarvi.jpg` },
  { name: "Joharfa", image: `${CF_BASE}/restaurants/joharfa.jpg` },
  { name: "Minerva", image: `${CF_BASE}/restaurants/minerva.jpg` },
  { name: "Kirtunga", image: `${CF_BASE}/restaurants/kirtunga.jpg` },
  { name: "Lucky", image: `${CF_BASE}/restaurants/lucky.png` },
  { name: "Rumaan", image: `${CF_BASE}/restaurants/rumaan.png` },
  { name: "Meridian", image: `${CF_BASE}/restaurants/meridian.png` },
  { name: "Toshe Daan", image: `${CF_BASE}/restaurants/toshedaan.jpg` },
  { name: "Ismail Biryani", image: `${CF_BASE}/restaurants/ismailbiryani.jpg` },
  { name: "Swagath", image: `${CF_BASE}/restaurants/swagath.png` },
  { name: "Tulips", image: `${CF_BASE}/restaurants/tulips.png` },
  { name: "Iron Hill", image: `${CF_BASE}/restaurants/ironhill2.png` },
];

// Banquet partners images (Assumed to be in /restaurants/ or /banquets/ - using /restaurants/ based on user's cloudflare folders)
// Naming convention: lowercase, no spaces to match existing style (e.g. pistahouse.png)
// Note: Since images are not yet available, we will display initials as placeholders if image fails to load
const banquetPartners = [
  { name: "King Kohinoor", image: null },
  { name: "Classic 3", image: null },
  { name: "Red Rose", image: null },
  { name: "OR Palace", image: null },
  { name: "Regal Convention", image: null },
  { name: "Metro Convention", image: null },
  { name: "Vintage Palace", image: null },
  { name: "Legacy Palace", image: null },
  { name: "HF Convention", image: null },
  { name: "Mehboob Pride", image: null },
  { name: "Paigah Palace", image: null },
  { name: "Shimla Garden", image: null },
  { name: "MNR Garden", image: null },
  { name: "Anmol Garden", image: null },
  { name: "SR Classic", image: null },
  { name: "TS Paradise", image: null },
  { name: "IB Palace", image: null },
];

const features = [
  {
    title: "Engineered for Maximum Durability",
    description:
      "Crafted with premium materials and precision engineering, our products withstand the toughest demands of high-volume hospitality environments.",
    icon: "🛡️",
  },
  {
    title: "Dishwasher-safe, commercial grade quality",
    description:
      "Built to handle rigorous cleaning cycles while maintaining their elegant appearance.",
  },
  {
    title: "Growth-Ready Stock Solutions",
    description:
      "Scalable inventory management to support your business expansion.",
  },
  {
    title: "On-demand replenishment capabilities",
    description:
      "Flexible supply chain solutions that adapt to your operational needs.",
  },
];

// V5 Compact & Crisp Floating Input
const FloatingInput = ({ label, id, name, type = "text", value, onChange, required, isTextArea = false, rows = 2 }) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="relative w-full">
      {isTextArea ? (
        <textarea
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          required={required}
          rows={rows}
          className={`
            relative w-full px-4 pt-5 pb-2 bg-white border-2 rounded-xl outline-none transition-all duration-200
            ${isFocused ? 'border-primary ring-2 ring-primary/5' : 'border-gray-200'}
            placeholder-transparent text-gray-900 text-sm font-semibold
          `}
          placeholder=" "
        />
      ) : (
        <input
          type={type}
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          required={required}
          className={`
            relative w-full px-4 pt-5 pb-2 bg-white border-2 rounded-xl outline-none transition-all duration-200
            ${isFocused ? 'border-primary ring-2 ring-primary/5' : 'border-gray-200'}
            placeholder-transparent text-gray-900 text-sm font-semibold
          `}
          placeholder=" "
        />
      )}

      <motion.label
        htmlFor={id}
        className="absolute left-4 pointer-events-none select-none"
        animate={{
          y: (value || isFocused) ? 6 : 16,
          scale: (value || isFocused) ? 0.75 : 1,
          color: isFocused ? "#EE4023" : (value ? "#666" : "#9ca3af"),
        }}
        initial={false}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        style={{ transformOrigin: 'left top' }}
      >
        <span className="text-[10px] font-black tracking-tight uppercase">
          {label} {required && <span className="text-red-500">*</span>}
        </span>
      </motion.label>
    </div>
  );
};

export default function CategoryPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug || "";
  const category = categoryData[slug] || categoryData.restaurants;
  const {
    cart,
    products,
    categories: allCategories,
    businessTypes,
  } = useAppContext();

  // Get current category name from businessTypes using slug
  const currentBusinessType = useMemo(() => {
    if (!businessTypes || businessTypes.length === 0) return null;
    return businessTypes.find(bt => {
      const btSlug = bt.slug || bt.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      return btSlug === slug;
    });
  }, [businessTypes, slug]);

  const currentCategoryName = currentBusinessType?.name || "";

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    companyName: "",
    state: "",
    query: "",
    categories: currentCategoryName ? [currentCategoryName] : [],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);
  const [isCartDropdownOpen, setIsCartDropdownOpen] = useState(false);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [includeCart, setIncludeCart] = useState(true);
  const [hoveredCollectionIndex, setHoveredCollectionIndex] = useState(null);
  const categoryDropdownRef = useRef(null);

  // Update form data when businessTypes are loaded and we can find the matching businessType
  useEffect(() => {
    if (currentBusinessType?.name) {
      setFormData(prev => {
        // Only update if form hasn't been filled out and category doesn't match
        const currentName = prev.categories[0];
        if (currentName !== currentBusinessType.name && !prev.fullName && !prev.email && !prev.phone) {
          return {
            ...prev,
            categories: [currentBusinessType.name],
          };
        }
        return prev;
      });
    } else if (!currentBusinessType && businessTypes && businessTypes.length > 0) {
      // Clear categories if no matching businessType is found (after businessTypes have loaded) and form is empty
      setFormData(prev => {
        if (!prev.fullName && !prev.email && !prev.phone && prev.categories.length > 0) {
          return {
            ...prev,
            categories: [],
          };
        }
        return prev;
      });
    }
  }, [currentBusinessType, businessTypes]);

  // Close category dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(event.target)
      ) {
        setIsCategoryDropdownOpen(false);
      }
    };

    if (isCategoryDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isCategoryDropdownOpen]);

  // Get departments (top-level categories) - show up to 5 for display
  const departments = useMemo(() => {
    if (!allCategories || allCategories.length === 0) return [];
    return allCategories
      .filter((cat) => {
        const catParent = cat.parent?._id || cat.parent || null;
        return (
          catParent === null &&
          (cat.level === "department" || cat.level === "category")
        );
      })
      .slice(0, 5);
  }, [allCategories]);

  // Get cart items with product details
  const cartItems = useMemo(() => {
    return cart
      .map((cartItem) => {
        const product = products.find((p) => {
          const pid = p._id || p.id;
          return pid?.toString() === cartItem.productId?.toString();
        });
        return product
          ? {
            productId: cartItem.productId,
            productName: product.title || product.name || "Product",
            quantity: cartItem.quantity,
          }
          : null;
      })
      .filter(Boolean);
  }, [cart, products]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCategoryToggle = (categoryName) => {
    setFormData((prev) => {
      const currentCategories = prev.categories || [];
      if (currentCategories.includes(categoryName)) {
        return {
          ...prev,
          categories: currentCategories.filter((cat) => cat !== categoryName),
        };
      } else {
        return {
          ...prev,
          categories: [...currentCategories, categoryName],
        };
      }
    });
  };

  const scrollToForm = () => {
    const formElement = document.getElementById("contact");
    if (formElement) {
      formElement.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const submitEnquiry = async (e) => {
    e.preventDefault();

    if (
      !formData.fullName ||
      !formData.email ||
      !formData.phone ||
      !formData.state
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);

    try {
      // Use selected categories, or current category name if available
      const allCategories =
        formData.categories.length > 0
          ? formData.categories
          : (currentCategoryName ? [currentCategoryName] : []);

      const enquiryData = {
        name: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        company: formData.companyName,
        state: formData.state,
        message: formData.query,
        categories: allCategories,
        cartItems: includeCart && cartItems.length > 0 ? cartItems : [],
        source: "whom-we-serve", // Specific source for "whom we serve" pages
        userType: "business", // This is a "whom we serve" page, so default to business
      };

      const response = await fetch("/api/enquiries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(enquiryData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit enquiry");
      }

      let whatsappMessage = "Hello! I would like to make an enquiry:\n\n";
      whatsappMessage += `Name: ${formData.fullName}\n`;
      whatsappMessage += `Email: ${formData.email}\n`;
      whatsappMessage += `Phone: ${formData.phone}\n`;
      if (formData.companyName) {
        whatsappMessage += `Company: ${formData.companyName}\n`;
      }
      whatsappMessage += `State: ${formData.state}\n`;
      if (allCategories.length > 0) {
        whatsappMessage += `Categories: ${allCategories.join(", ")}\n`;
      }

      if (includeCart && cartItems.length > 0) {
        whatsappMessage += `\n📦 Products I'm interested in:\n`;
        cartItems.forEach((item, index) => {
          whatsappMessage += `${index + 1}. ${item.productName} (Quantity: ${item.quantity
            })\n`;
        });
        whatsappMessage += `\nTotal Items: ${cartItems.reduce(
          (sum, item) => sum + item.quantity,
          0
        )}\n`;
      }

      if (formData.query) {
        whatsappMessage += `\nMessage: ${formData.query}\n`;
      }

      const whatsappUrl = getWhatsAppBusinessLink(whatsappMessage);
      openWhatsAppLink(whatsappUrl);

      // Reset form with current category name (only if businessType is found)
      setFormData({
        fullName: "",
        email: "",
        phone: "",
        companyName: "",
        state: "",
        query: "",
        categories: currentCategoryName ? [currentCategoryName] : [],
      });

      toast.success("Enquiry submitted successfully! Opening WhatsApp...");
    } catch (error) {
      console.error("Error submitting enquiry:", error);
      toast.error(
        error.message || "Failed to submit enquiry. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!categoryData[slug]) {
    return (
      <div className="bg-white min-h-screen py-12 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-black mb-4">
            Category Not Found
          </h1>
          <Link href="/whom-we-serve" className="text-accent hover:underline">
            ← Back to Whom We Serve
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className=" sm:pt-0 md:pt-0 lg:pt-0  ">
      {/* Hero Section */}
      <section className="relative min-h-[250px] sm:min-h-[300px] md:min-h-[500px] lg:min-h-[700px] flex items-center justify-center overflow-hidden">
        <Image
          src={category.heroImage}
          alt={category.title}
          fill
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/40" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 md:px-8 lg:px-12 text-center">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-[3.5rem] font-bold text-white tracking-tight leading-tight mb-4 sm:mb-6">
            {category.title}
          </h1>
          <p className="text-sm sm:text-base md:text-lg lg:text-xl text-white/90 leading-relaxed mb-6 sm:mb-8 md:mb-10 max-w-2xl mx-auto px-2">
            {category.subtitle}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <button
              onClick={() => router.push("/catalog")}
              className="inline-flex items-center justify-center whitespace-nowrap text-xs sm:text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover-elevate active-elevate-2 border border-accent min-h-9 sm:min-h-10 rounded-md bg-accent text-white font-semibold px-6 sm:px-8 gap-2 w-full sm:w-auto"
            >
              View Catalog
            </button>
            <button
              onClick={scrollToForm}
              className="inline-flex items-center justify-center whitespace-nowrap text-xs sm:text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover-elevate active-elevate-2 border border-white/30 shadow-xs active:shadow-none min-h-9 sm:min-h-10 rounded-md bg-white/10 backdrop-blur-sm text-white font-semibold px-6 sm:px-8 gap-2 w-full sm:w-auto"
            >
              Enquire Now
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5"
              >
                <path d="M5 12h14"></path>
                <path d="m12 5 7 7-7 7"></path>
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* Restaurant Types Section */}
      <section className="py-12 sm:py-16 md:py-20 px-4 sm:px-6 md:px-12 lg:px-20 bg-white">
        <div className="max-w-[1600px] mx-auto">
          <div className="text-center mb-8 sm:mb-12 md:mb-16">
            <p className="text-sm sm:text-base md:text-lg text-black/70 leading-relaxed max-w-3xl mx-auto px-2">
              {category.introText}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 sm:gap-x-6 gap-y-12 sm:gap-y-16 md:gap-y-20">
            {category.restaurantTypes.map((type, index) => {
              // Offset classes for staggered layout (only on large screens)
              const offsetClasses = [
                "lg:mt-20", // Col 1 sits lower
                "lg:mt-8", // Col 2 sits highest
                "lg:mt-32", // Col 3 sits lowest
                "lg:mt-16", // Col 4 sits medium
              ];

              return (
                <div
                  key={index}
                  className={`flex flex-col group transition-all duration-1000 ${offsetClasses[index % 4]
                    }`}
                >
                  {/* Text Content */}
                  <div className="mb-6 sm:mb-8 md:mb-10 max-w-[320px]">
                    <h3 className="text-lg sm:text-xl font-bold text-black mb-4 sm:mb-6 leading-tight transition-colors duration-700 group-hover:text-accent">
                      {type.title}
                    </h3>
                    <p className="text-gray-500 text-xs sm:text-[13px] leading-relaxed font-normal">
                      {type.description}
                    </p>
                  </div>

                  {/* Image Container */}
                  <div className="relative overflow-hidden aspect-[4/5] shadow-sm">
                    <div className="absolute inset-0 bg-black/5 z-10 pointer-events-none group-hover:bg-transparent transition-all duration-1000" />
                    <Image
                      src={type.image}
                      alt={type.title}
                      fill
                      className="object-cover grayscale-[20%] group-hover:grayscale-0 scale-100 group-hover:scale-105 transition-all duration-[1500ms] ease-out"
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    />

                    {/* Reveal Overlay Animation */}
                    <div
                      className="absolute inset-0 bg-white z-20"
                      style={{
                        animation: `reveal-overlay 1.5s ease-out forwards`,
                        animationDelay: `${(index + 1) * 200}ms`,
                        transform: "translateY(0)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Partners Section - Celestial Pearl Gallery */}
      <section className="pt-4 sm:pt-6 md:pt-8 pb-4 sm:pb-6 md:pb-8 relative">
        <div className="max-w-[98%] md:max-w-[1800px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12">
          <div className="bg-white rounded-t-3xl rounded-b-3xl shadow-[0_0_20px_rgba(0,0,0,0.08)] relative overflow-visible">
            {/* Background abstract accents - subtle for white background */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full -z-0 pointer-events-none overflow-hidden">
              <div className="absolute top-[10%] left-[5%] w-[45vw] h-[45vw] border border-gray-100 rounded-full opacity-50 animate-pulse-slow"></div>
              <div className="absolute bottom-[5%] right-[0%] w-[35vw] h-[35vw] border border-gray-100 rounded-full opacity-50 animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70vw] h-[70vw] border border-gray-100 rounded-full opacity-30"></div>
            </div>

            <div className="px-4 sm:px-6 md:px-8 lg:px-12 pt-8 sm:pt-10 md:pt-12 mb-8 md:mb-10 relative z-20">
              <div className="text-center">
                <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-gray-600 mb-4">
                  {slug === 'restaurants' ? 'Our Restaurant Partners' : slug === 'banquets' ? 'Our Banquet Partners' : 'Proud Partners in Hospitality'}
                </p>
              </div>
            </div>

            {/* Full-width circular pearl gallery */}
            <div className="w-full relative flex items-center justify-center pb-8 sm:pb-10 md:pb-12 px-4 sm:px-6 md:px-8">
              <div className="w-full max-w-[1600px] mx-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-y-6 md:gap-y-8 gap-x-6 md:gap-x-8 relative z-10">
            {((slug === 'restaurants' ? restaurantPartners : slug === 'banquets' ? banquetPartners : partners)).map((partner, idx) => {
              const driftDuration = 4 + (idx % 3);
              const entryDelay = idx * 0.05;
              
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, scale: 0.5 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{
                    duration: 0.8,
                    delay: entryDelay,
                    type: "spring",
                    stiffness: 200,
                    damping: 20,
                  }}
                  className="flex items-center justify-center group"
                >
                  {/* Circular Tile - Crisp and Clear */}
                  <div
                    className={`
                      relative w-28 h-28 sm:w-32 sm:h-32 md:w-36 md:h-36 rounded-full
                      flex items-center justify-center overflow-hidden
                      ${partner.image ? 'bg-white' : 'bg-gradient-to-br from-gray-900 via-gray-800 to-black shadow-lg border border-gray-700'}
                      transition-all duration-300 ease-out cursor-pointer
                      hover:scale-110 hover:-translate-y-2
                      animate-float-pearl
                    `}
                    style={{
                      animationDuration: `${driftDuration}s`,
                      animationDelay: `${idx * 0.1}s`,
                    }}
                  >
                    {/* Logo - Always Colorful */}
                    <div className="relative z-10 p-4 sm:p-5 md:p-6 flex items-center justify-center w-full h-full">
                      {partner.image ? (
                        <Image
                          src={partner.image}
                          alt={partner.name}
                          fill
                          className="object-contain transition-all duration-300 group-hover:scale-105"
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 14vw"
                        />
                      ) : (
                        <div className="text-center w-full px-2 flex flex-col items-center gap-1">
                          <div className="w-8 h-[1px] bg-accent/50 mb-1"></div>
                          <span className="text-xs sm:text-sm md:text-[15px] font-bold text-white/90 uppercase tracking-[0.15em] leading-tight font-sans text-shadow-sm">
                            {partner.name}
                          </span>
                          <div className="w-8 h-[1px] bg-accent/50 mt-1"></div>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
              </div>
            </div>

            {/* Custom CSS for animations */}
            <style dangerouslySetInnerHTML={{ __html: `
              @keyframes float-pearl {
                0%, 100% {
                  transform: translateY(0) rotate(0deg);
                }
                33% {
                  transform: translateY(-8px) rotate(0.5deg);
                }
                66% {
                  transform: translateY(-4px) rotate(-0.5deg);
                }
              }
              @keyframes pulse-slow {
                0%, 100% {
                  transform: scale(1);
                  opacity: 0.3;
                }
                50% {
                  transform: scale(1.05);
                  opacity: 0.1;
                }
              }
              .animate-float-pearl {
                animation: float-pearl ease-in-out infinite;
              }
              .animate-pulse-slow {
                animation: pulse-slow 10s ease-in-out infinite;
              }
            `}} />
          </div>
        </div>
      </section>

      {/* Split Section: Elevating Experiences (Video Inspired) */}
      <section className="py-12 sm:py-16 md:py-20 lg:py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-12">
          <div className="flex flex-col lg:flex-row gap-12 sm:gap-16 lg:gap-20">
            {/* Left Sticky Heading */}
            <div className="lg:w-1/2 lg:sticky lg:top-40 self-start">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
              >
                <p className="text-accent uppercase tracking-[0.2em] sm:tracking-[0.3em] font-bold text-xs sm:text-sm mb-3 sm:mb-4">
                  HoReCa Excellence
                </p>
                <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold leading-[1.1] tracking-tighter mb-6 sm:mb-8">
                  Elevating Experiences <br className="hidden sm:block" />{" "}
                  across your Property
                </h2>
                <p className="text-gray-500 text-base sm:text-lg max-w-md leading-relaxed">
                  Designed to bring consistency, elegance, and elevated
                  presentation to every space within your property.
                </p>
              </motion.div>
            </div>

            {/* Right Grid Layout */}
            <div className="lg:w-1/2">
              <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-10 sm:auto-rows-fr overflow-x-auto sm:overflow-x-visible pb-4 sm:pb-0">
                {TOUCHPOINTS.map((tp, idx) => (
                  <motion.div
                    key={tp.id}
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{ duration: 0.7, delay: idx * 0.1 }}
                    className="group flex flex-col h-full min-w-[280px] sm:min-w-0"
                  >
                    <h3 className="text-lg sm:text-xl font-bold uppercase tracking-tight mb-3 group-hover:text-accent transition-colors duration-300">
                      {tp.title}
                    </h3>
                    <p className="text-gray-600 text-xs sm:text-sm leading-relaxed flex-grow">
                      {tp.description}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comprehensive Solutions Section (Video Inspired) */}
      <section className="py-8 sm:py-16 md:py-20 lg:py-8 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-12 text-center mb-12 sm:mb-16 md:mb-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl 2xl:text-8xl font-bold tracking-tighter mb-6 sm:mb-8">
              Comprehensive <br /> <span className="text-accent">Table-top </span> Solutions
            </h2>
            <p className="text-gray-500 text-base sm:text-lg max-w-2xl mx-auto mb-8 sm:mb-12 px-4">
              A tabletop collection that unifies form, function, and guest
              experience across every dining touchpoint.
            </p>
            <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
              <button
                onClick={scrollToForm}
                className="bg-black text-white px-6 sm:px-8 md:px-10 py-3 sm:py-4 text-xs sm:text-sm font-bold uppercase tracking-widest hover:bg-accent transition-all duration-300"
              >
                Enquire Now
              </button>
              <button
                onClick={() => router.push("/catalog?category=tableware")}
                className="border border-black px-6 sm:px-8 md:px-10 py-3 sm:py-4 text-xs sm:text-sm font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-all duration-300"
              >
                VIEW TABLEWARE{" "}
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Product Collections Section - Cinematic Expanding Panels Gallery */}
      {departments.length > 0 && (
        <section id="products" className="py-8 md:py-12 bg-white relative overflow-hidden">
          {/* Redesigned Minimalist/Editorial Header */}
          <div className="max-w-[1800px] mx-auto px-4 md:px-8 mb-8 md:mb-12">
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-8 md:gap-12">
              {/* Monumental Text Block */}
              <div className="flex-shrink-0">
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif leading-none tracking-tighter text-gray-900 select-none">
                  The <br />
                  <span className="italic text-[#D4AF37]">Archives.</span>
                </h2>
              </div>

              {/* Minimalist CTA & Context */}
              <div className="flex-grow space-y-4">
                <div className="max-w-xl">
                  <div className="h-[1px] w-8 bg-gray-200 mb-3"></div>
                  <p className="text-sm md:text-base font-light text-gray-400 italic leading-relaxed">
                    "Curating the physical geometry of service excellence. Each collection is a testament to the weight of hospitality history."
                  </p>
                </div>
                
                <div className="flex items-center space-x-6">
                  <button 
                    onClick={scrollToForm}
                    className="text-[8px] uppercase tracking-[0.4em] font-bold text-black border-b border-black pb-1 hover:text-[#D4AF37] hover:border-[#D4AF37] transition-all"
                  >
                    Request Print Catalogue
                  </button>
                  <button 
                    onClick={() => {
                      const productsSection = document.getElementById('products');
                      if (productsSection) {
                        productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }}
                    className="w-10 h-10 rounded-full border border-gray-100 flex items-center justify-center hover:bg-black hover:text-white transition-all"
                  >
                    <span className="text-sm">↓</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Cinematic Expanding Panels Gallery */}
          <div className="w-full h-[700px] flex flex-col lg:flex-row gap-0 overflow-hidden px-4 md:px-8">
            {departments.map((dept, idx) => {
              const deptSlug = dept.slug || dept.name?.toLowerCase().replace(/\s+/g, "-");
              
              // Generate subtitle based on department name
              const getSubtitle = (name) => {
                const subtitleMap = {
                  "Barware": "The Art of Mixology",
                  "Catering": "Grand Scale Elegance",
                  "Hotel & Hospitality": "Palatial Service Standards",
                  "Kitchenware": "The Chef's Hardware",
                  "Tableware": "The Final Narrative",
                  "Dining": "The Final Narrative",
                  "Service": "Grand Scale Elegance",
                };
                return subtitleMap[name] || "Crafted Excellence";
              };

              return (
                <Link
                  key={dept._id || dept.id}
                  href={`/catalog?department=${deptSlug}`}
                  onMouseEnter={() => setHoveredCollectionIndex(idx)}
                  onMouseLeave={() => setHoveredCollectionIndex(null)}
                  className={`
                    relative h-full flex-grow transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)]
                    overflow-hidden cursor-pointer group border-x border-white/5
                    ${hoveredCollectionIndex === idx ? 'lg:flex-[3]' : 'lg:flex-[1]'}
                  `}
                >
                  {/* Background Image */}
                  <div className="absolute inset-0 w-full h-full scale-110 group-hover:scale-100 transition-transform duration-[2000ms] ease-out">
                    {dept.image ? (
                      <Image
                        src={dept.image}
                        alt={dept.name}
                        fill
                        className={`w-full h-full object-cover transition-all duration-1000 ${
                          hoveredCollectionIndex !== null && hoveredCollectionIndex !== idx 
                            ? 'brightness-[0.4] grayscale' 
                            : 'brightness-[0.85]'
                        }`}
                        sizes="(max-width: 1024px) 100vw, 20vw"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300" />
                    )}
                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80 group-hover:opacity-100 transition-opacity"></div>
                  </div>

                  {/* Content Layer */}
                  <div className="absolute inset-0 flex flex-col justify-end p-8 md:p-12">
                    <div className="space-y-4">
                      <div className="overflow-hidden">
                        <p className={`
                          text-[9px] uppercase tracking-[0.5em] text-[#D4AF37] font-bold transition-all duration-700
                          ${hoveredCollectionIndex === idx ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}
                        `}>
                          {getSubtitle(dept.name)}
                        </p>
                      </div>
                      
                      <h3 className={`
                        text-2xl md:text-5xl font-serif text-white transition-all duration-700 leading-none
                        ${hoveredCollectionIndex === idx ? 'scale-110 origin-left' : 'scale-100'}
                      `}>
                        {dept.name}
                      </h3>
                      
                      <div className={`
                        h-[1px] bg-white/30 transition-all duration-1000 ease-out
                        ${hoveredCollectionIndex === idx ? 'w-full' : 'w-12'}
                      `}></div>
                    </div>

                    {/* Vertical Title (Shown when not hovered) */}
                    <div className={`
                      absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 
                      transition-all duration-700 pointer-events-none
                      ${hoveredCollectionIndex === idx ? 'opacity-0 scale-150' : 'opacity-100 scale-100'}
                    `}>
                      <span className="text-[12px] uppercase tracking-[0.8em] font-light text-white/40 vertical-text origin-center rotate-90 whitespace-nowrap">
                        {dept.name}
                      </span>
                    </div>
                  </div>

                  {/* Hover Accent Glow */}
                  <div className="absolute bottom-0 left-0 w-full h-1 bg-[#D4AF37] scale-x-0 group-hover:scale-x-100 transition-transform duration-1000 origin-left"></div>
                </Link>
              );
            })}
          </div>

          <style dangerouslySetInnerHTML={{ __html: `
            .vertical-text {
              writing-mode: vertical-rl;
              text-orientation: mixed;
            }
            @keyframes slideUp {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
            }
            .animate-slide-up {
              animation: slideUp 1s ease-out forwards;
            }
          `}} />
        </section>
      )}



      {/* Contact Form Section */}
      <section
        id="contact"
        className="py-12 lg:py-16 bg-gray-100 overflow-hidden font-sans"
      >
        <div className="container relative z-10 mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <motion.h2 initial={{ opacity: 0, y: -10 }} whileInView={{ opacity: 1, y: 0 }} className="text-3xl lg:text-5xl font-black text-gray-900 tracking-tighter mb-2">
                Start Your <span className="font-serif italic text-primary">Regal</span> Journey.
              </motion.h2>
              <p className="text-xs lg:text-sm text-gray-500 font-bold uppercase tracking-[0.2em]">Contact Us</p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-white p-6 lg:p-10 rounded-[24px] shadow-2xl border border-gray-100 max-w-2xl mx-auto"
            >
              <form onSubmit={submitEnquiry} className="space-y-6 text-left">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <FloatingInput label="Full Name" id="fullName" name="fullName" value={formData.fullName} onChange={handleChange} required />
                    <FloatingInput label="Email address" type="email" id="email" name="email" value={formData.email} onChange={handleChange} required />
                    <FloatingInput label="WhatsApp phone" type="tel" id="phone" name="phone" value={formData.phone} onChange={handleChange} required />
                  </div>

                  <div className="space-y-4">
                    <FloatingInput label="Company name (optional)" id="companyName" name="companyName" value={formData.companyName} onChange={handleChange} />
                    <FloatingInput label="State / City" id="state" name="state" value={formData.state} onChange={handleChange} required />

                    <div className="relative" ref={categoryDropdownRef}>
                      <button type="button" onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)} className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl border-2 border-transparent hover:border-primary/10 transition-all text-left">
                        <span className={`text-[11px] font-black uppercase tracking-tight ${formData.categories.length > 0 ? "text-gray-900" : "text-gray-400"}`}>
                          {formData.categories.length > 0 ? `${formData.categories.length} Topics Selected` : "Focus Categories"}
                        </span>
                        <ChevronDownIcon className={`w-4 h-4 transition-transform duration-300 ${isCategoryDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      <AnimatePresence>
                        {isCategoryDropdownOpen && (
                          <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} className="absolute z-50 bottom-full inset-x-0 mb-2 p-2 bg-white rounded-2xl shadow-2xl border border-gray-200 max-h-[160px] overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-1 gap-1">
                              {businessTypes?.map((cat) => {
                                const active = formData.categories.includes(cat.name);
                                return (
                                  <button key={cat.name} type="button" onClick={() => handleCategoryToggle(cat.name)} className={`flex items-center gap-2 p-3 rounded-lg transition-all text-left ${active ? 'bg-primary text-white' : 'hover:bg-gray-50 text-gray-700'}`}>
                                    <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${active ? 'bg-white border-none' : 'border-gray-300'}`}>{active && <span className="text-[7px] text-primary font-bold">✓</span>}</div>
                                    <span className="text-[10px] font-bold uppercase tracking-tight">{cat.name}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                <FloatingInput label="Requirements" id="query" name="query" value={formData.query} onChange={handleChange} isTextArea rows={2} />

                {cartItems.length > 0 && (
                  <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">📦</span>
                      <div className="text-left"><h4 className="text-[8px] font-black uppercase tracking-widest text-blue-900">Sync</h4><p className="text-[10px] font-black text-blue-900">{cartItems.length} ITEMS</p></div>
                    </div>
                    <label className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-100 cursor-pointer">
                      <input type="checkbox" checked={includeCart} onChange={(e) => setIncludeCart(e.target.checked)} className="w-3.5 h-3.5 accent-primary" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-gray-600">Include</span>
                    </label>
                  </div>
                )}

                <div className="flex justify-center pt-2">
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} disabled={isSubmitting} type="submit" className="w-full px-10 py-4 bg-gray-900 text-white text-xs font-black tracking-[0.2em] rounded-xl shadow-xl flex items-center justify-center gap-3 transition-colors hover:bg-black uppercase">
                    <WhatsAppIcon className="w-5 h-5" />
                    <span>{isSubmitting ? "Submitting..." : "START CONVERSATION"}</span>
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}
