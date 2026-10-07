import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getDatabase } from 'firebase/database'

// La configuración web de Firebase es pública por diseño: el acceso se
// controla con las reglas de database.rules.json, no ocultando estos valores.
const app = initializeApp({
  apiKey: 'AIzaSyB6gIdgmcyWFcgMyGwlT139oUpwqHHcAI4',
  authDomain: 'dexva-planning-poker.firebaseapp.com',
  databaseURL: 'https://dexva-planning-poker-default-rtdb.firebaseio.com',
  projectId: 'dexva-planning-poker',
  storageBucket: 'dexva-planning-poker.firebasestorage.app',
  messagingSenderId: '1077833879088',
  appId: '1:1077833879088:web:366fa4e2cf7c65ad5767f5',
})

export const auth = getAuth(app)
export const db = getDatabase(app)
