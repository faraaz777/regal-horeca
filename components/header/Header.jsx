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
import Logo from "../new/regalLogo.png";
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
  InfoIcon,
  UserIcon,
  PhoneIcon,
} from "../Icons";
import { ClipboardList as LuClipboardList, Mic as LuMic } from "lucide-react";
import { useAppContext } from "@/context/AppContext";
import { buildCategoryTree } from "@/lib/utils/categoryUtils";
import SearchBar from "../new/SearchBar";
import CartDrawer from "../CartDrawer";
import LightCaptureModal, { updateSavedLeadProfile } from "../LightCaptureModal";
import { LoadingLink } from "@/components/ui/LoadingCTA";
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

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMenuOpen) {
      // Save current scroll position
      const scrollY = window.scrollY;
      // Lock body scroll
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      
      return () => {
        // Restore scroll position when menu closes
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isMenuOpen]);
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
  // Use optimized utility (single-pass parent map, no repeated .filter())
  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);

  // Root-level categories (same as categoryTree from utility)
  const topLevelCategories = categoryTree;

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
        <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">

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
                  alt="REGAL® HoReCa - Commercial kitchen equipment Hyderabad"
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
                <LuClipboardList className="w-5 h-5 md:w-5 md:h-5" />
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
    { name: 'Company Profile', href: '/company-profile' },
    { name: 'Chef Podcast', href: '/chef-podcast' },
    { name: 'Contact', href: '/#contact' },
    { name: "FAQ's", href: '/#faqs' },
    { name: 'Enquiry', href: '/enquiry' },
  ];

  const moreButtonRef = useRef(null);
  const [moreDropdownLeft, setMoreDropdownLeft] = useState(0);

  // Keep popup aligned with "More" button while rendering outside nav flow.
  useEffect(() => {
    if (!isMoreDropdownOpen || !moreButtonRef.current) return;

    const updatePosition = () => {
      const triggerRect = moreButtonRef.current.getBoundingClientRect();
      const navContainer = moreButtonRef.current.closest('.w-full.relative');
      if (!navContainer) return;

      const containerRect = navContainer.getBoundingClientRect();
      const dropdownWidth = 176; // w-44
      const rawLeft = triggerRect.right - containerRect.left - dropdownWidth;
      const maxLeft = Math.max(0, containerRect.width - dropdownWidth);
      const clampedLeft = Math.max(0, Math.min(rawLeft, maxLeft));
      setMoreDropdownLeft(clampedLeft);
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
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

          {/* More Trigger */}
          <div
            ref={moreButtonRef}
            className="relative z-[100] flex items-center"
            onMouseEnter={() => setIsMoreDropdownOpen(true)}
            onMouseLeave={() => setIsMoreDropdownOpen(false)}
          >
            <button type="button" className={`${navLinkClass} flex items-center gap-1`}>
              <span>More</span>
              <ChevronDownIcon className={`w-3 h-3 transition-transform ${isMoreDropdownOpen ? 'rotate-180' : ''}`} />
              <span
                className={`absolute bottom-[-1px] left-0 h-[2px] bg-accent transition-all duration-300 ${isMoreDropdownOpen ? 'w-full' : 'w-0 group-hover:w-full'}`}
              />
            </button>
          </div>
        </nav>

        {/* More Popup (outside nav; doesn't affect nav scroll width) */}
        <AnimatePresence>
          {isMoreDropdownOpen && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onMouseEnter={() => setIsMoreDropdownOpen(true)}
              onMouseLeave={() => setIsMoreDropdownOpen(false)}
              className="absolute top-full  w-44 bg-white border border-black/10 shadow-lg rounded-lg overflow-hidden py-1 z-[100]"
              style={{ left: `${moreDropdownLeft}px` }}
            >
              {moreLinks.map((link) => (
                <LoadingLink
                  key={link.href}
                  href={link.href}
                  className="!flex !w-full !justify-start px-8 py-2 text-xs font-bold uppercase tracking-widest text-black/70 hover:bg-gray-50 hover:text-accent transition-colors leading-tight"
                >
                  {link.name}
                </LoadingLink>
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
              ? "opacity-100 translate-y-0 visible max-h-[85vh]"
              : "opacity-0 -translate-y-2 invisible max-h-0"
            }
          `}
        >
          {/* Mega Menu Content */}
          {activeDept && hasActiveChildren && (
            <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                          {childCat.children
                            .slice(0, (childCat.name?.toUpperCase() === 'STAINLESS STEEL FABRICATION' || childCat.slug === 'stainless-steel-fabrication') ? 30 : 12)
                            .map((sub) => (
                            <li key={sub._id || sub.id}>
                              <Link
                                href={`/catalog?category=${sub.slug}`}
                                className="text-sm text-gray-500 hover:text-accent transition-colors block leading-tight"
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
      <svg className={className} viewBox="0 0 32 32" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M13.67 2.00067C13.14 2.00067 12.72 2.42067 12.72 2.94067V6.64067C12.72 6.91067 12.5 7.13067 12.23 7.13067 11.96 7.13067 11.74 6.91067 11.74 6.64067V2.98067C11.74 2.46067 11.34 2.01067 10.83 2.00067 10.3 1.98067 9.86 2.41067 9.86 2.94067V6.64067C9.86 6.91067 9.64 7.13067 9.37 7.13067 9.1 7.13067 8.88 6.91067 8.88 6.64067V2.98067C8.88 2.46067 8.48 2.01067 7.97 2.00067 7.44 1.98067 7 2.41067 7 2.94067V9.26067C7 10.5001 7.5894 11.5997 8.50296 12.2944 9.35 12.9134 9.35 14.9107 9.35 14.9107V28.7107C9.35 29.4207 9.93 30.0007 10.64 30.0007H10.96C11.67 30.0007 12.25 29.4207 12.25 28.7107V14.9007C12.25 14.9007 12.25 12.8644 13.0838 12.2944 14.0049 11.6003 14.6 10.4961 14.6 9.25067V2.94067C14.61 2.42067 14.19 2.00067 13.67 2.00067ZM23.06 2.00061C24.3 2.00061 25.3 3.00061 25.3 4.24061V17.8906L25.29 17.887V28.7006C25.29 29.4106 24.71 29.9906 24 29.9906H23.68C22.97 29.9906 22.39 29.4106 22.39 28.7006V16.8369C20.8453 16.1365 19.84 14.591 19.84 12.8706V5.22061C19.83 3.44061 21.28 2.00061 23.06 2.00061Z" />
      </svg>
    ),
    'kitchenware': (
      <svg className={className} viewBox="-3 0 75 122.88" fill="currentColor" stroke="currentColor" strokeWidth="2.4" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <g>
          <path d="M6.14,0H65.4c1.69,0,3.23,0.69,4.34,1.8c1.11,1.11,1.8,2.65,1.8,4.34v29.67v73.73c0,1.69-0.69,3.23-1.8,4.34 c-1.11,1.11-2.65,1.8-4.34,1.8H6.14c-1.69,0-3.23-0.69-4.34-1.8c-1.11-1.11-1.8-2.65-1.8-4.34V35.81V6.14C0,4.45,0.69,2.91,1.8,1.8C2.91,0.69,4.45,0,6.14,0L6.14,0z M12.2,44.89c0-1.34,1.09-2.43,2.43-2.43 c1.34,0,2.43,1.09,2.43,2.43v20.4c0,1.34-1.09,2.43-2.43,2.43c-1.34,0-2.43-1.09-2.43-2.43V44.89L12.2,44.89z M12.2,10.39 c0-1.34,1.09-2.43,2.43-2.43c1.34,0,2.43,1.09,2.43,2.43v15.15c0,1.34-1.09,2.43-2.43,2.43c-1.34,0-2.43-1.09-2.43-2.43V10.39 L12.2,10.39z M4.87,33.37h61.81V6.14c0-0.35-0.14-0.67-0.38-0.9c-0.23-0.23-0.55-0.38-0.9-0.38H6.14c-0.35,0-0.67,0.14-0.9,0.38 c-0.23,0.23-0.38,0.55-0.38,0.9V33.37L4.87,33.37z M66.67,38.24H4.87v71.29c0,0.35,0.14,0.67,0.38,0.9 c0.23,0.23,0.55,0.38,0.9,0.38H65.4c0.35,0,0.67-0.14,0.9-0.38c0.23-0.23,0.38-0.55,0.38-0.9V38.24L66.67,38.24z"/>
        </g>
      </svg>
    ),
    'hospitality': (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M7,12.5a3,3,0,1,0-3-3A3,3,0,0,0,7,12.5Zm0-4a1,1,0,1,1-1,1A1,1,0,0,1,7,8.5Zm13-2H12a1,1,0,0,0-1,1v6H3v-8a1,1,0,0,0-2,0v13a1,1,0,0,0,2,0v-3H21v3a1,1,0,0,0,2,0v-9A3,3,0,0,0,20,6.5Zm1,7H13v-5h7a1,1,0,0,1,1,1Z" />
      </svg>
    ),
    'catering': (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <g>
          {/* Handle knob */}
          <ellipse cx="12" cy="6" rx="0.8" ry="0.5" fill="currentColor"/>
          <rect x="11.2" y="6" width="1.6" height="0.6" fill="currentColor"/>
          
          {/* Main dome cloche */}
          <path d="M5,14 Q5,8 12,8 T19,14" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="1.2" 
                strokeLinecap="round"
                strokeLinejoin="round"/>
          
          {/* Base horizontal line */}
          <line x1="4.5" y1="14" x2="19.5" y2="14" 
                stroke="currentColor" 
                strokeWidth="1.2" 
                strokeLinecap="round"/>
          
          {/* Base plate */}
          <rect x="4" y="16" width="16" height="1.2" rx="0.6" fill="currentColor"/>
        </g>
      </svg>
    ),
    'barware': (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m12 12 7-8H5l7 8Zm0 0v8m-3 0h6M8.54939 8h6.95051"/>
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
      onTouchMove={(e) => {
        // Prevent scrolling on backdrop
        if (e.target === e.currentTarget) {
          e.preventDefault();
        }
      }}
    >
      <div
        className={`fixed inset-y-0 left-0 w-[85%] max-w-[320px] sm:max-w-[380px] md:max-w-[420px] bg-white shadow-2xl transform transition-transform duration-300 ease-out flex flex-col ${isMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Menu Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 md:px-8 h-16 sm:h-[72px] border-b border-gray-100 flex-shrink-0">
          <Link href="/" onClick={() => setIsMenuOpen(false)}>
            <Image src={Logo} alt="REGAL® HoReCa" width={100} height={40} className="h-8 w-auto object-contain" />
          </Link>
          <button onClick={() => setIsMenuOpen(false)} className="p-2 text-black/60 hover:text-black">
            <XIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-5 border-b border-gray-300">
          <form onSubmit={handleSearchSubmit} className="relative">
            <div className="relative">
              <SearchIcon className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none z-10" />
              <input
                type="text"
                placeholder="What are you looking for?"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 sm:pl-12 pr-24 py-3 sm:py-3.5 border-2 border-orange-200 rounded-lg text-xs sm:text-sm text-black placeholder:text-gray-400 bg-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all shadow-sm"
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
              className="flex-1 flex items-center justify-center gap-2 py-4 sm:py-5 px-4 sm:px-6 text-sm sm:text-base font-medium text-black hover:bg-gray-50 transition-colors border-r border-gray-300 relative"
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
              className="flex-1 flex items-center justify-center gap-2 py-4 sm:py-5 px-4 sm:px-6 text-sm sm:text-base font-medium text-black hover:bg-gray-50 transition-colors relative"
            >
              <div className="relative">
                <LuClipboardList className="w-5 h-5 text-gray-700" />
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
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8">
          {navStack.length > 1 ? (
            <>
              <button
                onClick={handleNavBack}
                className="flex items-center gap-2 w-full text-left text-sm sm:text-base font-semibold text-black/60 hover:bg-gray-50 border-b border-gray-50 py-3.5 sm:py-4 -mx-4 sm:-mx-6 md:-mx-8 px-4 sm:px-6 md:px-8"
              >
                <ChevronLeftIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                Back to {navStack[navStack.length - 2]?.name || "Menu"}
              </button>
              <div className="py-2 sm:py-3">
                {currentMenu.children && currentMenu.children.map((item) => {
                  const hasChildren = item.children && item.children.length > 0;
                  const isServe = item.slug === "serve";

                  if (hasChildren && !isServe) {
                    return (
                      <div key={item.id} className="border-b border-gray-50/50">
                        <button
                          onClick={() => toggleAccordion(item.id)}
                          className="flex items-center justify-between w-full py-3.5 sm:py-4 text-left -mx-4 sm:-mx-6 md:-mx-8 px-4 sm:px-6 md:px-8 hover:bg-gray-50/50"
                        >
                          <span className="text-sm sm:text-base font-medium text-black uppercase tracking-wide">{item.name}</span>
                          <ChevronDownIcon
                            className={`w-4 h-4 sm:w-5 sm:h-5 text-black/40 transition-transform flex-shrink-0 ${openAccordions[item.id] ? 'rotate-180' : ''}`}
                          />
                        </button>
                        {openAccordions[item.id] && (
                          <div className="bg-gray-50 -mx-4 sm:-mx-6 md:-mx-8 px-4 sm:px-6 md:px-8 py-2.5 sm:py-3 space-y-1.5 sm:space-y-2">
                            {item.children.map(sub => (
                              <Link
                                key={sub.id}
                                href={`/catalog?category=${sub.slug}`}
                                onClick={() => setIsMenuOpen(false)}
                                className="block py-2 sm:py-2.5 text-sm sm:text-base text-gray-600 hover:text-accent pl-3 sm:pl-4 border-l-2 border-transparent hover:border-accent"
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
                      className="flex items-center justify-between py-3.5 sm:py-4 text-sm sm:text-base font-medium text-black hover:bg-gray-50/50 border-b border-gray-50/50 uppercase tracking-wide -mx-4 sm:-mx-6 md:-mx-8 px-4 sm:px-6 md:px-8"
                    >
                      {item.name}
                    </Link>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="py-2 sm:py-3">
              {/* Home Link */}
              <Link
                href="/"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-3 py-3.5 sm:py-4 text-sm sm:text-base font-medium text-black hover:bg-gray-50/50 border-b border-gray-50/50 -mx-4 sm:-mx-6 md:-mx-8 px-4 sm:px-6 md:px-8"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span>Home</span>
              </Link>

              {/* Shop by Category Section */}
              {departments && departments.length > 0 && (
                <>
                  <div className="py-3.5 sm:py-4 border-b border-gray-50/50 -mx-4 sm:-mx-6 md:-mx-8 px-4 sm:px-6 md:px-8">
                    <h3 className="text-xs sm:text-sm font-bold text-black uppercase tracking-widest">SHOP BY CATEGORY</h3>
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
                          className="flex items-center justify-between w-full py-3.5 sm:py-4 text-left hover:bg-gray-50/50 border-b border-gray-50/50 -mx-4 sm:-mx-6 md:-mx-8 px-4 sm:px-6 md:px-8"
                        >
                          <div className="flex items-center gap-3 sm:gap-4">
                            <CategoryIcon categorySlug={deptSlug} className="w-5 h-5 sm:w-6 sm:h-6 text-black/60 flex-shrink-0" />
                            <span className="text-sm sm:text-base font-medium text-black uppercase">{dept.name}</span>
                          </div>
                          <ChevronRightIcon className="w-4 h-4 sm:w-5 sm:h-5 text-black/40 flex-shrink-0" />
                        </button>
                      );
                    }
                    
                    return (
                      <Link
                        key={dept._id || dept.id || deptSlug}
                        href={`/catalog?category=${deptSlug}`}
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center justify-between w-full py-3.5 sm:py-4 text-left hover:bg-gray-50/50 border-b border-gray-50/50 -mx-4 sm:-mx-6 md:-mx-8 px-4 sm:px-6 md:px-8"
                      >
                        <div className="flex items-center gap-3 sm:gap-4">
                          <CategoryIcon categorySlug={deptSlug} className="w-5 h-5 sm:w-6 sm:h-6 text-black/60 flex-shrink-0" />
                          <span className="text-sm sm:text-base font-medium text-black">{dept.name}</span>
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
                className="flex items-center gap-3 py-3.5 sm:py-4 text-sm sm:text-base font-medium text-black hover:bg-gray-50/50 border-b border-gray-50/50 -mx-4 sm:-mx-6 md:-mx-8 px-4 sm:px-6 md:px-8"
              >
                <InfoIcon className="w-5 h-5 sm:w-6 sm:h-6 text-black/60 flex-shrink-0" />
                <span>About Us</span>
              </Link>

              <Link
                href="/company-profile"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-3 py-3.5 sm:py-4 text-sm sm:text-base font-medium text-black hover:bg-gray-50/50 border-b border-gray-50/50 -mx-4 sm:-mx-6 md:-mx-8 px-4 sm:px-6 md:px-8"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-black/60 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Company Profile</span>
              </Link>

              <Link
                href="/chef-podcast"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-3 py-3.5 sm:py-4 text-sm sm:text-base font-medium text-black hover:bg-gray-50/50 border-b border-gray-50/50 -mx-4 sm:-mx-6 md:-mx-8 px-4 sm:px-6 md:px-8"
              >
                <LuMic className="w-5 h-5 sm:w-6 sm:h-6 text-black/60 flex-shrink-0" />
                <span>Chef Podcast</span>
              </Link>
            </div>
          )}
        </div>

        {/* Bottom Action Buttons */}
        {navStack.length === 1 && (
          <div className="border-t border-gray-100 p-4 sm:p-5 md:p-6 flex gap-2 sm:gap-3 flex-shrink-0">
            <button
              onClick={onProfileClick}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-50 text-black text-sm font-medium rounded-md hover:bg-gray-100 transition-colors"
            >
              <UserIcon className="w-5 h-5" />
              <span>Profile</span>
            </button>
            <LoadingLink
              href="/#contact"
              onClick={() => setIsMenuOpen(false)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-50 text-black text-sm font-medium rounded-md hover:bg-gray-100 transition-colors"
            >
              <PhoneIcon className="w-5 h-5" />
              <span>Contact</span>
            </LoadingLink>
          </div>
        )}
      </div>
    </div>
  );
}
