# Control de Pesos — Veladoras (Grupo Aramo)

Estructura:

```
control-pesos/
├── index.html            # Estructura de la página, formulario y pantallas
├── css/
│   └── styles.css        # Todos los estilos (tema claro/oscuro, layout app-shell)
├── js/
│   ├── app.js             # Lógica: cálculos, guardado, historial, exportar CSV
│   └── firebase-config.js # Config de tu proyecto de Firebase (para uso fuera de claude.ai)
└── firestore.rules       # Reglas de seguridad para pegar en la consola de Firebase
```

La app detecta sola dónde está corriendo y usa el backend correspondiente —
no hay que cambiar nada a mano entre un entorno y otro.

## Opción 1: dentro de claude.ai (Artifact)

Publicada como Artifact, la app usa `window.claude.use(...)` para tres cosas:

- **`db`** — guardar y sincronizar las capturas en tiempo real entre todo el equipo.
- **`downloads`** — el botón de exportar CSV.
- **`user`** — mostrar quién capturó cada registro.

Esas funciones solo existen dentro de un Artifact publicado en claude.ai. No
requieren ninguna configuración de tu parte.

## Opción 2: fuera de claude.ai (GitHub Pages, hosting propio, etc.)

Cuando la app no detecta `window.claude`, usa **Firebase** (plan gratuito
Spark) como backend en su lugar: mismo formulario, mismo historial en vivo,
misma exportación a CSV, pero con tu propia base de datos.

Pasos para activarlo:

1. Crea un proyecto en [console.firebase.google.com](https://console.firebase.google.com).
2. En **Compilación > Firestore Database**, crea la base de datos (modo producción).
3. Pega el contenido de `firestore.rules` (de este repo) en **Firestore Database > Reglas** y publícalo.
4. En **Compilación > Authentication > Sign-in method**, activa el proveedor **Anónimo**.
5. En **Configuración del proyecto > Tus apps**, agrega una app web y copia su
   objeto de configuración (`apiKey`, `authDomain`, etc.).
6. Pega esos valores en `js/firebase-config.js`, reemplazando los placeholders.
7. Sube los cambios a tu repositorio de GitHub.

Estos valores de configuración web de Firebase **no son secretos** — es
normal y seguro que queden públicos en el repositorio; la seguridad real la
dan las reglas de Firestore del paso 3.

Mientras `js/firebase-config.js` mantenga el valor de ejemplo (`apiKey`
empezando con `REEMPLAZA`), la app mostrará "Backend no configurado" y no
podrá guardar — es la señal de que faltan los pasos de arriba.

### Identificación de quién captura

Dentro de claude.ai, "Capturado por" muestra el nombre real de la cuenta.
Fuera de claude.ai no hay ese directorio de usuarios, así que la primera vez
que alguien captura algo en un dispositivo, la app le pide su nombre una sola
vez y lo recuerda en ese navegador (`localStorage`).

## Personalizar mezclas, cartuchos o la fórmula de pesos

Todo eso vive en `js/app.js`: las listas `MEZCLAS` y `CARTUCHOS` al inicio del
archivo, y la función `computePromedios()` para la fórmula. El resto es
JavaScript normal y no depende de nada externo.
