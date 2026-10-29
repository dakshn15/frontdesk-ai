// A drawn map of the block, not a real one: where the salon sits on South Congress and how
// to reach the guest lot behind it from Elizabeth Street.

export function StreetMap() {
  return (
    <svg
      viewBox="0 0 480 360"
      role="img"
      aria-label="Map of the block. Bloom is on South Congress Avenue between a coffee shop and a bookstore. The guest parking lot is behind the salon, entered from Elizabeth Street."
      className="h-auto w-full"
    >
      <rect width="480" height="360" fill="#EDE0E6" />
      {/* Blocks either side of the avenue */}
      <rect x="0" y="134" width="226" height="226" fill="#E4D3DB" />
      <rect x="284" y="134" width="196" height="226" fill="#E4D3DB" />
      <rect x="0" y="0" width="226" height="98" fill="#E4D3DB" />
      <rect x="284" y="0" width="196" height="98" fill="#E4D3DB" />

      {/* South Congress Ave and Elizabeth St */}
      <rect x="226" y="0" width="58" height="360" fill="#FFFFFF" />
      <rect x="0" y="98" width="480" height="36" fill="#FFFFFF" />
      <path
        d="M255 0 V98 M255 134 V360"
        stroke="#E8A93A"
        strokeWidth="2"
        strokeDasharray="10 9"
      />

      {/* Guest lot, with its drive from Elizabeth St */}
      <rect x="66" y="134" width="22" height="36" fill="#FFFFFF" />
      <rect
        x="24"
        y="170"
        width="104"
        height="150"
        rx="6"
        fill="#FFFFFF"
        stroke="#1F5C4F"
        strokeWidth="2"
      />
      <g stroke="#C9B3BF" strokeWidth="2">
        <path d="M24 200 H58 M24 230 H58 M24 260 H58 M24 290 H58" />
        <path d="M94 200 H128 M94 230 H128 M94 260 H128 M94 290 H128" />
      </g>
      <circle cx="76" cy="245" r="17" fill="#1F5C4F" />
      <text
        x="76"
        y="252"
        textAnchor="middle"
        fontSize="20"
        fontWeight="700"
        fill="#FFFFFF"
      >
        P
      </text>

      {/* Shops on the avenue */}
      <rect x="148" y="150" width="70" height="56" rx="3" fill="#D6C1CC" />
      <rect x="148" y="212" width="70" height="60" rx="3" fill="#2A1430" />
      <rect x="148" y="278" width="70" height="56" rx="3" fill="#D6C1CC" />
      <path
        d="M128 245 H148"
        stroke="#1F5C4F"
        strokeWidth="2"
        strokeDasharray="4 4"
      />

      <g fontFamily="inherit" fill="#2A1430">
        <text x="183" y="183" textAnchor="middle" fontSize="13">
          Coffee
        </text>
        <text
          x="183"
          y="247"
          textAnchor="middle"
          fontSize="15"
          fontWeight="700"
          fill="#F4C6D0"
        >
          Bloom
        </text>
        <text x="183" y="311" textAnchor="middle" fontSize="13">
          Books
        </text>
        <text x="76" y="160" textAnchor="middle" fontSize="12">
          Way in
        </text>
        <text x="76" y="340" textAnchor="middle" fontSize="13">
          Guest lot
        </text>
        <text x="16" y="121" fontSize="14" fontWeight="600">
          Elizabeth St
        </text>
        <text
          x="278"
          y="300"
          fontSize="14"
          fontWeight="600"
          transform="rotate(-90 278 300)"
        >
          South Congress Ave
        </text>
        <text x="400" y="60" fontSize="12" textAnchor="middle">
          N
        </text>
      </g>
      <path d="M400 30 L408 46 H392 Z" fill="#2A1430" />
    </svg>
  );
}
