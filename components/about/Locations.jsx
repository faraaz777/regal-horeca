'use client';

import { MapPin, Mail, ExternalLink } from 'lucide-react';

const ADDRESS = 'REGAL HORECA, Ashok Bazar, Afzal Gunj, Hyderabad, Telangana 500012';
const GOOGLE_MAPS_LINK = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ADDRESS)}`;
// Google Maps embed - same style as original (red pin, info card)
const GOOGLE_MAPS_EMBED = `https://maps.google.com/maps?q=${encodeURIComponent(ADDRESS)}&t=&z=16&ie=UTF8&iwloc=&output=embed`;

export default function Locations() {
  return (
    <section id="visit-us" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-black">Visit Us</h2>
          <p className="text-black/70 mt-4">Workshops, Showrooms, and Corporate Offices</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Contact Info Card */}
          <div className="bg-white p-8 shadow-xl border-t-4 border-accent">
            <h3 className="text-2xl font-bold mb-6 text-black">Our Location</h3>
            
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <MapPin className="text-accent shrink-0 mt-1" size={20} />
                <div>
                  <h4 className="font-bold text-black">Retail Store</h4>
                  <p className="text-black/70 text-sm mt-1">
                    REGAL HORECA<br/>
                    Ashok Bazar, Afzal Gunj<br/>
                    Hyderabad, Telangana 500012
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <MapPin className="text-accent shrink-0 mt-1" size={20} />
                <div>
                  <h4 className="font-bold text-black">Workshops</h4>
                  <p className="text-black/70 text-sm mt-1">
                    Kuttur, Katedan, and IDA Nacharam.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-4 border-t border-black/10">
                <Mail className="text-accent" size={20} />
                <span className="text-black/70">regalmetals@rediffmail.com</span>
              </div>
            </div>
          </div>

          {/* Map */}
          <div className="lg:col-span-2 h-[400px] bg-white border border-black/10 shadow-xl rounded-sm overflow-hidden relative">
            <iframe 
              src={GOOGLE_MAPS_EMBED}
              width="100%" 
              height="100%" 
              style={{ border: 0 }} 
              allowFullScreen={true} 
              loading="lazy" 
              referrerPolicy="no-referrer-when-downgrade"
              title="Regal Horeca Location - Ashok Bazar, Afzal Gunj"
            />
            <div className="absolute top-4 right-4 flex flex-col gap-2 items-end">
              <div className="bg-white px-4 py-2 shadow-md rounded-sm">
                <span className="text-xs font-bold tracking-widest uppercase text-accent">REGAL HORECA, Ashok Bazar, Afzal Gunj</span>
              </div>
              <a 
                href={GOOGLE_MAPS_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-white px-3 py-1.5 shadow-md rounded-sm text-xs font-medium text-accent hover:bg-accent hover:text-white transition-colors"
              >
                <ExternalLink size={14} />
                Open in Google Maps
              </a>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

