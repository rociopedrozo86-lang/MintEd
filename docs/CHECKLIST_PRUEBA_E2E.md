# MintEd — Checklist de la prueba end-to-end en Sepolia

Objetivo: comprobar que el ciclo completo funciona de punta a punta con las piezas reales (contratos, backend y front):

**conectar wallet → aprobar actividad → reclamar MXP → transferir → quemar MXP → recibir credencial**

Responsables sugeridos: **A** contratos y deploy, **B** front, **C** backend, **D** pruebas negativas y evidencias. Todos pueden correr toda la checklist; los roles solo indican quién se ocupa si algo falla.

---

## 0. Antes de empezar

- [ ] Node 20.6 o superior en las máquinas que corran el backend (`node --version`).
- [ ] **Tres wallets de testnet** (nunca wallets con fondos reales):
  - **Deployer**: despliega los contratos, necesita ETH de Sepolia.
  - **Firmante**: wallet nueva solo para firmar claims. Firma off-chain, así que **no necesita ETH**. Su clave privada va únicamente en el `.env` del backend.
  - **Alice** y **Bob**: cuentas de usuario en MetaMask (u otra wallet). Las dos necesitan ETH de Sepolia (con ~0.05 ETH cada una alcanza de sobra).
- [ ] ETH de Sepolia en Deployer, Alice y Bob (usen el faucet que indique el curso o busquen uno vigente; algunos piden cuenta o saldo en mainnet).
- [ ] RPC de Sepolia (Alchemy, Infura u otro) y API key de Etherscan.
- [ ] Anotar las direcciones de **Deployer**, **Firmante**, **Alice** y **Bob** en un lugar común.

---

## 1. Verificación local (sin red)

- [ ] **A:** en `contracts`: `npm install && npm test` → **28 tests en verde**.
- [ ] **C:** en `backend`: `npm install && npm test` → **22 tests en verde** (contenido, intentos y servidor).
- [ ] **B:** abrir el front por HTTP, no con doble click (ver sección 4).

Si algo falla acá, arreglarlo antes de gastar ETH.

---

## 2. Deploy de contratos (A)

- [ ] Completar `.env` de contratos: `SEPOLIA_RPC_URL`, `PRIVATE_KEY` (Deployer), `ETHERSCAN_API_KEY`, `CLAIM_SIGNER_ADDRESS` (dirección del Firmante, **no** su clave).
- [ ] `npm run deploy:sepolia`
  - Esperado: imprime las direcciones de `MintXP` y `MintCredential`, "Path 1 creado con actividades [1, 2, 3]" y las líneas para pegar en `front/config.js`.
  - Esperado: se crea `deployments/sepolia.json`.
- [ ] Ambos contratos aparecen **verificados** en Sepolia Etherscan (tildecito verde, pestañas Read/Write Contract). Si la verificación automática falló, esperar unos minutos y correr a mano:
  ```bash
  npx hardhat verify --network sepolia <MINTXP> <DIRECCION_FIRMANTE>
  npx hardhat verify --network sepolia <MINTCREDENTIAL> <MINTXP> 20000000000000000000 ""
  ```
- [ ] **Read Contract** de `MintXP`: `symbol` = MXP, `owner` = Deployer, `claimSigner` = Firmante, `MAX_CLAIM` = 100000000000000000000.
- [ ] **Read Contract** de `MintCredential`: `xp` = dirección de `MintXP`, `burnCost` = 20000000000000000000, `pathExists(1)` = true, `getPathActivities(1)` = [1, 2, 3].
- [ ] Guardar las direcciones y los hashes de deploy (se usan en la sección 7).

---

## 3. Backend (C)

- [ ] Completar `.env` del backend: `SIGNER_PRIVATE_KEY` (clave del Firmante), `MINTXP_ADDRESS` (la desplegada) y `ALLOWED_ORIGIN` (el origen exacto donde se sirve el front, por defecto `http://localhost:8000`).
- [ ] `npm start`
  - Esperado: "Dirección del firmante: 0x…" y **esa dirección coincide con el `claimSigner` de `MintXP`**. Si no coincide, todos los claims van a revertir con `BadSignature`.
- [ ] `curl http://localhost:3001/health` → `{"ok":true,"signer":"0x…"}` con la misma dirección.
- [ ] `curl http://localhost:3001/activities/1` → devuelve lección y preguntas, **sin** el campo `correct`.
- [ ] Sin aprobar nada, pedir una firma (reemplazar por la dirección de Alice):
  ```bash
  curl -s -X POST http://localhost:3001/sign-claim -H "Content-Type: application/json" \
    -d '{"user":"<ALICE>","activityId":1}'
  ```
  Esperado: HTTP 403 con "Primero tenés que aprobar la actividad".

---

## 4. Front (B)

- [ ] Pegar en `front/config.js` las direcciones de `mintXP` y `mintCredential`. Revisar que `backendUrl` apunte al backend.
- [ ] Desde la carpeta `front/`: `python3 -m http.server 8000` y abrir **`http://localhost:8000`**.
  - El origen tiene que coincidir **exactamente** con `ALLOWED_ORIGIN` (`localhost` y `127.0.0.1` cuentan como distintos). Si no, el navegador bloquea las llamadas al backend por CORS.
- [ ] La página carga sin errores en la consola del navegador y no aparece el aviso "Faltan las direcciones de los contratos".

---

## 5. Flujo principal con Alice

Hacerlo con una wallet **sin historial en estos contratos**. Anotar cada hash de transacción.

### 5.1 Conexión
- [ ] "Conectar wallet" → la wallet pide permiso y cambiar a Sepolia (si no estaba).
- [ ] Esperado: etiqueta **Sepolia**, dirección de Alice, ETH mayor a 0, **MintXP = 0**, las 3 actividades con el botón "Hacer actividad".
- [ ] Cambiar la wallet a otra red (por ejemplo mainnet) → etiqueta "Red incorrecta" y aviso "Cambiá tu wallet a Sepolia…". Volver a Sepolia.

### 5.2 Primera actividad
- [ ] "Hacer actividad" en la actividad 1 → se abre el diálogo con la lección y 4 preguntas. Se lee "Intento 1 de 3. Necesitás 3 respuestas correctas de 4".
- [ ] Responder mal a propósito (al menos 2 mal) → mensaje "No alcanzaste el mínimo… quedan 2 intento(s) y las preguntas cambian". **No muestra el puntaje.** El diálogo sigue abierto, ahora con "Intento 2 de 3" y **preguntas distintas** a las del primer intento.
- [ ] Responder bien → el diálogo se cierra y la wallet pide **firmar la transacción** `claimXP`.
- [ ] Confirmar → en "Actividad on-chain" el estado pasa de "esperando firma…" a "confirmando…" y luego "confirmada", con link a Etherscan.
- [ ] Esperado: **MintXP = 10**, la actividad 1 queda "Reclamado ✓".
- [ ] En Etherscan: el evento `XPClaimed(Alice, 1, 10 MXP)` y un Transfer de la dirección cero a Alice. En Read Contract, `claimed(Alice, 1)` = true.

### 5.3 Actividades 2 y 3
- [ ] Repetir con las actividades 2 y 3.
- [ ] Esperado: **MintXP = 30**, progreso **3/3** en la sección de credencial.

### 5.4 Credencial y burn
- [ ] En "Credencial verificable": actividades 3/3 completas, saldo "30 de 20 MXP", y el paso de autorización dice "se pedirá al reclamar".
- [ ] "Reclamar credencial" → la wallet pide **dos** confirmaciones, una detrás de la otra: primero `approve` de 20 MXP y después `claimCredential`.
- [ ] Esperado: dos entradas "confirmada" en el log, **MintXP = 10** y el mensaje "Ya tenés tu credencial de este learning path.". El botón queda deshabilitado.
- [ ] En Etherscan:
  - Transfer de Alice a la dirección cero por **20 MXP** (el burn). `totalSupply` de MintXP bajó de 30 a 10.
  - `MintCredential`: `ownerOf(1)` = Alice, `hasCredential(Alice, 1)` = true, `tokenPath(1)` = 1, `locked(1)` = true.
  - Eventos `CredentialClaimed(Alice, 1, 1)` y `Locked(1)`.
  - `tokenURI(1)` devuelve vacío si no se configuró `CREDENTIAL_BASE_URI` (es lo esperado).

### 5.5 Transferencia
- [ ] En "Transferir MXP": enviar **5 MXP a Bob** → "confirmada", saldo de Alice = 5.
- [ ] En Etherscan, Bob figura con 5 MXP.

**El ciclo completo está validado cuando 5.1 a 5.5 pasan sin retoques.**

---

## 6. Pruebas negativas y red team (D)

Marcar el resultado real de cada una. Las respuestas correctas del quiz están en `backend/activities.js`: una lista por cada juego de preguntas (intento 1, 2 y 3): actividad 1 → `[2,1,2,0]`, `[2,1,3,2]`, `[2,1,0,1]`; actividad 2 → `[1,2,2,1]`, `[3,0,2,1]`, `[1,2,3,1]`; actividad 3 → `[1,0,2,0]`, `[2,0,3,0]`, `[2,1,2,3]`. Un usuario que no falló antes está en el intento 1. Se aprueba con 3 de 4.

### Contrato
- [ ] **Doble claim.** Con Alice (ya reclamó la actividad 1), pedir una firma nueva por `curl` a `/sign-claim` (el backend la da porque Alice aprobó) y usarla en Etherscan → Write Contract → `claimXP(1, amount, deadline, signature)`. Esperado: revierte por `AlreadyClaimed`.
- [ ] **Firma ajena.** Con una dirección nueva (Carol): enviar las respuestas correctas de la actividad 1 por `curl` a `/submit-answers`, pedir la firma a `/sign-claim`, y usarla desde **Bob** en `claimXP`. Esperado: revierte por `BadSignature`.
  ```bash
  curl -s -X POST http://localhost:3001/submit-answers -H "Content-Type: application/json" \
    -d '{"user":"<CAROL>","activityId":1,"answers":[2,1,2,0]}'
  ```
- [ ] **Firma vencida.** Reiniciar el backend con `DEADLINE_SECONDS=30`, pedir una firma, esperar más de 30 segundos y usarla. Esperado: revierte por `ClaimExpired`. Volver a poner 600.
- [ ] **Comprar MXP sin aprender.** Bob tiene 5 MXP pero ninguna actividad aprobada. En el front, con Bob: la credencial muestra 0/3 y el botón queda deshabilitado. Forzarlo en Etherscan con `claimCredential(1)` desde Bob. Esperado: revierte por `PathIncomplete`.
- [ ] **Credencial intransferible.** En Etherscan, Write Contract de `MintCredential`: `transferFrom(Alice, Bob, 1)` desde Alice. Esperado: revierte por `Soulbound` (la wallet suele avisar que la transacción va a fallar).
- [ ] **Rotación del firmante** (opcional, A). Con el Deployer, `setClaimSigner(<otra dirección>)` en `MintXP`. Esperado: las firmas del backend pasan a fallar con `BadSignature`. Volver a poner el firmante original.

### Backend
- [ ] **Tres intentos y bloqueo de 24 h.** Con una dirección sin actividad aprobada, enviar 3 veces respuestas incorrectas a la actividad 1 y una cuarta vez respuestas correctas:
  ```bash
  for i in 1 2 3 4; do
    curl -s -w "  -> %{http_code}\n" -X POST http://localhost:3001/submit-answers \
      -H "Content-Type: application/json" \
      -d '{"user":"0x0000000000000000000000000000000000000001","activityId":1,"answers":[0,0,0,0]}'
  done
  ```
  Esperado: `{"passed":false,"attemptsLeft":2,"locked":false}`, luego `attemptsLeft":1`, luego `"locked":true,"retryAfterSeconds":86400` (**sin puntaje** en ninguna respuesta) y un `429` en el cuarto. Para el cuarto con respuestas correctas, el resultado es el mismo: sigue bloqueada.
- [ ] **Preguntas distintas por intento.** `curl "http://localhost:3001/activities/1?user=<ADDR>"` antes y después de un fallo. Esperado: cambia el texto de las preguntas y `attempt` pasa de 1 a 2. Con la actividad bloqueada devuelve `"locked":true` y `"questions":[]` (la lección sigue visible).
- [ ] **Bloqueo en el front.** Con la dirección bloqueada, abrir la actividad. Esperado: se ve la lección y el aviso "Agotaste los 3 intentos… volvé a intentarlo en 23 h …", sin preguntas. Las otras actividades siguen disponibles.
- [ ] **El bloqueo vence** (opcional). Reiniciar el backend con `LOCKOUT_HOURS=0.01` (36 s) y repetir los 3 fallos. Esperado: tras ~36 s la actividad vuelve a habilitarse con el juego 1.
- [ ] **Reinicio del backend.** Aprobar una actividad sin reclamarla, reiniciar el backend y volver a pedir la firma. Esperado: 403 (el progreso está en memoria); hay que rehacer el quiz. Es un comportamiento conocido, no un bug.
- [ ] **Backend caído.** Apagarlo y tocar "Hacer actividad". Esperado: aviso "No se pudo cargar la actividad…" y ninguna transacción en la wallet.

### Front
- [ ] **Rechazar en la wallet.** Rechazar una transacción de claim → el log muestra "Rechazaste la operación en la wallet." y el saldo no cambia. Volver a tocar "Hacer actividad": como ya está aprobada, va directo a pedir la firma (sin repetir el quiz).
- [ ] **Cambio de cuenta.** Cambiar de cuenta en la wallet con la página abierta → los saldos y los botones se actualizan solos.

---

## 7. Evidencia para whitepaper y pitch (D)

Completar con links a Sepolia Etherscan. Sirven para la demo y para el análisis de riesgos.

| Evidencia | Link / valor |
|---|---|
| Deploy `MintXP` | |
| Deploy `MintCredential` | |
| Claim de MXP (actividad 1) | |
| Approve + `claimCredential` (burn de 20 MXP) | |
| Mint de la credencial (`ownerOf(1)`) | |
| Transferencia de 5 MXP a Bob | |
| Revert `AlreadyClaimed` | |
| Revert `BadSignature` | |
| Revert `PathIncomplete` | |
| Revert `Soulbound` | |

Para la demo de 5 minutos: usar una wallet nueva con ETH ya cargado, tener el backend y el front levantados de antemano, y mostrar 5.2 (una actividad) y 5.4 (credencial con burn). Ensayar el recorrido completo al menos una vez antes.

---

## 8. Si algo falla

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| Todos los claims revierten con `BadSignature` | El firmante del backend no es el `claimSigner` del contrato, o `MINTXP_ADDRESS` o `CHAIN_ID` del backend no coinciden con el contrato | Comparar la dirección que imprime el backend con `claimSigner`; revisar `MINTXP_ADDRESS` y `CHAIN_ID` |
| "Failed to fetch" o error de CORS en la consola | `ALLOWED_ORIGIN` no coincide con el origen del front, o el front se abrió con `file://` | Servirlo por HTTP y alinear `localhost` o `127.0.0.1` y el puerto |
| Aviso "Faltan las direcciones de los contratos" | `config.js` sigue con ceros | Pegar las direcciones del deploy |
| "No se pudo leer el estado de los contratos" | Direcciones o red equivocadas, o el ABI de `abis.js` no coincide con el contrato | Revisar `config.js` y la red; comparar firmas de funciones |
| 403 "Primero tenés que aprobar la actividad" | El backend se reinició o la actividad nunca se aprobó | Rehacer el quiz |
| 429 en `/submit-answers` | Falló 3 veces y la actividad está bloqueada 24 h | Repasar la lección y esperar, o reiniciar el backend en desarrollo (el estado está en memoria) |
| `ClaimExpired` | Pasaron más de 10 minutos entre la firma y la confirmación | Volver a tocar "Hacer actividad" para pedir una firma nueva |
| `AlreadyClaimed` | La actividad ya se reclamó con esa dirección | Refrescar la página; es el comportamiento esperado |
| `ERC20InsufficientAllowance` al reclamar la credencial | El `approve` no se confirmó o es de otro monto | Esperar su confirmación y reintentar |
| `ERC20InsufficientBalance` | Saldo menor a 20 MXP (por ejemplo, ya se transfirieron) | Revisar el saldo; con 30 MXP alcanza |
| La verificación en Etherscan falla | Etherscan todavía no indexó el contrato | Esperar unos minutos y correr los comandos de la sección 2 |
| El deploy falla por falta de fondos o por el RPC | Deployer sin ETH, o límite del proveedor | Cargar ETH o probar con otra URL de RPC |
