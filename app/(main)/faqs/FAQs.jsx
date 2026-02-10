'use client';

/**
 * FAQs Component
 * 
 * Frequently Asked Questions accordion component for the home page
 */

import { useState } from 'react';
import { ChevronDownIcon } from '@/components/Icons';
import { FAQ_ITEMS } from '@/lib/constants/faqs';

export default function FAQs() {
  const [openFaq, setOpenFaq] = useState(null);

  const toggleFaq = (id) => {
    setOpenFaq(openFaq === id ? null : id);
  };

  return (
    <section className="py-12 bg-white" id="faqs">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight mb-4">Frequently Asked Questions</h2>
          <p className="text-black/70 max-w-2xl mx-auto">
            Find answers to common questions about our products and services.
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <div className="space-y-4">
            {FAQ_ITEMS.map((faq) => {
              const isOpen = openFaq === faq.id;
              
              return (
                <div
                  key={faq.id}
                  className="border border-gray-200 rounded-lg overflow-hidden transition-all duration-300 hover:shadow-md"
                >
                  <button
                    onClick={() => toggleFaq(faq.id)}
                    className="w-full px-6 py-4 flex items-center justify-between text-left bg-white hover:bg-gray-50 transition-colors"
                  >
                    <span className="font-semibold text-black pr-4">{faq.question}</span>
                    <ChevronDownIcon
                      className={`w-5 h-5 text-gray-500 flex-shrink-0 transition-transform duration-300 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  <div
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${
                      isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                    }`}
                  >
                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                      <p className="text-black/70 leading-relaxed">{faq.answer}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

     
        </div>
      </div>
    </section>
  );
}

