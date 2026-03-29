export function FlagNL({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 0.75)} viewBox="0 0 20 15" fill="none" style={{ borderRadius: 2, overflow: "hidden", flexShrink: 0 }}>
      <rect width="20" height="5" fill="#AE1C28" />
      <rect y="5" width="20" height="5" fill="#FFF" />
      <rect y="10" width="20" height="5" fill="#21468B" />
    </svg>
  )
}

export function FlagGB({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 0.75)} viewBox="0 0 60 30" fill="none" style={{ borderRadius: 2, overflow: "hidden", flexShrink: 0 }}>
      <rect width="60" height="30" fill="#012169" />
      <path d="M0 0L60 30M60 0L0 30" stroke="#FFF" strokeWidth="6" />
      <path d="M0 0L60 30M60 0L0 30" stroke="#C8102E" strokeWidth="2" />
      <path d="M30 0V30M0 15H60" stroke="#FFF" strokeWidth="10" />
      <path d="M30 0V30M0 15H60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  )
}
