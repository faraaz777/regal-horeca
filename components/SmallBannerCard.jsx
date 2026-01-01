'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

const textVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { 
      duration: 0.6, 
      ease: [0.25, 0.46, 0.45, 0.94]
    } 
  }
};

export default function SmallBannerCard({ data }) {
  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={textVariants}
      className={`relative h-full w-full p-4 sm:p-5 md:p-6 lg:p-8 flex items-center justify-between gap-4 overflow-hidden rounded-xl ${data.bgColor || 'bg-slate-50'}`}
    >
      {/* Content Side */}
      <div className="flex-1 flex flex-col justify-center z-20">
        {data.discount && (
          <motion.div variants={textVariants}>
            <p className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800 mb-1">
              {data.discount}
            </p>
          </motion.div>
        )}
        
        {data.saleLabel && (
          <motion.div variants={textVariants} className="mb-2">
            <div className="w-12 h-0.5 bg-slate-300 mb-1"></div>
            <p className="text-xs sm:text-sm font-semibold text-slate-600 uppercase tracking-wider">
              {data.saleLabel}
            </p>
          </motion.div>
        )}
        
        <motion.h2 variants={textVariants} className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-slate-800 mb-3 sm:mb-4 leading-tight">
          {data.title}
        </motion.h2>

        {data.shopUrl && (
          <motion.div variants={textVariants}>
            <Link 
              href={data.shopUrl}
              className="inline-flex items-center gap-1 text-sm sm:text-base text-slate-700 hover:text-slate-900 font-medium transition-colors group"
            >
              Shop Collection
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        )}
      </div>

      {/* Product Image Side */}
      {data.imageUrl && (
        <div className="flex-shrink-0 w-24 sm:w-32 md:w-40 lg:w-48 h-full flex items-center justify-center relative">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ 
              type: "spring", 
              damping: 20, 
              stiffness: 50,
              delay: 0.2
            }}
            className="relative w-full h-full flex items-center justify-center"
          >
            <Image 
              src={data.imageUrl} 
              alt={data.title || 'Banner image'}
              width={200}
              height={200}
              className="w-full h-full object-contain"
              priority
            />
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

