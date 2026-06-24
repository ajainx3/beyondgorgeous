export default function Watermark() {
  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0">
        {[...Array(6)].map((_, row) =>
          [...Array(4)].map((_, col) => (
            <div
              key={`${row}-${col}`}
              className="absolute text-pink/[0.07] font-bold text-3xl md:text-5xl whitespace-nowrap select-none"
              style={{
                top: `${row * 18 + 5}%`,
                left: `${col * 28 + (row % 2 === 0 ? 0 : 14)}%`,
                transform: "rotate(-25deg)",
              }}
            >
              Launching Soon
            </div>
          ))
        )}
      </div>
    </div>
  );
}
