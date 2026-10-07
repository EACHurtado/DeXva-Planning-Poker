import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import Marca from '../Marca'
import { MAZOS, MAZO_INICIAL, crearSala, guardarNombre, leerNombre, limpiarSalasVencidas, useUid } from '../sala'
import type { MazoId } from '../sala'

export function SelectorMazo(props: { id: string; valor: MazoId; onCambio: (mazo: MazoId) => void }) {
  return (
    <select id={props.id} value={props.valor} onChange={(e) => props.onCambio(e.target.value as MazoId)}>
      {(Object.keys(MAZOS) as MazoId[]).map((clave) => (
        <option key={clave} value={clave}>
          {MAZOS[clave].nombre} ({MAZOS[clave].cartas.join(', ')})
        </option>
      ))}
    </select>
  )
}

export default function Inicio() {
  const navegar = useNavigate()
  const { uid, error: errorSesion } = useUid()
  const [nombre, setNombre] = useState(leerNombre)
  const [mazo, setMazo] = useState<MazoId>(MAZO_INICIAL)
  const [codigo, setCodigo] = useState('')
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (uid) void limpiarSalasVencidas()
  }, [uid])

  const nombreValido = nombre.trim().length > 0

  async function crear(e: FormEvent) {
    e.preventDefault()
    if (!uid || !nombreValido) return
    setCreando(true)
    setError(null)
    try {
      guardarNombre(nombre.trim())
      const id = await crearSala(uid, mazo)
      navegar(`/sala/${id}`)
    } catch {
      setError('No se pudo crear la sala. Intenta de nuevo en unos segundos.')
      setCreando(false)
    }
  }

  function unirse(e: FormEvent) {
    e.preventDefault()
    const id = codigo.trim().toUpperCase()
    if (!id) return
    if (nombreValido) guardarNombre(nombre.trim())
    navegar(`/sala/${id}`)
  }

  return (
    <main className="inicio">
      <div className="portada">
        <Marca />
        <h1>
          Que la estimación <em>sea un acuerdo de equipo.</em>
        </h1>
        <p className="bajada">Estima en equipo, en tiempo real y sin registrarte.</p>
      </div>

      <form className="tarjeta" onSubmit={crear}>
        <label htmlFor="nombre">Tu nombre</label>
        <input
          id="nombre"
          value={nombre}
          maxLength={40}
          autoComplete="nickname"
          placeholder="Cómo te verá el equipo"
          onChange={(e) => setNombre(e.target.value)}
        />
        <label htmlFor="mazo">Mazo (no se puede cambiar después)</label>
        <SelectorMazo id="mazo" valor={mazo} onCambio={setMazo} />
        <button type="submit" className="primario" disabled={!uid || !nombreValido || creando}>
          {creando ? 'Creando…' : 'Crear sala'}
        </button>
      </form>

      <form className="tarjeta" onSubmit={unirse}>
        <label htmlFor="codigo">¿Ya tienes un código de sala?</label>
        <div className="fila">
          <input
            id="codigo"
            value={codigo}
            maxLength={12}
            placeholder="Ej: K7M2QX"
            onChange={(e) => setCodigo(e.target.value)}
          />
          <button type="submit" disabled={!codigo.trim()}>
            Entrar
          </button>
        </div>
      </form>

      {(error ?? errorSesion) && <p className="error">{error ?? 'No se pudo conectar con el servidor.'}</p>}

      <p className="pie">
        Una herramienta de{' '}
        <a href="https://dexvagroup.com/" target="_blank" rel="noreferrer">
          DeXva Group
        </a>
      </p>
    </main>
  )
}
