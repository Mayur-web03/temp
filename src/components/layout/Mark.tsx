export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="6" fill="currentColor" className="text-primary" />
      <path
        d="M6 22 L12 12 L16 18 L20 10 L26 22"
        fill="none"
        stroke="#0c0d0b"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M8 22 H24" stroke="#0c0d0b" strokeWidth="1.6" />
      <path d="M10 22 C14 16 18 16 22 22" fill="none" stroke="#0c0d0b" strokeWidth="1.4" />
    </svg>
  );
}
