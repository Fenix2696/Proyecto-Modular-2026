# Diagnóstico: Google login funciona en algunos teléfonos y en otros no

Cuando Google Sign-In falla de forma intermitente entre dispositivos (iPhone/Android), casi siempre es por **entorno del navegador**, no por la cuenta en sí.

## Causas más comunes

1. **Navegador embebido (in-app browser)**
   - Instagram, Facebook, TikTok, Gmail webview, etc. abren una vista interna que rompe popups/cookies.
   - Síntomas: detecta cuentas, abre popup, pero no regresa o queda en blanco.

2. **Bloqueo de cookies/ITP/privacidad**
   - En iOS (Safari), “Prevent Cross-Site Tracking” y modos estrictos pueden afectar el flujo de Google.
   - En Android, navegadores con anti-tracking agresivo también lo rompen.

3. **Origen no autorizado en Google Cloud**
   - Debe estar exactamente el dominio que usa el usuario:
     - `https://proyecto-modular-2026.vercel.app`
     - tu dominio custom (si existe)
   - Sin slash final y con protocolo correcto.

4. **Client IDs distintos entre frontend y backend**
   - `VITE_GOOGLE_CLIENT_ID` (frontend) y `GOOGLE_CLIENT_ID` (backend) deben apuntar al mismo client web.

5. **Cuenta/dispositivo con restricciones**
   - Family Link, perfil de trabajo, cuenta empresarial o controles de seguridad.

6. **Sesión/caché corrupta del navegador**
   - Funciona en un celular y en otro no por estado local distinto.

## Checklist rápida (5 minutos)

1. Abrir la app en **Safari/Chrome real** (no desde Instagram/Facebook).
2. Probar en incógnito.
3. Confirmar en Google Cloud Console:
   - Authorized JavaScript origins exactos.
   - Client ID correcto (mismo en frontend y backend).
4. Borrar cookies/cache del dominio y volver a probar.
5. Verificar hora/fecha automáticas del teléfono.

## Recomendación práctica para usuarios

Si falla en celular:

- iPhone: “Abrir en Safari”
- Android: “Abrir en Chrome”

Esto por sí solo suele resolver la mayoría de fallos intermitentes.
