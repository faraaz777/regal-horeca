"use client";

/**
 * Header Component - Premium Redesign
 *
 * - Layout:
 *   - Top Row: Logo (Left), Search (Center - Wider), Actions (Right)
 *   - Bottom Row: Navigation (Centered, Clean, Uppercase)
 * - Typography: Montserrat Uppercase Tracking
 * - Visuals: Less rounded, cleaner borders, "Airy" feel
 */

import { useState, useEffect, useRef, useMemo } from "react";
import useSWR from 'swr';
import Logo from "./new/regalLogo.png";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  HeartIcon,
  MenuIcon,
  XIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchIcon,
  ShoppingCartIcon,
  InfoIcon,
  UserIcon,
  PhoneIcon,
} from "./Icons";
import { useAppContext } from "@/context/AppContext";
import SearchBar from "./new/SearchBar";
import CartDrawer from "./CartDrawer";
import LightCaptureModal, { updateSavedLeadProfile } from "./LightCaptureModal";
import toast from 'react-hot-toast';

// SWR fetcher function
const fetcher = async (url) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.');
    error.info = await res.json();
    error.status = res.status;
    throw error;
  }
  return res.json();
};

// Static departments list for navbar - ensures immediate render and consistent layout
// This improves SEO and prevents navbar from disappearing on initial load
const STATIC_DEPARTMENTS = [
  { slug: 'barware', name: 'BARWARE' },
  { slug: 'catering', name: 'CATERING' },
  { slug: 'hotel-hospitality', name: 'HOTEL HOSPITALITY' },
  { slug: 'kitchenware', name: 'KITCHENWARE' },
  { slug: 'tableware', name: 'TABLEWARE' },
];

export default function Header() {
  const { wishlist, getCartTotalItems, categories, businessTypes } = useAppContext();
  const pathname = usePathname();
  const router = useRouter();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [activeDesktopMenu, setActiveDesktopMenu] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [navStack, setNavStack] = useState([]);
  const [openAccordions, setOpenAccordions] = useState({});
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [activeDepartment, setActiveDepartment] = useState(null);
  const [isMoreDropdownOpen, setIsMoreDropdownOpen] = useState(false);
  const [departmentProducts, setDepartmentProducts] = useState({});

  const departmentMenuRefs = useRef({});

  const navLinkClass =
    "text-xs md:text-xs font-semibold tracking-wide uppercase text-black hover:text-accent transition-colors relative py-2.5 group whitespace-nowrap flex-shrink-0";

  // ---------- Category tree building ----------
  // Memoize category tree building to prevent unnecessary recalculations
  const categoryTree = useMemo(() => {
    const buildCategoryTree = (parentId = null) => {
      return categories
        .filter((cat) => {
          const catParent = cat.parent?._id || cat.parent || null;
          return catParent === parentId;
        })  
        .map((cat) => ({
          ...cat,
          id: cat._id || cat.id,
          children: buildCategoryTree(cat._id || cat.id),
        }));
    };
    return buildCategoryTree();
  }, [categories]);

  // Memoize top level categories
  const topLevelCategories = useMemo(() => {
    return categoryTree.filter((cat) => {
      const catParent = cat.parent?._id || cat.parent || null;
      return catParent === null;
    });
  }, [categoryTree]);

  // Use actual departments from database (top-level categories)
  // Filter by level === "department" if level field exists, otherwise use all top-level categories
  // Fallback to static departments if no dynamic departments found
  const departments = useMemo(() => {
    if (!topLevelCategories || topLevelCategories.length === 0) {
      // Fallback to static departments if no categories loaded
      return STATIC_DEPARTMENTS.map((dept) => ({
        ...dept,
        id: dept.slug,
        children: [],
      }));
    }
    
    // Filter by level if it exists, otherwise use all top-level categories
    const filtered = topLevelCategories.filter((cat) => {
      // If level field exists, only show departments
      if (cat.level !== undefined) {
        return cat.level === 'department';
      }
      // Otherwise, show all top-level categories as departments
      return true;
    });
    
    // If no departments found after filtering, fallback to all top-level categories
    if (filtered.length === 0) {
      // Use all top-level categories as departments
      return topLevelCategories.map((cat) => ({
        ...cat,
        name: cat.name.toUpperCase(),
        id: cat._id || cat.id,
      }));
    }
    
    // Ensure uppercase names for consistency
    return filtered.map((cat) => ({
      ...cat,
      name: cat.name.toUpperCase(),
      id: cat._id || cat.id,
    }));
  }, [topLevelCategories]);

  // Memoize rootNavMenu to prevent unnecessary re-renders
  const rootNavMenu = useMemo(() => ({
    id: "root",
    name: "Menu",
    children: [
      {
        id: "products",
        name: "Products",
        slug: "products",
        level: "department",
        parent: null,
        children: categoryTree,
      },
      {
        id: "serve",
        name: "We Serve",
        slug: "serve",
        level: "department",
        parent: null,
        children: businessTypes.map((bt) => ({
          id: bt._id || bt.id,
          name: bt.name,
          slug: `/catalog?business=${bt.slug}`,
          isLink: true,
          level: "category",
          parent: "serve",
        })),
      },
    ],
  }), [categoryTree, businessTypes]);

  // ---------- Effects ----------
  useEffect(() => {
    setIsMenuOpen(false);
    setActiveDesktopMenu(null);
    setIsMobileSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMenuOpen) {
      setTimeout(() => {
        setNavStack([rootNavMenu]);
        setOpenAccordions({});
      }, 300);
    } else {
      setNavStack([rootNavMenu]);
    }
  }, [isMenuOpen]);

  // Scroll detection
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY < 10) {
        setIsHeaderVisible(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsHeaderVisible(false);
      } else if (currentScrollY < lastScrollY) {
        setIsHeaderVisible(true);
      }
      setLastScrollY(currentScrollY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  // Open Cart Drawer Event
  useEffect(() => {
    const handleOpenCartDrawer = () => {
      setIsCartOpen(true);
    };
    window.addEventListener('openCartDrawer', handleOpenCartDrawer);
    return () => window.removeEventListener('openCartDrawer', handleOpenCartDrawer);
  }, []);

  // Prevent horizontal scroll
  useEffect(() => {
    if (activeDepartment || activeDesktopMenu === "products") {
      document.body.style.overflowX = "hidden";
    } else {
      document.body.style.overflowX = "";
    }
    return () => {
      document.body.style.overflowX = "";
    };
  }, [activeDepartment, activeDesktopMenu]);

  // Find active department for SWR key
  const activeDept = useMemo(() => {
    if (!activeDepartment) return null;
    return departments.find((d) => 
      d.slug === activeDepartment || (d._id || d.id) === activeDepartment
    );
  }, [activeDepartment, departments]);

  // Use SWR for fetching featured products with caching and deduplication
  const { data: productsData, error: productsError, isLoading: productsLoading } = useSWR(
    activeDept?.slug ? `/api/products?category=${activeDept.slug}&featured=true&limit=10` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // Cache for 1 minute
      onError: (error) => {
        console.error('Failed to fetch department products:', error);
      },
    }
  );

  // Update department products state when data changes
  useEffect(() => {
    if (activeDept?.slug && productsData?.success && productsData?.products) {
      setDepartmentProducts(prev => ({
        ...prev,
        [activeDept.slug]: productsData.products
      }));
    } else if (!activeDept) {
      // Clear products when no active department
      setDepartmentProducts({});
    }
  }, [activeDept?.slug, productsData]);

  // ---------- Handlers ----------
  const handleNavForward = (menu) => {
    setNavStack((prev) => [
      ...prev,
      { id: menu.id, name: menu.name, children: menu.children || [] },
    ]);
  };

  const handleNavBack = () => {
    setNavStack((prev) => prev.slice(0, -1));
  };

  const toggleAccordion = (id) => {
    setOpenAccordions((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Mobile Search Submit
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/catalog?search=${encodeURIComponent(searchQuery.trim())}`);
      setIsMobileSearchOpen(false);
    }
  };

  return (
    <>
      <div className="h-16 lg:h-[115px] w-full bg-white relative z-0" aria-hidden="true" />
      <header
        className={`bg-white fixed top-0 left-0 right-0 z-40  border-b  border-black/5 transition-transform duration-300 ease-out ${isHeaderVisible ? "translate-y-0" : "-translate-y-full"
          }`}
      >
        <div className="container mx-auto px-4 lg:px-8">

          {/* DESKTOP + MOBILE TOP ROW */}
          <div className="flex items-center justify-between py-1.5 lg:py-1.5 gap-4">

            {/* LEFT: Logo */}
            <div className="flex items-center shrink-0">
              {/* Mobile Menu Button - VISIBLE ONLY ON MOBILE */}
              <button
                onClick={() => setIsMenuOpen(true)}
                className="lg:hidden p-2 -ml-2 mr-2 text-black hover:text-accent transition-colors"
                aria-label="Menu"
              >
                <MenuIcon className="w-6 h-6" />
              </button>

              <Link href="/" className="block">
                <Image
                  src={Logo}
                  alt="Regal HoReCa"
                  priority
                  className="h-10 md:h-12  w-auto object-contain"
                />
              </Link>
            </div>

            {/* CENTER: Search Bar - DESKTOP ONLY */}
            <div className="hidden lg:flex flex-1 justify-center max-w-2xl px-8 py-2.5">
              <SearchBar className="w-full" />
            </div>

            {/* RIGHT: Actions */}
            <div className="flex items-center gap-3 md:gap-6">

              {/* Mobile Search Icon */}
              <button
                onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
                className="lg:hidden p-2 text-black hover:text-accent"
              >
                {isMobileSearchOpen ? <XIcon className="w-5 h-5" /> : <SearchIcon className="w-5 h-5" />}
              </button>

              {/* Wishlist */}
              <Link href="/wishlist" className="relative p-1.5 text-black hover:text-accent transition-colors group">
                <HeartIcon className="w-5 h-5 md:w-5 md:h-5" />
                {wishlist.length > 0 && (
                  <span className="absolute top-0 right-0 bg-accent text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold shadow-sm">
                    {wishlist.length}
                  </span>
                )}
              </Link>

              {/* Cart */}
              <button
                onClick={() => setIsCartOpen(true)}
                className="relative p-1.5 text-black hover:text-accent transition-colors"
              >
                <ShoppingCartIcon className="w-5 h-5 md:w-5 md:h-5" />
                {getCartTotalItems() > 0 && (
                  <span className="absolute top-0 right-0 bg-accent text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold shadow-sm">
                    {getCartTotalItems()}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* DESKTOP NAVIGATION BAR (Departments) */}
          <div className="hidden lg:block border-t border-black/5">
            <DepartmentsBar
              departments={departments}
              departmentMenuRefs={departmentMenuRefs}
              activeDepartment={activeDepartment}
              setActiveDepartment={setActiveDepartment}
              departmentProducts={departmentProducts}
              navLinkClass={navLinkClass}
              isMoreDropdownOpen={isMoreDropdownOpen}
              setIsMoreDropdownOpen={setIsMoreDropdownOpen}
              topLevelCategories={topLevelCategories}
              productsLoading={productsLoading}
              productsError={productsError}
            />
          </div>

          {/* MOBILE SEARCH BAR EXPANDABLE */}
          <MobileSearchBar
            isMobileSearchOpen={isMobileSearchOpen}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            handleSearchSubmit={handleSearchSubmit}
          />
        </div>
      </header>

      {/* MOBILE MENU OVERLAY */}
      <MobileMenuOverlay
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
        navStack={navStack}
        wishlist={wishlist}
        cartTotalItems={getCartTotalItems()}
        onCartClick={() => {
          setIsMenuOpen(false);
          setIsCartOpen(true);
        }}
        openAccordions={openAccordions}
        toggleAccordion={toggleAccordion}
        handleNavForward={handleNavForward}
        handleNavBack={handleNavBack}
        departments={departments}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        handleSearchSubmit={handleSearchSubmit}
        onProfileClick={() => {
          setIsMenuOpen(false);
          setIsProfileModalOpen(true);
        }}
      />

      {/* Cart Drawer */}
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />

      {/* Profile Modal */}
      <LightCaptureModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onSubmit={async ({ phone, name, userType }) => {
          // Save profile
          updateSavedLeadProfile({ phone, name, userType });
          setIsProfileModalOpen(false);
          toast.success('Profile updated successfully!');
        }}
        defaultUserType="unknown"
      />
    </>
  );
}

/* =========================
   DEPARTMENTS BAR (DESKTOP)
   ========================= */

function DepartmentsBar({
  departments,
  departmentMenuRefs,
  activeDepartment,
  setActiveDepartment,
  departmentProducts,
  navLinkClass,
  isMoreDropdownOpen,
  setIsMoreDropdownOpen,
  productsLoading,
  productsError,
}) {
  // Always show the department bar, even if empty (will show Home, About, More)
  // if (!departments.length) return null;

  // Find active department by slug (consistent identifier) or by id (fallback)
  const activeDept = departments.find((d) => 
    d.slug === activeDepartment || (d._id || d.id) === activeDepartment
  ) || null;
  const hasActiveChildren = activeDept && activeDept.children && activeDept.children.length > 0;

  // Get products for active department
  const activeDeptProducts = activeDept?.slug ? (departmentProducts[activeDept.slug] || []) : [];

  // More dropdown links
  const moreLinks = [
    { name: 'Contact', href: '/#contact' },
    { name: "FAQ's", href: '/#faqs' },
    { name: 'Enquiry', href: '/enquiry' },
  ];

  // Ref for More button to position dropdown
  const moreButtonRef = useRef(null);
  const [dropdownRight, setDropdownRight] = useState(0);

  // Calculate More dropdown position
  useEffect(() => {
    if (isMoreDropdownOpen && moreButtonRef.current) {
      const buttonRect = moreButtonRef.current.getBoundingClientRect();
      const container = moreButtonRef.current.closest('.w-full.relative');
      if (container) {
        const containerRect = container.getBoundingClientRect();
        // Calculate distance from right edge of container to right edge of button
        const rightOffset = containerRect.right - buttonRect.right;
        setDropdownRight(rightOffset);
      }
    }
  }, [isMoreDropdownOpen]);

  return (
    <>
      <div
        className="w-full relative p-1"
        onMouseLeave={() => {
          setActiveDepartment(null);
          setIsMoreDropdownOpen(false);
        }}
      >
        <nav className="flex flex-nowrap justify-center gap-4 md:gap-4 lg:gap-4 xl:gap-12 overflow-x-auto hide-scrollbar">
          {/* Home Link */}
          <Link href="/" className={navLinkClass}>
            <span>Home</span>
            <span className="absolute bottom-[-1px] left-0 w-0 h-[2px] bg-accent transition-all duration-300 group-hover:w-full"></span>
          </Link>

          {departments.map((dept) => {
            // Use slug as consistent identifier (works for both static and dynamic departments)
            const deptSlug = dept.slug;
            const id = dept._id || dept.id;
            const isActive = activeDepartment === deptSlug || activeDepartment === id;

            return (
              <div
                key={id}
                ref={(el) => (departmentMenuRefs.current[deptSlug] = el)}
                className="relative flex items-center h-full"
                onMouseEnter={() => setActiveDepartment(deptSlug)}
              >
                <Link href={`/catalog?category=${dept.slug}`} className={navLinkClass}>
                  <span>{dept.name}</span>
                  {/* Active/Hover line */}
                  <span
                    className={`absolute bottom-[-1px] left-0 h-[2px] bg-accent transition-all duration-300 ${isActive ? 'w-full' : 'w-0 group-hover:w-full'}`}
                  />
                </Link>
              </div>
            );
          })}

          <Link href="/about" className={navLinkClass}>
            <span>About Us</span>
            <span className="absolute bottom-[-1px] left-0 w-0 h-[2px] bg-accent transition-all duration-300 group-hover:w-full"></span>
          </Link>

          {/* More Dropdown */}
          <div
            ref={moreButtonRef}
            className="relative flex items-center"
            onMouseEnter={() => setIsMoreDropdownOpen(true)}
            onMouseLeave={() => setIsMoreDropdownOpen(false)}
          >
            <button className={`${navLinkClass} flex items-center gap-1`}>
              <span>More</span>
              <ChevronDownIcon className={`w-3 h-3 transition-transform ${isMoreDropdownOpen ? 'rotate-180' : ''}`} />
              <span
                className={`absolute bottom-[-1px] left-0 h-[2px] bg-accent transition-all duration-300 ${isMoreDropdownOpen ? 'w-full' : 'w-0 group-hover:w-full'}`}
              />
            </button>
          </div>
        </nav>

        {/* More Dropdown - Positioned outside nav, below the More button */}
        <AnimatePresence>
          {isMoreDropdownOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              onMouseEnter={() => setIsMoreDropdownOpen(true)}
              onMouseLeave={() => setIsMoreDropdownOpen(false)}
              className="absolute top-full mt-1 w-48 bg-white border border-black/10 shadow-lg rounded-lg overflow-hidden py-2 z-[100]"
              style={{
                right: `${dropdownRight}px`
              }}
            >
              {moreLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block px-6 py-3 text-xs font-bold uppercase tracking-widest text-black/70 hover:bg-gray-50 hover:text-accent transition-colors"
                >
                  {link.name}
                </Link>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* SHARED CENTERED MEGA DROPDOWN */}
        <div
          className={`
            absolute left-0 w-full
            top-[calc(100%+1px)]
            bg-white/95 backdrop-blur-md
            overflow-hidden
            transform-gpu
            transition-all duration-500 ease-out
            z-30 border-b border-black/10 shadow-xl
            ${hasActiveChildren
              ? "opacity-100 translate-y-0 visible max-h-[500px]"
              : "opacity-0 -translate-y-2 invisible max-h-0"
            }
          `}
        >
          {/* Mega Menu Content */}
          {activeDept && hasActiveChildren && (
            <div className="container mx-auto px-8 py-8">
              <div className="flex gap-8">
                {/* Categories Grid */}
                {/* Categories Grid - Adjusted per user request for consistent alignment */}
                {/* Categories Grid - Dynamic columns (spread evenly if < 6, wrap after 6) */}
                <div
                  className={`flex-1 grid gap-x-8 gap-y-8 content-start ${activeDept.children.length >= 6
                    ? 'grid-cols-6'
                    : activeDept.children.length === 5 ? 'grid-cols-5'
                      : activeDept.children.length === 4 ? 'grid-cols-4'
                        : activeDept.children.length === 3 ? 'grid-cols-3'
                          : activeDept.children.length === 2 ? 'grid-cols-2'
                            : 'grid-cols-1'
                    }`}
                >
                  {activeDept.children.map((childCat) => (
                    <div
                      key={childCat._id || childCat.id}
                      className="space-y-3"
                    >
                      <Link
                        href={`/catalog?category=${childCat.slug}`}
                        className="block text-xs font-semibold uppercase tracking-wide text-black hover:text-accent pb-2 border-b border-black/5 min-h-[1.5rem] line-clamp-2"
                        title={childCat.name}
                      >
                        {childCat.name}
                      </Link>
                      {childCat.children && childCat.children.length > 0 && (
                        <ul className="space-y-1.5">
                          {childCat.children.slice(0, 5).map((sub) => (
                            <li key={sub._id || sub.id}>
                              <Link
                                href={`/catalog?category=${sub.slug}`}
                                className="text-xs text-gray-500 hover:text-accent transition-colors block leading-tight"
                              >
                                {sub.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>

                {/* Featured Section on Right */}
                <div className="w-[180px] shrink-0 border-l border-black/10 pl-6">
                  <FeaturedProductsSection 
                    department={activeDept} 
                    products={activeDeptProducts}
                    isLoading={productsLoading}
                    error={productsError}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function FeaturedProductsSection({ department, products, isLoading, error }) {
  // API already filters by featured=true, so just take first product
  // No need for redundant client-side filtering
  const featuredProduct = useMemo(() => {
    if (!products || products.length === 0) return null;
    // API already returns only featured products, so just take the first one
    return products[0];
  }, [products]);

  // Loading state
  if (isLoading) {
    return (
      <div>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-black mb-2">
          Featured
        </h3>
        <div className="aspect-square bg-gray-100 border border-black/5 rounded-md overflow-hidden relative mb-2 max-w-[140px] animate-pulse" />
        <div className="h-3 bg-gray-100 rounded mb-1 animate-pulse" />
        <div className="h-3 bg-gray-100 rounded w-2/3 animate-pulse" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-black mb-2">
          Featured
        </h3>
        <div className="text-[9px] text-gray-400">
          Unable to load
        </div>
      </div>
    );
  }

  // No products state
  if (!featuredProduct) return null;

  const formatPrice = (price) => {
    if (price == null) return 'Price on request';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(price).replace('₹', '₹ ');
  };

  const productId = featuredProduct._id || featuredProduct.id;
  const productSlug = featuredProduct.slug || productId?.toString();

  return (
    <div>
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-black mb-2">
        Featured
      </h3>
      <Link
        href={`/products/${productSlug}`}
        className="group block"
      >
        <div className="aspect-square bg-white border border-black/5 rounded-md overflow-hidden relative mb-2 max-w-[140px]">
          <Image
            src={featuredProduct.heroImage || featuredProduct.images?.[0] || '/placeholder.png'}
            alt={featuredProduct.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="140px"
          />
        </div>
        <h4 className="text-[10px] font-medium uppercase tracking-wide text-black group-hover:text-accent mb-0.5 transition-colors line-clamp-2 leading-tight">
          {featuredProduct.title}
        </h4>
        <span className="text-[10px] font-bold text-accent">
          {formatPrice(featuredProduct.price)}
        </span>
      </Link>
    </div>
  );
}

/* =========================
   MOBILE COMPONENTS (Preserved)
   ========================= */

function MobileSearchBar({ isMobileSearchOpen, searchQuery, setSearchQuery, handleSearchSubmit }) {
  return (
    <div
      className={`lg:hidden overflow-hidden transition-all duration-300 ease-in-out ${isMobileSearchOpen ? "max-h-16 opacity-100 mb-2" : "max-h-0 opacity-0"
        }`}
    >
      <form
        onSubmit={handleSearchSubmit}
        className="flex items-center border border-black/10 rounded-md px-3 py-2 bg-gray-50 mx-2"
      >
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-grow bg-transparent outline-none text-sm text-black placeholder:text-black/40"
        />
        <button type="submit" className="text-black/50 hover:text-accent">
          <SearchIcon className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}

// Category Icons for Mobile Menu
const CategoryIcon = ({ categorySlug, className = "w-5 h-5" }) => {
  const icons = {
    'tableware': (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    'kitchenware': (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
    'hotel-hospitality': (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    'catering': (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
      </svg>
    ),
    'barware': (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  };
  return icons[categorySlug] || icons['tableware'];
};

function MobileMenuOverlay({ isMenuOpen, setIsMenuOpen, navStack, wishlist, cartTotalItems, onCartClick, openAccordions, toggleAccordion, handleNavForward, handleNavBack, departments, searchQuery, setSearchQuery, handleSearchSubmit, router, onProfileClick }) {
  const currentMenu = navStack[navStack.length - 1] || {};

  return (
    <div
      className={`fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${isMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      onClick={() => setIsMenuOpen(false)}
    >
      <div
        className={`fixed inset-y-0 left-0 w-[85%] max-w-[320px] bg-white shadow-2xl transform transition-transform duration-300 ease-out flex flex-col ${isMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Menu Header */}
        <div className="flex items-center justify-between px-4 h-16 border-b border-gray-100 flex-shrink-0">
          <Link href="/" onClick={() => setIsMenuOpen(false)}>
            <Image src={Logo} alt="Regal" width={100} height={40} className="h-8 w-auto object-contain" />
          </Link>
          <button onClick={() => setIsMenuOpen(false)} className="p-2 text-black/60 hover:text-black">
            <XIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-4 py-4 border-b border-gray-300">
          <form onSubmit={handleSearchSubmit} className="relative">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none z-10" />
              <input
                type="text"
                placeholder="What are you looking for?"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-24 py-3 border-2 border-orange-200 rounded-lg text-xs text-black placeholder:text-gray-400 placeholder:text-xs bg-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all shadow-sm"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-accent text-white px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider hover:bg-red-600 active:bg-red-700 transition-all duration-200 shadow-sm hover:shadow-md whitespace-nowrap"
              >
                SEARCH
              </button>
            </div>
          </form>
        </div>

        {/* Quick Links */}
        <div className="border-b border-gray-300">
          <div className="flex">
            <Link
              href="/wishlist"
              onClick={() => setIsMenuOpen(false)}
              className="flex-1 flex items-center justify-center gap-2 py-4 px-4 text-sm font-medium text-black hover:bg-gray-50 transition-colors border-r border-gray-300 relative"
            >
              <div className="relative">
                <HeartIcon className="w-5 h-5 text-gray-700" />
                {wishlist.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-accent text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                    {wishlist.length}
                  </span>
                )}
              </div>
              <span>Wishlist</span>
            </Link>
            <button
              onClick={() => {
                setIsMenuOpen(false);
                onCartClick();
              }}
              className="flex-1 flex items-center justify-center gap-2 py-4 px-4 text-sm font-medium text-black hover:bg-gray-50 transition-colors relative"
            >
              <div className="relative">
                <ShoppingCartIcon className="w-5 h-5 text-gray-700" />
                {cartTotalItems > 0 && (
                  <span className="absolute -top-1 -right-1 bg-accent text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                    {cartTotalItems}
                  </span>
                )}
              </div>
              <span>My Cart</span>
            </button>
          </div>
        </div>

        {/* Menu Content */}
        <div className="flex-1 overflow-y-auto">
          {navStack.length > 1 ? (
            <>
              <button
                onClick={handleNavBack}
                className="flex items-center gap-2 px-4 py-3 w-full text-left text-sm font-semibold text-black/60 hover:bg-gray-50 border-b border-gray-50"
              >
                <ChevronLeftIcon className="w-4 h-4" />
                Back to {navStack[navStack.length - 2]?.name || "Menu"}
              </button>
              <div className="py-2">
                {currentMenu.children && currentMenu.children.map((item) => {
                  const hasChildren = item.children && item.children.length > 0;
                  const isServe = item.slug === "serve";

                  if (hasChildren && !isServe) {
                    return (
                      <div key={item.id} className="border-b border-gray-50/50">
                        <button
                          onClick={() => toggleAccordion(item.id)}
                          className="flex items-center justify-between w-full px-5 py-3 text-left"
                        >
                          <span className="text-[15px] font-medium text-black uppercase tracking-wide">{item.name}</span>
                          <ChevronDownIcon
                            className={`w-4 h-4 text-black/40 transition-transform ${openAccordions[item.id] ? 'rotate-180' : ''}`}
                          />
                        </button>
                        {openAccordions[item.id] && (
                          <div className="bg-gray-50 px-5 py-2 space-y-2">
                            {item.children.map(sub => (
                              <Link
                                key={sub.id}
                                href={`/catalog?category=${sub.slug}`}
                                onClick={() => setIsMenuOpen(false)}
                                className="block py-2 text-sm text-gray-600 hover:text-accent pl-2 border-l-2 border-transparent hover:border-accent"
                              >
                                {sub.name}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  }

                  return (
                    <Link
                      key={item.id}
                      href={item.slug}
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center justify-between px-5 py-3 text-[15px] font-medium text-black hover:bg-gray-50 border-b border-gray-50/50 uppercase tracking-wide"
                    >
                      {item.name}
                    </Link>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="py-2">
              {/* Home Link */}
              <Link
                href="/"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-3 px-5 py-3 text-[15px] font-medium text-black hover:bg-gray-50 border-b border-gray-50/50"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span>Home</span>
              </Link>

              {/* Shop by Category Section */}
              {departments && departments.length > 0 && (
                <>
                  <div className="px-5 py-3 border-b border-gray-50/50">
                    <h3 className="text-xs font-bold text-black uppercase tracking-widest">SHOP BY CATEGORY</h3>
                  </div>
                  {departments.map((dept) => {
                    const deptSlug = dept.slug;
                    const hasChildren = dept.children && dept.children.length > 0;
                    
                    if (hasChildren) {
                      return (
                        <button
                          key={dept._id || dept.id || deptSlug}
                          onClick={() => {
                            handleNavForward({
                              id: dept._id || dept.id,
                              name: dept.name,
                              children: dept.children,
                            });
                          }}
                          className="flex items-center justify-between w-full px-5 py-3 text-left hover:bg-gray-50 border-b border-gray-50/50"
                        >
                          <div className="flex items-center gap-3">
                            <CategoryIcon categorySlug={deptSlug} className="w-5 h-5 text-black/60" />
                            <span className="text-[15px] font-medium text-black uppercase">{dept.name}</span>
                          </div>
                          <ChevronRightIcon className="w-4 h-4 text-black/40" />
                        </button>
                      );
                    }
                    
                    return (
                      <Link
                        key={dept._id || dept.id || deptSlug}
                        href={`/catalog?category=${deptSlug}`}
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center justify-between w-full px-5 py-3 text-left hover:bg-gray-50 border-b border-gray-50/50"
                      >
                        <div className="flex items-center gap-3">
                          <CategoryIcon categorySlug={deptSlug} className="w-5 h-5 text-black/60" />
                          <span className="text-[15px] font-medium text-black">{dept.name}</span>
                        </div>
                      </Link>
                    );
                  })}
                </>
              )}

              {/* About Us */}
              <Link
                href="/about"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-3 px-5 py-3 text-[15px] font-medium text-black hover:bg-gray-50 border-b border-gray-50/50"
              >
                <InfoIcon className="w-5 h-5 text-black/60" />
                <span>About Us</span>
              </Link>
            </div>
          )}
        </div>

        {/* Bottom Action Buttons */}
        {navStack.length === 1 && (
          <div className="border-t border-gray-100 p-4 flex gap-2">
            <button
              onClick={onProfileClick}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-50 text-black text-sm font-medium rounded-md hover:bg-gray-100 transition-colors"
            >
              <UserIcon className="w-5 h-5" />
              <span>Profile</span>
            </button>
            <Link
              href="/#contact"
              onClick={() => setIsMenuOpen(false)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-50 text-black text-sm font-medium rounded-md hover:bg-gray-100 transition-colors"
            >
              <PhoneIcon className="w-5 h-5" />
              <span>Contact</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
