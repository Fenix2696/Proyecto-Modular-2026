# Configuración de GOOGLE_CLIENT_ID / GOOGLE_CLIENT_IDS (Render + Vercel)

## Qué poner exactamente

> Importante: **NO son IDs de usuarios**.  
> `GOOGLE_CLIENT_ID(S)` son IDs de tu **aplicación OAuth**.  
> Con **un solo Client ID Web** pueden iniciar sesión miles de personas.

### Backend (Render)

En Render (servicio backend), define:

- `GOOGLE_CLIENT_ID` = **tu Web Client ID principal** de Google OAuth.
- `GOOGLE_CLIENT_IDS` = lista separada por comas de todos los Web Client IDs válidos que aceptará el backend.

Ejemplo:

```env
GOOGLE_CLIENT_ID=1234567890-abcde12345fghijklmno.apps.googleusercontent.com
GOOGLE_CLIENT_IDS=1234567890-abcde12345fghijklmno.apps.googleusercontent.com,1234567890-zxywv98765qwertyuiop.apps.googleusercontent.com
```

> Si solo usas 1 Client ID, puedes poner ambos iguales.

En un evento público, lo normal es usar **1 solo Client ID** para todos.

### Frontend (Vercel)

En Vercel (frontend), define:

- `VITE_GOOGLE_CLIENT_ID` = el Client ID que usará el botón de Google en el navegador.

Recomendación: usa el **mismo** valor que `GOOGLE_CLIENT_ID` de Render.

## Regla práctica

- Frontend emite token con `VITE_GOOGLE_CLIENT_ID`.
- Backend valida token contra `GOOGLE_CLIENT_IDS`/`GOOGLE_CLIENT_ID`.
- Si no coincide, verás errores de autenticación de Google.

Para “cualquier persona puede entrar con Google”, basta con:

1. El mismo Client ID en frontend/backend.
2. Dominios autorizados correctos.
3. No limitar usuarios por dominio en Google Cloud (si no quieres restricción).

## Dónde revisar en Google Cloud Console

OAuth 2.0 Client IDs → tu cliente Web → **Authorized JavaScript origins**:

- `https://proyecto-modular-2026.vercel.app`
- Tu dominio custom (si aplica)

Sin slash al final y con `https`.

## Punto crítico para eventos públicos

En Google Cloud Console → **OAuth consent screen**:

- `Publishing status` debe estar en **In production**.
- Si está en **Testing**, solo podrán entrar usuarios agregados como *Test users*.

Ese es el motivo más común cuando “a unos sí les deja y a otros no” aunque variables estén correctas.

### Límite de usuarios OAuth (importantísimo para eventos)

Si ves algo como `1 usuario del máximo de 100 usuarios`, significa que tu app está bajo límite de OAuth no verificado para ciertos scopes.

- Con ese límite, al llegar al tope algunos usuarios nuevos no podrán autenticar.
- Solución: completar verificación OAuth en Google o evitar scopes sensibles/restringidos no necesarios.

Si tu evento será de menos de 100 usuarios totales, en principio **no necesitas tocar código** por este punto; solo monitorea el contador.

## Después de cambiar variables

1. Guardar env vars en Render y Vercel.
2. Hacer redeploy en ambos.
3. Probar login Google en una ventana incógnita.

## Fallback temporal (solo emergencia de evento)

Si todavía falla por mismatch de audience y necesitas que el evento siga, puedes activar en Render:

```env
GOOGLE_AUTH_RELAX_AUDIENCE=true
```

Esto permite validar el token Google sin exigir audience exacta (menos estricto).  
Úsalo solo como medida temporal y luego vuelve a `false` al normalizar tus Client IDs.
