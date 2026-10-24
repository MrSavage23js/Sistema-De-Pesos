# Control de Pesos — Veladoras (Grupo Aramo)

Estructura:

```
control-pesos/
├── index.html            # Estructura de la página, formulario y pantallas
├── css/
│   └── styles.css        # Todos los estilos (tema claro/oscuro, layout app-shell)
├── js/
│   ├── app.js             # Lógica: cálculos, guardado, historial, exportar a Excel
│   └── firebase-config.js # Config de tu proyecto de Firebase (para uso fuera de claude.ai)
└── firestore.rules       # Reglas de seguridad para pegar en la consola de Firebase
```

La app detecta sola dónde está corriendo y usa el backend correspondiente —
no hay que cambiar nada a mano entre un entorno y otro.

## Opción 1: dentro de claude.ai (Artifact)

Publicada como Artifact, la app usa `window.claude.use(...)` para tres cosas:

- **`db`** — guardar y sincronizar las capturas en tiempo real entre todo el equipo.
- **`downloads`** — el botón de exportar a Excel.
- **`user`** — mostrar quién capturó cada registro.

Esas funciones solo existen dentro de un Artifact publicado en claude.ai. No
requieren ninguna configuración de tu parte.

## Opción 2: fuera de claude.ai (GitHub Pages, hosting propio, etc.)

Cuando la app no detecta `window.claude`, usa **Firebase** (plan gratuito
Spark) como backend en su lugar: mismo formulario, mismo historial en vivo,
misma exportación a Excel, pero con tu propia base de datos.

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
archivo, y la función `calcPromedios()` para la fórmula. El resto es
JavaScript normal y no depende de nada externo.

### Fórmula de pesos promedio

- **Mezcla 1:** `prom1 = peso total 1 ÷ piezas 1`, y se le resta el vaso solo
  si está marcada la casilla **"Restar peso del vaso a la mezcla 1"**.
- **Mezcla 2** (veladora terminada): `prom2 = peso total 2 ÷ piezas 2 − prom1 − vaso`

La casilla se marca sola cuando hay una sola mezcla y se desmarca cuando se
elige una mezcla 2, pero el capturista puede cambiarla. La elección se guarda en
cada registro (`restarVaso1`) y aparece en el historial y en el Excel.

El historial y la exportación recalculan los promedios a partir de los pesos
capturados. Los registros guardados antes de que existiera la casilla usan el
caso habitual: restan el vaso con una mezcla y no lo restan con dos.
