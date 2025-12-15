'use client';

import { MapPin, Mail } from 'lucide-react';

export default function Locations() {
  return (
    <section id="contact" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="font-serif text-4xl font-bold text-regal-black">Visit Us</h2>
          <p className="text-gray-600 mt-4">Workshops, Showrooms, and Corporate Offices</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Contact Info Card */}
          <div className="bg-white p-8 shadow-xl border-t-4 border-regal-orange">
            <h3 className="font-serif text-2xl font-bold mb-6">Headquarters</h3>
            
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <MapPin className="text-regal-orange shrink-0 mt-1" size={20} />
                <div>
                  <h4 className="font-bold text-gray-900">Retail Stores</h4>
                  <p className="text-gray-600 text-sm mt-1">
                    Opp. Osmania Hospital, Begum Bazar<br/>
                    & Opp. Afzalgunj, Hyderabad.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <MapPin className="text-regal-orange shrink-0 mt-1" size={20} />
                <div>
                  <h4 className="font-bold text-gray-900">Workshops</h4>
                  <p className="text-gray-600 text-sm mt-1">
                    Kuttur, Katedan, and IDA Nacharam.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-4 border-t border-gray-100">
                <Mail className="text-regal-orange" size={20} />
                <span className="text-gray-700">info@regalhoreca.com</span>
              </div>
            </div>
          </div>

          {/* Map */}
          <div className="lg:col-span-2 h-[400px] bg-gray-200 shadow-xl rounded-sm overflow-hidden relative">
            {/* Embedded Google Map pointing to Begum Bazar area with marker */}
            <iframe 
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3807.410793663048!2d78.468758875165!3d17.37340578350868!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bcb977e201015f3%3A0x6758414445851493!2sBegum%20Bazar%2C%20Hyderabad%2C%20Telangana!5e0!3m2!1sen!2sin!4v1709400000000!5m2!1sen!2sin&q=17.37340578350868,78.468758875165" 
              width="100%" 
              height="100%" 
              style={{ border: 0, filter: 'grayscale(100%) contrast(1.2)' }} 
              allowFullScreen={true} 
              loading="lazy" 
              referrerPolicy="no-referrer-when-downgrade"
              title="Regal Horeca Location"
            ></iframe>
            
            {/* Pinned Location Marker */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
              <div className="relative">
                <div className="w-6 h-6 bg-regal-orange rounded-full border-2 border-white shadow-lg animate-pulse"></div>
                <div className="absolute top-6 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-8 border-transparent border-t-regal-orange"></div>
              </div>
            </div>
            
            <div className="absolute top-4 right-4 bg-white px-4 py-2 shadow-md rounded-sm">
              <span className="text-xs font-bold tracking-widest uppercase text-regal-orange">Begum Bazar</span>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

