import { useId } from 'react'

/**
 * Loading indicator: a small Moon whose shadow sweeps across it, from full to new and back.
 * Under reduced motion it rests as a still crescent. The label says what is loading.
 */
export default function MoonLoader({ label, size = 56 }: { label: string; size?: number }) {
  const clip = useId()
  return (
    <div role="status" className="flex flex-col items-center gap-3 text-center text-sm text-muted">
      <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden>
        <defs>
          <clipPath id={clip}>
            <circle cx="32" cy="32" r="28" />
          </clipPath>
        </defs>
        <circle cx="32" cy="32" r="28" fill="#d9d6cf" />
        {/* A few maria and craters, so it reads as the Moon and not a plain disc. */}
        <g fill="#b7b3ab">
          <circle cx="23" cy="24" r="7" />
          <circle cx="38" cy="19" r="4" />
          <circle cx="41" cy="36" r="8" />
          <circle cx="25" cy="42" r="4.5" />
          <circle cx="33" cy="49" r="2.5" />
        </g>
        <g clipPath={`url(#${clip})`}>
          <circle className="moon-loader-shadow" cx="32" cy="32" r="34" fill="#08090b" opacity="0.94" />
        </g>
        <circle cx="32" cy="32" r="28" fill="none" stroke="#454a56" strokeWidth="1" />
      </svg>
      <span>{label}</span>
    </div>
  )
}
