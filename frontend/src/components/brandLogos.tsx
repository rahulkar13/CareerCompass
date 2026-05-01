import { classNames } from '../utils/helpers'

type BrandLogoProps = {
  compact?: boolean
  className?: string
}

export const CareerCompassLogoOne = ({ compact = false, className = '' }: BrandLogoProps) => (
  <span className={classNames('brand-logo brand-logo-one inline-flex items-center', compact ? 'gap-2.5' : 'gap-3', className)}>
    <svg
      viewBox="0 0 40 40"
      aria-hidden="true"
      className={classNames('brand-logo-mark shrink-0', compact ? 'h-8 w-8' : 'h-9 w-9')}
    >
      <circle cx="20" cy="20" r="13.5" className="brand-logo-ring" />
      <path d="M18.15 11.85V9.65l3.7 2.2v-2.2" className="brand-logo-north" />
      <circle cx="20" cy="20" r="2.4" className="brand-logo-core" />
      <path d="M30.2 20h-4.1M20 30.2v-4.1M9.8 20h4.1" className="brand-logo-ticks" />
      <path d="M15 24.8 20.2 19.6 24 23.4 29.4 14.4" className="brand-logo-path" />
      <path d="m26.8 14.5 4.6-.7-.9 4.6" className="brand-logo-arrow" />
    </svg>
    <span className="brand-logo-divider" aria-hidden="true" />
    <span className="brand-logo-wordmark">
      <span className="brand-logo-name brand-logo-one-name">
        <span className="brand-logo-segment brand-logo-career">
          <span className="brand-logo-initial">C</span>areer
        </span>
        <span className="brand-logo-segment brand-logo-compass">
          <span className="brand-logo-initial">C</span>ompass
        </span>
      </span>
    </span>
  </span>
)

export const CareerCompassLogoTwo = ({ compact = false, className = '' }: BrandLogoProps) => (
  <span className={classNames('brand-logo brand-logo-two inline-flex items-center', compact ? 'gap-2.5' : 'gap-3', className)}>
    <svg
      viewBox="0 0 40 40"
      aria-hidden="true"
      className={classNames('brand-logo-mark shrink-0', compact ? 'h-8 w-8' : 'h-9 w-9')}
    >
      <path d="M20 7.8a12.2 12.2 0 1 1-8.63 3.57A12.18 12.18 0 0 1 20 7.8Z" className="brand-logo-two-shell" />
      <path d="M20 12.2v15.6" className="brand-logo-two-axis" />
      <path d="M12.8 20h14.4" className="brand-logo-two-axis soft" />
      <path d="M14.2 25.2 19 20.5l3.6 3.2 7.1-7" className="brand-logo-two-rise" />
      <path d="m26.6 16.7 3.7-.2-.3 3.7" className="brand-logo-two-rise" />
      <path d="M15.2 10.4c1.28-1.02 3-1.6 4.8-1.6 1.9 0 3.68.63 5.03 1.76" className="brand-logo-two-crest" />
    </svg>
    <span className="brand-logo-divider" aria-hidden="true" />
    <span className="brand-logo-wordmark">
      <span className="brand-logo-name brand-logo-two-name">
        <span className="brand-logo-segment brand-logo-career">
          <span className="brand-logo-initial">C</span>areer
        </span>
        <span className="brand-logo-segment brand-logo-compass">
          <span className="brand-logo-initial">C</span>ompass
        </span>
      </span>
    </span>
  </span>
)

export const BrandLogo = CareerCompassLogoOne
