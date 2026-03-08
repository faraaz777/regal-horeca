'use client';

import { MapPin, Mail, Factory } from 'lucide-react';

export default function Locations() {
  return (
    <section id="visit-us" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-black">Visit Us</h2>
          <p className="text-black/70 mt-4">Our showroom in Hyderabad</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Contact Info Card - single canonical location */}
          <div className="bg-white p-8 shadow-xl border-t-4 border-accent">
            <h3 className="text-2xl font-bold mb-6 text-black">Store Location</h3>
            
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <MapPin className="text-accent shrink-0 mt-1" size={20} />
                <div>
                  <h4 className="font-bold text-black">REGAL HORECA</h4>
                  <p className="text-black/70 text-sm mt-1">
                    Ashok Bazar, Afzal Gunj<br/>
                    Hyderabad, Telangana 500012
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 pt-4 border-t border-black/10">
                <Factory className="text-accent shrink-0 mt-1" size={20} />
                <div>
                  <h4 className="font-bold text-black">Workshops</h4>
                  <p className="text-black/70 text-sm mt-1">
                    Kuttur, Katedan, and IDA Nacharam.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-4 border-t border-black/10">
                <Mail className="text-accent" size={20} />
                <a href="mailto:regalmetals@rediffmail.com" className="text-black/70 hover:text-accent transition-colors">regalmetals@rediffmail.com</a>
              </div>
            </div>
          </div>

          {/* Map - canonical store address */}
          <div className="lg:col-span-2 h-[400px] bg-white border border-black/10 shadow-xl rounded-sm overflow-hidden relative">
            <iframe 
         src="https://www.google.com/maps?q=Regal+Horeca+Ashok+Bazar+Afzal+Gunj+Hyderabad&output=embed"
              width="100%" 
              height="100%" 
              style={{ border: 0 }} 
              allowFullScreen={true} 
              loading="lazy" 
              referrerPolicy="no-referrer-when-downgrade"
              title="Regal Horeca - Ashok Bazar, Afzal Gunj, Hyderabad"
            ></iframe>
            
            <div className="absolute top-4 right-4 bg-white px-4 py-2 shadow-md rounded-sm">
              <span className="text-xs font-bold tracking-widest uppercase text-accent">Afzal Gunj</span>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

