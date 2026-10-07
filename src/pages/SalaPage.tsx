import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Marca from '../Marca'
import Resumen from '../Resumen'
import {
  COMODINES,
  MAZOS,
  MAZO_INICIAL,
  agregarHistorias,
  cambiarEspectador,
  cartasDe,
  cerrarSala,
  entrarSala,
  estimarHistoria,
  guardarEstimacion,
  guardarNombre,
  leerNombre,
  mostrarResumen,
  nuevaRonda,
  quitarHistoria,
  recordarVisita,
  resumir,
  revelar,
  totalEstimado,
  useSala,
  useUid,
  votar,
} from '../sala'

const DESPEDIDA_MS = 3500

export default function SalaPage() {
  const { id = '' } = useParams()
  const navegar = useNavigate()
  const { uid, error: errorSesion } = useUid()
  const sala = useSala(id, uid)
  const [nombre, setNombre] = useState(leerNombre)
  const [borradorNombre, setBorradorNombre] = useState('')
  const [nuevasHistorias, setNuevasHistorias] = useState('')
  const [copiado, setCopiado] = useState(false)

  const [estuvoAbierta, setEstuvoAbierta] = useState(false)
  const [avisoDescartado, setAvisoDescartado] = useState(false)
  const cajaHistorias = useRef<HTMLTextAreaElement>(null)

  const existe = !!sala
  if (existe && !estuvoAbierta) setEstuvoAbierta(true)
  // La sala se cerró mientras esta persona estaba dentro (la cerró ella o quien modera).
  const despedida = sala === null && estuvoAbierta

  useEffect(() => {
    if (!uid || !nombre || !existe) return
    recordarVisita(id)
    return entrarSala(id, uid, nombre)
  }, [id, uid, nombre, existe])

  useEffect(() => {
    if (!despedida) return
    const reloj = setTimeout(() => navegar('/'), DESPEDIDA_MS)
    return () => clearTimeout(reloj)
  }, [despedida, navegar])

  if (despedida) return <Despedida />
  if (errorSesion) return <Aviso texto="No se pudo conectar con el servidor." />
  if (sala === undefined || !uid) return <Aviso texto="Cargando sala…" />
  if (sala === null) return <Aviso texto={`La sala ${id} no existe o ya fue cerrada.`} />

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
  const cartas = cartasDe(sala.mazo)

  const conectados = Object.entries(sala.participantes ?? {})
    .filter(([, p]) => p.conectado)
    .sort(([, a], [, b]) => a.nombre.localeCompare(b.nombre))
  const votantes = conectados.filter(([, p]) => !p.espectador)
  const espectadores = conectados.filter(([, p]) => p.espectador)
  const soyEspectador = !!sala.participantes?.[uid]?.espectador

  const votosVisibles = votantes.map(([pid]) => votos[pid]).filter((v) => v !== undefined)
  const { propuesta, aproximada, minimo, maximo, consenso, distribucion, moda } = resumir(votosVisibles, cartas)

  // Las claves de Firebase son cronológicas en orden de código de carácter;
  // `localeCompare` las desordena porque ignora mayúsculas y símbolos.
  const historias = Object.entries(sala.historias ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  const actualId = sala.historiaActual
  const actual = actualId ? sala.historias?.[actualId] : undefined
  // La siguiente es la primera pendiente después de la que está en mesa; al llegar
  // al final se vuelve a las pendientes que quedaron antes.
  const pendientes = historias.filter(([hid, h]) => hid !== actualId && !h.estimacion)
  const siguiente = pendientes.find(([hid]) => !actualId || hid > actualId) ?? pendientes[0]
  const total = totalEstimado(historias.map(([, h]) => h))

  // El aviso de cierre vuelve a estar disponible cuando aparece una historia pendiente.
  const todasEstimadas = historias.length > 0 && historias.every(([, h]) => h.estimacion)
  if (!todasEstimadas && avisoDescartado) setAvisoDescartado(false)

  function seguirEstimando() {
    setAvisoDescartado(true)
    if (sala?.resumen) void mostrarResumen(id, false)
    // Deja el cursor listo para escribir las historias nuevas.
    setTimeout(() => cajaHistorias.current?.focus(), 100)
  }

  const encabezado = (
    <header className="encabezado">
      <Link to="/" aria-label="DeXva Planning Poker, volver al inicio">
        <Marca compacta />
      </Link>
      <div className="fila">
        <span className="codigo">Sala {id}</span>
        <button onClick={copiarEnlace}>{copiado ? 'Enlace copiado' : 'Copiar enlace'}</button>
      </div>
    </header>
  )

  if (sala.resumen) {
    return (
      <main className="sala">
        {encabezado}
        <Resumen
          historias={historias.map(([, h]) => h)}
          cartas={cartas}
          participantes={Object.keys(sala.participantes ?? {}).length}
        />
        {soyModerador && (
          <section className="acciones">
            <button onClick={seguirEstimando}>Estimar más historias</button>
            <button className="peligro" onClick={() => void cerrarSala(id)}>
              Cerrar sala
            </button>
          </section>
        )}
      </main>
    )
  }

  async function copiarEnlace() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Sin permiso de portapapeles: el código visible sirve para compartir.
    }
  }

  function alternarEspectador() {
    if (!uid) return
    // Quien pasa a observar retira su voto; si ya se reveló, el servidor lo conserva.
    if (!soyEspectador && miVoto !== undefined) votar(id, uid, null).catch(() => {})
    void cambiarEspectador(id, uid, !soyEspectador)
  }

  function agregar(e: FormEvent) {
    e.preventDefault()
    const titulos = nuevasHistorias
      .split('\n')
      .map((t) => t.trim().slice(0, 200))
      .filter(Boolean)
    if (!titulos.length) return
    void agregarHistorias(id, titulos)
    setNuevasHistorias('')
  }


  return (
    <main className="sala">
      {encabezado}

      {soyModerador && todasEstimadas && !avisoDescartado && (
        <div className="despedida" role="dialog" aria-modal="true" aria-labelledby="aviso-titulo">
          <div className="despedida-tarjeta">
            <p id="aviso-titulo" className="despedida-titulo">
              Todas las historias están estimadas
            </p>
            <p className="bajada">¿Quieres estimar más historias o ver el resumen de la sesión?</p>
            <div className="acciones">
              <button onClick={seguirEstimando}>Estimar más historias</button>
              <button className="primario" autoFocus onClick={() => void mostrarResumen(id, true)}>
                Ver resumen
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="tarjeta">
        <div className="titulo-seccion">
          <span className="etiqueta">Historia en estimación</span>
          <span className="etiqueta">Mazo: {MAZOS[sala.mazo ?? MAZO_INICIAL].nombre}</span>
        </div>
        <p className="historia">{actual ? actual.titulo : 'Ronda libre, sin historia asignada.'}</p>
      </section>

      <section className="mesa">
        {votantes.length === 0 && <p className="bajada">Aún no hay votantes en la mesa.</p>}
        {votantes.map(([pid, p]) => {
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

      {espectadores.length > 0 && (
        <p className="espectadores">
          Observando:{' '}
          {espectadores.map(([pid, p]) => p.nombre + (pid === uid ? ' (tú)' : '') + (pid === sala.moderador ? ' ★' : '')).join(', ')}
        </p>
      )}

      {revelado && (
        <section className="tarjeta">
          <div className="resultado">
            <div>
              <span className="etiqueta">Promedio</span>
              <strong>{propuesta ?? '–'}</strong>
              {aproximada && <small className="aproximacion">(con aproximación)</small>}
            </div>
            <div>
              <span className="etiqueta">Más bajo</span>
              <strong>{minimo ?? '–'}</strong>
            </div>
            <div>
              <span className="etiqueta">Más alto</span>
              <strong>{maximo ?? '–'}</strong>
            </div>
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
          {actualId && actual && (
            <div className="estimacion-final">
              <span className="etiqueta">Estimación final de la historia</span>
              <div className="mazo">
                {cartas
                  .filter((carta) => !COMODINES.includes(carta))
                  .map((carta) => (
                    <span key={carta} className={carta === (actual.estimacion ?? propuesta) ? 'ficha elegido' : 'ficha'}>
                      {carta}
                    </span>
                  ))}
              </div>
              {actual.estimacion ? (
                <span className="consenso">Consenso confirmado: {actual.estimacion}</span>
              ) : soyModerador ? (
                <div className="acciones">
                  <button
                    className="primario"
                    disabled={!propuesta}
                    onClick={() => propuesta && void guardarEstimacion(id, actualId, propuesta)}
                  >
                    Hay consenso
                  </button>
                  <button onClick={() => void nuevaRonda(id)}>No hay consenso, votar de nuevo</button>
                </div>
              ) : (
                <span className="bajada">Quien modera debe confirmar si hay consenso.</span>
              )}
            </div>
          )}
        </section>
      )}

      {soyModerador && (
        <section className="acciones">
          {revelado ? (
            <>
              {/* Con una historia en mesa la ronda se repite desde «No hay consenso». */}
              {!actual && (
                <button className={siguiente ? '' : 'primario'} onClick={() => void nuevaRonda(id)}>
                  Nueva ronda
                </button>
              )}
              {siguiente && (!actual || actual.estimacion) && (
                <button className="primario" onClick={() => void estimarHistoria(id, siguiente[0])}>
                  Siguiente historia
                </button>
              )}
              {!siguiente && actual?.estimacion && <p className="bajada">Todas las historias están estimadas.</p>}
            </>
          ) : (
            <button className="primario" disabled={votosVisibles.length === 0} onClick={() => void revelar(id)}>
              Revelar votos ({votosVisibles.length}/{votantes.length})
            </button>
          )}
        </section>
      )}

      {soyEspectador ? (
        <p className="bajada centrado">Estás observando: no votas en esta sala.</p>
      ) : (
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
      )}

      <label className="casilla">
        <input type="checkbox" checked={soyEspectador} onChange={alternarEspectador} />
        Solo observar (no voto)
      </label>

      <section className="tarjeta">
        <div className="titulo-seccion">
          <span className="etiqueta">Historias ({historias.length})</span>
          {total !== null && <span className="etiqueta">Total estimado: {total}</span>}
        </div>
        {historias.length === 0 && (
          <p className="bajada">
            {soyModerador ? 'Agrega historias para estimarlas en orden.' : 'Quien modera aún no agrega historias.'}
          </p>
        )}
        <ul className="historias">
          {historias.map(([hid, h]) => (
            <li key={hid} className={hid === actualId ? 'actual' : undefined}>
              <span className="historia-titulo">{h.titulo}</span>
              <span className="insignia">{h.estimacion ?? '–'}</span>
              {soyModerador && (
                <span className="fila">
                  <button className="chico" disabled={hid === actualId} onClick={() => void estimarHistoria(id, hid)}>
                    {hid === actualId ? 'En mesa' : 'Estimar'}
                  </button>
                  <button
                    className="chico"
                    aria-label={`Quitar ${h.titulo}`}
                    onClick={() => void quitarHistoria(id, hid, hid === actualId)}
                  >
                    Quitar
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
        {soyModerador && (
          <form className="agregar" onSubmit={agregar}>
            <textarea
              ref={cajaHistorias}
              rows={2}
              value={nuevasHistorias}
              placeholder="Nuevas historias, una por línea"
              aria-label="Nuevas historias, una por línea"
              onChange={(e) => setNuevasHistorias(e.target.value)}
            />
            <button type="submit" disabled={!nuevasHistorias.trim()}>
              Agregar
            </button>
          </form>
        )}
      </section>

      {soyModerador && (
        <section className="acciones">
          {historias.some(([, h]) => h.estimacion) && (
            <button onClick={() => void mostrarResumen(id, true)}>Ver resumen</button>
          )}
          <button className="peligro" onClick={() => void cerrarSala(id)}>
            Cerrar sala
          </button>
        </section>
      )}
    </main>
  )
}

function Despedida() {
  return (
    <main className="despedida" role="status">
      <div className="despedida-tarjeta">
        <Marca />
        <p className="despedida-titulo">¡Gracias por usar DeXva Planning Poker!</p>
        <p className="bajada">La sala se cerró y sus datos fueron eliminados.</p>
        <span className="despedida-barra" style={{ animationDuration: `${DESPEDIDA_MS}ms` }} />
      </div>
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
