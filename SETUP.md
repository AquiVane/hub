# Marketing Hub — Guía de configuración

## 1. Probar en modo demo (sin configurar nada)

Abrí `index.html` en el navegador. Ya funciona con datos de ejemplo guardados en el navegador.
- Admin: `admin@demo.com` / `admin123`
- Cliente Slots: `slots@demo.com` / `slots123`
- Cliente DOMO: `domo@demo.com` / `domo123`

---

## 2. Publicar en Vercel (para acceder desde cualquier lugar)

1. Creá una cuenta en https://github.com si no tenés
2. Creá un repo nuevo llamado `marketing-hub`
3. Subí todos los archivos de esta carpeta al repo
4. Entrá a https://vercel.com, conectá tu cuenta de GitHub
5. Importá el repo `marketing-hub`
6. Vercel lo publica automáticamente. Te da una URL como `marketing-hub.vercel.app`

---

## 3. Activar Firebase (para datos reales y login real)

### Paso 1: Crear el proyecto Firebase

1. Entrá a https://console.firebase.google.com
2. Hacé clic en **Agregar proyecto**
3. Nombre: `marketing-hub` (o el que quieras)
4. Desactivá Google Analytics si no lo necesitás
5. Creá el proyecto

### Paso 2: Activar Authentication

1. En el menú de Firebase, hacé clic en **Authentication** → **Comenzar**
2. En la pestaña **Sign-in method**, activá **Correo electrónico/contraseña**

### Paso 3: Activar Firestore

1. En el menú, hacé clic en **Firestore Database** → **Crear base de datos**
2. Elegí **Comenzar en modo de prueba** (podés ajustar las reglas después)
3. Elegí la región **us-east1** o **us-central1**

### Paso 4: Obtener las credenciales

1. En Firebase, hacé clic en el ícono ⚙️ → **Configuración del proyecto**
2. Bajá hasta **Tus apps** → hacé clic en **</>** (Web)
3. Registrá la app con el nombre `marketing-hub`
4. Copiá el objeto `firebaseConfig`

### Paso 5: Pegar las credenciales

Abrí el archivo `js/firebase.js` y reemplazá los valores:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",           // ← pegá el tuyo
  authDomain: "marketing-hub-xxxxx.firebaseapp.com",
  projectId: "marketing-hub-xxxxx",
  storageBucket: "marketing-hub-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

---

## 4. Agregar usuarios reales en Firebase

1. En Firebase → **Authentication** → **Usuarios** → **Agregar usuario**
2. Ingresá el email y contraseña del cliente
3. Anotá el UID que aparece

4. En **Firestore** → creá la colección `users` → nuevo documento con el UID como ID:
```
{
  role: "client",
  clientId: "slots",     ← el ID del cliente
  name: "Slots!"
}
```

5. Para el admin:
```
{
  role: "admin",
  name: "Vaneh"
}
```

6. Creá la colección `clients` → documento con ID igual al clientId:
```
{
  nombre: "Slots!",
  instagram: "@wildeslots",
  facebook: "Slots Avellaneda",
  activo: true
}
```

---

## 5. Conectar Meta Ads API (para pauta automática)

1. Entrá a https://developers.facebook.com
2. Creá una app de tipo **Business**
3. Agregá el producto **Marketing API**
4. Generá un **token de acceso** con permisos `ads_read`
5. En el panel de Pauta, próximamente habrá un campo para pegarlo

---

## Estructura de archivos

```
marketing-hub/
  index.html          ← Login
  admin/index.html    ← Panel admin (gestión de clientes)
  app/index.html      ← Panel cliente (contenidos, tareas, pauta)
  css/style.css       ← Estilos
  js/
    firebase.js       ← ⚠️ Acá pegás tus credenciales Firebase
    auth.js           ← Login / logout
    data.js           ← Lectura y escritura de datos
    app.js            ← Lógica principal del panel
  SETUP.md            ← Esta guía
```
