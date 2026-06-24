"use client";

import { useParams } from "next/navigation";
import { categories, products } from "@/data/products";
import ProductCard from "@/components/ProductCard";
import Link from "next/link";

export default function CategoryPage() {
  const params = useParams();
  const slug = params.slug as string;
  const category = categories.find((c) => c.slug === slug);

  if (!category) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <span className="text-6xl mb-4 block">😢</span>
          <h2 className="text-xl font-bold text-gray-dark mb-2">Category not found</h2>
          <Link href="/" className="inline-block bg-pink text-white px-6 py-3 rounded-full hover:bg-pink-dark transition-colors font-medium mt-4">
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const categoryProducts = products.filter((p) => p.category === slug);

  return (
    <div className="min-h-screen bg-gray-light">
      {/* Breadcrumb */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-gray-medium">
            <Link href="/" className="hover:text-pink transition-colors">
              Home
            </Link>
            <span>/</span>
            <span className="text-gray-dark font-medium">{category.name}</span>
          </div>
        </div>
      </div>

      {/* Category Header */}
      <div className="bg-gradient-to-r from-pink to-pink-dark py-10 text-white text-center">
        <span className="text-5xl mb-3 block">{category.icon}</span>
        <h1 className="text-3xl md:text-4xl font-bold mb-2">{category.name}</h1>
        <p className="text-white/80">
          {categoryProducts.length} products available
        </p>
      </div>

      {/* Category Navigation Tabs */}
      <div className="bg-white border-b sticky top-[108px] z-40">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex overflow-x-auto hide-scrollbar gap-1">
            {categories.map((cat) => (
              <Link
                key={cat.slug}
                href={`/category/${cat.slug}`}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
                  cat.slug === slug
                    ? "border-pink text-pink"
                    : "border-transparent text-gray-medium hover:text-gray-dark hover:border-gray-300"
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Products */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {categoryProducts.length > 0 ? (
          <>
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-gray-medium">
                Showing <strong className="text-gray-dark">{categoryProducts.length}</strong> products
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-medium">Sort by:</span>
                <select className="text-sm border border-gray-200 rounded-md px-3 py-1.5 outline-none focus:ring-2 focus:ring-pink/30">
                  <option>Popularity</option>
                  <option>Price: Low to High</option>
                  <option>Price: High to Low</option>
                  <option>Rating</option>
                  <option>Discount</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6">
              {categoryProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-20">
            <span className="text-6xl mb-4 block">🔍</span>
            <h2 className="text-xl font-bold text-gray-dark mb-2">
              Coming Soon!
            </h2>
            <p className="text-gray-medium mb-6">
              We&apos;re adding amazing {category.name.toLowerCase()} products.
              Check back soon!
            </p>
            <Link
              href="/"
              className="inline-block bg-pink text-white px-6 py-3 rounded-full hover:bg-pink-dark transition-colors font-medium"
            >
              ← Back to Home
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
