"use client";

import Link from "next/link";
import type { Product } from "@/data/products";

export default function ProductCard({ product }: { product: Product }) {
  return (
    <Link href={`/product/${product.id}`} className="group block">
      <div className="bg-white rounded-lg border border-gray-100 overflow-hidden hover:shadow-lg transition-all duration-300 h-full flex flex-col">
        {/* Image */}
        <div className="relative aspect-square bg-gray-light overflow-hidden">
          <div className="w-full h-full flex items-center justify-center text-gray-medium">
            <svg
              className="w-16 h-16 opacity-30 group-hover:scale-110 transition-transform duration-300"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M7 21q-.825 0-1.413-.588T5 19V5q0-.825.588-1.413T7 3h10q.825 0 1.413.588T19 5v14q0 .825-.588 1.413T17 21H7zm5-7q1.65 0 2.825-1.175T16 10q0-1.65-1.175-2.825T12 6q-1.65 0-2.825 1.175T8 10q0 1.65 1.175 2.825T12 14z" />
            </svg>
          </div>

          {/* Tag badge */}
          {product.tag && (
            <span className="absolute top-2 left-2 bg-pink text-white text-[10px] font-bold px-2 py-0.5 rounded">
              {product.tag}
            </span>
          )}

          {/* Wishlist button */}
          <button
            className="absolute top-2 right-2 w-8 h-8 bg-white rounded-full shadow flex items-center justify-center hover:bg-pink-light transition-colors"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <svg
              className="w-4 h-4 text-gray-medium hover:text-pink"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </button>
        </div>

        {/* Info */}
        <div className="p-3 flex flex-col flex-1">
          <p className="text-xs text-gray-medium font-medium uppercase tracking-wider mb-1">
            {product.brand}
          </p>
          <h3 className="text-sm text-gray-dark leading-snug mb-2 line-clamp-2 flex-1">
            {product.name}
          </h3>

          {/* Rating */}
          <div className="flex items-center gap-1 mb-2">
            <span className="bg-green text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
              ★ {product.rating}
            </span>
            <span className="text-xs text-gray-medium">
              ({product.reviews.toLocaleString()})
            </span>
          </div>

          {/* Price */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-base text-gray-dark">
              ₹{product.price}
            </span>
            <span className="text-sm text-gray-medium line-through">
              ₹{product.originalPrice}
            </span>
            <span className="text-xs font-semibold text-green">
              {product.discount}% off
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
