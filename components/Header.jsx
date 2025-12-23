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
import Logo from "./new/regalLogo.png";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  HeartIcon,
  MenuIcon,
  XIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  SearchIcon,
  ShoppingCartIcon,
} from "./Icons";
import { useAppContext } from "@/context/AppContext";
import SearchBar from "./new/SearchBar";
import CartDrawer from "./CartDrawer";

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
  const { wishlist, cart, getCartTotalItems, categories, businessTypes, products } = useAppContext();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

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

  const departmentMenuRefs = useRef({});

  const navLinkClass =
    "text-sm md:text-[15px] font-semibold tracking-wide uppercase text-black hover:text-accent transition-colors relative py-4 group";

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

  // Hybrid approach: Use static departments for navbar, enrich with dynamic data when available
  // This ensures navbar appears immediately while mega-dropdowns stay dynamic
  const departments = useMemo(() => {
    // Helper function to normalize slugs for flexible matching
    const normalizeSlug = (slug) => {
      if (!slug) return '';
      return slug.toLowerCase().replace(/[^a-z0-9]/g, '');
    };

    // Debug: Log available category slugs (remove after debugging)
    if (process.env.NODE_ENV === 'development' && topLevelCategories.length > 0) {
      console.log('Available category slugs:', topLevelCategories.map(cat => ({ 
        name: cat.name, 
        slug: cat.slug 
      })));
    }

    // Always return static departments for consistent navbar (5 departments max)
    // When categories are loaded, enrich static departments with dynamic children data
    return STATIC_DEPARTMENTS.map((staticDept) => {
      // Try to find matching category from fetched data
      // First try exact match, then try normalized match (handles hyphen/underscore variations)
      const normalizedStaticSlug = normalizeSlug(staticDept.slug);
      const normalizedStaticName = normalizeSlug(staticDept.name);
      
      const matchingCategory = topLevelCategories.find(
        (cat) => {
          const catSlug = cat.slug || '';
          const catName = cat.name || '';
          
          // Try exact slug match first
          if (catSlug === staticDept.slug || catSlug.toLowerCase() === staticDept.slug.toLowerCase()) {
            return true;
          }
          // Try normalized slug match (handles hotel-hospitality vs hotelhospitality vs hotel_hospitality)
          if (normalizeSlug(catSlug) === normalizedStaticSlug) {
            return true;
          }
          // Try name-based matching as fallback (handles cases where slug differs but name matches)
          if (normalizeSlug(catName) === normalizedStaticName) {
            return true;
          }
          return false;
        }
      );
      
      if (matchingCategory) {
        // Return enriched department with dynamic children for mega-dropdown
        return {
          ...matchingCategory,
          name: matchingCategory.name.toUpperCase(), // Ensure uppercase for consistency
          id: matchingCategory._id || matchingCategory.id,
        };
      }
      
      // Fallback: return static department (navbar will still show, link will work)
      // Mega-dropdown won't show until category data loads
      return {
        ...staticDept,
        id: staticDept.slug, // Use slug as ID for static departments
        children: [], // Empty children until data loads
      };
    });
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
      <div className="h-[72px] lg:h-[136px] w-full bg-white relative z-0" aria-hidden="true" />
      <header
        className={`bg-white fixed top-0 left-0 right-0 z-40 border-b border-black/5 transition-transform duration-300 ease-out ${isHeaderVisible ? "translate-y-0" : "-translate-y-full"
          }`}
      >
        <div className="container mx-auto px-4 lg:px-8">

          {/* DESKTOP + MOBILE TOP ROW */}
          <div className="flex items-center justify-between py-4 lg:py-5 gap-4">

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
                  className="h-8 md:h-10 w-auto object-contain"
                />
              </Link>
            </div>

            {/* CENTER: Search Bar - DESKTOP ONLY */}
            <div className="hidden lg:flex flex-1 justify-center max-w-2xl px-8">
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
              <Link href="/wishlist" className="relative p-2 text-black hover:text-accent transition-colors group">
                <HeartIcon className="w-5 h-5 md:w-6 md:h-6" />
                {wishlist.length > 0 && (
                  <span className="absolute top-0 right-0 bg-accent text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold shadow-sm">
                    {wishlist.length}
                  </span>
                )}
              </Link>

              {/* Cart */}
              <button
                onClick={() => setIsCartOpen(true)}
                className="relative p-2 text-black hover:text-accent transition-colors"
              >
                <ShoppingCartIcon className="w-5 h-5 md:w-6 md:h-6" />
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
              products={products}
              navLinkClass={navLinkClass}
              isMoreDropdownOpen={isMoreDropdownOpen}
              setIsMoreDropdownOpen={setIsMoreDropdownOpen}
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
  products,
  navLinkClass,
  isMoreDropdownOpen,
  setIsMoreDropdownOpen,
}) {
  if (!departments.length) return null;

  // Find active department by slug (consistent identifier) or by id (fallback)
  const activeDept = departments.find((d) => 
    d.slug === activeDepartment || (d._id || d.id) === activeDepartment
  ) || null;
  const hasActiveChildren = activeDept && activeDept.children && activeDept.children.length > 0;

  // More dropdown links
  const moreLinks = [
    { name: 'Contact', href: '/contact' },
    { name: "FAQ's", href: '/faqs' },
    { name: 'Enquiry', href: '/enquiry' },
  ];

  return (
    <>
      <div
        className="w-full relative"
        onMouseLeave={() => {
          setActiveDepartment(null);
          setIsMoreDropdownOpen(false);
        }}
      >
        <nav className="flex justify-center gap-8 xl:gap-12">
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
                        className="block text-xs font-bold uppercase tracking-wide text-black hover:text-accent pb-2 border-b border-black/5 min-h-[2.5rem] line-clamp-2"
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
                <div className="w-[240px] shrink-0 border-l border-black/10 pl-8">
                  <FeaturedProductsSection department={activeDept} products={products} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function FeaturedProductsSection({ department, products }) {
  // Get products for this department (featured first, then by category)
  const featuredProducts = useMemo(() => {
    if (!products || products.length === 0) return [];

    // Collect all category IDs in this department tree
    const getAllCategoryIds = (cat) => {
      const ids = [cat._id || cat.id];
      if (cat.children && cat.children.length > 0) {
        cat.children.forEach(child => {
          ids.push(...getAllCategoryIds(child));
        });
      }
      return ids;
    };

    const deptCategoryIds = getAllCategoryIds(department).map(id => id?.toString());

    // Filter products that belong to this department
    let deptProducts = products.filter((p) => {
      const pCategoryId = p.categoryId?._id || p.categoryId;
      if (!pCategoryId) return false;
      return deptCategoryIds.includes(pCategoryId?.toString());
    });

    // Prioritize featured products
    const featured = deptProducts.filter(p => p.featured);
    const others = deptProducts.filter(p => !p.featured);

    // Show only 1 featured product
    return [...featured, ...others].slice(0, 1);
  }, [department, products]);

  if (featuredProducts.length === 0) return null;

  const formatPrice = (price) => {
    if (price == null) return 'Price on request';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(price).replace('₹', '₹ ');
  };

  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-widest text-black mb-4">
        Featured
      </h3>
      {featuredProducts.map((product) => {
        const productId = product._id || product.id;
        // Get product slug with fallback - use ID if slug is missing (API handles both)
        const productSlug = product.slug || productId?.toString();
        
        return (
        <Link
          key={productId}
          href={`/products/${productSlug}`}
          className="group block"
        >
          <div className="aspect-square bg-white border border-black/5 rounded-lg overflow-hidden relative mb-3">
            <Image
              src={product.image || product.images?.[0] || '/placeholder.png'}
              alt={product.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
          </div>
          <h4 className="text-xs font-medium uppercase tracking-wide text-black group-hover:text-accent mb-1 transition-colors line-clamp-2">
            {product.title}
          </h4>
          <span className="text-xs font-bold text-accent">
            {formatPrice(product.price)}
          </span>
        </Link>
        );
      })}
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
