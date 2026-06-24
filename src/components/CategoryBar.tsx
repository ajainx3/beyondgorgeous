import Link from "next/link";
import { categories } from "@/data/products";

export default function CategoryBar() {
  return (
    <section className="py-8 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex overflow-x-auto gap-4 md:gap-6 hide-scrollbar justify-start md:justify-center">
          {categories.map((cat) => (
            <Link
              key={cat.slug}
              href={`/category/${cat.slug}`}
              className="flex flex-col items-center gap-2 min-w-[80px] group"
            >
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-pink-light flex items-center justify-center text-2xl md:text-3xl group-hover:bg-pink group-hover:text-white transition-all group-hover:scale-110 group-hover:shadow-lg">
                {cat.icon}
              </div>
              <span className="text-xs md:text-sm font-medium text-gray-dark group-hover:text-pink transition-colors whitespace-nowrap">
                {cat.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
