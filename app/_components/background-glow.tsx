// app/_components/background-glow.tsx
// Source: lead-scoring-with-tools/website-analysis-tools/app/components/BackgroundGlow.tsx
// Adapted: fixed → absolute (CP-06 / GLOW-03), color prop added (GLOW-02),
//          blob left-offsets reduced (580→200, 380→100) to fit sidebar-constrained container.
// Phase 17 (MP-10): blob 2 terminus changed from #111827 → transparent so customer-
// tinted glows on bg-gray-50 public surfaces render cleanly without a visible dark smear.

interface BackgroundGlowProps {
  color?: string;
}

export function BackgroundGlow({ color = "#3B82F6" }: BackgroundGlowProps) {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <div
        className="absolute w-80 h-80 rounded-full opacity-40 blur-[160px]"
        style={{
          top: '-32px',
          left: 'calc(50% + 100px)',
          transform: 'translateX(-50%)',
          background: `linear-gradient(to top right, ${color}, transparent)`,
        }}
      />
      <div
        className="absolute w-80 h-80 rounded-full opacity-[0.35] blur-[160px]"
        style={{
          top: '420px',
          left: 'calc(50% + 0px)',
          transform: 'translateX(-50%)',
          background: `linear-gradient(to top right, ${color}, transparent)`,
        }}
      />
    </div>
  );
}
