"use client";
import bybone from "../../../lib/bybone.png"
// Helper to get image src from Next.js static import
const getImageSrc = (img) => {
  if (typeof img === 'string') return img;
  if (img?.src) return img.src;
  if (img?.default) return img.default.src || img.default;
  return img;
};

// Participating Brands Configuration
// To add a new brand logo:
// 1. Place the logo image in the /lib folder (e.g., /lib/nestle.png)
// 2. Import it at the top: import nestle from "../../lib/nestle.png"
// 3. Add it to the PARTICIPATING_BRANDS array below using getImageSrc(nestle)
const PARTICIPATING_BRANDS = [
  // Example entries - replace with your actual brand logos
  { src: getImageSrc(bybone), name: "bybonel" },
  // { src: getImageSrc(cremica), name: "Mrs. Bector's CREMICA" },
  // { src: "https://example.com/logo.png", name: "Brand Name" },
  { src: "https://fns.co.in/cdn/shop/files/Frame_9309_110x.png?v=1721712046", name: "fns" },
  // { src: "https://bybone.com/wp-content/uploads/2023/12/logow300_white.png", name: "By Bone" },
  { src:  "https://sujataappliances.com/wp-content/uploads/2021/08/SujataLogo-NEW-1024x345.png", name: "sujata" },
  { src: "https://www.milton.in/cdn/shop/files/1__1_-removebg-preview_1_a5b0b114-e4b3-4846-afe9-b88cac3a7abc.png?v=1752814136&width=200", name: "Milton" },
  { src: "https://file.hstatic.net/200000409027/file/logo_300_x_83_e722f9e57bbc489f85994c3fb893ccd5.png", name: "Superware" },
  { src: "https://myborosil.com/cdn/shop/files/borosil-grey.png?v=1732033894&width=600", name: "borosil" },
  { src: "https://arianefineporcelain.com/wp-content/uploads/2023/01/Ariane-Logo-Final-Transparent.png", name: "Ariane" },
  { src: "https://apaarcutlery.in/wp-content/uploads/2024/05/logo-removebg-preview.png", name: "apaarcutlery" },
  { src: "https://www.ocean-glassware.com/wp-content/themes/ocean/assets/images/OceanLogo.png", name: "ocean" },
  { src: "https://www.kent.co.in/images/logo/kitchen-appliances-logo.svg", name: "kent" },
  { src: "https://kohekgoc.com/frontend/images/logo.png", name: "kohe" },
  { src: "https://dukaan.b-cdn.net/700x700/webp/4112024/67eeb815-ae3c-4622-9dcd-882aed91b3eb/100-821775b1-5770-408d-b3fd-1d7785b50fb7.png", name: "mazda" },
  { src: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTkMO0inl2DMO93TyubJ58ywkw2PCxR88T-GA&s", name: "bharat tableware" },
  { src: "https://www.shapesproducts.in/_next/image?url=%2Fimages%2Fhomepage%2FShapesLogo.png&w=384&q=75", name: "shapes" },
  { src: "https://venusindustries.in/wp-content/uploads/2022/10/venus-logo.png", name: " venus" },
  { src: "https://metinoxindia.com/images/head-logo-1.png", name: "metinox" },
  // { src: "data:image/png;base64,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", name: " pasabahce" },
  { src: "https://m.media-amazon.com/images/S/abs-image-upload-na/c/AmazonStores/A21TJRUUN4KGV/4c3588bd05232edd1bd02a0fc3cec692.w5906.h1722.gif", name: " lucaris" },
  { src: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTiF__mweKVgGFwDnYizdhO3rRS_lN6PvRhvg&s", name: " luminarc" },
  { src: "https://www.arcoroc.com/medias/sites/2/2024/11/arcoroc-logo.png", name: " arcoroc" },
  { src: "https://www.francecorner.com/img/m/123.jpg", name: " chef and sommelier" },
  { src: "https://www.logoshape.com/wp-content/uploads/2025/07/Cello-Logo-Vector_logoshape.png", name: " cello" },
  { src: "https://dinewell.in/assets/images/logo.png", name: " dinewell" },
  { src: "https://enrichwares.com/wp-content/uploads/2025/03/Enrich_logo.png", name: " enrich wares" },
  { src: "https://logoeps.com/wp-content/uploads/2013/05/tramontina-vector-logo.png", name: " taramontina" },
  { src: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTKclyGlooQSmgd5A6XyraAfGvXOKn3d6iBZg&s", name: " zanuff" },
  { src: "https://m.media-amazon.com/images/S/stores-image-uploads-eu-prod/5/AmazonStores/A21TJRUUN4KGV/02efc4b1ef0dad2c085305996c58fff2.w3508.h2481.jpg", name: " paradeep" },
  { src: "https://m.media-amazon.com/images/S/abs-image-upload-na/7/AmazonStores/A21TJRUUN4KGV/4d6f646495b501b37d3130b478ec9e10.w3160.h1560.jpg", name: " rena germany" },
  // { src: "https://example.com/logo.png", name: " smart chef" },
  { src: "https://upload.wikimedia.org/wikipedia/en/7/7b/TTK_Prestige.svg", name: " prestige" },
  { src: "https://iconape.com/wp-content/png_logo_vector/hawkins-logo.png", name: " hawkins" },
  { src: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Rational_AG_Logo.svg/1200px-Rational_AG_Logo.svg.png", name: " rational" },
  { src: "https://restolane.com/wp-content/uploads/2024/06/logo-sinmag.jpg", name: " sinmag" },
  { src: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTzM4ctoRsM5EqFAzfoQl4k9wlnQkGN2iViQA&s", name: " trufrost" },
  { src: "https://www.rollergrill-international.com/images/logo-rg.webp", name: " roller grill" },
  { src: "https://sirman-corporate-dev-s3-images.s3.eu-west-1.amazonaws.com/logo_Sirman_site_b8d7e5bd76.webp ", name: " sirman" },
  { src: "https://s3.amazonaws.com/dc-docs.dcatalog.com/Cambro/Inter-Pages-Main/res/Cambro%20RED.png?v=1736191431056", name: " cambro" },
  { src: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRbM4xjl6dD6y8VHMham-v-tsIeXCGMHVEgyA&s", name: " electrolux" },
  { src: "https://upload.wikimedia.org/wikipedia/commons/7/70/Hamilton_Beach_Company_%28logo%29.jpg", name: " hamiton beach " },
  { src: "https://www.gai.com.np/wp-content/uploads/2024/03/Washmatic.png", name: " washmatic" },
  { src: "https://kenford.in/wp-content/uploads/2021/10/kenford-logo-2.png", name: " kenford" },
  { src: "https://i.pinimg.com/280x280_RS/16/81/b9/1681b9672b296c98941c3c2e2bf2827c.jpg", name: " cartini" },
  { src: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRZZi4bSbsOs2tL18O5PrfeeyMIN0sG515O2g&s", name: " unox" },
  { src: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQhQijZOQl0IieHbsqjiYMc71WcaIn28GcKBQ&s", name: " servewell" },
];

export default function ParticipatingBrands() {
  // Don't render if no brands are configured
  if (PARTICIPATING_BRANDS.length === 0) {
    return null;
  }

  return (
    <section className="relative bg-gray-50 overflow-hidden py-16 md:py-24">
      {/* Background with subtle texture/chandelier effect */}
      <div className="absolute inset-0 opacity-[0.03]">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-transparent" 
             style={{
               backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(212, 175, 55, 0.3) 0%, transparent 50%)',
             }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Heading */}
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-black tracking-wide uppercase">
            Brand Partners
          </h2>
        </div>

        {/* Grid of Brand Logos */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
          {PARTICIPATING_BRANDS.map((brand, index) => (
            <div
              key={index}
              className="bg-white rounded-lg p-4 md:p-6 flex items-center justify-center shadow-sm hover:shadow-md transition-shadow duration-300 min-h-[120px] md:min-h-[140px]"
            >
              <img
                src={brand.src}
                alt={brand.name}
                className="max-w-full max-h-[80px] md:max-h-[100px] w-auto h-auto object-contain"
              />
            </div>
          ))}
        </div>

        {/* "& many more...." text at bottom right */}
        {PARTICIPATING_BRANDS.length > 10 && (
          <div className="text-right mt-8 md:mt-12">
            <p className="text-sm md:text-base text-gray-500 italic">
              & many more....
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
