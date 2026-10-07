# DeXva Planning Poker

Planning poker gratuito para estimar en equipo, en tiempo real y sin registro.

Sitio: https://eachurtado.github.io/DeXva-Planning-Poker/

## Cómo funciona

- Una persona crea la sala y queda como moderadora; comparte el enlace o el código.
- Cada participante entra con su nombre y elige una carta. Los votos se muestran ocultos hasta que la moderadora los revela.
- Al revelar se ven los votos, el promedio y si hubo consenso. "Nueva ronda" limpia los votos.

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
