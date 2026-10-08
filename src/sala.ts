import { onAuthStateChanged, signInAnonymously } from 'firebase/auth'
import {
  child,
  get,
  onDisconnect,
  onValue,
  push,
  ref,
  remove,
  serverTimestamp,
  set,
  update,
} from 'firebase/database'
import { useEffect, useState } from 'react'
import { auth, db } from './firebase'

export type Estado = 'votando' | 'revelado'

export interface Participante {
  nombre: string
  conectado: boolean
  espectador?: boolean
}

// Tipos de ítem de backlog que se pueden estimar. «Otro» pide un texto libre.
export const TIPO_OTRO = 'Otro'
export const TIPOS_ITEM = [
  'Historia de Usuario',
  'Habilitador Exploratorio',
  'Habilitador Técnico/Arquitectónico',
  'Habilitador de Cumplimiento',
  'Bugs',
  'Deuda Técnica',
  'Mejora del Producto',
  'Mejora del Proceso',
  'Mejora de las Interacciones',
  TIPO_OTRO,
]
/** Cómo se nombra un ítem agregado antes de que existieran los tipos. */
export const SIN_TIPO = 'Sin tipo'

/** Un ítem de backlog. El nombre viene de cuando solo se estimaban historias. */
export interface Historia {
  titulo: string
  tipo?: string
  estimacion?: string
}

export interface Sala {
  moderador: string
  estado: Estado
  mazo?: MazoId
  /** Quien modera puso la sala en modo resumen: todos ven el tablero de cierre. */
  resumen?: boolean
  historiaActual?: string
  historias?: Record<string, Historia>
  participantes?: Record<string, Participante>
  votos?: Record<string, string>
}

// Los identificadores están repetidos en la validación de database.rules.json.
export const MAZOS = {
  fibonacci: { nombre: 'Fibonacci', cartas: ['0', '1', '2', '3', '5', '8', '13', '21', '?', '☕'] },
  tallas: { nombre: 'Tallas', cartas: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '?', '☕'] },
  potencias: { nombre: 'Potencias de 2', cartas: ['1', '2', '4', '8', '16', '32', '?', '☕'] },
} as const

export type MazoId = keyof typeof MAZOS

export const MAZO_INICIAL: MazoId = 'fibonacci'

/** Cartas que no son una estimación: no cuentan como valor final de una historia. */
export const COMODINES = ['?', '☕']

export function cartasDe(mazo: MazoId | undefined): readonly string[] {
  return (MAZOS[mazo ?? MAZO_INICIAL] ?? MAZOS[MAZO_INICIAL]).cartas
}

// Mismo plazo que en database.rules.json: una sala sin actividad vence a las 24 h.
const VIGENCIA_MS = 24 * 60 * 60 * 1000
// Holgura por si el reloj del navegador va adelantado respecto del servidor.
const MARGEN_RELOJ_MS = 10 * 60 * 1000

const CLAVE_NOMBRE = 'planning-poker:nombre'
const CLAVE_VISITADAS = 'planning-poker:salas'
const MAX_VISITADAS = 50
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

export async function crearSala(uid: string, mazo: MazoId): Promise<string> {
  const id = nuevoId()
  await update(refSala(id), {
    moderador: uid,
    actividad: serverTimestamp(),
    estado: 'votando',
    mazo,
  })
  return id
}

/** Borra la sala completa. Solo lo permite el servidor a quien la modera. */
export function cerrarSala(id: string) {
  return remove(refSala(id))
}

function leerVisitadas(): string[] {
  try {
    const lista: unknown = JSON.parse(localStorage.getItem(CLAVE_VISITADAS) ?? '[]')
    return Array.isArray(lista) ? lista.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

function guardarVisitadas(ids: string[]) {
  try {
    localStorage.setItem(CLAVE_VISITADAS, JSON.stringify(ids.slice(-MAX_VISITADAS)))
  } catch {
    // Sin almacenamiento local este navegador no participa de la limpieza.
  }
}

/** Anota la sala para que este navegador la limpie cuando venza. */
export function recordarVisita(id: string) {
  const visitadas = leerVisitadas()
  if (!visitadas.includes(id)) guardarVisitadas([...visitadas, id])
}

/**
 * Elimina las salas vencidas que este navegador visitó. Nadie puede listar
 * las salas y no hay servidor que las barra, así que cada visitante limpia
 * las que conoce; el servidor solo acepta el borrado si de verdad vencieron.
 */
export async function limpiarSalasVencidas() {
  const corte = Date.now() - VIGENCIA_MS - MARGEN_RELOJ_MS
  const vigentes: string[] = []
  for (const id of leerVisitadas()) {
    try {
      const sala = await get(refSala(id))
      if (!sala.exists()) continue
      const actividad: unknown = sala.child('actividad').val()
      if (typeof actividad === 'number' && actividad >= corte) {
        vigentes.push(id)
        continue
      }
      await remove(refSala(id))
    } catch {
      // Sin conexión o sin permiso: se reintenta en la próxima visita.
      vigentes.push(id)
    }
  }
  guardarVisitadas(vigentes)
}

/** Registra la presencia; devuelve la función para dejar de escuchar. */
export function entrarSala(id: string, uid: string, nombre: string): () => void {
  const yo = child(refSala(id), `participantes/${uid}`)
  return onValue(ref(db, '.info/connected'), (snap) => {
    if (!snap.val()) return
    // Primero el registro y después la desconexión programada: las reglas se
    // validan al programarla y un `conectado` suelto no pasa sin participante.
    // `update` conserva la marca de espectador al reconectar.
    update(yo, { nombre, conectado: true })
      .then(() => onDisconnect(child(yo, 'conectado')).set(false))
      .catch((e: Error) => console.error('No se pudo registrar la presencia', e))
  })
}

export function cambiarEspectador(id: string, uid: string, espectador: boolean) {
  return set(child(refSala(id), `participantes/${uid}/espectador`), espectador)
}

export function votar(id: string, uid: string, carta: string | null) {
  return set(child(refSala(id), `votos/${uid}`), carta)
}

export function revelar(id: string) {
  return update(refSala(id), { estado: 'revelado', actividad: serverTimestamp() })
}

const rondaNueva = () => ({ estado: 'votando', votos: null, actividad: serverTimestamp() })

export function nuevaRonda(id: string) {
  return update(refSala(id), rondaNueva())
}

export function agregarHistorias(id: string, titulos: string[], tipo: string) {
  const historias = child(refSala(id), 'historias')
  const cambios: Record<string, Historia> = {}
  for (const titulo of titulos) cambios[`historias/${push(historias).key}`] = { titulo, tipo }
  return update(refSala(id), cambios)
}

/**
 * Pone una historia en la mesa y abre una ronda limpia. Si ya tenía una
 * estimación se descarta: volver a estimarla exige confirmar un consenso nuevo.
 */
export function estimarHistoria(id: string, historiaId: string) {
  return update(refSala(id), {
    historiaActual: historiaId,
    [`historias/${historiaId}/estimacion`]: null,
    ...rondaNueva(),
  })
}

export function mostrarResumen(id: string, visible: boolean) {
  return set(child(refSala(id), 'resumen'), visible ? true : null)
}

export function guardarEstimacion(id: string, historiaId: string, estimacion: string | null) {
  return set(child(refSala(id), `historias/${historiaId}/estimacion`), estimacion)
}

export function quitarHistoria(id: string, historiaId: string, esLaActual: boolean) {
  return update(refSala(id), {
    [`historias/${historiaId}`]: null,
    ...(esLaActual ? { historiaActual: null } : {}),
  })
}

export interface Resumen {
  /**
   * Promedio de los votos llevado a una carta del mazo: la más cercana y, si
   * queda justo entre dos, la más alta. En mazos no numéricos se promedia la
   * posición de las cartas. `null` si nadie votó una carta estimable.
   */
  propuesta: string | null
  /** El promedio exacto no era una carta del mazo y hubo que aproximarlo. */
  aproximada: boolean
  /** Votos extremos según el orden del mazo, sin comodines; `null` si no hay. */
  minimo: string | null
  maximo: string | null
  consenso: boolean
  /** Cartas con al menos un voto, en el orden del mazo. */
  distribucion: { carta: string; cantidad: number }[]
  /** Cartas más votadas; vacío si no hay votos. */
  moda: string[]
}

const esNumero = (texto: string) => texto.trim() !== '' && !Number.isNaN(Number(texto))

export function resumir(votos: string[], cartas: readonly string[]): Resumen {
  const consenso = votos.length > 1 && votos.every((v) => v === votos[0])

  const conteo = new Map<string, number>()
  for (const v of votos) conteo.set(v, (conteo.get(v) ?? 0) + 1)
  const orden = (carta: string) => {
    const i = cartas.indexOf(carta)
    return i === -1 ? cartas.length : i
  }
  const distribucion = [...conteo]
    .map(([carta, cantidad]) => ({ carta, cantidad }))
    .sort((a, b) => orden(a.carta) - orden(b.carta))
  const masVotos = Math.max(0, ...distribucion.map((d) => d.cantidad))
  const moda = distribucion.filter((d) => d.cantidad === masVotos).map((d) => d.carta)

  const ordenados = votos
    .filter((v) => !COMODINES.includes(v) && cartas.includes(v))
    .sort((a, b) => orden(a) - orden(b))
  const minimo = ordenados[0] ?? null
  const maximo = ordenados[ordenados.length - 1] ?? null

  // Escala sobre la que se promedia: el valor de la carta, o su posición si el mazo no es numérico.
  const estimables = cartas.filter((c) => !COMODINES.includes(c))
  const numerico = estimables.every(esNumero)
  const valor = (carta: string) => (numerico ? Number(carta) : estimables.indexOf(carta))
  let propuesta: string | null = null
  let aproximada = false
  if (ordenados.length) {
    const promedio = ordenados.reduce((suma, v) => suma + valor(v), 0) / ordenados.length
    for (const carta of estimables) {
      const mejor = propuesta === null ? Infinity : Math.abs(valor(propuesta) - promedio)
      // `<=` para que, en un empate, gane la carta más alta.
      if (Math.abs(valor(carta) - promedio) <= mejor) propuesta = carta
    }
    aproximada = propuesta !== null && valor(propuesta) !== promedio
  }

  return { propuesta, aproximada, minimo, maximo, consenso, distribucion, moda }
}

/** Suma de las estimaciones numéricas; `null` si ninguna lo es (p. ej. tallas). */
export function totalEstimado(historias: Historia[]): number | null {
  const numeros = historias.map((h) => h.estimacion ?? '').filter(esNumero).map(Number)
  return numeros.length ? numeros.reduce((a, b) => a + b, 0) : null
}
