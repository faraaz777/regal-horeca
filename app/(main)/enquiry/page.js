/**
 * Enquiry Form Page - V3 (Restored - "Massive Visual Impact")
 */

'use client';

import { useState, Suspense, useMemo, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { WhatsAppIcon, ChevronDownIcon } from '@/components/Icons';
import { useAppContext } from '@/context/AppContext';
import { getWhatsAppBusinessLink, openWhatsAppLink } from '@/lib/utils/whatsapp';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

// Floating Input Sub-component with Tailwind & Spring Animations
const FloatingInput = ({ label, id, name, type = "text", value, onChange, required, isTextArea = false, rows = 4 }) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="relative group w-full"
    >
      <div className={`
        absolute -inset-0.5 bg-gradient-to-r from-primary to-orange-400 rounded-[22px] blur opacity-0 
        group-focus-within:opacity-20 transition duration-500
      `}></div>

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
            relative w-full px-6 pt-7 pb-3 bg-white/70 backdrop-blur-xl border-2 rounded-[20px] outline-none transition-all duration-300
            ${isFocused ? 'border-primary ring-4 ring-primary/5 bg-white' : 'border-transparent bg-white/50'}
            placeholder-transparent text-gray-900 font-medium
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
            relative w-full px-6 pt-7 pb-3 bg-white/70 backdrop-blur-xl border-2 rounded-[20px] outline-none transition-all duration-300
            ${isFocused ? 'border-primary ring-4 ring-primary/5 bg-white' : 'border-transparent bg-white/50'}
            placeholder-transparent text-gray-900 font-medium
          `}
          placeholder=" "
        />
      )}

      <motion.label
        htmlFor={id}
        className="absolute left-6 pointer-events-none select-none"
        animate={{
          y: (value || isFocused) ? 8 : 22,
          scale: (value || isFocused) ? 0.75 : 1,
          color: isFocused ? "#EE4023" : (value ? "#666" : "#9ca3af"),
        }}
        initial={false}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        style={{ transformOrigin: 'left top' }}
      >
        <span className="text-sm font-bold tracking-tight uppercase">
          {label} {required && <span className="text-red-500">*</span>}
        </span>
      </motion.label>
    </motion.div>
  );
};

function EnquiryForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const categoryParam = searchParams.get('category') || '';
  const { cart, products, businessTypes } = useAppContext();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    state: '',
    message: '',
    categories: categoryParam ? [categoryParam] : [],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(true);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const categoryRef = useRef(null);

  useEffect(() => {
    const clickOutside = (e) => {
      if (categoryRef.current && !categoryRef.current.contains(e.target)) setIsCategoryOpen(false);
    };
    document.addEventListener('mousedown', clickOutside);
    return () => document.removeEventListener('mousedown', clickOutside);
  }, []);

  const cartItems = useMemo(() => {
    return cart.map(item => {
      const p = products.find(prod => (prod._id || prod.id)?.toString() === item.productId?.toString());
      return p ? { productId: item.productId, productName: p.title || p.name, quantity: item.quantity } : null;
    }).filter(Boolean);
  }, [cart, products]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleCategory = (cat) => {
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter(c => c !== cat)
        : [...prev.categories, cat]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.phone) return toast.error('Please fill all required fields');

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, cartItems }),
      });
      if (!response.ok) throw new Error('Submission failed');

      let msg = `*New Enquiry from Regal Horeca*\n\n`;
      msg += `👤 *Customer Details*\n`;
      msg += `• Name: ${formData.name}\n`;
      msg += `• Phone: ${formData.phone}\n`;
      msg += `• Location: ${formData.state}\n\n`;
      if (formData.categories.length > 0) msg += `📂 *Focus Areas:* ${formData.categories.join(', ')}\n\n`;
      if (cartItems.length > 0) {
        msg += `📦 *Products for Review:*\n`;
        cartItems.forEach((it, i) => msg += `${i + 1}. ${it.productName} (${it.quantity})\n`);
        msg += `\n`;
      }
      if (formData.message) msg += `💬 *Message:* ${formData.message}\n`;

      openWhatsAppLink(getWhatsAppBusinessLink(msg));
      setFormData({ name: '', email: '', phone: '', company: '', state: '', message: '', categories: [] });
      toast.success('Enquiry Sent! Opening WhatsApp...');
    } catch (err) {
      toast.error('Failed to send enquiry. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#fafafa] overflow-hidden selection:bg-primary/20 selection:text-primary">
      {/* Animated Mesh Gradient Background (Tailwind + Framer) */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            x: [0, 100, 0],
            y: [0, 50, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-[20%] -left-[10%] w-[1000px] h-[1000px] bg-primary/10 rounded-full blur-[120px]"
        />
        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            x: [0, -100, 0],
            y: [0, -50, 0],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-[20%] -right-[10%] w-[800px] h-[800px] bg-orange-200/20 rounded-full blur-[100px]"
        />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-20 lg:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">

          {/* Left Column: Heading & Large Visuals */}
          <div className="lg:col-span-5 space-y-12">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <span className="inline-block px-4 py-1.5 bg-primary/10 text-primary text-xs font-black uppercase tracking-[3px] rounded-full mb-6">
                Connect with us
              </span>
              <h1 className="text-6xl md:text-8xl font-black text-gray-900 leading-[0.9] tracking-tighter mb-8 bg-clip-text text-transparent bg-gradient-to-br from-gray-900 via-gray-800 to-gray-500">
                Let's Make it <span className="italic font-serif text-primary block mt-4">Regal.</span>
              </h1>
              <p className="text-xl text-gray-500 font-medium leading-relaxed max-w-md">
                Elevate your hospitality experience. Share your vision, and we'll bring the excellence.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 1 }}
              className="hidden lg:block relative p-8 bg-gray-900 rounded-[40px] overflow-hidden shadow-2xl"
            >
              <div className="absolute top-0 right-0 p-8">
                <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center animate-pulse">
                  <WhatsAppIcon className="w-6 h-6 text-white" />
                </div>
              </div>
              <h3 className="text-3xl font-black text-white mb-4">Fast Link</h3>
              <p className="text-gray-400 font-bold text-sm tracking-widest uppercase mb-6">WhatsApp Response Time</p>
              <div className="flex items-center gap-2">
                <div className="h-1 lg:w-32 bg-gray-800 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "95%" }}
                    transition={{ delay: 1, duration: 2 }}
                    className="h-full bg-primary"
                  />
                </div>
                <span className="text-primary font-black text-xs">VERY FAST</span>
              </div>
            </motion.div>
          </div>

          {/* Right Column: The Form */}
          <div className="lg:col-span-7">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="bg-white/40 backdrop-blur-3xl p-8 md:p-12 rounded-[50px] border border-white/50 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)]"
            >
              <form onSubmit={handleSubmit} className="space-y-12">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <FloatingInput label="Full Name" name="name" id="name" value={formData.name} onChange={handleChange} required />
                  <FloatingInput label="Email Address" type="email" name="email" id="email" value={formData.email} onChange={handleChange} required />
                  <FloatingInput label="WhatsApp Number" type="tel" name="phone" id="phone" value={formData.phone} onChange={handleChange} required />
                  <FloatingInput label="State / City" name="state" id="state" value={formData.state} onChange={handleChange} required />
                </div>

                {/* Focus Areas Selection */}
                <div className="space-y-6" ref={categoryRef}>
                  <label className="text-[10px] font-black uppercase tracking-[3px] text-gray-400 ml-4">
                    What are you focusing on?
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                      className="w-full flex items-center justify-between p-6 bg-white/50 rounded-[24px] border border-transparent hover:border-primary/20 transition-all group"
                    >
                      <span className="font-bold text-gray-700">
                        {formData.categories.length > 0
                          ? `${formData.categories.length} Areas Selected`
                          : "Select Categories"
                        }
                      </span>
                      <ChevronDownIcon className={`w-6 h-6 text-gray-400 transition-transform duration-500 ${isCategoryOpen ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                      {isCategoryOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute z-50 top-full left-0 right-0 mt-4 p-4 bg-white rounded-[32px] shadow-2xl border border-gray-100 max-h-[300px] overflow-y-auto"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {businessTypes?.map((cat) => {
                              const active = formData.categories.includes(cat.name);
                              return (
                                <button
                                  key={cat.name}
                                  type="button"
                                  onClick={() => toggleCategory(cat.name)}
                                  className={`
                                    flex items-center gap-3 p-4 rounded-[20px] transition-all
                                    ${active ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'hover:bg-gray-50 text-gray-700'}
                                  `}
                                >
                                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${active ? 'border-none bg-white/20' : 'border-gray-200'}`}>
                                    {active && <span className="text-[10px]">✓</span>}
                                  </div>
                                  <span className="text-sm font-bold">{cat.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <FloatingInput label="Tell us more about your requirements" name="message" id="message" value={formData.message} onChange={handleChange} isTextArea rows={3} />

                {/* Visual Cart Summary */}
                {cartItems.length > 0 && (
                  <motion.div
                    layout
                    className="p-8 bg-gray-50/50 rounded-[32px] border border-dashed border-gray-200"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                          <span className="text-xl">📦</span>
                        </div>
                        <h4 className="text-xs font-black uppercase tracking-[2px] text-gray-400">Cart Review</h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsCartOpen(!isCartOpen)}
                        className="text-[10px] font-black uppercase tracking-widest text-primary hover:opacity-70 transition-opacity"
                      >
                        {isCartOpen ? 'Minimize' : 'View All'}
                      </button>
                    </div>

                    <AnimatePresence>
                      {isCartOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-4">
                            {cartItems.map((item, idx) => (
                              <motion.div
                                key={idx}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className="flex items-center justify-between p-4 bg-white rounded-[20px] shadow-sm border border-gray-50"
                              >
                                <span className="text-sm font-bold text-gray-800">{item.productName}</span>
                                <span className="text-[10px] font-black bg-primary/10 text-primary px-3 py-1 rounded-full">{item.quantity} QTY</span>
                              </motion.div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}

                <div className="flex flex-col md:flex-row items-center gap-8 pt-8">
                  <motion.button
                    whileHover={{ scale: 1.05, translateY: -5 }}
                    whileTap={{ scale: 0.95 }}
                    disabled={isSubmitting}
                    type="submit"
                    className="w-full md:w-auto px-12 py-6 bg-primary text-white text-lg font-black tracking-tight rounded-[24px] shadow-2xl shadow-primary/40 flex items-center justify-center gap-4 group overflow-hidden relative"
                  >
                    <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 ease-in-out" />
                    <WhatsAppIcon className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                    <span>{isSubmitting ? 'SENDING...' : 'START CONVERSATION'}</span>
                  </motion.button>

                  <button
                    type="button"
                    onClick={() => router.back()}
                    className="text-xs font-black uppercase tracking-[3px] text-gray-400 hover:text-primary transition-colors flex items-center gap-2 group"
                  >
                    <span className="group-hover:-translate-x-1 transition-transform">←</span> Go Back
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EnquiryPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full"
        />
      </div>
    }>
      <EnquiryForm />
    </Suspense>
  );
}
