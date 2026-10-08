import { useState } from 'react'
import { COMODINES, SIN_TIPO } from './sala'
import type { Historia } from './sala'

interface Props {
  /** Ítems de backlog en el orden en que se agregaron. */
  historias: Historia[]
  cartas: readonly string[]
  participantes: number
}

// Lienzo del gráfico en unidades del viewBox; el SVG se escala al ancho disponible.
const ANCHO = 480
const ALTO = 210
const MARGEN = { arriba: 14, derecha: 16, abajo: 26, izquierda: 34 }
// Separación entre líneas de referencia que caen sobre la misma carta.
const DESFASE = 3

/** Tablero de cierre: cifras de la sesión, evolución de las estimaciones y su detalle. */
export default function Resumen({ historias, cartas, participantes }: Props) {
  const [activo, setActivo] = useState<number | null>(null)

  const escala = cartas.filter((c) => !COMODINES.includes(c))
  const estimadas = historias
    .map((h, i) => ({
      numero: i + 1,
      titulo: h.titulo,
      tipo: h.tipo ?? SIN_TIPO,
      valor: h.estimacion ?? '',
      nivel: escala.indexOf(h.estimacion ?? ''),
    }))
    .filter((h) => h.nivel !== -1)

  const porNivel = [...estimadas].sort((a, b) => a.nivel - b.nivel)
  const masBaja = porNivel[0]
  const masAlta = porNivel[porNivel.length - 1]
  // Percentil 85 por rango más cercano: la carta más baja que cubre al 85 % de los ítems.
  const p85 = porNivel.length ? porNivel[Math.ceil(0.85 * porNivel.length) - 1] : undefined

  // Solo tiene sentido en mazos numéricos: cuánto menor es la más baja respecto de la más alta.
  const numerico = escala.every((c) => !Number.isNaN(Number(c)))
  let variabilidad = '–'
  if (numerico && masAlta && masBaja) {
    const alto = Number(masAlta.valor)
    variabilidad = `${alto > 0 ? Math.round(((alto - Number(masBaja.valor)) / alto) * 100) : 0} %`
  }

  const conteo = new Map<string, number>()
  for (const h of estimadas) conteo.set(h.tipo, (conteo.get(h.tipo) ?? 0) + 1)
  const tipos = [...conteo].sort((a, b) => b[1] - a[1])
  const mayorTipo = Math.max(1, ...tipos.map(([, n]) => n))

  const anchoTrazo = ANCHO - MARGEN.izquierda - MARGEN.derecha
  const altoTrazo = ALTO - MARGEN.arriba - MARGEN.abajo
  const x = (i: number) => MARGEN.izquierda + (estimadas.length > 1 ? (i / (estimadas.length - 1)) * anchoTrazo : anchoTrazo / 2)
  const y = (nivel: number) => MARGEN.arriba + altoTrazo - (escala.length > 1 ? (nivel / (escala.length - 1)) * altoTrazo : 0)
  const puntoActivo = activo === null ? undefined : estimadas[activo]

  const referencias = [
    { clave: 'alto', nombre: 'Más alta', punto: masAlta },
    { clave: 'p85', nombre: 'P85', punto: p85 },
    { clave: 'bajo', nombre: 'Más baja', punto: masBaja },
  ].flatMap((r) => (r.punto ? [{ ...r, punto: r.punto }] : []))
  // Si varias referencias coinciden en una carta se separan unos píxeles para que se vean todas.
  const yReferencia = (indice: number) => {
    const nivel = referencias[indice].punto.nivel
    const iguales = referencias.map((r, i) => (r.punto.nivel === nivel ? i : -1)).filter((i) => i !== -1)
    return y(nivel) + (iguales.indexOf(indice) - (iguales.length - 1) / 2) * DESFASE
  }

  return (
    <>
      <h1 className="resumen-titulo">Resumen de la sesión</h1>

      <section className="indicadores">
        <Indicador etiqueta="Participantes" valor={String(participantes)} />
        <Indicador etiqueta="Ítems estimados" valor={String(estimadas.length)} detalle={`de ${historias.length}`} />
        <Indicador etiqueta="Puntuación más alta" valor={masAlta?.valor ?? '–'} detalle={masAlta?.titulo} />
        <Indicador etiqueta="Puntuación más baja" valor={masBaja?.valor ?? '–'} detalle={masBaja?.titulo} />
        <Indicador
          etiqueta="Variabilidad"
          valor={variabilidad}
          detalle={masAlta && masBaja ? `entre ${masBaja.valor} y ${masAlta.valor}` : undefined}
        />
        <Indicador etiqueta="P85" valor={p85?.valor ?? '–'} detalle={p85 ? `85 % de los ítems en ${p85.valor} o menos` : undefined} />
      </section>

      {tipos.length > 0 && (
        <section className="tarjeta">
          <span className="etiqueta">Ítems estimados por tipo</span>
          <ul className="tipos">
            {tipos.map(([tipo, cantidad]) => (
              <li key={tipo}>
                <span className="tipos-nombre">{tipo}</span>
                <span className="dist-barra">
                  <span style={{ width: `${(cantidad / mayorTipo) * 100}%` }} />
                </span>
                <strong>{cantidad}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}

      {estimadas.length > 0 && (
        <section className="tarjeta">
          <span className="etiqueta">Estimación por ítem, en orden</span>
          <ul className="leyenda">
            <li>
              <svg viewBox="0 0 28 8" aria-hidden="true">
                <line className="grafico-linea" x1="1" x2="27" y1="4" y2="4" />
              </svg>
              Estimación
            </li>
            {referencias.map((r) => (
              <li key={r.clave}>
                <svg viewBox="0 0 28 8" aria-hidden="true">
                  <line className={`grafico-ref ref-${r.clave}`} x1="1" x2="27" y1="4" y2="4" />
                </svg>
                {r.nombre}: <strong>{r.punto.valor}</strong>
              </li>
            ))}
          </ul>
          <div className="grafico" onMouseLeave={() => setActivo(null)}>
            <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} role="img" aria-label="Estimación de cada ítem en el orden en que se estimaron">
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
              {referencias.map((r, i) => (
                <line
                  key={r.clave}
                  className={`grafico-ref ref-${r.clave}`}
                  x1={MARGEN.izquierda}
                  x2={ANCHO - MARGEN.derecha}
                  y1={yReferencia(i)}
                  y2={yReferencia(i)}
                />
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
                    aria-label={`Ítem ${h.numero}, ${h.titulo}: ${h.valor}`}
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
                <span>{puntoActivo.tipo}</span>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="tarjeta">
        <span className="etiqueta">Ítems de backlog estimados</span>
        <ol className="historias">
          {estimadas.map((h) => (
            <li key={h.numero}>
              <span className="historia-numero">{h.numero}</span>
              <span className="historia-titulo">
                {h.titulo}
                <small className="historia-tipo">{h.tipo}</small>
              </span>
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
