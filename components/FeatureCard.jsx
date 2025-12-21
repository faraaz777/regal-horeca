'use client';

export default function FeatureCard({ feature, index, isHovered, onHover }) {
  return (
    <div 
      className={`group relative bg-white p-7 border transition-all duration-[1000ms] ease-out cursor-pointer overflow-hidden shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] hover:shadow-2xl ${
        isHovered ? 'border-black/10 shadow-xl translate-x-2' : 'border-gray-50'
      }`}
      onMouseEnter={() => onHover(feature.id)}
      onMouseLeave={() => onHover(null)}
      style={{
        animationDelay: `${index * 150}ms`,
      }}
    >
      {/* Interactive Bottom Border Reveal */}
      <div 
        className={`absolute bottom-0 left-0 h-[3px] bg-accent transition-all duration-[1200ms] ease-in-out ${
          isHovered ? 'w-full' : 'w-0'
        }`} 
      />
      
      <div className="flex flex-col gap-4">
        {/* Icon with scaling effect */}
        <div className={`transition-all duration-[1000ms] ${
          isHovered ? 'scale-110 -translate-y-1 text-accent' : 'text-gray-300'
        }`}>
          {feature.icon}
        </div>

        {/* Content Section */}
        <div>
          <h3 className={`text-[11px] font-extrabold uppercase tracking-[0.25em] mb-2 transition-colors duration-[1000ms] ${
            isHovered ? 'text-black' : 'text-gray-900'
          }`}>
            {feature.title}
          </h3>
          <p className="text-gray-500 text-[11px] leading-relaxed font-medium transition-colors duration-[1000ms]">
            {feature.description}
          </p>
        </div>
      </div>
    </div>
  );
}

