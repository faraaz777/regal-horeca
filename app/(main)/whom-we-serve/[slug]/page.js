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
import { motion } from "framer-motion";
import { WhatsAppIcon, ChevronDownIcon } from "@/components/Icons";
import { useAppContext } from "@/context/AppContext";
import { getWhatsAppBusinessLink } from "@/lib/utils/whatsapp";
import toast from "react-hot-toast";
import hotelImage from "./images/hotelH.png";
import partnersImage from "./images/Picture1.png";
import partnersImage2 from "./images/Picture2.png";
import partnersImage4 from "./images/Picture4.png";
import partnersImage5 from "./images/Picture5.png";
import partnersImage6 from "./images/Picture6.png";
import partnersImage7 from "./images/Picture7.png";
import partnersImage8 from "./images/Picture8.png";
import partnersImage9 from "./images/Picture9.png";
import partnersImage10 from "./images/Picture10.png";
import partnersImage11 from "./images/Picture11.png";
import partnersImage12 from "./images/Picture12.png";
import partnersImage13 from "./images/Picture13.png";
import partnersImage14 from "./images/Picture14.png";
import partnersImage15 from "./images/Picture15.png";

// Category-specific content data
const categoryData = {
  hotels: {
    title: "Designed for Distinguished Hotels",
    subtitle: "Crafting Elevated Hospitality Experiences",
    heroImage: hotelImage,
    introText:
      "From luxury hotels to boutique properties, Regal delivers refined hospitality solutions that balance timeless elegance, durability, and operational precision.",
    restaurantTypes: [
      {
        title: "Luxury Hotels",
        description:
          "Sophisticated solutions designed to complement high-end hotel environments and premium guest experiences.",
        image: hotelImage,
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

  gifting: {
    title: "Designed to Leave an Impression",
    subtitle: "Thoughtfully Curated Premium Gifting",
    heroImage:
      "https://images.unsplash.com/photo-1606490203669-94bd3f0d8b5d?auto=format&fit=crop&w=2000&q=80",
    introText:
      "Curated gifting collections by Regal—combining refined design and lasting quality for meaningful occasions.",
    restaurantTypes: [
      {
        title: "Corporate Gifts",
        description:
          "Sophisticated gifting solutions for corporate recognition and branding.",
        image:
          "https://images.unsplash.com/photo-1606490203669-94bd3f0d8b5d?auto=format&fit=crop&w=800&q=80",
      },
      {
        title: "Wedding Favors",
        description: "Elegant keepsakes designed to elevate celebrations.",
        image:
          "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=800&q=80",
      },
      {
        title: "Special Occasions",
        description:
          "Thoughtfully curated pieces for memorable gifting experiences.",
        image:
          "https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=800&q=80",
      },
      {
        title: "Gift Sets",
        description:
          "Beautifully packaged collections suited for premium gifting.",
        image:
          "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=800&q=80",
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
      'Upgrade cocktails and small bites with sleek service pieces that suit bar counters, lounges, and late-night service without looking "generic".',
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
  { name: "TAJ", image: partnersImage },
  { name: "Clarks", image: partnersImage2 },
  { name: "ROYAL ORCHID HOTELS", image: partnersImage9 },
  { name: "Oberoi HOTELS & RESORTS", image: partnersImage4 },
  { name: "THE LEELA PALACES HOTELS RESORTS", image: partnersImage5 },
  { name: "ORIS HÖLSTEIN 1904", image: partnersImage6 },
  { name: "Marriott HOTELS · RESORTS · SUITES", image: partnersImage7 },
  { name: "Shera town", image: partnersImage8 },
  { name: "Radisson BLU", image: partnersImage13 },
  { name: "Le MERIDIEN", image: partnersImage15 },
  { name: "American M2 Pets", image: partnersImage10 },
  { name: "JUMBO", image: partnersImage11 },
  { name: "ANdAZ. HOTELS & RESORTS", image: partnersImage12 },
  { name: "TEDi", image: partnersImage14 },
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

  // Get current category name from the page
  const currentCategoryName = category.title.replace("Shapes for ", "");

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    companyName: "",
    state: "",
    query: "",
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

  // Get departments (top-level categories) - limit to 4 for display
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
      .slice(0, 4);
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
      // Combine selected categories with the current page category
      const allCategories =
        formData.categories.length > 0
          ? formData.categories
          : [category.title.replace("Shapes for ", "")];

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
          whatsappMessage += `${index + 1}. ${item.productName} (Quantity: ${
            item.quantity
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
      window.open(whatsappUrl, "_blank");

      setFormData({
        fullName: "",
        email: "",
        phone: "",
        companyName: "",
        state: "",
        query: "",
        categories: [currentCategoryName],
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
    <div className="pt-[80px] sm:pt-[90px] md:pt-[100px] lg:pt-[120px] pb-10">
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
                  className={`flex flex-col group transition-all duration-1000 ${
                    offsetClasses[index % 4]
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

      {/* Partners Section */}
      <section className="py-8 sm:py-12 md:py-16 bg-gray-900 transition-colors duration-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-12">
          <p className="text-center text-xs sm:text-sm font-semibold uppercase tracking-wider text-white/60 mb-6 sm:mb-8 md:mb-10 transition-colors duration-500">
            Proud Partners in Hospitality
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4 md:gap-6">
            {partners.map((partner, index) => (
              <div
                key={index}
                className="group relative bg-gray-800 rounded-lg p-1 sm:p-1.5 md:p-2 flex items-center justify-center min-h-[80px] sm:min-h-[90px] md:min-h-[100px] aspect-square shadow-sm hover:shadow-xl transition-all duration-500 cursor-pointer overflow-hidden transform hover:scale-105 hover:-translate-y-2"
                style={{
                  animationDelay: `${index * 50}ms`,
                }}
              >
                {/* Hover gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-accent/0 via-accent/0 to-accent/0 group-hover:from-accent/5 group-hover:via-accent/10 group-hover:to-accent/5 transition-all duration-500 rounded-lg" />

                {/* Shine effect on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                  <div
                    className="absolute inset-0 bg-gradient-to-r from-transparent to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"
                    style={{
                      background:
                        "linear-gradient(to right, transparent, rgba(255,255,255,0.1), transparent)",
                    }}
                  />
                </div>

                {/* Border glow effect */}
                <div className="absolute inset-0 rounded-lg border-2 border-transparent group-hover:border-accent/30 transition-all duration-500" />

                {/* Partner Logo Image */}
                <div className="relative z-10 w-full h-full flex items-center justify-center">
                  <Image
                    src={partner.image}
                    alt={partner.name}
                    fill
                    className="object-contain transition-all duration-500 transform group-hover:scale-110"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 14vw"
                  />
                </div>

                {/* Ripple effect on click */}
                <div className="absolute inset-0 rounded-lg opacity-0 group-active:opacity-100 group-active:bg-accent/10 transition-opacity duration-300" />
              </div>
            ))}
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

      {/* Product Collections Section */}
      {departments.length > 0 && (
        <section id="products" className="py-16 md:py-24 lg:py-12 bg-[#F5F5F5]">
          <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-12">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12 md:mb-16">
              <div>
                <h2 className="text-3xl md:text-4xl lg:text-[2.5rem] font-bold text-black tracking-tight mb-4">
                  Dining Experience Collections
                </h2>
                <p className="text-base md:text-lg text-black/70 leading-relaxed max-w-xl">
                  Crafted for elegance, durability, and effortless
                  maintenance—designed to enhance every dining occasion.
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
                  onClick={() => router.push("/catalog")}
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover-elevate active-elevate-2 border border-black/20 shadow-xs active:shadow-none min-h-9 px-4 py-2 gap-2"
                >
                  View Catalog
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
                    className="w-4 h-4"
                  >
                    <path d="M5 12h14"></path>
                    <path d="m12 5 7 7-7 7"></path>
                  </svg>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              {departments.map((dept) => {
                const deptSlug =
                  dept.slug || dept.name?.toLowerCase().replace(/\s+/g, "-");
                return (
                  <Link
                    key={dept._id || dept.id}
                    href={`/catalog?department=${deptSlug}`}
                    className="group relative aspect-[2/3] md:aspect-[4/3] rounded-md overflow-hidden"
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
                          className="w-4 h-4"
                        >
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

      

      {/* Contact Form Section */}
      <section
        id="contact"
        className=" sm:py-16 md:py-24 lg:py-12 bg-gray-50"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 lg:px-12">
          <div className="text-center mb-8 sm:mb-10">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-[2.5rem] font-bold text-black tracking-tight mb-3 sm:mb-4">
              Get in Touch
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-black/70 px-2">
              Have questions about our products? We'd love to hear from you.
            </p>
          </div>

          <form
            onSubmit={submitEnquiry}
            className="bg-white rounded-lg p-4 sm:p-6 md:p-8 shadow-sm"
          >
            <div className="space-y-4 sm:space-y-6">
              {/* Two Column Grid Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {/* Column 1 - Contact Details */}
                <div className="space-y-6">
                  {/* Name */}
                  <div>
                    <label
                      htmlFor="fullName"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
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
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
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
                    <label
                      htmlFor="phone"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {/* Company */}
                    <div>
                      <label
                        htmlFor="companyName"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
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
                      <label
                        htmlFor="state"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
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
                        onClick={() =>
                          setIsCategoryDropdownOpen(!isCategoryDropdownOpen)
                        }
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-left flex items-center justify-between hover:border-gray-400 transition-colors focus:ring-2 focus:ring-accent focus:border-transparent outline-none"
                      >
                        <span className="text-sm text-gray-700">
                          {formData.categories.length > 0
                            ? `${formData.categories.length} categor${
                                formData.categories.length === 1 ? "y" : "ies"
                              } selected`
                            : "Select categories"}
                        </span>
                        <ChevronDownIcon
                          className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${
                            isCategoryDropdownOpen ? "rotate-180" : ""
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
                                const isSelected =
                                  formData.categories.includes(
                                    businessTypeName
                                  );
                                return (
                                  <label
                                    key={
                                      businessType._id ||
                                      businessType.id ||
                                      businessTypeName
                                    }
                                    className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer transition-colors"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() =>
                                        handleCategoryToggle(businessTypeName)
                                      }
                                      className="w-4 h-4 text-accent border-gray-300 rounded focus:ring-accent focus:ring-2 transition-all hover:scale-110"
                                    />
                                    <span className="text-sm text-gray-700">
                                      {businessTypeName}
                                    </span>
                                  </label>
                                );
                              })
                            ) : (
                              <p className="text-sm text-gray-500 p-2">
                                No categories available
                              </p>
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
                    <label
                      htmlFor="query"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
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
                        Cart Items (
                        {cartItems.reduce(
                          (sum, item) => sum + item.quantity,
                          0
                        )}{" "}
                        items)
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
                        <span className="text-xs text-gray-700 font-medium">
                          Include
                        </span>
                      </label>
                      <ChevronDownIcon
                        className={`w-4 h-4 sm:w-5 sm:h-5 text-gray-600 transition-transform duration-300 ease-in-out ${
                          isCartDropdownOpen ? "rotate-180" : ""
                        } group-hover:text-gray-900`}
                      />
                    </div>
                  </button>

                  <div
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${
                      isCartDropdownOpen
                        ? "max-h-[500px] opacity-100"
                        : "max-h-0 opacity-0"
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
                                  window.dispatchEvent(
                                    new CustomEvent("openCartDrawer")
                                  );
                                }}
                                className="w-full text-left text-xs sm:text-sm text-gray-700 flex justify-between items-center p-2 rounded-md bg-white/60 hover:bg-white transition-all duration-200 hover:shadow-sm hover:translate-x-1 active:scale-[0.98] cursor-pointer group"
                              >
                                <span className="font-medium group-hover:text-accent transition-colors truncate pr-2">
                                  {item.productName}
                                </span>
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
                  <span>
                    {isSubmitting ? "Submitting..." : "Submit Enquiry"}
                  </span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
