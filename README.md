# DeXva Planning Poker

Planning poker gratuito para estimar en equipo, en tiempo real y sin registro.

Sitio: https://eachurtado.github.io/DeXva-Planning-Poker/

## Cómo funciona

- Una persona crea la sala y queda como moderadora; comparte el enlace o el código.
- Cada participante entra con su nombre y elige una carta. Los votos se muestran ocultos hasta que la moderadora los revela.
- Al revelar se ven los votos, el promedio, la carta más votada, la distribución y si hubo consenso. "Nueva ronda" limpia los votos.
- La moderadora elige el mazo (Fibonacci hasta 21, tallas o potencias de 2) al crear la sala; después no se puede cambiar.
- También al crear la sala se elige el tipo de decisión que resume cada ronda: promedio de los votos numéricos, o P85 (la carta más baja del mazo que iguala o supera al 85 % de los votos, sin contar "?" ni "☕").

- La moderadora puede cargar una lista de historias (una por línea), ponerlas en la mesa en orden y guardar la estimación final de cada una.
- Cualquier participante puede marcar "Solo observar" para seguir la sesión sin votar.

## Qué se guarda y hasta cuándo

Cada sala guarda nombres de participantes, historias con su estimación y los votos de la ronda en curso. No hay historial de rondas.

- "Cerrar sala" (solo la moderadora) borra todo al instante.
- Una sala sin actividad por 24 horas queda vencida: el servidor permite borrarla y lo hace el navegador de cualquiera de sus participantes la próxima vez que abre el sitio. No hay servidor que barra las salas, así que una sala cuyos participantes no vuelven queda guardada.

## Plataformas (todas en su plan gratuito)

| Pieza | Plataforma |
|---|---|
| Sitio | GitHub Pages |
| Publicación | GitHub Actions (`.github/workflows/deploy.yml`), en cada push a `main` |
| Tiempo real | Firebase Realtime Database, proyecto `dexva-planning-poker` |
| Identidad | Firebase Auth anónimo |

Límite a tener presente: 100 conexiones simultáneas a la base de datos.

## Desarrollo

```bash
npm install
npm run dev
```

## Reglas de la base de datos

Las reglas viven en `database.rules.json` y no se publican con el sitio. Tras modificarlas:

```bash
firebase deploy --only database --account <cuenta dueña del proyecto>
```

Los votos se ocultan en la interfaz, no en el servidor: quien inspeccione el tráfico del navegador puede verlos antes de revelar.
