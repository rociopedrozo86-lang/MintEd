# MintEd — Guion del pitch (5 minutos)

Los tiempos son acumulados. El texto hablado suma unas 620 palabras, que a ritmo normal rondan los 4:30. Los 30 segundos restantes son el colchón para la demo.

**Antes de grabar o presentar**
- Backend y front levantados, wallet con ETH de Sepolia y MetaMask en la red correcta.
- Una wallet de demo con las actividades 2 y 3 ya reclamadas (saldo de 20 MXP) y la actividad 1 sin hacer.
- Pestañas de Etherscan abiertas con los dos contratos.
- Plan B: grabar la demo una vez completa. Si la red falla en vivo, se reproduce el video.

---

## 0:00 – 0:40 · La necesidad

> Hola, somos [equipo] y presentamos MintEd.
>
> Entrar a Web3 tiene una barrera que no es técnica. Es práctica. Podés leer qué es una wallet, qué es el gas, qué es un smart contract, y aun así no entender qué pasa cuando firmás una transacción. Eso solo se aprende haciéndolo.
>
> Y cuando alguien termina un curso, lo que recibe es un certificado que vale únicamente si confiás en quien lo emitió.
>
> Nuestra idea: aprender blockchain usando blockchain.

## 0:40 – 1:30 · La solución y por qué blockchain

> MintEd es una plataforma educativa gamificada. Las lecciones y los quizzes viven en un servidor, porque ahí funcionan mejor. No pretendemos que la blockchain sea mejor que una base de datos para eso.
>
> La usamos para tres cosas que una base de datos no da.
> Primero, un token, MintXP, que el usuario realmente posee y puede transferir.
> Segundo, una emisión y una quema que cualquiera puede auditar.
> Y tercero, una credencial que cualquiera puede verificar sin pedirnos permiso.
>
> Además, cada reclamo es una transacción real. El usuario aprende wallets, firmas y gas haciéndolos.

## 1:30 – 3:45 · Demo (2 min 15 s)

| Tiempo | Qué se hace en pantalla | Qué se dice |
|---|---|---|
| 1:30 | Conectar la wallet. Se ven Sepolia, el saldo de ETH y los 20 MXP. | "Conecto mi wallet en Sepolia. Ya completé dos actividades, tengo 20 MXP." |
| 1:45 | Abrir la actividad 1, mostrar la lección y contestar el quiz. | "Cada actividad tiene una lección y un quiz. El servidor corrige. Las respuestas correctas nunca llegan al navegador." |
| 2:15 | Firmar `claimXP` en la wallet. Abrir el hash en Etherscan y señalar el evento `XPClaimed`. | "Si apruebo, el servidor firma un mensaje. Con esa firma reclamo MXP, y el contrato verifica que sea auténtica. Acá está el evento, todo público." |
| 2:50 | Mostrar el progreso 3/3 y el saldo de 30 MXP. Tocar "Reclamar credencial" y confirmar `approve` y `claimCredential`. | "Con las tres actividades y 30 MXP, reclamo la credencial. Son dos firmas: autorizo la quema y reclamo." |
| 3:20 | En Etherscan, mostrar la transferencia a la dirección cero por 20 MXP y `ownerOf`. | "Se quemaron 20 MXP y la credencial quedó en mi wallet. El contrato verificó mi progreso por su cuenta." |
| 3:35 | Opcional: intentar `transferFrom` de la credencial en Etherscan. Revierte con `Soulbound`. | "Y no se puede transferir. No se compra ni se vende." |

## 3:45 – 4:40 · Riesgos

> Queremos ser claros con lo que no resolvemos.
>
> El mayor riesgo es el firmante. Es un servidor centralizado: si alguien toma esa clave, puede emitir MXP. Lo acotamos con un tope por reclamo, firmas que vencen y la posibilidad de rotar el firmante, pero sigue siendo un punto de confianza. En producción usaríamos un multisig y varios firmantes.
>
> Segundo, el sybil. Una persona puede crear varias wallets. Limitamos los intentos por wallet, pero no hay prueba de personalidad. Hoy el token no tiene valor porque estamos en testnet.
>
> Tercero, los bots. Cada quiz da tres intentos con preguntas distintas, no muestra el puntaje y bloquea la actividad 24 horas después del tercer fallo. Eso encarece el ensayo y error, pero un banco finito de preguntas se puede automatizar con wallets nuevas. La mejora sería un banco más grande y desafíos que se verifiquen en la cadena.
>
> Y por el lado económico: por cada path emitimos 30 MXP y quemamos 20. Falta diseñar más usos para el token antes de pensar en mainnet.

## 4:40 – 5:00 · Cierre

> MintEd valida técnicamente el mecanismo central: aprender, ganar tokens, quemarlos y obtener una credencial que nadie puede falsificar. Lo desplegamos en Sepolia y el código está en GitHub.
>
> Gracias.

---

**Si sobra o falta tiempo**
- Si sobra: mostrar `totalSupply` bajando de 30 a 10 en Etherscan.
- Si falta: saltear el intento de transferir la credencial (3:35) y decir solo que es no transferible.
- Si la demo en vivo falla: pasar al video grabado sin explicar el problema técnico.
