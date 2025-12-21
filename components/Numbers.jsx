'use client';

import { useState, useEffect, useRef } from 'react';

const STATS = [
  { label: 'Plates Sold', value: '10 Cr+', subtext: 'Excellence served daily' },
  { label: 'Dealers', value: '578+', subtext: 'Pan-India network' },
  { label: 'Countries', value: '20+', subtext: 'Global presence' },
  { label: 'Products', value: '6000+', subtext: 'One-stop solution' },
];

// Parse value string to extract number and suffix
function parseValue(valueStr) {
  // Handle "10 Cr+" -> { number: 10, suffix: ' Cr+', multiplier: 10000000 }
  if (valueStr.includes('Cr')) {
    const num = parseFloat(valueStr.replace(/[^0-9.]/g, ''));
    return { number: num * 10000000, suffix: ' Cr+', original: valueStr };
  }
  // Handle "578+", "20+", "6000+" -> { number: 578, suffix: '+' }
  const num = parseFloat(valueStr.replace(/[^0-9.]/g, ''));
  const suffix = valueStr.replace(/[0-9.]/g, '');
  return { number: num, suffix, original: valueStr };
}

// Format number with suffix
function formatValue(current, target) {
  if (target.suffix.includes('Cr')) {
    const crValue = current / 10000000;
    return `${Math.floor(crValue)}${target.suffix}`;
  }
  return `${Math.floor(current)}${target.suffix}`;
}

export default function Numbers() {
  const [displayValues, setDisplayValues] = useState(STATS.map(() => 0));
  const [hasAnimated, setHasAnimated] = useState(false);
  const sectionRef = useRef(null);

  useEffect(() => {
    if (hasAnimated) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated) {
            setHasAnimated(true);
            
            // Animate each stat
            STATS.forEach((stat, index) => {
              const parsed = parseValue(stat.value);
              const target = parsed.number;
              const duration = 2000; // 2 seconds
              const steps = 60; // 60 steps for smooth animation
              const increment = target / steps;
              const stepDuration = duration / steps;

              let current = 0;
              const timer = setInterval(() => {
                current += increment;
                if (current >= target) {
                  current = target;
                  clearInterval(timer);
                }
                setDisplayValues((prev) => {
                  const newValues = [...prev];
                  newValues[index] = current;
                  return newValues;
                });
              }, stepDuration);
            });
          }
        });
      },
      { threshold: 0.3 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => {
      if (sectionRef.current) {
        observer.unobserve(sectionRef.current);
      }
    };
  }, [hasAnimated]);

  return (
    <section ref={sectionRef} className="bg-black py-12 text-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
          {STATS.map((stat, idx) => {
            const parsed = parseValue(stat.value);
            const displayValue = hasAnimated 
              ? formatValue(displayValues[idx], parsed)
              : '0' + parsed.suffix;
            
            return (
              <div key={idx} className="space-y-2 group">
                <div className="text-4xl md:text-5xl font-extrabold text-white group-hover:text-accent transition-all duration-300">
                  {displayValue}
                </div>
                <div className="h-[2px] w-8 bg-accent mx-auto transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
                <div className="text-xs font-bold tracking-[0.2em] uppercase text-gray-400">
                  {stat.label}
                </div>
                <p className="text-[10px] text-gray-600 uppercase tracking-wider">
                  {stat.subtext}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

