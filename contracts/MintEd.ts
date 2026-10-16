import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// ---------------------------------------------------------------------
// Valores acordados con el equipo (inmutables una vez desplegado)
// ---------------------------------------------------------------------

// MXP que se queman al reclamar una credencial: 20 MXP (18 decimales)
const BURN_COST = 20n * 10n ** 18n;

// Path 1 del MVP: actividades 1, 2 y 3.
// Tienen que ser los mismos ids que usa el backend (activities.js) y el front (config.js).
const PATH_ID = 1n;
const ACTIVITY_IDS = [1n, 2n, 3n];

export default buildModule("MintEdModule", (m) => {
  // Cuenta que despliega = owner de los dos contratos (la cuenta 0 de la red elegida)
  const owner = m.getAccount(0);

  // Datos que cambian según la red: se pasan en un archivo de parámetros
  // (ver ignition/parameters/). No tienen valor por defecto A PROPÓSITO:
  // si falta alguno, el despliegue se detiene en lugar de usar uno equivocado.
  const claimSigner = m.getParameter("claimSigner"); // dirección PÚBLICA del backend
  const baseURI = m.getParameter("baseURI"); // puede ser "" por ahora

  // 1. Token
  const mintXP = m.contract("MintXP", [owner, claimSigner]);

  // 2. Credencial: necesita la dirección de MintXP (Ignition resuelve el orden solo)
  const credential = m.contract("MintEdCredential", [
    owner,
    mintXP,
    BURN_COST,
    baseURI,
  ]);

  // 3. Crear el path 1 (solo el owner puede; se hace con la misma cuenta que desplegó)
  m.call(credential, "createPath", [PATH_ID, ACTIVITY_IDS]);

  return { mintXP, credential };
});
