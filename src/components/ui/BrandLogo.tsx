"use client";

interface BrandLogoProps {
  size?: number;
  variant?: "full" | "icon";
  className?: string;
}

export function BrandLogo({ size = 40, variant = "icon", className = "" }: BrandLogoProps) {
  if (variant === "full") {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <PhcIcon size={size} />
        <div className="leading-tight">
          <div className="font-bold tracking-wide text-[#9B2335]" style={{ fontSize: size * 0.38 }}>
            PROXIMITÉ HABITAT
          </div>
          <div className="font-semibold tracking-widest text-[#1B2659]" style={{ fontSize: size * 0.28 }}>
            CONSEIL
          </div>
        </div>
      </div>
    );
  }
  return <PhcIcon size={size} className={className} />;
}

function PhcIcon({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Proximité Habitat Conseil"
    >
      {/* Main circle outline */}
      <circle cx="50" cy="50" r="47" stroke="#1B2659" strokeWidth="3" fill="none" opacity="0.15" />

      {/* Navy blue hand — top arc */}
      <path
        d="M50 12
           C65 12, 80 20, 87 34
           C90 40, 90 46, 88 50
           C85 55, 78 56, 72 53
           C66 50, 62 44, 58 40
           C54 36, 50 35, 46 37
           C42 39, 40 43, 42 47
           C44 51, 50 52, 50 52
           C50 52, 40 50, 34 44
           C28 38, 28 28, 35 22
           C41 16, 50 12, 50 12Z"
        fill="#1B2659"
      />

      {/* Crimson red hand — bottom arc */}
      <path
        d="M50 88
           C35 88, 20 80, 13 66
           C10 60, 10 54, 12 50
           C15 45, 22 44, 28 47
           C34 50, 38 56, 42 60
           C46 64, 50 65, 54 63
           C58 61, 60 57, 58 53
           C56 49, 50 48, 50 48
           C50 48, 60 50, 66 56
           C72 62, 72 72, 65 78
           C59 84, 50 88, 50 88Z"
        fill="#9B2335"
      />

      {/* Small highlight dots */}
      <circle cx="50" cy="30" r="4" fill="#1B2659" opacity="0.5" />
      <circle cx="50" cy="70" r="4" fill="#9B2335" opacity="0.5" />
    </svg>
  );
}
