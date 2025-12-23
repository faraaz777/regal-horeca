'use client';

/**
 * FAQs Component
 * 
 * Frequently Asked Questions accordion component for the home page
 */

import { useState } from 'react';
import { ChevronDownIcon } from '@/components/Icons';

const faqs = [
  {
    id: 1,
    question: 'What products do you offer?',
    answer: 'We offer a wide range of premium tableware, glassware, serveware, and hospitality products. Our catalog includes everything from fine dining sets to commercial kitchen equipment, catering to hotels, restaurants, cafes, and other hospitality businesses.',
  },
  {
    id: 2,
    question: 'Do you offer bulk ordering?',
    answer: 'Yes, we specialize in bulk orders for businesses in the hospitality industry. We offer competitive pricing for large quantities and can customize orders to meet your specific requirements. Please contact us for a quote.',
  },
  {
    id: 3,
    question: 'What is your minimum order quantity?',
    answer: 'Minimum order quantities vary by product category. For most items, we can accommodate orders of any size, but bulk orders typically receive better pricing. Contact our sales team for specific MOQ requirements.',
  },
  {
    id: 4,
    question: 'Do you ship internationally?',
    answer: 'Yes, we ship to various international destinations. Shipping costs and delivery times depend on the destination. Please contact us with your location and order details for shipping information.',
  },
  {
    id: 5,
    question: 'What payment methods do you accept?',
    answer: 'We accept various payment methods including bank transfers, credit/debit cards, and other payment gateways. Payment terms may vary based on order size and customer relationship. Contact us for more details.',
  },
  {
    id: 6,
    question: 'Can I customize products?',
    answer: 'Yes, we offer customization services including branding, engraving, and custom designs. Customization options depend on the product type. Please reach out to discuss your specific requirements.',
  },
];

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
            {faqs.map((faq) => {
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

