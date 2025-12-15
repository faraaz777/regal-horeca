import React from 'react';
import { motion } from 'framer-motion';

const ventures = [
  { 
    title: 'Regal Estate', 
    desc: 'Premium Real Estate Development', 
    sub: '6-acre property in Shamshabad',
    image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop'
  },
  { 
    title: 'Regal Convention', 
    desc: 'Luxury Event Spaces', 
    sub: 'Convention 1 & 2 for grand weddings',
    image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?q=80&w=2070&auto=format&fit=crop'
  },
  { 
    title: 'Regal Catering', 
    desc: 'The Elegant Touch', 
    sub: 'Bespoke culinary services',
    image: 'https://images.unsplash.com/photo-1555244162-803834f70033?q=80&w=2070&auto=format&fit=crop'
  },
  { 
    title: 'Circle 7', 
    desc: 'Strategic Ventures', 
    sub: 'Business expansion unit',
    image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=2070&auto=format&fit=crop'
  },
];

const Ventures: React.FC = () => {
  return (
    <section id="ventures" className="py-24 bg-zinc-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
           <span className="text-regal-black font-bold tracking-widest uppercase text-sm">Our Group</span>
           <h2 className="font-serif text-4xl font-bold mt-2">Diversified Ventures</h2>
           <p className="text-gray-500 mt-4 max-w-2xl mx-auto font-light">
             Expanding excellence beyond manufacturing into real estate, hospitality, and strategic investments.
           </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {ventures.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.6 }}
              className="group relative h-96 rounded-sm overflow-hidden cursor-pointer shadow-md hover:shadow-2xl transition-shadow duration-300"
            >
              {/* Background Image */}
              <div className="absolute inset-0">
                <img 
                  src={item.image} 
                  alt={item.title} 
                  className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                />
                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10 transition-opacity duration-500 group-hover:via-black/60"></div>
              </div>

              {/* Text Content */}
              <div className="absolute bottom-0 left-0 w-full p-8 md:p-10 text-white transform translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
                <div className="w-12 h-1 bg-regal-orange mb-4 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                
                <h3 className="font-serif text-3xl font-bold mb-2">{item.title}</h3>
                <p className="text-regal-orange text-xs font-bold uppercase tracking-widest mb-1">
                  {item.desc}
                </p>
                <p className="text-gray-300 text-sm font-light opacity-80 group-hover:opacity-100 transition-opacity duration-300">
                  {item.sub}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Ventures;