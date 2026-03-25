 'use client';
 
 import { useMemo, useState } from 'react';
 import { ChevronDown } from 'lucide-react';
 
 export default function FaqAccordion({ faqs = [] }) {
   const items = useMemo(
     () =>
       (Array.isArray(faqs) ? faqs : [])
         .map((f) => ({
           question: String(f?.question || '').trim(),
           answer: String(f?.answer || '').trim(),
         }))
         .filter((f) => f.question && f.answer),
     [faqs]
   );
 
   const [openSet, setOpenSet] = useState(() => new Set());
 
   if (items.length === 0) return null;
 
   const allOpen = openSet.size === items.length;
 
   const toggle = (idx) => {
     setOpenSet((prev) => {
       const next = new Set(prev);
       if (next.has(idx)) next.delete(idx);
       else next.add(idx);
       return next;
     });
   };
 
   const expandAll = () => {
     setOpenSet(new Set(items.map((_, i) => i)));
   };
 
   const collapseAll = () => {
     setOpenSet(new Set());
   };
 
   return (
     <section className="w-full">
      <div className="flex items-start justify-between gap-3 mb-2 pb-3 border-b border-black/10">
         <h3 className="min-w-0 max-w-[200px] sm:max-w-none text-lg sm:text-2xl font-semibold text-rich-black leading-tight">
           Frequently Asked Questions{' '}
           <span className="inline-block align-middle text-black/30 text-sm" aria-hidden>
             ⓘ
           </span>
         </h3>
 
         <button
           type="button"
           onClick={allOpen ? collapseAll : expandAll}
           className="shrink-0 whitespace-nowrap px-3 sm:px-4 h-9 sm:h-10 rounded-lg border border-black/10 bg-white text-xs sm:text-sm font-semibold text-black/70 hover:border-black/20"
         >
           {allOpen ? 'Collapse All' : 'Expand All'}
         </button>
       </div>
 
      <div className="bg-white">
         {items.map((faq, idx) => {
           const isOpen = openSet.has(idx);
           const number = String(idx + 1).padStart(2, '0');
           return (
            <div key={`${faq.question}-${idx}`} className="border-b border-black/10">
               <button
                 type="button"
                 onClick={() => toggle(idx)}
                 className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-black/[0.02]"
               >
                 <div className="flex items-center gap-4 min-w-0">
                   <span className="text-accent text-sm font-medium tabular-nums w-8 flex-shrink-0">
                     {number}/
                   </span>
                  <span className="text-sm sm:text-base font-semibold text-rich-black leading-snug">
                     {faq.question}
                   </span>
                 </div>
 
                <span className="flex-shrink-0 w-10 h-10 inline-flex items-center justify-center text-accent">
                   <ChevronDown
                     size={18}
                     className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                   />
                 </span>
               </button>
 
              <div
                className={`grid transition-all duration-300 ease-out ${
                  isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                }`}
              >
                <div className="overflow-hidden">
                  <div className="px-5 pb-4 text-sm text-black/60 leading-relaxed pl-12">
                    {faq.answer}
                  </div>
                </div>
              </div>
             </div>
           );
         })}
       </div>
     </section>
   );
 }
