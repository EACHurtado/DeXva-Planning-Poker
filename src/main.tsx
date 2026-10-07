import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import Inicio from './pages/Inicio.tsx'
import SalaPage from './pages/SalaPage.tsx'

// HashRouter: GitHub Pages no reescribe rutas, así que la sala va tras el #.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/sala/:id" element={<SalaPage />} />
        <Route path="*" element={<Inicio />} />
      </Routes>
    </HashRouter>
  </StrictMode>,
)
