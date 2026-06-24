import HeroBanner from "@/components/HeroBanner";
import CategoryBar from "@/components/CategoryBar";
import ProductSection from "@/components/ProductSection";
import { products } from "@/data/products";

export default function Home() {
  const bestsellers = products.filter((p) => p.tag === "Bestseller" || p.rating >= 4.3);
  const skincare = products.filter((p) => p.category === "skincare");
  const makeup = products.filter((p) => p.category === "makeup");
  const deals = products.filter((p) => p.discount >= 30);

  return (
    <>
      {/* Hero Banner Carousel */}
      <HeroBanner />

      {/* Category Icons */}
      <CategoryBar />

      {/* Deals of the Day */}
      <div className="bg-pink-light">
        <ProductSection
          title="Deals of the Day 🔥"
          subtitle="Grab these before they're gone!"
          products={deals}
        />
      </div>

      {/* Bestsellers */}
      <ProductSection
        title="Bestsellers"
        subtitle="Most loved products by our customers"
        products={bestsellers.slice(0, 8)}
      />

      {/* Promo Banner */}
      <section className="py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="bg-gradient-to-r from-purple-600 to-pink-500 rounded-2xl p-8 md:p-12 text-white text-center">
            <h2 className="text-2xl md:text-4xl font-bold mb-3">
              Join the Gorgeous Club ✨
            </h2>
            <p className="text-lg opacity-90 mb-6 max-w-xl mx-auto">
              Sign up for exclusive deals, early access to sales, and
              personalized beauty recommendations.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 px-4 py-3 rounded-full text-gray-dark outline-none"
              />
              <button className="bg-white text-pink font-semibold px-6 py-3 rounded-full hover:shadow-lg transition-all">
                Subscribe
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Skincare */}
      <ProductSection
        title="Skincare Essentials"
        subtitle="Nourish, protect, and glow"
        products={skincare.slice(0, 8)}
      />

      {/* Makeup */}
      <div className="bg-gray-light">
        <ProductSection
          title="Makeup Must-Haves"
          subtitle="Look gorgeous every day"
          products={makeup.slice(0, 8)}
        />
      </div>

      {/* Brand Highlights */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-dark mb-2">
            Shop by Brand
          </h2>
          <div className="w-16 h-0.5 bg-pink mx-auto mt-3 mb-8" />
          <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
            {[
              "Maybelline",
              "L'Oréal",
              "Lakmé",
              "MAC",
              "Sugar",
              "The Ordinary",
              "Mamaearth",
              "Plum",
              "Cetaphil",
              "Forest Essentials",
            ].map((brand) => (
              <div
                key={brand}
                className="border border-gray-200 rounded-lg p-4 md:p-6 hover:border-pink hover:shadow-md transition-all cursor-pointer flex items-center justify-center"
              >
                <span className="text-sm md:text-base font-medium text-gray-dark">
                  {brand}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why BeyondGorgeous */}
      <section className="bg-pink-light py-12">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-dark text-center mb-8">
            Why BeyondGorgeous?
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              {
                icon: "✅",
                title: "100% Genuine",
                desc: "All products are sourced directly from brands",
              },
              {
                icon: "🚚",
                title: "Free Delivery",
                desc: "On orders above ₹499 across India",
              },
              {
                icon: "↩️",
                title: "Easy Returns",
                desc: "15-day hassle-free return policy",
              },
              {
                icon: "🎁",
                title: "Best Offers",
                desc: "Exclusive deals and combo offers",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="text-center p-4"
              >
                <div className="text-4xl mb-3">{feature.icon}</div>
                <h3 className="font-bold text-gray-dark mb-1">
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-medium">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
