'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';

// Define containerVariants - slower and smoother
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.4,
      duration: 1.2,
      ease: [0.25, 0.46, 0.45, 0.94] // Smooth ease-in-out
    }
  }
};

// Define textVariants - slower and smoother
const textVariants = {
  hidden: { opacity: 0, y: 20, filter: 'blur(8px)' },
  visible: { 
    opacity: 1, 
    y: 0, 
    filter: 'blur(0px)',
    transition: { 
      duration: 1.2, 
      ease: [0.25, 0.46, 0.45, 0.94] // Smooth ease-in-out
    } 
  }
};

export default function MainBannerCard({ data }) {
  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className={`relative h-full w-full p-4 sm:p-6 md:p-8 lg:p-12 xl:p-16 flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6 md:gap-8 lg:gap-10 overflow-hidden ${data.bgColor || 'bg-gradient-to-br from-slate-50 to-slate-100'}`}
    >
      {/* Content Side */}
      <div className="flex-1 flex flex-col justify-center text-center md:text-left z-20 w-full">
        {data.badge && (
          <motion.div variants={textVariants}>
            <span className={`inline-block px-3 py-1.5 sm:px-4 sm:py-2 rounded-full ${data.badgeColor || 'bg-yellow-400 text-yellow-900'} text-[9px] sm:text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] mb-4 sm:mb-6 md:mb-8`}>
              {data.badge}
            </span>
          </motion.div>
        )}
        
        <motion.h1 variants={textVariants} className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-slate-800 leading-[1.1] sm:leading-[1.05] mb-4 sm:mb-6 md:mb-8 tracking-tight">
          {data.title} <br />
          {data.subtitle && (
            <span className="text-slate-600 font-normal text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl">& {data.subtitle}</span>
          )}
        </motion.h1>

        {data.description && (
          <motion.p variants={textVariants} className="text-slate-500 max-w-md mb-8 sm:mb-10 md:mb-12 text-sm sm:text-base md:text-lg leading-relaxed font-normal mx-auto md:mx-0 px-2 sm:px-0">
            {data.description}
          </motion.p>
        )}

        <motion.div variants={textVariants} className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 justify-center md:justify-start w-full sm:w-auto">
          {data.shopUrl && (
            <Link 
              href={data.shopUrl}
              className="px-8 sm:px-10 md:px-12 py-3 sm:py-4 md:py-5 bg-transparent border border-slate-700 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 hover:border-slate-900 transition-all duration-300 w-full sm:w-auto text-center text-sm sm:text-base"
            >
              SHOP NOW
            </Link>
          )}
        </motion.div>
      </div>

      {/* Product Image Side - Fixed height, image adjusts */}
      {data.imageUrl && (
        <div className="flex-1 flex items-center justify-center relative w-full h-full max-h-full">
          <motion.div
            initial={{ opacity: 0, scale: 0.7, rotate: 10, x: 50 }}
            animate={{ opacity: 1, scale: 1, rotate: 0, x: 0 }}
            transition={{ 
              type: "spring", 
              damping: 25, 
              stiffness: 50,
              delay: 0.6,
              duration: 1.2
            }}
            whileHover={{ 
              scale: 1.03, 
              rotate: -1,
              transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }
            }}
            className="relative group w-full h-full flex items-center justify-center"
          >
            {/* Layered Realistic Shadows */}
            <div className="absolute -bottom-8 sm:-bottom-10 left-1/2 -translate-x-1/2 w-4/5 h-12 sm:h-16 bg-black/10 blur-[40px] sm:blur-[50px] rounded-full opacity-60 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="absolute -bottom-3 sm:-bottom-4 left-1/2 -translate-x-1/2 w-3/5 h-6 sm:h-8 bg-black/20 blur-[15px] sm:blur-[20px] rounded-full" />
            
            {/* Image container - uses max-height to fit within parent */}
            <div className="relative z-10 w-full h-full flex items-center justify-center">
              <Image 
                src={data.imageUrl} 
                alt={data.title || 'Banner image'}
                width={450}
                height={450}
                className="max-w-[180px] sm:max-w-[220px] md:max-w-[280px] lg:max-w-[350px] xl:max-w-[400px] w-auto h-auto max-h-[80%] object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.1)] transition-all duration-700"
                priority
                style={{ maxHeight: '80%' }}
              />
            </div>
            
            {/* Floating Micro-particles Decor */}
            <motion.div 
              animate={{ y: [0, -15, 0], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-10 -right-5 w-8 h-8 rounded-full bg-white/40 blur-xl md:block hidden"
            />
            <motion.div 
              animate={{ y: [0, 20, 0], opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              className="absolute bottom-10 -left-10 w-12 h-12 rounded-full bg-black/5 blur-2xl md:block hidden"
            />
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

