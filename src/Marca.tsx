/** Logotipo de DeXva recreado en SVG para que funcione sobre el fondo oscuro. */
export default function Marca({ compacta = false }: { compacta?: boolean }) {
  return (
    <span className={compacta ? 'marca compacta' : 'marca'}>
      <span className="marca-nombre" role="img" aria-label="DeXva">
        De
        <svg viewBox="0 0 100 72" aria-hidden="true">
          <defs>
            <linearGradient id="marca-oro" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#b8862c" />
              <stop offset="1" stopColor="#f0c860" />
            </linearGradient>
            <linearGradient id="marca-cian" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#22e3f2" />
              <stop offset="1" stopColor="#0a7fb5" />
            </linearGradient>
          </defs>
          <polygon points="66,0 96,0 34,72 4,72" fill="url(#marca-oro)" />
          <polygon points="4,0 34,0 96,72 66,72" fill="url(#marca-cian)" stroke="var(--fondo)" strokeWidth="5" />
        </svg>
        va
      </span>
      <span className="marca-producto">Planning Poker</span>
    </span>
  )
}
