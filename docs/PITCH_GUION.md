# MintEd — Guion del pitch (5 minutos)

Tono: cercano, entusiasta y claro, como quien presenta un producto que quiere que la gente use. Los tiempos son acumulados. El texto hablado suma unas 450 palabras, que a ritmo normal son cerca de 3:30. El resto del tiempo es la demo en pantalla y el colchón para las esperas de la wallet. Hablar mirando a la audiencia, no al guion, y sonreír cuando aparece Minty.

**Antes de grabar o presentar**
- Backend y front levantados, wallet con ETH de Sepolia y MetaMask en la red correcta.
- Una wallet de demo con las actividades 2 y 3 ya reclamadas (saldo de 20 MXP) y la actividad 1 sin hacer.
- Pestañas de Etherscan abiertas con los dos contratos.
- Plan B: grabar la demo una vez completa. Si la red falla en vivo, se reproduce el video sin explicar el problema.
- Si todavía no hay deploy en Sepolia, cambiar "lo desplegamos en Sepolia" por "funciona sobre una red local de pruebas" y avisarlo al empezar.

---

## 0:00 – 0:40 · El gancho

> ¿Cuántas veces te dijeron "tenés que aprender Web3" y terminaste con veinte pestañas abiertas, sin saber ni por dónde empezar?
>
> Hola, somos David, Graciano, Melina y Rocio, y queremos que aprender blockchain deje de ser aburrido y confuso. Les presentamos **MintEd**.
>
> Acá se aprende blockchain... usando blockchain. Cada lección termina con algo que hacés de verdad: firmás una transacción, ganás puntos y desbloqueás una credencial que es tuya.

## 0:40 – 1:30 · La propuesta

> Te presentamos a Minty, nuestra compañera de estudio.
>
> En MintEd cada actividad tiene una lección corta y un quiz. Si lo aprobás, ganás **MXP**: puntos de aprendizaje que viven en tu propia wallet. No se compran ni se venden: solo se ganan aprendiendo. Lo que sabés es lo que valés.
>
> Cuando completás el recorrido, canjeás tus MXP por tu **credencial verificable**. Es tuya, queda en tu wallet y cualquier persona, un empleador, un profe, un amigo, puede comprobar que es auténtica en un click, sin pedirnos permiso. Y si alguna vez hubiera que invalidarla, no se borra: queda marcada, a la vista de todos.
>
> Los quizzes están pensados para aprender: tenés tres intentos, con preguntas distintas cada vez, y si algo no sale, repasás la lección y volvés a intentar.

## 1:30 – 3:45 · Demo en vivo (2 min 15 s)

| Tiempo | Qué se hace en pantalla | Qué se dice |
|---|---|---|
| 1:30 | Conectar la wallet. Se ven Sepolia, el saldo de ETH y los 20 MXP. | "Entro con mi wallet. Ya hice dos actividades y tengo 20 MXP. Me falta una." |
| 1:45 | Abrir la actividad 1, leer la lección y contestar el quiz. | "Leo la lección, respondo las preguntas y el servidor las corrige. Las respuestas correctas nunca llegan al navegador." |
| 2:15 | Firmar `claimXP` en la wallet. Abrir el hash en Etherscan y señalar el evento `XPClaimed`. | "¡Aprobé! Firmo y gano mis MXP. Esto no es un número en una base de datos: es una transacción real. Acá está en Etherscan, pública para todos." |
| 2:50 | Mostrar el progreso 3/3 y el saldo de 30 MXP. Tocar "Reclamar credencial" y confirmar `approve` y `claimCredential`. | "Ya tengo las tres. Canjeo mis MXP por la credencial: autorizo la quema y la reclamo." |
| 3:20 | En Etherscan, mostrar los 20 MXP quemados y la credencial en mi wallet. Usar "Verificar una credencial" con la dirección. | "Y listo: es mía. Cualquiera puede verificarla acá, ahora mismo. Dice válida." |
| 3:35 | Opcional: intentar transferir la credencial en Etherscan. Revierte con `Soulbound`. | "Y no se puede transferir ni vender. Si la tengo, es porque la gané." |

## 3:45 – 4:40 · Lo que viene

> Hoy MintEd funciona de punta a punta en Sepolia, una red de prueba de Ethereum: nada de esto usa dinero real, y por eso cualquiera puede probarlo sin riesgo.
>
> Y estamos pensando en lo que viene. Más recorridos y credenciales por nivel. Más actividades que se verifiquen directamente en la blockchain. Una forma de comprobar que detrás de cada cuenta hay una persona real. Y llevar la plataforma a una red más económica para que aprender no cueste ni un centavo de gas.
>
> Lo hacemos con transparencia: el sistema depende de un servidor que valida las actividades, y sabemos que en producción haría falta reforzarlo con más controles y una auditoría. Está todo explicado en nuestro whitepaper.

## 4:40 – 5:00 · Cierre

> MintEd es aprender haciendo, ganar por saber y tener algo propio al final del camino.
>
> El código está en GitHub y pueden probarlo hoy mismo. Gracias, y que Minty los acompañe en su primera transacción.

---

**Si sobra o falta tiempo**
- Si sobra: mostrar `totalSupply` bajando de 30 a 10 en Etherscan, o revocar una credencial de prueba y mostrar cómo el front pasa a "REVOCADA" y el certificado sale marcado como inválido.
- Si falta: saltear el intento de transferir la credencial (3:35) y decir solo que no se puede transferir.
- Si la demo en vivo falla: pasar al video grabado sin explicar el problema técnico.

**Para ensayar**
- Que cada integrante diga una parte. Sugerencia: uno el gancho y la propuesta, otro la demo, otro lo que viene y el cierre.
- Practicar con cronómetro. Si se pasan, recortar la sección "Lo que viene", nunca la demo.
- En la demo, hablar mientras la wallet confirma: las transacciones en Sepolia tardan unos 10 a 20 segundos.
