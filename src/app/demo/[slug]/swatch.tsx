// A hair colour swatch, the bound strand of sample hair a salon keeps in its colour book.
// Roots at the top, ends at the bottom, with a few fibres drawn over the colour.

const FIBRES = [
  "M9 24 C10 80 14 150 20 196",
  "M14 24 C15 90 17 150 20 196",
  "M20 24 C20 90 20 150 20 196",
  "M26 24 C25 90 23 150 20 196",
  "M31 24 C30 80 26 150 20 196",
  "M11 24 C13 70 18 120 19 170",
  "M29 24 C27 70 22 120 21 170",
];

export function Swatch({
  id,
  stops,
  className,
}: {
  id: string;
  stops: readonly string[];
  className?: string;
}) {
  const gradient = `swatch-${id}`;
  return (
    <svg
      viewBox="0 0 40 200"
      aria-hidden
      className={className}
      preserveAspectRatio="xMidYMin meet"
    >
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
          {stops.map((stop, index) => (
            <stop
              key={stop}
              offset={index / (stops.length - 1)}
              stopColor={stop}
            />
          ))}
        </linearGradient>
      </defs>
      <path
        d="M6 22 C6 80 12 150 20 199 C28 150 34 80 34 22 Z"
        fill={`url(#${gradient})`}
      />
      <g fill="none" strokeLinecap="round" strokeWidth="0.6">
        {FIBRES.map((d, index) => (
          <path
            key={d}
            d={d}
            stroke={index % 2 ? "#000" : "#fff"}
            strokeOpacity={index % 2 ? 0.16 : 0.22}
          />
        ))}
      </g>
      <rect x="4" y="9" width="32" height="15" rx="3" fill="#2A1430" />
      <rect x="7" y="13" width="26" height="1.6" rx="0.8" fill="#F4C6D0" />
      <circle
        cx="20"
        cy="5"
        r="3.6"
        fill="none"
        stroke="#2A1430"
        strokeWidth="2"
      />
    </svg>
  );
}
