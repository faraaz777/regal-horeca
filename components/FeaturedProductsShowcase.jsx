'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import ProductCard from '@/components/ProductCard';

export default function FeaturedProductsShowcase({ products = [], categories = [] }) {
  const [activeCategory, setActiveCategory] = useState('all'); // 'all' matches the slug in departmentCategories

  // Fixed department categories with icons
  const departmentCategories = [
    { id: 'all', label: 'All', icon: '✨', slug: 'all' },
    { id: 'barware', label: 'Barware', icon: '🍷', slug: 'barware' },
    { id: 'catering', label: 'Catering', icon: '🍽️', slug: 'catering' },
    { id: 'hotel-hospitality', label: 'Hotel & Resort', icon: '🏨', slug: 'hospitality' },
    { id: 'kitchenware', label: 'Kitchenware', icon: '👨‍🍳', slug: 'kitchenware' },
    { id: 'tableware', label: 'Tableware', icon: '🍴', slug: 'tableware' },
  ];

  // Helper function to get all category IDs for a department (including children)
  const getDepartmentCategoryIds = (departmentSlug) => {
    if (!categories || categories.length === 0) return [];
    
    // Find the department category
    const department = categories.find(cat => 
      cat.level === 'department' && 
      (cat.slug === departmentSlug || cat.name?.toLowerCase().replace(/\s+/g, '-') === departmentSlug)
    );
    
    if (!department) return [];
    
    const departmentId = department._id || department.id;
    const allIds = [departmentId];
    
    // Recursively get all child category IDs
    const getChildrenIds = (parentId) => {
      const children = categories.filter(cat => {
        const parent = cat.parent;
        return (parent?._id?.toString() === parentId?.toString() || parent?.toString() === parentId?.toString());
      });
      
      children.forEach(child => {
        const childId = child._id || child.id;
        if (childId && !allIds.includes(childId)) {
          allIds.push(childId);
          getChildrenIds(childId);
        }
      });
    };
    
    getChildrenIds(departmentId);
    return allIds;
  };

  // Filter products by department
  const filteredProducts = useMemo(() => {
    if (activeCategory === 'all') {
      return products.slice(0, 4);
    }
    
    const departmentIds = getDepartmentCategoryIds(activeCategory);
    if (departmentIds.length === 0) {
      // Fallback: try to match by category name/slug if IDs don't work
      return products.filter(p => {
        const category = p.category;
        if (!category) return false;
        
        const categoryName = typeof category === 'string' ? category : category.name;
        const categorySlug = typeof category === 'string' ? null : category.slug;
        
        const normalizedName = categoryName?.toLowerCase().replace(/\s+/g, '-');
        const normalizedSlug = categorySlug?.toLowerCase();
        
        return normalizedName === activeCategory || normalizedSlug === activeCategory;
      }).slice(0, 4);
    }
    
    return products.filter(p => {
      // Check categoryId (can be ObjectId or populated object)
      const productCategoryId = p.categoryId?._id || p.categoryId;
      if (productCategoryId) {
        const matches = departmentIds.some(deptId => 
          productCategoryId.toString() === deptId.toString()
        );
        if (matches) return true;
      }
      
      // Check categoryIds array (can contain ObjectIds or populated objects)
      const productCategoryIds = p.categoryIds || [];
      const hasMatch = productCategoryIds.some(catId => {
        const id = catId?._id || catId;
        return departmentIds.some(deptId => id?.toString() === deptId?.toString());
      });
      if (hasMatch) return true;
      
      // Also check populated category object
      const category = p.category;
      if (category) {
        const catId = category._id || category.id;
        if (catId) {
          return departmentIds.some(deptId => catId.toString() === deptId.toString());
        }
      }
      
      return false;
    }).slice(0, 4);
  }, [activeCategory, products, categories]);

  // All products are displayed normally, hover effect will make them featured
  const displayProducts = filteredProducts;

  if (products.length === 0) {
    return null;
  }

  return (
    <section className="bg-[#8E3A3A] py-8 md:py-12 relative overflow-hidden">
      {/* Background Graphic Watermarks */}
      <div className="absolute top-6 left-6 text-[12vw] md:text-[15vw] font-serif font-bold text-black/[0.03] select-none pointer-events-none">
        傑
      </div>
      <div className="absolute bottom-6 right-6 text-[12vw] md:text-[15vw] font-serif font-bold text-black/[0.03] select-none pointer-events-none">
        作
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 relative z-10">
        {/* Header Section */}
        <div className="text-center mb-3 md:mb-4">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-serif text-white tracking-tight">
            Featured Products
          </h2>
        </div>

        {/* Category Filter Pills */}
        <div className="flex md:flex-wrap overflow-x-auto md:overflow-visible hide-scrollbar justify-start md:justify-center gap-2 md:gap-3 mb-4 md:mb-8 -mx-4 px-4 md:mx-0 md:px-0">
          {departmentCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.slug)}
              className={`
                flex items-center space-x-1.5 md:space-x-2 px-3 md:px-5 py-1 md:py-2 rounded-full border transition-all duration-500 text-[10px] md:text-xs font-semibold tracking-wide whitespace-nowrap
                ${activeCategory === cat.slug 
                  ? 'bg-white border-white text-[#8E3A3A] shadow-lg' 
                  : 'bg-transparent border-white/20 text-white hover:border-white/50'}
              `}
            >
              <span className="text-sm md:text-base">{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Product Grid - Compact, reusing global ProductCard */}
        {displayProducts.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mt-6 md:mt-8">
            {displayProducts.map((piece, index) => {
              const productId = piece._id || piece.id || `product-${index}`;
              return (
                <ProductCard
                  key={productId}
                  product={piece}
                  hidePrice
                  transparent
                />
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-white/60">
            No products found in this category
          </div>
        )}

        {/* Explore Button */}
        <div className="mt-8 md:mt-12 text-center">
          <Link
            href="/catalog"
            className="inline-block bg-black text-white px-8 md:px-10 py-3 md:py-4 rounded-full font-bold uppercase tracking-[0.3em] text-[9px] md:text-[10px] hover:bg-white hover:text-[#8E3A3A] transition-all duration-500 shadow-xl"
          >
            View All Products →
          </Link>
        </div>
      </div>
    </section>
  );
}
