import { onAuthStateChanged, signInAnonymously } from 'firebase/auth'
import { child, onDisconnect, onValue, ref, serverTimestamp, set, update } from 'firebase/database'
import { useEffect, useState } from 'react'
import { auth, db } from './firebase'

export type Estado = 'votando' | 'revelado'

export interface Participante {
  nombre: string
  conectado: boolean
}

export interface Sala {
  moderador: string
  estado: Estado
  historia?: string
  participantes?: Record<string, Participante>
  votos?: Record<string, string>
}

export const MAZO = ['0', '1', '2', '3', '5', '8', '13', '21', '34', '?', '☕']

const CLAVE_NOMBRE = 'planning-poker:nombre'
// Sin caracteres que se confunden al dictar el código (0/O, 1/I/L).
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function leerNombre(): string {
  try {
    return localStorage.getItem(CLAVE_NOMBRE) ?? ''
  } catch {
    return ''
  }
}

export function guardarNombre(nombre: string) {
  try {
    localStorage.setItem(CLAVE_NOMBRE, nombre)
  } catch {
    // Sin almacenamiento local se vuelve a pedir el nombre la próxima vez.
  }
}

function nuevoId(): string {
  const azar = crypto.getRandomValues(new Uint8Array(6))
  return Array.from(azar, (n) => ALFABETO[n % ALFABETO.length]).join('')
}

const refSala = (id: string) => ref(db, `salas/${id}`)

/** Identidad anónima del navegador; `null` mientras se inicia sesión. */
export function useUid(): { uid: string | null; error: string | null } {
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const cancelar = onAuthStateChanged(auth, (usuario) => {
      if (usuario) {
        setUid(usuario.uid)
        return
      }
      signInAnonymously(auth).catch((e: Error) => setError(e.message))
    })
    return cancelar
  }, [])

  return { uid, error }
}

/** `undefined` mientras carga, `null` si la sala no existe. */
export function useSala(id: string, uid: string | null): Sala | null | undefined {
  const [sala, setSala] = useState<Sala | null | undefined>(undefined)

  useEffect(() => {
    if (!uid) return
    return onValue(
      refSala(id),
      (snap) => setSala(snap.val() as Sala | null),
      () => setSala(null),
    )
  }, [id, uid])

  return sala
}

export async function crearSala(uid: string): Promise<string> {
  const id = nuevoId()
  await update(refSala(id), {
    moderador: uid,
    creadaEn: serverTimestamp(),
    estado: 'votando',
    historia: '',
  })
  return id
}

/** Registra la presencia; devuelve la función para dejar de escuchar. */
export function entrarSala(id: string, uid: string, nombre: string): () => void {
  const yo = child(refSala(id), `participantes/${uid}`)
  return onValue(ref(db, '.info/connected'), (snap) => {
    if (!snap.val()) return
    onDisconnect(child(yo, 'conectado'))
      .set(false)
      .then(() => set(yo, { nombre, conectado: true }))
      .catch(() => {})
  })
}

export function votar(id: string, uid: string, carta: string | null) {
  return set(child(refSala(id), `votos/${uid}`), carta)
}

export function revelar(id: string) {
  return set(child(refSala(id), 'estado'), 'revelado')
}

export function nuevaRonda(id: string) {
  return update(refSala(id), { estado: 'votando', votos: null })
}

export function cambiarHistoria(id: string, historia: string) {
  return set(child(refSala(id), 'historia'), historia)
}

export interface Resumen {
  promedio: number | null
  consenso: boolean
}

export function resumir(votos: string[]): Resumen {
  const numeros = votos.map(Number).filter((n, i) => votos[i].trim() !== '' && !Number.isNaN(n))
  const promedio = numeros.length ? numeros.reduce((a, b) => a + b, 0) / numeros.length : null
  const consenso = votos.length > 1 && votos.every((v) => v === votos[0])
  return { promedio, consenso }
}
