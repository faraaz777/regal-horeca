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
  SearchIcon,
  ShoppingCartIcon,
} from "./Icons";
import { useAppContext } from "@/context/AppContext";
import SearchBar from "./new/SearchBar";
import CartDrawer from "./CartDrawer";

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
  const [activeDesktopMenu, setActiveDesktopMenu] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [navStack, setNavStack] = useState([]);
  const [openAccordions, setOpenAccordions] = useState({});
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [activeDepartment, setActiveDepartment] = useState(null);
  const [isMoreDropdownOpen, setIsMoreDropdownOpen] = useState(false);
  const [isAllCategoriesDropdownOpen, setIsAllCategoriesDropdownOpen] = useState(false);
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
  const departments = useMemo(() => {
    if (!topLevelCategories || topLevelCategories.length === 0) {
      return [];
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
      <div className="h-[80px] lg:h-[115px] w-full bg-white relative z-0" aria-hidden="true" />
      <header
        className={`bg-white fixed top-0 left-0 right-0 z-40 border-b border-black/5 transition-transform duration-300 ease-out ${isHeaderVisible ? "translate-y-0" : "-translate-y-full"
          }`}
      >
        <div className="container mx-auto px-4 lg:px-8">

          {/* DESKTOP + MOBILE TOP ROW */}
          <div className="flex items-center justify-between py-2 lg:py-2.5 gap-4">

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
                  className="h-7 md:h-8 w-auto object-contain"
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
              isAllCategoriesDropdownOpen={isAllCategoriesDropdownOpen}
              setIsAllCategoriesDropdownOpen={setIsAllCategoriesDropdownOpen}
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
      />

      {/* Cart Drawer */}
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
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
  isAllCategoriesDropdownOpen,
  setIsAllCategoriesDropdownOpen,
  topLevelCategories,
  productsLoading,
  productsError,
}) {
  if (!departments.length) return null;

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

  return (
    <>
      <div
        className="w-full relative"
        onMouseLeave={() => {
          setActiveDepartment(null);
          setIsMoreDropdownOpen(false);
          setIsAllCategoriesDropdownOpen(false);
        }}
      >
        <nav className="flex flex-nowrap justify-center gap-4 md:gap-4 lg:gap-4 xl:gap-12 overflow-x-auto hide-scrollbar">
          {/* Home Link */}
          <Link href="/" className={navLinkClass}>
            <span>Home</span>
            <span className="absolute bottom-[-1px] left-0 w-0 h-[2px] bg-accent transition-all duration-300 group-hover:w-full"></span>
          </Link>

          {/* All Categories Dropdown */}
          <div
            className="relative flex items-center h-full"
            onMouseEnter={() => setIsAllCategoriesDropdownOpen(true)}
            onMouseLeave={() => setIsAllCategoriesDropdownOpen(false)}
          >
            <Link href="/catalog" className={`${navLinkClass} flex items-center gap-1.5 bg-accent text-white font-semibold px-3 py-1.5 hover:text-white `}>
              <MenuIcon className="w-4 h-4 pb-0.5" />
              <span>All Categories</span>
              <ChevronDownIcon className={`w-3 h-3 transition-transform ${isAllCategoriesDropdownOpen ? 'rotate-180' : ''}`} />
            </Link>

          </div>
            {/* All Categories Dropdown - Positioned directly below the button */}
            <AnimatePresence>
              {isAllCategoriesDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  onMouseEnter={() => setIsAllCategoriesDropdownOpen(true)}
                  onMouseLeave={() => setIsAllCategoriesDropdownOpen(false)}
                  className="absolute top-full  sm:left-20  lg:left-20 xl:left-60 w-[280px] bg-white z-[100] shadow-2xl border border-black/10 rounded-lg overflow-hidden"
                >
                  <div className="py-3">
                    {departments && departments.length > 0 ? (
                      departments.map((dept) => (
                        <Link
                          key={dept._id || dept.id || dept.slug}
                          href={`/catalog?category=${dept.slug}`}
                          className="flex items-center gap-4 px-5 py-3 text-sm font-medium text-black/80 hover:bg-gray-100 hover:text-accent transition-colors"
                        >
                          <span className="whitespace-nowrap">
                            {dept.name}
                          </span>
                        </Link>
                      ))
                    ) : (
                      <div className="px-5 py-3 text-sm text-black/40">
                        No departments
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

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

            {/* Simple Dropdown for More */}
            {isMoreDropdownOpen && (
              <div className="absolute top-full right-0 mt-0 w-48 bg-white border border-black/10 shadow-lg rounded-b-lg overflow-hidden py-2 z-50">
                {moreLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="block px-6 py-3 text-xs font-bold uppercase tracking-widest text-black/70 hover:bg-gray-50 hover:text-accent transition-colors"
                  >
                    {link.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>

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

function MobileMenuOverlay({ isMenuOpen, setIsMenuOpen, navStack, wishlist, cartTotalItems, onCartClick, openAccordions, toggleAccordion, handleNavForward, handleNavBack }) {
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

        {/* Menu Content */}
        <div className="flex-1 overflow-y-auto">
          {navStack.length > 1 && (
            <button
              onClick={handleNavBack}
              className="flex items-center gap-2 px-4 py-3 w-full text-left text-sm font-semibold text-black/60 hover:bg-gray-50 border-b border-gray-50"
            >
              <ChevronLeftIcon className="w-4 h-4" />
              Back to {navStack[navStack.length - 2]?.name || "Menu"}
            </button>
          )}

          <div className="py-2">
            {currentMenu.children && currentMenu.children.map((item) => {
              const hasChildren = item.children && item.children.length > 0;
              const isServe = item.slug === "serve";

              if (hasChildren && !isServe) {
                // Accordion for deep trees
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
            {/* Static Links for Root */}
            {navStack.length === 1 && (
              <>
                <Link href="/about" onClick={() => setIsMenuOpen(false)} className="block px-5 py-3 text-[15px] font-medium text-black hover:bg-gray-50 border-b border-gray-50/50 uppercase tracking-wide">About Us</Link>
                <Link href="/contact" onClick={() => setIsMenuOpen(false)} className="block px-5 py-3 text-[15px] font-medium text-black hover:bg-gray-50 border-b border-gray-50/50 uppercase tracking-wide">Contact</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
