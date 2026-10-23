# MintEd: Contratos inteligentes

Esta carpeta es la **raíz del proyecto Hardhat**. Contiene los dos contratos de MintEd, sus tests y el módulo de despliegue en Sepolia.

> **Todos los comandos de Hardhat se corren desde esta carpeta (`contracts/`), no desde la raíz del repositorio ni tampoco desde la subcarpeta del mismo nombre.**

## Qué hacen los contratos

MintEd es una plataforma educativa Web3: el contenido y la corrección de los quizzes ocurren off-chain, mientras que la blockchain guarda lo que necesita ser verificable.

| Contrato | Tipo | Para qué sirve |
|---|---|---|
| `MintXP` | ERC-20 no transferible | Token **MXP**. Se acuña al completar actividades (con una firma EIP-712 del backend) y se quema al reclamar una credencial. |
| `MintEdCredential` | ERC-721 no transferible (ERC-5192) | Credencial educativa por curso o learning path. Verifica on-chain que se completaron todas las actividades, quema MXP y emite la credencial. |

### Flujo

```
Se completa una Actividad ───(firma EIP-712)───▶ claimXP en MintXP ────▶ MXP acuñados
                                                                                       │
Se reclaman todas las Actividades del Learning Path + approve ──▶ claimCredential ──┤
                                                                                       ▼
                                                      Se queman 20 MXP y se emite la credencial
```

1. El usuario completa una actividad en la web. El backend le entrega una **firma**.
2. El usuario llama a `claimXP` con esa firma y recibe MXP. Se marca la actividad como reclamada.
3. Con todas las actividades del path reclamadas, el usuario hace `approve` de 20 MXP a `MintEdCredential` (le permite quemar 20MXP al contrato MintEdCredential).
4. El usuario llama a `claimCredential(pathId)`. En una sola transacción se verifican las actividades, se queman 20 MXP con `burnFrom` y se emite la credencial.

## Parámetros

| Parámetro | Valor | Dónde vive |
|---|---|---|
| MXP por actividad | 10 | Backend (`AMOUNT_PER_ACTIVITY`). |
| Tope por claim | 100 MXP | `MAX_CLAIM` en `MintXP` (constante). |
| Costo de la credencial | 20 MXP | `burnCost` en `MintEdCredential` (inmutable). |
| Path 1 | actividades 1, 2 y 3 | `createPath` en el despliegue. |
| Máximo de actividades por path | 32 | `MAX_ACTIVITIES_PER_PATH` (constante). |

De esta manera, para este learning path con 3 actividades de 10 MXP y un costo de 20 MXP para reclamar la credencial, completar el path deja 10 MXP de sobra al usuario.

## Despliegue en Sepolia (chainId 11155111)

| Contrato | Dirección |
|---|---|
| `MintXP` | [`0xdb90a4C8AC91941935980b7B7c230bE2e6d58426`](https://sepolia.etherscan.io/address/0xdb90a4C8AC91941935980b7B7c230bE2e6d58426) |
| `MintEdCredential` | [`0x25C2633607d40Cc6E832f321aa39aFb6074454E0`](https://sepolia.etherscan.io/address/0x25C2633607d40Cc6E832f321aa39aFb6074454E0) |

El registro del despliegue (direcciones, journal y ABI) está en `ignition/deployments/chain-11155111/`.

## Estructura

```
contracts/                    ← raíz del proyecto Hardhat
├── contracts/
│   ├── MintXP.sol
│   └── MintEdCredential.sol
├── test/
│   ├── MintXP.ts
│   └── MintEdCredential.ts
├── ignition/
│   ├── modules/
│   │   └── MintEd.ts         ← módulo de despliegue
│   ├── parameters/
│   │   ├── local.json
│   │   ├── sepolia.example.json
│   │   └── sepolia.json      ← dirección pública del firmante
│   └── deployments/
│       └── chain-11155111/   ← registro del despliegue en Sepolia
├── hardhat.config.ts
├── package.json
├── package-lock.json
├── tsconfig.json
└── .env.example
```

## Requisitos

- Node.js (versión LTS)
- Hardhat 3 con viem (ya incluido en `package.json`)
- Solidity 0.8.34 y OpenZeppelin Contracts 5.6.1

## Cómo usarlo

```bash
cd contracts
npm install
npx hardhat compile
npx hardhat test
```

### Ensayo de despliegue en local (sin gastar nada)

```bash
npx hardhat ignition deploy ignition/modules/MintEd.ts --parameters ignition/parameters/local.json
```

El resultado se descarta al terminar: sirve para comprobar que el módulo funciona.

### Despliegue en Sepolia

1. Completar `ignition/parameters/sepolia.json` (copiando `sepolia.example.json` del proyecto) con la **dirección pública** del firmante backend.
2. Establecer una clave keystore de Hardhat y cargar las claves privadas (se guardan cifrados, fuera del repo):

   ```bash
   npx hardhat keystore set SEPOLIA_RPC_URL
   npx hardhat keystore set SEPOLIA_PRIVATE_KEY   # clave de la cuenta owner, con ETH de Sepolia
   npx hardhat keystore set ETHERSCAN_API_KEY     # solo para verificar
   ```

3. Desplegar y verificar:

   ```bash
   npx hardhat ignition deploy --network sepolia ignition/modules/MintEd.ts --parameters ignition/parameters/sepolia.json --verify
   ```

La cuenta que despliega queda como **owner** de los dos contratos. Si se repite el mismo comando con los mismos parámetros, Ignition no vuelve a desplegar lo que ya está en el registro.

> **Nota de seguridad:** Estos datos sensibles quedan resguardados por el sistema de Hardhat. Bajo ninguna circunstancia tenés que incluir claves privadas, frases semilla o la URL de tu nodo en archivos públicos.

## Interfaz de los contratos

### MintXP

| Función | Quién | Descripción |
|---|---|---|
| `claimXP(activityId, amount, deadline, signature)` | Cualquiera, con firma válida | Acuña MXP por una actividad. Una sola vez por (usuario, actividad) |
| `claimed(user, activityId)` | Lectura | `true` si el usuario ya reclamó esa actividad |
| `setClaimSigner(newSigner)` | Owner | Rota el firmante; las firmas del anterior dejan de valer |
| `claimSigner()` | Lectura | Dirección del firmante actual |
| `MAX_CLAIM()` | Lectura | Tope por claim (100 MXP) |
| `burn(value)` / `burnFrom(account, value)` | Titular / con `approve` | Quema MXP |

- **Eventos:** `XPClaimed(user, activityId, amount)`, `ClaimSignerUpdated(oldSigner, newSigner)`.
- **Errores:** `InvalidSigner`, `InvalidAmount`, `SignatureExpired`, `AlreadyClaimed`, `ZeroAddress`, `NonTransferable`.
- **Constructor:** `(initialOwner, initialSigner)`.
- **No transferible:** `transfer` y `transferFrom` entre cuentas revierten con `NonTransferable`. `approve` se mantiene porque `burnFrom` lo necesita.

### MintEdCredential

| Función | Quién | Descripción |
|---|---|---|
| `createPath(pathId, activityIds)` | Owner | Crea un learning path. No se puede modificar después |
| `getPathActivities(pathId)` | Lectura | Lista de actividades del path |
| `claimCredential(pathId)` | Cualquiera | Verifica actividades, quema `burnCost` MXP y emite la credencial. Requiere `approve` previo |
| `credentialId(user, pathId)` | Lectura | `tokenId` de la credencial; `0` si no la tiene |
| `tokenPath(tokenId)` | Lectura | Path al que pertenece una credencial |
| `revoke(tokenId, reason)` | Owner | Marca la credencial como revocada (no la borra ni la quema) |
| `isValid(tokenId)` | Lectura | `true` si existe y no está revocada |
| `revocationOf(tokenId)` | Lectura | `(revocada, fecha, motivo)` |
| `locked(tokenId)` | Lectura | ERC-5192: siempre `true` para una credencial existente |
| `setBaseURI(newBaseURI)` | Owner | Cambia la base de los metadatos |

- **Eventos:** `PathCreated`, `CredentialClaimed(user, pathId, tokenId)`, `CredentialRevoked(tokenId, reason)`, `Locked(tokenId)`. `Unlocked` está declarado por compatibilidad con ERC-5192, pero nunca se emite.
- **Errores:** `ZeroAddress`, `InvalidBurnCost`, `UnknownPath`, `PathAlreadyExists`, `InvalidPath`, `PathIncomplete`, `AlreadyHasCredential`, `AlreadyRevoked`, `Soulbound`.
- **Constructor:** `(initialOwner, xp, burnCost, baseURI)`.
- **Nombre y símbolo:** `MintEd Credential` / `MEDC`.
- Los `tokenId` empiezan en 1 y se asignan por orden de emisión.

## Firma de claims

El backend firma un mensaje EIP-712 con la clave del **firmante**. El contrato y el backend tienen que coincidir **exactamente** en el dominio y en los tipos.

| Campo del dominio | Valor |
|---|---|
| `name` | `"MintXP"` |
| `version` | `"1"` |
| `chainId` | `11155111` (Sepolia) |
| `verifyingContract` | Dirección de `MintXP` |

```
primaryType: Claim
Claim(address user, uint256 activityId, uint256 amount, uint256 deadline)
```

- `user` es la wallet que va a llamar a `claimXP`: una firma no sirve para otro usuario.
- `amount` va en unidades de 18 decimales (10 MXP = `10 * 10**18`).
- `deadline` es un timestamp en segundos; la firma vale hasta ese instante inclusive.
- La función `firmarClaim` de `test/MintXP.ts` es un ejemplo ejecutable de cómo se firma.

## Tests

`npx hardhat test` corre ambos archivos con la blockchain local de Hardhat.

- **`MintXP.ts`:** configuración inicial, claim exitoso, doble claim, firma vencida, montos inválidos, firmante equivocado, datos alterados, firma de otro usuario o de otro contrato, firma mal formada, rotación del firmante, permisos, transferencias bloqueadas y burn.
- **`MintEdCredential.ts`:** configuración inicial, `createPath`, `claimCredential` (camino feliz y casos de ataque), `credentialId`, credencial no transferible, ERC-5192, metadatos, revocación y un recorrido completo de punta a punta.

## Decisiones de diseño y límites conocidos

- **Sin contratos actualizables.** Un cambio en el código implica desplegar contratos nuevos, con otras direcciones.
- **`burnCost` es inmutable.** Ni el owner puede encarecer la credencial.
- **Credencial no transferible.** No hay migración: si el usuario pierde su wallet, la credencial no se puede mover.
- **Revocación irreversible.** `revoke` no se puede deshacer, no devuelve los MXP quemados y no libera el path para reclamarlo de nuevo.
- **Owner único.** Una sola cuenta puede rotar el firmante, crear paths, revocar credenciales y cambiar el `baseURI`. En producción debería ser un multisig. `Ownable` también permite `transferOwnership` y `renounceOwnership`: si el owner renuncia, nadie podría rotar el firmante ni revocar.
- **Firmante centralizado.** Quien controle su clave puede firmar claims para cualquier wallet y actividad (hasta 100 MXP por claim). Mitigación: el owner puede rotarlo con `setClaimSigner`.
- **Sin protección contra Sybil.** Una persona con varias wallets puede reclamar varias veces.
- **Solo wallets normales (EOA).** La verificación de firmas no contempla wallets de contrato.
- **Sin auditoría externa.** Pensado solo para testnet.
