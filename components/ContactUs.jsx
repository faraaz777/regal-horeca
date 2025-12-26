'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { WhatsAppIcon, ChevronDownIcon } from '@/components/Icons';
import { useAppContext } from '@/context/AppContext';
import { getWhatsAppBusinessLink, openWhatsAppLink } from '@/lib/utils/whatsapp';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

// V5 Compact & Crisp Floating Input
const FloatingInput = ({ label, id, name, type = "text", value, onChange, required, isTextArea = false, rows = 2 }) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="relative w-full">
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
            relative w-full px-4 pt-5 pb-2 bg-white border-2 rounded-xl outline-none transition-all duration-200
            ${isFocused ? 'border-primary ring-2 ring-primary/5' : 'border-gray-200'}
            placeholder-transparent text-gray-900 text-sm font-semibold
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
            relative w-full px-4 pt-5 pb-2 bg-white border-2 rounded-xl outline-none transition-all duration-200
            ${isFocused ? 'border-primary ring-2 ring-primary/5' : 'border-gray-200'}
            placeholder-transparent text-gray-900 text-sm font-semibold
          `}
          placeholder=" "
        />
      )}

      <motion.label
        htmlFor={id}
        className="absolute left-4 pointer-events-none select-none"
        animate={{
          y: (value || isFocused) ? 6 : 16,
          scale: (value || isFocused) ? 0.75 : 1,
          color: isFocused ? "#EE4023" : (value ? "#666" : "#9ca3af"),
        }}
        initial={false}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        style={{ transformOrigin: 'left top' }}
      >
        <span className="text-[10px] font-black tracking-tight uppercase">
          {label} {required && <span className="text-red-500">*</span>}
        </span>
      </motion.label>
    </div>
  );
};

export default function ContactUs() {
  const { cart, products, businessTypes } = useAppContext();

  const [formData, setFormData] = useState({
    fullName: '', email: '', phone: '', companyName: '', state: '', query: '', categories: [],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [includeCart, setIncludeCart] = useState(true);
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
    if (!formData.fullName || !formData.email || !formData.phone || !formData.state) {
      return toast.error('Required fields missing');
    }

    setIsSubmitting(true);
    try {
      const enquiryData = {
        name: formData.fullName, email: formData.email, phone: formData.phone,
        company: formData.companyName, state: formData.state, message: formData.query,
        categories: formData.categories, cartItems: includeCart && cartItems.length > 0 ? cartItems : [],
      };

      const response = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(enquiryData),
      });

      if (!response.ok) throw new Error('Submission failed');

      let msg = `*New Request*\n👤 *Client:* ${formData.fullName}\n📞 *Phone:* ${formData.phone}\n📍 *City:* ${formData.state}\n\n`;
      if (formData.categories.length > 0) msg += `📂 *Areas:* ${formData.categories.join(', ')}\n\n`;
      if (includeCart && cartItems.length > 0) {
        msg += `📦 *Products Review:*\n`;
        cartItems.forEach((it, i) => msg += `${i + 1}. ${it.productName} (${it.quantity})\n`);
        msg += `\n`;
      }
      if (formData.query) msg += `💬 *Msg:* ${formData.query}\n`;

      openWhatsAppLink(getWhatsAppBusinessLink(msg));
      setFormData({ fullName: '', email: '', phone: '', companyName: '', state: '', query: '', categories: [] });
      toast.success('Opening WhatsApp...');
    } catch (err) {
      toast.error('Submission failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="relative py-12 lg:py-16 bg-gray-100 overflow-hidden font-sans">
      <div className="container relative z-10 mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <motion.h2 initial={{ opacity: 0, y: -10 }} whileInView={{ opacity: 1, y: 0 }} className="text-3xl lg:text-5xl font-black text-gray-900 tracking-tighter mb-2">
              Start Your <span className="font-serif italic text-accent">Regal</span> Journey.
            </motion.h2>
            <p className="text-xs lg:text-sm text-gray-500 font-bold uppercase tracking-[0.2em]">Contact Us</p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white p-6 lg:p-10 rounded-[24px] shadow-2xl border border-gray-100 max-w-2xl mx-auto"
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                <div className="space-y-4">
                  <FloatingInput label="Full Name" id="fullName" name="fullName" value={formData.fullName} onChange={handleChange} required />
                  <FloatingInput label="Email address" type="email" id="email" name="email" value={formData.email} onChange={handleChange} required />
                  <FloatingInput label="WhatsApp phone" type="tel" id="phone" name="phone" value={formData.phone} onChange={handleChange} required />
                </div>

                <div className="space-y-4">
                  <FloatingInput label="Company name (optional)" id="companyName" name="companyName" value={formData.companyName} onChange={handleChange} />
                  <FloatingInput label="State / City" id="state" name="state" value={formData.state} onChange={handleChange} required />

                  <div className="relative" ref={categoryRef}>
                    <button type="button" onClick={() => setIsCategoryOpen(!isCategoryOpen)} className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl border-2 border-transparent hover:border-primary/10 transition-all text-left">
                      <span className={`text-[11px] font-black uppercase tracking-tight ${formData.categories.length > 0 ? "text-gray-900" : "text-gray-400"}`}>
                        {formData.categories.length > 0 ? `${formData.categories.length} Topics Selected` : "Focus Categories"}
                      </span>
                      <ChevronDownIcon className={`w-4 h-4 transition-transform duration-300 ${isCategoryOpen ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                      {isCategoryOpen && (
                        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} className="absolute z-50 bottom-full inset-x-0 mb-2 p-2 bg-white rounded-2xl shadow-2xl border border-gray-200 max-h-[160px] overflow-y-auto custom-scrollbar">
                          <div className="grid grid-cols-1 gap-1">
                            {businessTypes?.map((cat) => {
                              const active = formData.categories.includes(cat.name);
                              return (
                                <button key={cat.name} type="button" onClick={() => toggleCategory(cat.name)} className={`flex items-center gap-2 p-3 rounded-lg transition-all text-left ${active ? 'bg-primary text-white' : 'hover:bg-gray-50 text-gray-700'}`}>
                                  <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${active ? 'bg-white border-none' : 'border-gray-300'}`}>{active && <span className="text-[7px] text-primary font-bold">✓</span>}</div>
                                  <span className="text-[10px] font-bold uppercase tracking-tight">{cat.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              <FloatingInput label="Requirements" id="query" name="query" value={formData.query} onChange={handleChange} isTextArea rows={2} />

              {cartItems.length > 0 && (
                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">📦</span>
                    <div className="text-left"><h4 className="text-[8px] font-black uppercase tracking-widest text-blue-900">Sync</h4><p className="text-[10px] font-black text-blue-900">{cartItems.length} ITEMS</p></div>
                  </div>
                  <label className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-100 cursor-pointer">
                    <input type="checkbox" checked={includeCart} onChange={(e) => setIncludeCart(e.target.checked)} className="w-3.5 h-3.5 accent-primary" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-600">Include</span>
                  </label>
                </div>
              )}

              <div className="flex justify-center pt-2">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} disabled={isSubmitting} type="submit" className="w-full px-10 py-4 bg-gray-900 text-white text-xs font-black tracking-[0.2em] rounded-xl shadow-xl flex items-center justify-center gap-3 transition-colors hover:bg-black uppercase">
                  <WhatsAppIcon className="w-5 h-5" />
                  <span>START CONVERSATION</span>
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
