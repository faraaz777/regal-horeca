'use client';

const stats = [
  { label: "Years of Excellence", value: "45+" },
  { label: "Dedicated Staff", value: "250+" },
  { label: "Product SKUs", value: "5,000+" },
  { label: "Retail Showrooms", value: "2" },
];

export default function Stats() {
  return (
    <section className="bg-regal-black py-12 text-white border-b border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-x divide-zinc-800/50">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="px-4 animate-fade-in-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <h3 className="text-4xl md:text-5xl font-serif font-bold text-regal-orange mb-2">
                {stat.value}
              </h3>
              <p className="text-sm md:text-base text-gray-400 uppercase tracking-widest font-light">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

