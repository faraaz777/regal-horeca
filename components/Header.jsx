"use client";

/**
 * Header Component
 *
 * Modular, modern/classic header with:
 * - Centered pill-style SearchBar on desktop
 * - Wishlist (acting as cart) with badge
 * - Desktop mega menus (Products / We Serve)
 * - Original mobile header + mobile menu preserved
 * - Smooth micro-interactions (hover, transitions)
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
  ChevronLeftIcon,
  SearchIcon,
  ShoppingCartIcon,
} from "./Icons";
import { useAppContext } from "@/context/AppContext";
import SearchBar from "./new/SearchBar";
import CartDrawer from "./CartDrawer";

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
  const [dropdownLeft, setDropdownLeft] = useState(0);
  const [activeDepartment, setActiveDepartment] = useState(null);
  const [departmentDropdownLeft, setDepartmentDropdownLeft] = useState(0);
  const [isMoreDropdownOpen, setIsMoreDropdownOpen] = useState(false);

  const productsMenuRef = useRef(null);
  const departmentMenuRefs = useRef({});

  const navLinkClass =
    "text-sm font-medium tracking-[0.25em] uppercase text-black hover:text-accent transition-colors";

  // ---------- Category tree building ----------
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

  const categoryTree = buildCategoryTree();
  const topLevelCategories = categoryTree.filter((cat) => {
    const catParent = cat.parent?._id || cat.parent || null;
    return catParent === null;
  });

  const departments = topLevelCategories.filter(
    (cat) => !cat.level || cat.level === "department" || cat.level === "category"
  );

  const rootNavMenu = {
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
  };

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

  // Scroll detection for header visibility
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

  // Listen for custom event to open cart drawer
  useEffect(() => {
    const handleOpenCartDrawer = () => {
      setIsCartOpen(true);
    };

    window.addEventListener('openCartDrawer', handleOpenCartDrawer);
    return () => window.removeEventListener('openCartDrawer', handleOpenCartDrawer);
  }, []);

  // Prevent horizontal scroll when dropdown is open
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

  // For MOBILE search – desktop uses SearchBar
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/catalog?search=${encodeURIComponent(searchQuery.trim())}`);
      setIsMobileSearchOpen(false);
    }
  };

  return (
    <>
      <header
        className={`bg-white/90 backdrop-blur  sticky top-0 z-30 transition-transform duration-300 ease-out  ${
          isHeaderVisible ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="container mx-auto px-4 lg:px-20">
          {/* DESKTOP HEADER */}
          <DesktopHeaderTopRow
            wishlist={wishlist}
            cartTotalItems={getCartTotalItems()}
            onCartClick={() => setIsCartOpen(true)}
            navLinkClass={navLinkClass}
            productsMenuRef={productsMenuRef}
            activeDesktopMenu={activeDesktopMenu}
            setActiveDesktopMenu={setActiveDesktopMenu}
            dropdownLeft={dropdownLeft}
            setDropdownLeft={setDropdownLeft}
            topLevelCategories={topLevelCategories}
            businessTypes={businessTypes}
          />

          {/* MOBILE HEADER */}
          <MobileHeaderBar
            isMobileSearchOpen={isMobileSearchOpen}
            setIsMobileSearchOpen={setIsMobileSearchOpen}
            setIsMenuOpen={setIsMenuOpen}
            wishlist={wishlist}
            cartTotalItems={getCartTotalItems()}
            onCartClick={() => setIsCartOpen(true)}
          />

          {/* MOBILE SEARCH (unchanged) */}
          <MobileSearchBar
            isMobileSearchOpen={isMobileSearchOpen}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            handleSearchSubmit={handleSearchSubmit}
          />

          {/* DESKTOP DEPARTMENTS BAR */}
          <DepartmentsBar
            departments={departments}
            departmentMenuRefs={departmentMenuRefs}
            activeDepartment={activeDepartment}
            setActiveDepartment={setActiveDepartment}
            departmentDropdownLeft={departmentDropdownLeft}
            setDepartmentDropdownLeft={setDepartmentDropdownLeft}
            products={products}
            isMoreDropdownOpen={isMoreDropdownOpen}
            setIsMoreDropdownOpen={setIsMoreDropdownOpen}
          />
        </div>
      </header>

      {/* MOBILE MENU OVERLAY (unchanged behavior) */}
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
   DESKTOP TOP ROW + NAV
   ========================= */

function DesktopHeaderTopRow({
  wishlist,
  cartTotalItems,
  onCartClick,
  navLinkClass,
  productsMenuRef,
  activeDesktopMenu,
  setActiveDesktopMenu,
  dropdownLeft,
  setDropdownLeft,
  topLevelCategories,
  businessTypes,
}) {
  return (
    <div className="hidden lg:block">
      {/* Top row: Logo - Center Search - Wishlist */}
      <div className="flex items-center justify-between gap-3 sm:gap-6 py-3 sm:py-4 flex-wrap md:flex-nowrap">
  {/* Logo */}
  <Link
    href="/"
    className="shrink-0 flex items-center"
  >
    <Image
      src={Logo}
      alt="REGAL"
      width={170}
      height={100}
      priority
      className="h-7 w-auto sm:h-8 md:h-10 lg:h-12 object-contain"
    />
  </Link>

  {/* Centered Search */}
  <div className="flex-1 flex justify-center order-3 w-full mt-3 md:mt-0 md:order-none">
    <div className="w-full max-w-xl">
      <SearchBar />
    </div>
  </div>

  {/* Wishlist and Cart */}
  <div className="flex items-center gap-4 order-2 md:order-none">
    <Link
      href="/wishlist"
      className="relative text-black hover:text-accent transition-colors"
    >
      <HeartIcon className="w-6 h-6" />
      {wishlist.length > 0 && (
        <span className="absolute -top-1 -right-2 bg-accent text-white text-xs rounded-full h-5 w-5 flex items-center justify-center shadow-sm">
          {wishlist.length}
        </span>
      )}
    </Link>
    <button
      onClick={onCartClick}
      className="relative text-black hover:text-accent transition-colors"
      aria-label="Open cart"
    >
      <ShoppingCartIcon className="w-6 h-6" />
      {cartTotalItems > 0 && (
        <span className="absolute -top-1 -right-2 bg-accent text-white text-xs rounded-full h-5 w-5 flex items-center justify-center shadow-sm">
          {cartTotalItems}
        </span>
      )}
    </button>
  </div>
</div>


      {/* Nav row: Home / Products / We Serve */}
     
    </div>
  );
}

// function WeServeDropdown({ activeDesktopMenu, businessTypes }) {
//   if (activeDesktopMenu !== "serve") return null;

//   return (
//     <div className="absolute top-full bg-white shadow-lg border-t border-gray-200 p-6 min-w-[220px]">
//       <ul className="space-y-3 text-sm">
//         {businessTypes.map((bt) => (
//           <li key={bt._id || bt.id}>
//             <Link
//               href={`/catalog?business=${bt.slug}`}
//               className="whitespace-nowrap text-gray-700 hover:text-primary transition-colors"
//             >
//               {bt.name}
//             </Link>
//           </li>
//         ))}
//       </ul>
//     </div>
//   );
// }

/* =========================
   DEPARTMENTS BAR (DESKTOP)
   ========================= */

   
   
   function DepartmentsBar({
    departments,
    departmentMenuRefs,
    activeDepartment,
    setActiveDepartment,
    products,
    isMoreDropdownOpen,
    setIsMoreDropdownOpen,
  }) {
    if (!departments.length) return null;
  
    const activeDept =
      departments.find((d) => (d._id || d.id) === activeDepartment) || null;
    const hasActiveChildren =
      activeDept && activeDept.children && activeDept.children.length > 0;
  
    // More dropdown links
    const moreLinks = [
      { name: 'Contact', href: '/contact' },
      { name: "FAQ's", href: '/faq' },
      { name: 'Enquiry', href: '/enquiry' },
    ];
  
    return (
      <div className="hidden lg:block">
        <hr className="absolute left-0 w-full border-black/20" />
  
        <div
          className="relative w-full mx-auto "
          onMouseLeave={() => {
            setActiveDepartment(null);
            setIsMoreDropdownOpen(false);
          }}
        >
          <nav className="px-4">
            <div className="flex items-center justify-center gap-6 xl:gap-8 w-full ">
              {/* Home Link */}
              <Link
                href="/"
                className="text-md font-medium text-black hover:text-accent whitespace-nowrap transition-colors duration-300 ease-out py-3 relative group"
              >
                <span className="relative inline-block">
                  Home
                  <span className="absolute bottom-0 left-1/2 w-0 h-0.5 bg-accent transition-all duration-300 ease-out group-hover:w-full group-hover:left-1/2 group-hover:-translate-x-1/2"></span>
                </span>
              </Link>

              {departments.map((dept) => {
                const id = dept._id || dept.id;
                const hasChildren = dept.children && dept.children.length > 0;
                const isActive = activeDepartment === id;
  
                return (
                  <div
                    key={id}
                    ref={(el) => (departmentMenuRefs.current[id] = el)}
                    className="relative"
                    onMouseEnter={() => setActiveDepartment(id)}
                  >
                    <Link
                      href={`/catalog?category=${dept.slug}`}
                      className="text-md font-medium text-black hover:text-accent whitespace-nowrap transition-colors duration-300 ease-out flex items-center gap-1.5 group py-3 relative"
                    >
                      <span className="relative inline-block">
                        {dept.name}
                        {!isActive && (
                          <span className="absolute bottom-0 left-1/2 w-0 h-0.5 bg-accent transition-all duration-300 ease-out group-hover:w-full group-hover:left-1/2 group-hover:-translate-x-1/2"></span>
                        )}
                        {isActive && (
                          <span className="absolute bottom-0 left-0 w-full h-0.5 bg-accent"></span>
                        )}
                      </span>
                      {hasChildren && (
                        <ChevronDownIcon
                          className={`w-3 h-3 transition-transform duration-300 ease-out ${
                            isActive ? "rotate-180" : "group-hover:rotate-180"
                          }`}
                        />
                      )}
                    </Link>
                  </div>
                );
              })}
              <Link
                href="/about"
                className="text-md font-medium text-black hover:text-accent whitespace-nowrap transition-colors duration-300 ease-out py-3 relative group"
              >
                <span className="relative inline-block">
                  About Us
                  <span className="absolute bottom-0 left-1/2 w-0 h-0.5 bg-accent transition-all duration-300 ease-out group-hover:w-full group-hover:left-1/2 group-hover:-translate-x-1/2"></span>
                </span>
              </Link>

              {/* More Dropdown */}
              <div
                className="relative"
                onMouseEnter={() => setIsMoreDropdownOpen(true)}
                onMouseLeave={() => setIsMoreDropdownOpen(false)}
              >
                <button
                  className="text-md font-medium text-black hover:text-accent whitespace-nowrap transition-colors duration-300 ease-out flex items-center gap-1.5 group py-3 relative"
                >
                  <span className="relative inline-block">
                    More
                    <span className={`absolute bottom-0 left-1/2 h-0.5 bg-accent transition-all duration-300 ease-out ${
                      isMoreDropdownOpen ? 'w-full left-1/2 -translate-x-1/2' : 'w-0 group-hover:w-full group-hover:left-1/2 group-hover:-translate-x-1/2'
                    }`}></span>
                  </span>
                  <ChevronDownIcon
                    className={`w-3 h-3 transition-transform duration-300 ease-out ${
                      isMoreDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* More Dropdown Menu */}
                {isMoreDropdownOpen && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 bg-white border border-black/10 rounded-lg shadow-lg z-50 min-w-[180px] overflow-hidden">
                    <div className="py-2">
                      {moreLinks.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          className="block px-4 py-2 text-sm text-black hover:bg-black/5 hover:text-accent transition-colors"
                        >
                          {link.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </nav>
  
          {/* SHARED CENTERED DROPDOWN – ALWAYS MOUNTED */}
          <div
            className={`
              absolute left-1/2 -translate-x-1/2 
              top-full
              w-full
              z-40
              bg-white
              shadow-[0_18px_45px_rgba(15,23,42,0.18)]
              border border-black/10 rounded-b-2xl
              overflow-hidden
              transform-gpu
              transition-all duration-700 md:duration-1000 ease-out
              ${
                hasActiveChildren
                  ? "opacity-100 translate-y-0 scale-100 pointer-events-auto visible"
                  : "opacity-0 -translate-y-3 scale-[0.98] pointer-events-none invisible"
              }
            `}
          >
            {/* Only render content if we actually have an active department */}
            {activeDept && hasActiveChildren && (
              <div className="w-full px-4 md:px-6 py-6 md:py-8 transition-opacity duration-700 md:duration-1000 ease-out">
                <div className="flex gap-6 items-start">
                  {/* Categories Section - Scrollable with Grid Layout */}
                  <div className="flex-1 max-h-[380px] overflow-y-auto pr-4 categories-scrollbar">
                    <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-x-8 gap-y-6">
                      {/* Show ALL categories */}
                      {activeDept.children.map((childCat) => (
                        <div
                          key={childCat._id || childCat.id}
                          className="min-w-[120px] max-w-[160px] transition-transform duration-500 ease-out"
                        >
                          {/* Category Name - consistent size, allows 2-line wrap */}
                          <Link
                            href={`/catalog?category=${childCat.slug}`}
                            className="block text-xs font-semibold uppercase tracking-wide text-black border-b border-black/10 pb-2 mb-3 hover:text-accent transition-colors duration-500 ease-out line-clamp-2 min-h-[2.5rem]"
                            title={childCat.name}
                          >
                            {childCat.name}
                          </Link>

                          {/* Subcategories */}
                          {childCat.children && childCat.children.length > 0 && (
                            <ul className="space-y-2">
                              {childCat.children.slice(0, 5).map((subcat) => (
                                <li
                                  key={subcat._id || subcat.id}
                                  className="transition-transform duration-400 ease-out hover:translate-x-1"
                                >
                                  <Link
                                    href={`/catalog?category=${subcat.slug}`}
                                    className="text-sm text-black/70 hover:text-accent transition-colors duration-400 ease-out line-clamp-1"
                                    title={subcat.name}
                                  >
                                    {subcat.name}
                                  </Link>
                                </li>
                              ))}
                              {/* Show "more" link if > 5 subcategories */}
                              {childCat.children.length > 5 && (
                                <li>
                                  <Link
                                    href={`/catalog?category=${childCat.slug}`}
                                    className="text-xs text-accent font-medium hover:underline"
                                  >
                                    +{childCat.children.length - 5} more
                                  </Link>
                                </li>
                              )}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Featured Products Section - Fixed width, doesn't scroll with categories */}
                  <div className="w-[200px] flex-shrink-0 border-l border-black/10 pl-6 transition-opacity duration-700 md:duration-1000 ease-out">
                    <FeaturedProductsSection
                      department={activeDept}
                      products={products}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <hr className="absolute left-0 w-full border-black/20" />
      </div>
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
      
      // Prioritize featured products, then sort by price/date
      const featured = deptProducts.filter(p => p.featured);
      const others = deptProducts.filter(p => !p.featured);
      
      // Show only 1 featured product to save space
      return [...featured, ...others].slice(0, 1);
    }, [department, products]);
  
    if (featuredProducts.length === 0) return null;
  
    const formatPrice = (price) => {
      if (price == null) return 'Price on request';
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })
        .format(price)
        .replace('₹', '₹ ');
    };
  
    return (
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-black mb-4">
          Featured
        </h3>

        {/* Single featured product */}
        {featuredProducts.map((product) => {
          const isOnSale = product.mrp && product.price && product.mrp > product.price;
          const heroImage = product.heroImage || product.image || (product.images && product.images[0]) || '/placeholder-product.jpg';
          
          return (
            <Link
              key={product._id || product.id}
              href={`/products/${product.slug}`}
              className="group block"
            >
              <div className="relative mb-2">
                {/* Sale Badge */}
                {isOnSale && (
                  <div className="absolute top-2 left-2 z-10 bg-accent text-white text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-sm">
                    Sale
                  </div>
                )}
                {/* Product Image */}
                <div className="aspect-square bg-white border border-black/10 rounded overflow-hidden relative">
                  <Image
                    src={heroImage}
                    alt={product.title || product.name}
                    fill
                    sizes="180px"
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              </div>
              {/* Product Name */}
              <h4 className="text-xs font-medium text-black mb-1.5 line-clamp-2 group-hover:text-accent transition-colors leading-snug">
                {product.title || product.name}
              </h4>
              {/* Price */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-accent">
                  {formatPrice(product.price)}
                </span>
                {isOnSale && (
                  <span className="text-xs text-black/50 line-through">
                    {formatPrice(product.mrp)}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    );
  }
  

/* =========================
   MOBILE HEADER + SEARCH
   ========================= */

function MobileHeaderBar({
  isMobileSearchOpen,
  setIsMobileSearchOpen,
  setIsMenuOpen,
  wishlist,
  cartTotalItems,
  onCartClick,
}) {
  return (
    <div className="lg:hidden flex flex-col px-2">
      <div className="flex justify-between items-center h-14 relative z-50 bg-white">
        <div className="flex items-center gap-2">
          <button onClick={() => setIsMenuOpen(true)} className="p-1">
            <MenuIcon className="w-5 h-5" />
          </button>
          <Link href="/">
            <Image src={Logo} alt="Regal" width={90} height={90} className="h-8 w-auto object-contain" />
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)} className="p-1">
            {isMobileSearchOpen ? (
              <XIcon className="w-5 h-5" />
            ) : (
              <SearchIcon className="w-5 h-5" />
            )}
          </button>
          <Link
            href="/wishlist"
            className="relative text-black hover:text-accent p-1"
          >
            <HeartIcon className="w-5 h-5" />
            {wishlist.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-accent text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center">
                {wishlist.length}
              </span>
            )}
          </Link>
          <button
            onClick={onCartClick}
            className="relative text-black hover:text-accent p-1"
            aria-label="Open cart"
          >
            <ShoppingCartIcon className="w-5 h-5" />
            {cartTotalItems > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-accent text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center">
                {cartTotalItems}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function MobileSearchBar({
  isMobileSearchOpen,
  searchQuery,
  setSearchQuery,
  handleSearchSubmit,
}) {
  return (
    <div
      className={`lg:hidden overflow-hidden transition-all duration-300 ease-in-out ${
        isMobileSearchOpen ? "max-h-14 opacity-100 mb-2" : "max-h-0 opacity-0"
      }`}
    >
      <form
        onSubmit={handleSearchSubmit}
        className="flex items-center border border-black/20 rounded-md px-3 py-1.5 bg-white mx-2"
      >
        <input
          type="text"
          placeholder="Search products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-grow bg-transparent outline-none text-sm text-black"
          autoFocus={isMobileSearchOpen}
        />
        <button type="submit" className="text-black/60 hover:text-black">
          <SearchIcon className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}

/* =========================
   MOBILE MENU OVERLAY
   (unchanged behavior)
   ========================= */

function MobileMenuOverlay({
  isMenuOpen,
  setIsMenuOpen,
  navStack,
  wishlist,
  cartTotalItems,
  onCartClick,
  openAccordions,
  toggleAccordion,
  handleNavForward,
  handleNavBack,
}) {
  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity duration-300 lg:hidden ${
        isMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={() => setIsMenuOpen(false)}
      ></div>
      <div
        className={`relative w-4/5 max-w-sm h-full bg-white shadow-xl transform transition-transform duration-300 ease-in-out ${
          isMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="relative h-full w-full overflow-hidden">
          {navStack.map((menu, index) => (
            <div
              key={menu.id + index}
              className="absolute top-0 left-0 w-full h-full bg-white transition-transform duration-300 ease-in-out flex flex-col"
              style={{
                transform: `translateX(${
                  (index - (navStack.length - 1)) * 100
                }%)`,
              }}
            >
              {/* Panel Header */}
              <div className="p-4 flex items-center justify-between border-b">
                {index === 0 ? (
                  <div className="flex items-center gap-4">
                    <Link
                      href="/wishlist"
                      className="relative text-black hover:text-accent"
                    >
                      <HeartIcon className="w-6 h-6" />
                      {wishlist.length > 0 && (
                        <span className="absolute -top-1 -right-2 bg-accent text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                          {wishlist.length}
                        </span>
                      )}
                    </Link>
                    <button
                      onClick={onCartClick}
                      className="relative text-black hover:text-accent"
                      aria-label="Open cart"
                    >
                      <ShoppingCartIcon className="w-6 h-6" />
                      {cartTotalItems > 0 && (
                        <span className="absolute -top-1 -right-2 bg-accent text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                          {cartTotalItems}
                        </span>
                      )}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleNavBack}
                    className="flex items-center gap-1 font-semibold text-lg"
                  >
                    <ChevronLeftIcon className="w-6 h-6" /> {menu.name}
                  </button>
                )}
                <button onClick={() => setIsMenuOpen(false)}>
                  <XIcon className="w-6 h-6" />
                </button>
              </div>

              {/* Panel Body */}
              <nav className="flex-grow p-4 overflow-y-auto">
                <ul className="space-y-1">
                  {menu.children.map((item) => {
                    const hasChildren =
                      item.children && item.children.length > 0;
                    const isAccordion =
                      hasChildren && item.level === "subcategory";

                    if (item.isLink) {
                      return (
                        <li key={item._id || item.id}>
                          <Link
                            href={item.slug}
                            className="block py-3 text-lg"
                          >
                            {item.name}
                          </Link>
                        </li>
                      );
                    }

                    if (isAccordion) {
                      const isOpen = openAccordions[item._id || item.id];
                      return (
                        <li key={item._id || item.id}>
                          <button
                            onClick={() => toggleAccordion(item._id || item.id)}
                            className="w-full flex justify-between items-center py-3 text-lg text-left"
                          >
                            <span>{item.name}</span>
                            <ChevronDownIcon
                              className={`w-5 h-5 transition-transform ${
                                isOpen ? "rotate-180" : ""
                              }`}
                            />
                          </button>
                          {isOpen && (
                            <ul className="pl-4 pt-2 space-y-1">
                              {item.children?.map((child) => (
                                <li key={child._id || child.id}>
                                  <Link
                                    href={`/catalog?category=${child.slug}`}
                                    className="block py-2 text-black/70 hover:text-black"
                                  >
                                    {child.name}
                                  </Link>
                                </li>
                              ))}
                              <li>
                                <Link
                                  href={`/catalog?category=${item.slug}`}
                                  className="block py-2 font-semibold text-black hover:text-accent"
                                >
                                  View All
                                </Link>
                              </li>
                            </ul>
                          )}
                        </li>
                      );
                    }

                    if (hasChildren) {
                      return (
                        <li key={item._id || item.id}>
                          <button
                            onClick={() => handleNavForward(item)}
                            className="w-full flex justify-between items-center py-3 text-lg text-left"
                          >
                            <span>{item.name}</span>
                            <ChevronRightIcon />
                          </button>
                        </li>
                      );
                    }

                    return (
                      <li key={item._id || item.id}>
                        <Link
                          href={`/catalog?category=${item.slug}`}
                          className="block py-3 text-lg"
                        >
                          {item.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              {/* Panel Footer */}
              {index === 0 && (
                <div className="p-4 border-t border-black/10 text-sm text-black/70">
                  <ul className="space-y-3">
                    <li>
                      <Link href="/about" className="hover:text-black transition-colors">
                        About Us
                      </Link>
                    </li>
                    <li>
                      <Link href="/contact" className="hover:text-black transition-colors">
                        Contact
                      </Link>
                    </li>
                    <li>
                      <Link href="/faq" className="hover:text-black transition-colors">
                        FAQ&apos;s
                      </Link>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
