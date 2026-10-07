import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { crearSala, guardarNombre, leerNombre, useUid } from '../sala'

export default function Inicio() {
  const navegar = useNavigate()
  const { uid, error: errorSesion } = useUid()
  const [nombre, setNombre] = useState(leerNombre)
  const [codigo, setCodigo] = useState('')
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nombreValido = nombre.trim().length > 0

  async function crear(e: FormEvent) {
    e.preventDefault()
    if (!uid || !nombreValido) return
    setCreando(true)
    setError(null)
    try {
      guardarNombre(nombre.trim())
      const id = await crearSala(uid)
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
      <h1>DeXva Planning Poker</h1>
      <p className="bajada">Estima en equipo, en tiempo real y sin registrarte.</p>

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
    </main>
  )
}
