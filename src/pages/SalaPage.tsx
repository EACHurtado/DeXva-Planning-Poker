import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SelectorMazo } from './Inicio'
import {
  MAZO_INICIAL,
  cambiarHistoria,
  cambiarMazo,
  cartasDe,
  entrarSala,
  guardarNombre,
  leerNombre,
  nuevaRonda,
  resumir,
  revelar,
  useSala,
  useUid,
  votar,
} from '../sala'

export default function SalaPage() {
  const { id = '' } = useParams()
  const { uid, error: errorSesion } = useUid()
  const sala = useSala(id, uid)
  const [nombre, setNombre] = useState(leerNombre)
  const [borradorNombre, setBorradorNombre] = useState('')
  const [borradorHistoria, setBorradorHistoria] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  const existe = !!sala

  useEffect(() => {
    if (!uid || !nombre || !existe) return
    return entrarSala(id, uid, nombre)
  }, [id, uid, nombre, existe])

  if (errorSesion) return <Aviso texto="No se pudo conectar con el servidor." />
  if (sala === undefined || !uid) return <Aviso texto="Cargando sala…" />
  if (sala === null) return <Aviso texto={`La sala ${id} no existe.`} />

  if (!nombre) {
    const confirmar = (e: FormEvent) => {
      e.preventDefault()
      const limpio = borradorNombre.trim()
      if (!limpio) return
      guardarNombre(limpio)
      setNombre(limpio)
    }
    return (
      <main className="inicio">
        <h1>Sala {id}</h1>
        <form className="tarjeta" onSubmit={confirmar}>
          <label htmlFor="nombre">Tu nombre</label>
          <input
            id="nombre"
            autoFocus
            value={borradorNombre}
            maxLength={40}
            placeholder="Cómo te verá el equipo"
            onChange={(e) => setBorradorNombre(e.target.value)}
          />
          <button type="submit" className="primario" disabled={!borradorNombre.trim()}>
            Entrar a la sala
          </button>
        </form>
      </main>
    )
  }

  const soyModerador = sala.moderador === uid
  const revelado = sala.estado === 'revelado'
  const votos = sala.votos ?? {}
  const miVoto = votos[uid]
  const participantes = Object.entries(sala.participantes ?? {})
    .filter(([, p]) => p.conectado)
    .sort(([, a], [, b]) => a.nombre.localeCompare(b.nombre))
  const votosVisibles = participantes.map(([pid]) => votos[pid]).filter((v) => v !== undefined)
  const cartas = cartasDe(sala.mazo)
  const { promedio, consenso, distribucion, moda } = resumir(votosVisibles, cartas)
  const historia = sala.historia ?? ''

  async function copiarEnlace() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Sin permiso de portapapeles: el código visible sirve para compartir.
    }
  }

  function guardarHistoria() {
    if (borradorHistoria === null) return
    const limpia = borradorHistoria.trim()
    if (limpia !== historia) void cambiarHistoria(id, limpia)
    setBorradorHistoria(null)
  }

  return (
    <main className="sala">
      <header className="encabezado">
        <Link to="/" className="marca">
          DeXva Planning Poker
        </Link>
        <div className="fila">
          <span className="codigo">Sala {id}</span>
          <button onClick={copiarEnlace}>{copiado ? 'Enlace copiado' : 'Copiar enlace'}</button>
        </div>
      </header>

      <section className="tarjeta">
        <span className="etiqueta">Historia en estimación</span>
        {soyModerador ? (
          <input
            value={borradorHistoria ?? historia}
            maxLength={200}
            placeholder="Escribe el título de la historia"
            onChange={(e) => setBorradorHistoria(e.target.value)}
            onBlur={guardarHistoria}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        ) : (
          <p className="historia">{historia || 'El moderador aún no define la historia.'}</p>
        )}
        {soyModerador && (
          <>
            <label htmlFor="mazo">Mazo (al cambiarlo se reinicia la ronda)</label>
            <SelectorMazo
              id="mazo"
              valor={sala.mazo ?? MAZO_INICIAL}
              onCambio={(mazo) => void cambiarMazo(id, mazo)}
            />
          </>
        )}
      </section>

      <section className="mesa">
        {participantes.map(([pid, p]) => {
          const voto = votos[pid]
          const clases = ['carta', voto !== undefined && 'votada', revelado && 'revelada'].filter(Boolean).join(' ')
          return (
            <div key={pid} className="puesto">
              <div className={clases}>{revelado ? (voto ?? '–') : voto !== undefined ? '✓' : ''}</div>
              <span className="nombre">
                {p.nombre}
                {pid === uid && ' (tú)'}
                {pid === sala.moderador && ' ★'}
              </span>
            </div>
          )
        })}
      </section>

      {revelado && (
        <section className="tarjeta">
          <div className="resultado">
            {promedio !== null && (
              <div>
                <span className="etiqueta">Promedio</span>
                <strong>{promedio.toFixed(1)}</strong>
              </div>
            )}
            <div>
              <span className="etiqueta">Más votada</span>
              <strong>{moda.join(' · ') || '–'}</strong>
            </div>
            <div>
              <span className="etiqueta">Votos</span>
              <strong>{votosVisibles.length}</strong>
            </div>
            {consenso && <span className="consenso">¡Consenso!</span>}
          </div>
          <ul className="distribucion" aria-label="Distribución de votos">
            {distribucion.map(({ carta, cantidad }) => (
              <li key={carta}>
                <span className="dist-carta">{carta}</span>
                <span className="dist-barra">
                  <span style={{ width: `${(cantidad / votosVisibles.length) * 100}%` }} />
                </span>
                <span className="dist-cantidad">
                  {cantidad} {cantidad === 1 ? 'voto' : 'votos'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {soyModerador && (
        <section className="acciones">
          {revelado ? (
            <button className="primario" onClick={() => void nuevaRonda(id)}>
              Nueva ronda
            </button>
          ) : (
            <button className="primario" disabled={votosVisibles.length === 0} onClick={() => void revelar(id)}>
              Revelar votos ({votosVisibles.length}/{participantes.length})
            </button>
          )}
        </section>
      )}

      <section className="mazo" aria-label="Tu voto">
        {cartas.map((carta) => (
          <button
            key={carta}
            className={carta === miVoto ? 'naipe elegido' : 'naipe'}
            disabled={revelado}
            aria-pressed={carta === miVoto}
            onClick={() => void votar(id, uid, carta === miVoto ? null : carta)}
          >
            {carta}
          </button>
        ))}
      </section>
    </main>
  )
}

function Aviso({ texto }: { texto: string }) {
  return (
    <main className="inicio">
      <p className="bajada">{texto}</p>
      <Link to="/">Volver al inicio</Link>
    </main>
  )
}
