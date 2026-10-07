import { useState } from 'react'
import { COMODINES, totalEstimado } from './sala'
import type { Historia } from './sala'

interface Props {
  /** Historias en el orden en que se agregaron. */
  historias: Historia[]
  cartas: readonly string[]
  participantes: number
}

// Lienzo del gráfico en unidades del viewBox; el SVG se escala al ancho disponible.
const ANCHO = 480
const ALTO = 210
const MARGEN = { arriba: 14, derecha: 16, abajo: 26, izquierda: 34 }

/** Tablero de cierre: cifras de la sesión, evolución de las estimaciones y su detalle. */
export default function Resumen({ historias, cartas, participantes }: Props) {
  const [activo, setActivo] = useState<number | null>(null)

  const escala = cartas.filter((c) => !COMODINES.includes(c))
  const estimadas = historias
    .map((h, i) => ({ numero: i + 1, titulo: h.titulo, valor: h.estimacion ?? '', nivel: escala.indexOf(h.estimacion ?? '') }))
    .filter((h) => h.nivel !== -1)

  const masAlta = estimadas.reduce<(typeof estimadas)[number] | null>((m, h) => (!m || h.nivel > m.nivel ? h : m), null)
  const masBaja = estimadas.reduce<(typeof estimadas)[number] | null>((m, h) => (!m || h.nivel < m.nivel ? h : m), null)
  const total = totalEstimado(historias)

  const anchoTrazo = ANCHO - MARGEN.izquierda - MARGEN.derecha
  const altoTrazo = ALTO - MARGEN.arriba - MARGEN.abajo
  const x = (i: number) => MARGEN.izquierda + (estimadas.length > 1 ? (i / (estimadas.length - 1)) * anchoTrazo : anchoTrazo / 2)
  const y = (nivel: number) => MARGEN.arriba + altoTrazo - (escala.length > 1 ? (nivel / (escala.length - 1)) * altoTrazo : 0)
  const puntoActivo = activo === null ? undefined : estimadas[activo]

  return (
    <>
      <h1 className="resumen-titulo">Resumen de la sesión</h1>

      <section className="indicadores">
        <Indicador etiqueta="Historias estimadas" valor={String(estimadas.length)} detalle={`de ${historias.length}`} />
        <Indicador etiqueta="Puntuación más alta" valor={masAlta?.valor ?? '–'} detalle={masAlta?.titulo} />
        <Indicador etiqueta="Puntuación más baja" valor={masBaja?.valor ?? '–'} detalle={masBaja?.titulo} />
        <Indicador etiqueta="Participantes" valor={String(participantes)} />
      </section>

      {estimadas.length > 0 && (
        <section className="tarjeta">
          <span className="etiqueta">Estimación por historia, en orden</span>
          <div className="grafico" onMouseLeave={() => setActivo(null)}>
            <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} role="img" aria-label="Estimación de cada historia en el orden en que se estimaron">
              {escala.map((carta, nivel) => (
                <g key={carta}>
                  <line className="grafico-guia" x1={MARGEN.izquierda} x2={ANCHO - MARGEN.derecha} y1={y(nivel)} y2={y(nivel)} />
                  <text className="grafico-eje" x={MARGEN.izquierda - 8} y={y(nivel)} textAnchor="end" dominantBaseline="middle">
                    {carta}
                  </text>
                </g>
              ))}
              {estimadas.map((h, i) => (
                <text key={h.numero} className="grafico-eje" x={x(i)} y={ALTO - 6} textAnchor="middle">
                  {h.numero}
                </text>
              ))}
              <polyline className="grafico-linea" points={estimadas.map((h, i) => `${x(i)},${y(h.nivel)}`).join(' ')} />
              {estimadas.map((h, i) => (
                <g key={h.numero}>
                  <circle className="grafico-punto" cx={x(i)} cy={y(h.nivel)} r={activo === i ? 6.5 : 5} />
                  {/* Zona de contacto más grande que el punto, también alcanzable con teclado. */}
                  <circle
                    className="grafico-zona"
                    cx={x(i)}
                    cy={y(h.nivel)}
                    r={16}
                    tabIndex={0}
                    aria-label={`Historia ${h.numero}, ${h.titulo}: ${h.valor}`}
                    onMouseEnter={() => setActivo(i)}
                    onFocus={() => setActivo(i)}
                    onBlur={() => setActivo(null)}
                  />
                </g>
              ))}
            </svg>
            {puntoActivo && activo !== null && (
              <div
                className="grafico-globo"
                style={{ left: `${(x(activo) / ANCHO) * 100}%`, top: `${(y(puntoActivo.nivel) / ALTO) * 100}%` }}
              >
                <strong>{puntoActivo.valor}</strong>
                <span>
                  {puntoActivo.numero}. {puntoActivo.titulo}
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="tarjeta">
        <div className="titulo-seccion">
          <span className="etiqueta">Historias estimadas</span>
          {total !== null && <span className="etiqueta">Total estimado: {total}</span>}
        </div>
        <ol className="historias">
          {estimadas.map((h) => (
            <li key={h.numero}>
              <span className="historia-numero">{h.numero}</span>
              <span className="historia-titulo">{h.titulo}</span>
              <span className="insignia">{h.valor}</span>
            </li>
          ))}
        </ol>
      </section>
    </>
  )
}

function Indicador({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle?: string }) {
  return (
    <div className="indicador">
      <span className="etiqueta">{etiqueta}</span>
      <strong>{valor}</strong>
      {detalle && <small>{detalle}</small>}
    </div>
  )
}
