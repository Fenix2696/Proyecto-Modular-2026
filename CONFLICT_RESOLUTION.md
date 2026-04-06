# ¿Por qué aparece el conflicto en `authController.js`?

El conflicto aparece porque **dos ramas editaron la misma sección** del método `oauthGoogle`.

En tu captura se ve el caso típico:

- Rama A (current change):
  - `const fotoGoogle = normalizarFotoGoogle(payload.picture);`
- Rama B (incoming/main):
  - `const fotoGoogle = payload.picture || null;`

Git no puede decidir automáticamente cuál versión conservar cuando ambas cambiaron las mismas líneas.

## Resolución recomendada

Conserva la versión sanitizada:

```js
const fotoGoogle = normalizarFotoGoogle(payload.picture);
```

porque evita guardar URLs inválidas/largas y reduce errores 500 por datos inesperados.

## Flujo rápido para resolver en terminal

```bash
git fetch origin
git checkout work
git merge origin/main
# resolver archivos con <<<<<<< ======= >>>>>>>
git add backend/controllers/authController.js
git commit -m "resolve merge conflict in oauthGoogle photo handling"
```

Si te vuelve a salir en GitHub, usa **Accept current change** para esa línea específica y luego confirma commit de resolución.
