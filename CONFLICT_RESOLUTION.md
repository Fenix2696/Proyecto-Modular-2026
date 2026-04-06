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

## Resolver conflicto desde GitHub (clic por clic)

1. En tu PR, haz clic en **Resolve conflicts**.
2. Busca el archivo `backend/controllers/authController.js`.
3. Ubica el bloque con marcadores:
   - `<<<<<<<`
   - `=======`
   - `>>>>>>>`
4. En la línea de `fotoGoogle`, selecciona **Accept current change** para conservar:

```js
const fotoGoogle = normalizarFotoGoogle(payload.picture);
```

5. Verifica que ya no queden marcadores `<<<<<<<`, `=======`, `>>>>>>>` en el archivo.
6. Haz clic en **Mark as resolved**.
7. Haz clic en **Commit merge** (o **Commit conflict resolution**).
8. Regresa al PR y espera que GitHub recalcule el estado; después debería aparecer el botón para merge.

### Si sigue apareciendo conflicto

- Pulsa **Update branch** en el PR (si está disponible) y repite pasos.
- Si no aparece, resuelve por terminal y empuja:

```bash
git checkout work
git fetch origin
git merge origin/main
# resolver conflictos
git add backend/controllers/authController.js
git commit -m "resolve conflict in authController oauthGoogle"
git push
```
