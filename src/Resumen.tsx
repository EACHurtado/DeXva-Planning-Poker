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

/** Tablero de cierre: cifras de la sesión, lectura para el equipo, evolución y detalle. */
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

  // Los cálculos usan el valor de la carta, o su posición si el mazo no es numérico (tallas).
  const numerico = escala.every((c) => !Number.isNaN(Number(c)))
  const medida = (nivel: number) => (numerico ? Number(escala[nivel]) : nivel)
  const datos = porNivel.map((h) => medida(h.nivel))

  /**
   * Percentil por interpolación lineal, k = p·(n − 1) + 1, redondeado a entero
   * y llevado a la carta más cercana del mazo (en un empate, la más alta).
   */
  function percentil(p: number): number | null {
    if (!datos.length) return null
    const k = p * (datos.length - 1)
    const abajo = Math.floor(k)
    const arriba = Math.ceil(k)
    const exacto = Math.round(datos[abajo] + (k - abajo) * (datos[arriba] - datos[abajo]))
    let nivel = 0
    escala.forEach((_, i) => {
      if (Math.abs(medida(i) - exacto) <= Math.abs(medida(nivel) - exacto)) nivel = i
    })
    return nivel
  }

  const nivelMediana = percentil(0.5)
  const nivelP85 = percentil(0.85)
  const mediana = nivelMediana === null ? null : escala[nivelMediana]
  const p85 = nivelP85 === null ? null : escala[nivelP85]
  // «5 puntos» en mazos numéricos; solo la carta («M») en los demás.
  const conUnidad = (carta: string) => (numerico ? `${carta} ${carta === '1' ? 'punto' : 'puntos'}` : carta)

  let variabilidad = '–'
  if (numerico && masAlta && masBaja) {
    const alto = Number(masAlta.valor)
    variabilidad = `${alto > 0 ? Math.round(((alto - Number(masBaja.valor)) / alto) * 100) : 0} %`
  }

  const conteo = new Map<string, number>()
  for (const h of estimadas) conteo.set(h.tipo, (conteo.get(h.tipo) ?? 0) + 1)
  const tipos = [...conteo].sort((a, b) => b[1] - a[1])
  const mayorTipo = Math.max(1, ...tipos.map(([, n]) => n))

  // Lectura para el equipo: frases armadas según lo que muestran los datos.
  const lectura: string[] = []
  if (mediana !== null && p85 !== null && nivelMediana !== null && nivelP85 !== null && masAlta && masBaja) {
    if (masAlta.nivel === masBaja.nivel) {
      lectura.push(`Todos los ítems se estimaron en ${conUnidad(mediana)}: es un lote muy parejo, sin ítems que se salgan del resto.`)
    } else {
      lectura.push(
        `El tamaño típico de los ítems fue de ${conUnidad(mediana)}, y el 85 % de la carga se concentró hasta ${conUnidad(p85)}.`,
      )
      const brecha = nivelP85 - nivelMediana
      if (brecha >= 2) {
        lectura.push(
          `La distancia entre lo típico y lo complejo es amplia (${mediana} frente a ${p85}): el lote mezcla ítems pequeños con otros bastante más grandes.`,
        )
      } else if (brecha === 1) {
        lectura.push(`Lo complejo queda solo un escalón por encima de lo típico (${mediana} frente a ${p85}): el lote es razonablemente homogéneo.`)
      } else {
        lectura.push(`La mediana y el P85 coinciden en ${p85}: la mayoría de los ítems tiene un tamaño similar.`)
      }
      const sobreP85 = estimadas.filter((h) => h.nivel > nivelP85)
      if (sobreP85.length === 1) {
        lectura.push(
          `«${sobreP85[0].titulo}» (${sobreP85[0].valor}) quedó por encima de ese límite: es el valor atípico del lote y un buen candidato a dividirse o a revisarse antes de comprometerlo.`,
        )
      } else if (sobreP85.length > 1) {
        lectura.push(
          `${sobreP85.length} ítems superan ese límite (${sobreP85.map((h) => `«${h.titulo}»: ${h.valor}`).join(', ')}): conviene revisarlos o dividirlos antes de comprometerlos.`,
        )
      }
    }
    if (tipos.length > 1) lectura.push(`El tipo más frecuente fue ${tipos[0][0]}, con ${tipos[0][1]} de ${estimadas.length} ítems.`)
    if (estimadas.length < 4) lectura.push(`Con solo ${estimadas.length} ${estimadas.length === 1 ? 'ítem estimado' : 'ítems estimados'}, estas cifras son orientativas.`)
  }

  const anchoTrazo = ANCHO - MARGEN.izquierda - MARGEN.derecha
  const altoTrazo = ALTO - MARGEN.arriba - MARGEN.abajo
  const x = (i: number) => MARGEN.izquierda + (estimadas.length > 1 ? (i / (estimadas.length - 1)) * anchoTrazo : anchoTrazo / 2)
  const y = (nivel: number) => MARGEN.arriba + altoTrazo - (escala.length > 1 ? (nivel / (escala.length - 1)) * altoTrazo : 0)
  const puntoActivo = activo === null ? undefined : estimadas[activo]

  const referencias = [
    { clave: 'alto', nombre: 'Más alta', nivel: masAlta?.nivel },
    { clave: 'p85', nombre: 'P85', nivel: nivelP85 ?? undefined },
    { clave: 'bajo', nombre: 'Más baja', nivel: masBaja?.nivel },
  ].flatMap((r) => (r.nivel === undefined ? [] : [{ ...r, nivel: r.nivel }]))
  // Si varias referencias coinciden en una carta se separan unos píxeles para que se vean todas.
  const yReferencia = (indice: number) => {
    const nivel = referencias[indice].nivel
    const iguales = referencias.map((r, i) => (r.nivel === nivel ? i : -1)).filter((i) => i !== -1)
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
        <Indicador
          etiqueta="Mediana (valor central)"
          valor={mediana ?? '–'}
          detalle={
            mediana
              ? `El 50 % de los ítems se estimó en ${conUnidad(mediana)} o menos. Es el tamaño típico y no se distorsiona con valores atípicos.`
              : undefined
          }
        />
        <Indicador
          etiqueta="P85 (límite superior)"
          valor={p85 ?? '–'}
          detalle={p85 ? `El 85 % de los ítems quedó en ${conUnidad(p85)} o menos. Muestra el tamaño de los ítems complejos.` : undefined}
        />
      </section>

      {lectura.length > 0 && (
        <section className="tarjeta lectura">
          <span className="etiqueta">Lectura para el equipo</span>
          {lectura.map((frase) => (
            <p key={frase}>{frase}</p>
          ))}
        </section>
      )}

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
                {r.nombre}: <strong>{escala[r.nivel]}</strong>
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
