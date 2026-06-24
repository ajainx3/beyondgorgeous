import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-gray-dark text-gray-300 pt-12 pb-6">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {/* Company */}
          <div>
            <h3 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">
              Company
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/about" className="hover:text-pink transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/careers" className="hover:text-pink transition-colors">
                  Careers
                </Link>
              </li>
              <li>
                <Link href="/blog" className="hover:text-pink transition-colors">
                  Beauty Blog
                </Link>
              </li>
              <li>
                <Link href="/press" className="hover:text-pink transition-colors">
                  Press
                </Link>
              </li>
            </ul>
          </div>

          {/* Help */}
          <div>
            <h3 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">
              Help
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/contact" className="hover:text-pink transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/faq" className="hover:text-pink transition-colors">
                  FAQ
                </Link>
              </li>
              <li>
                <Link href="/shipping" className="hover:text-pink transition-colors">
                  Shipping Info
                </Link>
              </li>
              <li>
                <Link href="/returns" className="hover:text-pink transition-colors">
                  Returns & Exchange
                </Link>
              </li>
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h3 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">
              Top Categories
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link
                  href="/category/makeup"
                  className="hover:text-pink transition-colors"
                >
                  Makeup
                </Link>
              </li>
              <li>
                <Link
                  href="/category/skincare"
                  className="hover:text-pink transition-colors"
                >
                  Skincare
                </Link>
              </li>
              <li>
                <Link
                  href="/category/haircare"
                  className="hover:text-pink transition-colors"
                >
                  Hair Care
                </Link>
              </li>
              <li>
                <Link
                  href="/category/fragrances"
                  className="hover:text-pink transition-colors"
                >
                  Fragrances
                </Link>
              </li>
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h3 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">
              Connect
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a href="#" className="hover:text-pink transition-colors">
                  Instagram
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-pink transition-colors">
                  Facebook
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-pink transition-colors">
                  Twitter / X
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-pink transition-colors">
                  YouTube
                </a>
              </li>
            </ul>
            <div className="mt-6">
              <h4 className="text-white font-medium mb-2 text-xs uppercase tracking-wider">
                Newsletter
              </h4>
              <div className="flex">
                <input
                  type="email"
                  placeholder="Your email"
                  className="px-3 py-2 text-sm bg-gray-700 rounded-l-md outline-none focus:ring-1 focus:ring-pink w-full"
                />
                <button className="bg-pink text-white px-4 py-2 text-sm rounded-r-md hover:bg-pink-dark transition-colors whitespace-nowrap">
                  Join
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Trust badges */}
        <div className="border-t border-gray-600 pt-6 pb-4">
          <div className="flex flex-wrap justify-center gap-8 text-sm text-gray-400">
            <span className="flex items-center gap-2">
              🔒 100% Secure Payments
            </span>
            <span className="flex items-center gap-2">
              ✅ Genuine Products
            </span>
            <span className="flex items-center gap-2">
              🚚 Free Shipping above ₹499
            </span>
            <span className="flex items-center gap-2">
              ↩️ Easy Returns
            </span>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-600 pt-4 text-center text-xs text-gray-500">
          <p>
            © {new Date().getFullYear()} BeyondGorgeous. All rights reserved. |{" "}
            <Link href="/privacy" className="hover:text-pink">
              Privacy Policy
            </Link>{" "}
            |{" "}
            <Link href="/terms" className="hover:text-pink">
              Terms of Use
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
