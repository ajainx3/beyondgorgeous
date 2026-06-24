export default function VideoAd() {
  return (
    <section className="py-12 bg-gradient-to-b from-white to-pink-light relative z-[10000]">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-dark">
            Discover BeyondGorgeous ✨
          </h2>
          <p className="text-gray-medium mt-2 text-sm">
            Watch our latest beauty collection
          </p>
          <div className="w-16 h-0.5 bg-pink mx-auto mt-3" />
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white">
            <div className="relative pb-[56.25%] h-0">
              <iframe
                className="absolute top-0 left-0 w-full h-full"
                src="https://www.youtube.com/embed/A-he9LocWrY?rel=0&modestbranding=1"
                title="BeyondGorgeous - Beauty Ad"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>

          <div className="text-center mt-6">
            <a
              href="https://www.youtube.com/@BeyondGorgeous"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-full hover:bg-red-700 transition-colors font-medium"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z" />
                <path d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="white" />
              </svg>
              Subscribe to our Channel
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
