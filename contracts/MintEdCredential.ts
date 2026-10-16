import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getAddress } from "viem";
import { network } from "hardhat";

describe("MintEdCredential", async function () { // agrupo tests de MintEd Credential
  const { viem } = await network.create(); // podemos llamar al contrato
  const publicClient = await viem.getPublicClient(); // leemos info de la testnet: eventos, etc

  // Cuentas de prueba. La primera (owner) es la que despliega por defecto.
  const [owner, signer, ana, luis, otro] = await viem.getWalletClients();

  const NOMBRE_CREDENCIAL = "MintEdCredential" as const;

  const CERO = "0x0000000000000000000000000000000000000000" as const;
  const UN_MXP = 10n ** 18n;
  const DIEZ_MXP = 10n * UN_MXP; // Recompensa de una actividad (lo define el backend)
  const BURN_COST = 20n * UN_MXP; // Costo de la credencial
  const BASE_URI = "https://mined.example/credenciales/";

  // Path de ejemplo: 3 actividades = 30 MXP, la credencial cuesta 20
  const PATH_1 = [101n, 102n, 103n];

  // ---------------------------------------------------------------------
  // Ayudas (no son tests)
  // ---------------------------------------------------------------------

  async function deployXP() {
    return viem.deployContract("MintXP", [
      owner.account.address,
      signer.account.address,
    ]);
  }
  type XP = Awaited<ReturnType<typeof deployXP>>;


    /** Despliega MintXP y MintEdCredential, y crea el path 1. */
  async function deployTodo() {
    const xp = await deployXP();
    const cred = await viem.deployContract(NOMBRE_CREDENCIAL, [
      owner.account.address, // initialOwner
      xp.address,
      BURN_COST,
      BASE_URI,
    ]);
    await cred.write.createPath([1n, PATH_1], { account: owner.account });
    return { xp, cred };
  }

    /** Timestamp (segundos) del último bloque. */
  async function ahora() {
    const block = await publicClient.getBlock();
    return block.timestamp;
  }

  /** Firma un Claim EIP-712 como si fuera el backend. */
  async function firmarClaim(
    xp: XP,
    usuario: `0x${string}`,
    activityId: bigint,
    amount: bigint,
    deadline: bigint,
  ) {
    const chainId = await publicClient.getChainId();
    return signer.signTypedData({
      account: signer.account,
      domain: {
        name: "MintXP",
        version: "1",
        chainId,
        verifyingContract: xp.address,
      },
      types: {
        Claim: [
          { name: "user", type: "address" },
          { name: "activityId", type: "uint256" },
          { name: "amount", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      primaryType: "Claim",
      message: { user: usuario, activityId, amount, deadline },
    });
  }

  /** El usuario reclama en MintXP cada actividad de la lista (10 MXP c/u). */
  async function completar(
    xp: XP,
    usuario: typeof ana,
    actividades: bigint[],
  ) {
    for (const id of actividades) {
      const deadline = (await ahora()) + 3600n;
      const firma = await firmarClaim(
        xp,
        usuario.account.address,
        id,
        DIEZ_MXP,
        deadline,
      );
      await xp.write.claimXP([id, DIEZ_MXP, deadline, firma], {
        account: usuario.account,
      });
    }
  }

  /** Deja al usuario listo para reclamar: actividades completas + approve. */
  async function prepararUsuario(
    xp: XP,
    cred: { address: `0x${string}` },
    usuario: typeof ana,
    actividades: bigint[] = PATH_1,
  ) {
    await completar(xp, usuario, actividades);
    await xp.write.approve([cred.address, BURN_COST], {
      account: usuario.account,
    });
  }

  // ---------------------------------------------------------------------
  // Despliegue
  // ---------------------------------------------------------------------

  it("arranca con la configuración correcta", async function () {
    const { xp, cred } = await deployTodo();

    assert.equal(getAddress(await cred.read.mxp()), getAddress(xp.address));
    assert.equal(await cred.read.burnCost(), BURN_COST);
    assert.equal(
      getAddress(await cred.read.owner()),
      getAddress(owner.account.address),
    );
  });

  it("el owner es el initialOwner del constructor, no quien despliega", async function () {
    const xp = await deployXP();
    // Despliega el owner (cuenta por defecto), pero el dueño será la cuenta 'otro'
    const cred = await viem.deployContract(NOMBRE_CREDENCIAL, [
      otro.account.address,
      xp.address,
      BURN_COST,
      BASE_URI,
    ]);

    assert.equal(
      getAddress(await cred.read.owner()),
      getAddress(otro.account.address),
    );

    // Quien desplegó no tiene permisos de owner
    await viem.assertions.revertWithCustomError(
      cred.write.createPath([1n, PATH_1], { account: owner.account }),
      cred,
      "OwnableUnauthorizedAccount",
    );
    // El initialOwner sí
    await cred.write.createPath([1n, PATH_1], { account: otro.account });
    assert.equal(await cred.read.pathExists([1n]), true);
  });


  it("rechaza desplegar con la dirección de MintXP vacía", async function () {
    await assert.rejects(
      viem.deployContract(NOMBRE_CREDENCIAL, [owner.account.address, CERO, BURN_COST, BASE_URI]),
    );
  });

  it("rechaza desplegar con burnCost 0", async function () {
    const xp = await deployXP();
    await assert.rejects(
      viem.deployContract(NOMBRE_CREDENCIAL, [owner.account.address, xp.address, 0n, BASE_URI]),
    );
  });

  // ---------------------------------------------------------------------
  // createPath
  // ---------------------------------------------------------------------

  it("el owner crea un path y queda guardado", async function () {
    const { cred } = await deployTodo();

    await viem.assertions.emit(
      cred.write.createPath([2n, [201n, 202n]], { account: owner.account }),
      cred,
      "PathCreated",
    );

    assert.equal(await cred.read.pathExists([2n]), true);
    assert.deepEqual(await cred.read.getPathActivities([2n]), [201n, 202n]);
  });

  it("solo el owner puede crear paths", async function () {
    const { cred } = await deployTodo();

    await viem.assertions.revertWithCustomError(
      cred.write.createPath([2n, [201n]], { account: ana.account }),
      cred,
      "OwnableUnauthorizedAccount",
    );
  });

  it("no se puede crear dos veces el mismo path", async function () {
    const { cred } = await deployTodo(); // ya existe el path 1

    await viem.assertions.revertWithCustomError(
      cred.write.createPath([1n, [999n]], { account: owner.account }),
      cred,
      "PathAlreadyExists",
    );
    // El path original no cambió
    assert.deepEqual(await cred.read.getPathActivities([1n]), PATH_1);
  });

  it("rechaza un path sin actividades", async function () {
    const { cred } = await deployTodo();

    await viem.assertions.revertWithCustomError(
      cred.write.createPath([2n, []], { account: owner.account }),
      cred,
      "InvalidPath",
    );
  });

  it("rechaza un path con más de 32 actividades, pero acepta 32", async function () {
    const { cred } = await deployTodo();
    const treintaYTres = Array.from({ length: 33 }, (_, i) => BigInt(i + 1));
    const treintaYDos = treintaYTres.slice(0, 32);

    await viem.assertions.revertWithCustomError(
      cred.write.createPath([2n, treintaYTres], { account: owner.account }),
      cred,
      "InvalidPath",
    );

    await cred.write.createPath([3n, treintaYDos], { account: owner.account });
    assert.equal(await cred.read.pathExists([3n]), true);
  });

  // ---------------------------------------------------------------------
  // claimCredential: camino feliz
  // ---------------------------------------------------------------------

  it("claimCredential emite la credencial y quema 20 MXP", async function () {
    const { xp, cred } = await deployTodo();
    await prepararUsuario(xp, cred, ana);

    // Antes: 30 MXP
    assert.equal(await xp.read.balanceOf([ana.account.address]), 3n * DIEZ_MXP);

    await viem.assertions.emitWithArgs(
      cred.write.claimCredential([1n], { account: ana.account }),
      cred,
      "CredentialClaimed",
      [getAddress(ana.account.address), 1n, 1n], // usuario, pathId, tokenId
    );

    // Credencial
    assert.equal(
      getAddress(await cred.read.ownerOf([1n])),
      getAddress(ana.account.address),
    );
    assert.equal(await cred.read.balanceOf([ana.account.address]), 1n);
    assert.equal(await cred.read.credentialId([ana.account.address, 1n]), 1n);
    assert.equal(await cred.read.tokenPath([1n]), 1n);

    // MXP: 30 - 20 = 10, y el total también bajó
    assert.equal(await xp.read.balanceOf([ana.account.address]), DIEZ_MXP);
    assert.equal(await xp.read.totalSupply(), DIEZ_MXP);

    // El approve se consumió
    assert.equal(
      await xp.read.allowance([ana.account.address, cred.address]),
      0n,
    );
  });

  it("claimCredential emite también el evento Locked (ERC-5192)", async function () {
    const { xp, cred } = await deployTodo();
    await prepararUsuario(xp, cred, ana);

    await viem.assertions.emitWithArgs(
      cred.write.claimCredential([1n], { account: ana.account }),
      cred,
      "Locked",
      [1n],
    );
  });

  it("los tokenId se asignan por orden de emisión", async function () {
    const { xp, cred } = await deployTodo();
    await prepararUsuario(xp, cred, ana);
    await prepararUsuario(xp, cred, luis);

    await cred.write.claimCredential([1n], { account: ana.account });
    await cred.write.claimCredential([1n], { account: luis.account });

    assert.equal(
      getAddress(await cred.read.ownerOf([1n])),
      getAddress(ana.account.address),
    );
    assert.equal(
      getAddress(await cred.read.ownerOf([2n])),
      getAddress(luis.account.address),
    );
    assert.equal(await cred.read.tokenPath([2n]), 1n);
  });

  // ---------------------------------------------------------------------
  // claimCredential: casos de ataque
  // ---------------------------------------------------------------------

  it("rechaza un path que no existe", async function () {
    const { xp, cred } = await deployTodo();
    await prepararUsuario(xp, cred, ana);

    await viem.assertions.revertWithCustomError(
      cred.write.claimCredential([999n], { account: ana.account }),
      cred,
      "UnknownPath",
    );
  });

  it("rechaza si falta una actividad y no quema nada", async function () {
    const { xp, cred } = await deployTodo();
    await prepararUsuario(xp, cred, ana, [101n, 102n]); // falta la 103

    await viem.assertions.revertWithCustomError(
      cred.write.claimCredential([1n], { account: ana.account }),
      cred,
      "PathIncomplete",
    );

    // Todo quedó como estaba
    assert.equal(await cred.read.balanceOf([ana.account.address]), 0n);
    assert.equal(await cred.read.credentialId([ana.account.address, 1n]), 0n);
    assert.equal(await xp.read.balanceOf([ana.account.address]), 2n * DIEZ_MXP);
  });

  it("las actividades de otra persona no cuentan", async function () {
    const { xp, cred } = await deployTodo();
    await prepararUsuario(xp, cred, ana); // Ana completó todo
    // Luis no completó nada, aunque aprobó
    await xp.write.approve([cred.address, BURN_COST], {
      account: luis.account,
    });

    await viem.assertions.revertWithCustomError(
      cred.write.claimCredential([1n], { account: luis.account }),
      cred,
      "PathIncomplete",
    );
  });

  it("rechaza si no hizo approve", async function () {
    const { xp, cred } = await deployTodo();
    await completar(xp, ana, PATH_1); // completó, pero sin approve

    await assert.rejects(
      cred.write.claimCredential([1n], { account: ana.account }),
    );

    // No hay credencial y los MXP siguen intactos
    assert.equal(await cred.read.balanceOf([ana.account.address]), 0n);
    assert.equal(await cred.read.credentialId([ana.account.address, 1n]), 0n);
    assert.equal(await xp.read.balanceOf([ana.account.address]), 3n * DIEZ_MXP);
  });

  it("rechaza si el approve es menor al costo", async function () {
    const { xp, cred } = await deployTodo();
    await completar(xp, ana, PATH_1);
    await xp.write.approve([cred.address, BURN_COST - 1n], {
      account: ana.account,
    });

    await assert.rejects(
      cred.write.claimCredential([1n], { account: ana.account }),
    );
    assert.equal(await cred.read.balanceOf([ana.account.address]), 0n);
  });

  it("rechaza si no tiene saldo suficiente de MXP", async function () {
    const { xp, cred } = await deployTodo();
    await prepararUsuario(xp, cred, ana); // 30 MXP + approve de 20

    // Ana quema 15 MXP por su cuenta: le quedan 15, menos que el costo
    await xp.write.burn([15n * UN_MXP], { account: ana.account });

    await assert.rejects(
      cred.write.claimCredential([1n], { account: ana.account }),
    );
    assert.equal(await cred.read.balanceOf([ana.account.address]), 0n);
    assert.equal(await xp.read.balanceOf([ana.account.address]), 15n * UN_MXP);
  });

  it("no se puede reclamar dos veces el mismo path", async function () {
    const { xp, cred } = await deployTodo();
    await prepararUsuario(xp, cred, ana);
    await cred.write.claimCredential([1n], { account: ana.account });

    // Ana todavía tiene 10 MXP; vuelve a aprobar e intenta de nuevo
    await xp.write.approve([cred.address, BURN_COST], { account: ana.account });

    await viem.assertions.revertWithCustomError(
      cred.write.claimCredential([1n], { account: ana.account }),
      cred,
      "AlreadyHasCredential",
    );
    assert.equal(await cred.read.balanceOf([ana.account.address]), 1n);
  });

  // ---------------------------------------------------------------------
  // Soulbound (no transferible)
  // ---------------------------------------------------------------------

  async function anaConCredencial() {
    const { xp, cred } = await deployTodo();
    await prepararUsuario(xp, cred, ana);
    await cred.write.claimCredential([1n], { account: ana.account });
    return { xp, cred };
  }

  it("transferFrom está bloqueado", async function () {
    const { cred } = await anaConCredencial();

    await viem.assertions.revertWithCustomError(
      cred.write.transferFrom(
        [ana.account.address, luis.account.address, 1n],
        { account: ana.account },
      ),
      cred,
      "Soulbound",
    );

    // Sigue siendo de Ana
    assert.equal(
      getAddress(await cred.read.ownerOf([1n])),
      getAddress(ana.account.address),
    );
  });

  it("safeTransferFrom está bloqueado", async function () {
    const { cred } = await anaConCredencial();

    await viem.assertions.revertWithCustomError(
      cred.write.safeTransferFrom(
        [ana.account.address, luis.account.address, 1n],
        { account: ana.account },
      ),
      cred,
      "Soulbound",
    );
  });

  it("aunque Ana apruebe a otro, la transferencia sigue bloqueada", async function () {
    const { cred } = await anaConCredencial();

    await cred.write.approve([otro.account.address, 1n], {
      account: ana.account,
    });

    await viem.assertions.revertWithCustomError(
      cred.write.transferFrom(
        [ana.account.address, otro.account.address, 1n],
        { account: otro.account },
      ),
      cred,
      "Soulbound",
    );
  });

  // ---------------------------------------------------------------------
  // ERC-5192 y metadatos
  // ---------------------------------------------------------------------

  it("locked devuelve true para una credencial emitida", async function () {
    const { cred } = await anaConCredencial();
    assert.equal(await cred.read.locked([1n]), true);
  });

  it("locked revierte para una credencial que no existe", async function () {
    const { cred } = await anaConCredencial();
    await assert.rejects(cred.read.locked([999n]));
  });

  it("supportsInterface reconoce ERC-5192, ERC-721 y ERC-165", async function () {
    const { cred } = await deployTodo();

    assert.equal(await cred.read.supportsInterface(["0xb45a3c0e"]), true); // ERC-5192
    assert.equal(await cred.read.supportsInterface(["0x80ac58cd"]), true); // ERC-721
    assert.equal(await cred.read.supportsInterface(["0x01ffc9a7"]), true); // ERC-165
    assert.equal(await cred.read.supportsInterface(["0xffffffff"]), false); // inválido
  });

  it("tokenURI usa el baseURI seguido del tokenId", async function () {
    const { cred } = await anaConCredencial();
    assert.equal(await cred.read.tokenURI([1n]), BASE_URI + "1");
  });

  it("el owner cambia el baseURI y un no-owner no puede", async function () {
    const { cred } = await anaConCredencial();
    const nuevo = "https://otro.example/meta/";

    await viem.assertions.revertWithCustomError(
      cred.write.setBaseURI([nuevo], { account: ana.account }),
      cred,
      "OwnableUnauthorizedAccount",
    );

    await cred.write.setBaseURI([nuevo], { account: owner.account });
    assert.equal(await cred.read.tokenURI([1n]), nuevo + "1");
  });

  // ---------------------------------------------------------------------
  // credentialId (usuario, path) -> tokenId
  // ---------------------------------------------------------------------

  it("credentialId distingue usuarios y paths, y devuelve 0 si no hay credencial", async function () {
    const { xp, cred } = await deployTodo();
    await cred.write.createPath([2n, [201n, 202n]], { account: owner.account });

    // Ana completa los dos paths (50 MXP) y aprueba 40 (dos credenciales)
    await completar(xp, ana, [...PATH_1, 201n, 202n]);
    await xp.write.approve([cred.address, 2n * BURN_COST], {
      account: ana.account,
    });

    await cred.write.claimCredential([1n], { account: ana.account }); // tokenId 1
    await cred.write.claimCredential([2n], { account: ana.account }); // tokenId 2

    assert.equal(await cred.read.credentialId([ana.account.address, 1n]), 1n);
    assert.equal(await cred.read.credentialId([ana.account.address, 2n]), 2n);
    // Luis nunca reclamó nada: no da error, devuelve 0
    assert.equal(await cred.read.credentialId([luis.account.address, 1n]), 0n);
    // Y cada credencial sabe de qué path es
    assert.equal(await cred.read.tokenPath([1n]), 1n);
    assert.equal(await cred.read.tokenPath([2n]), 2n);
  });

  // ---------------------------------------------------------------------
  // Revocación (registro: no borra ni quema el NFT)
  // ---------------------------------------------------------------------

  it("una credencial recién emitida es válida y no está revocada", async function () {
    const { cred } = await anaConCredencial();

    assert.equal(await cred.read.isValid([1n]), true);

    const [revocada, fecha, motivo] = await cred.read.revocationOf([1n]);
    assert.equal(revocada, false);
    assert.equal(fecha, 0n);
    assert.equal(motivo, "");
  });

  it("el owner revoca: guarda fecha y motivo, y emite el evento", async function () {
    const { cred } = await anaConCredencial();

    await viem.assertions.emitWithArgs(
      cred.write.revoke([1n, "Fraude comprobado"], { account: owner.account }),
      cred,
      "CredentialRevoked",
      [1n, "Fraude comprobado"],
    );

    assert.equal(await cred.read.isValid([1n]), false);

    const [revocada, fecha, motivo] = await cred.read.revocationOf([1n]);
    assert.equal(revocada, true);
    assert.equal(fecha, await ahora()); // el último bloque es el de la revocación
    assert.equal(motivo, "Fraude comprobado");
  });

  it("revocar NO borra ni mueve la credencial", async function () {
    const { xp, cred } = await anaConCredencial();
    const saldoAntes = await xp.read.balanceOf([ana.account.address]);

    await cred.write.revoke([1n, "Motivo"], { account: owner.account });

    // Sigue existiendo y sigue siendo de Ana
    assert.equal(
      getAddress(await cred.read.ownerOf([1n])),
      getAddress(ana.account.address),
    );
    assert.equal(await cred.read.balanceOf([ana.account.address]), 1n);
    assert.equal(await cred.read.credentialId([ana.account.address, 1n]), 1n);
    assert.equal(await cred.read.locked([1n]), true);

    // No se devuelven los MXP quemados
    assert.equal(await xp.read.balanceOf([ana.account.address]), saldoAntes);
  });

  it("una credencial revocada sigue sin poder transferirse ni reclamarse de nuevo", async function () {
    const { xp, cred } = await anaConCredencial();
    await cred.write.revoke([1n, "Motivo"], { account: owner.account });

    await viem.assertions.revertWithCustomError(
      cred.write.transferFrom(
        [ana.account.address, luis.account.address, 1n],
        { account: ana.account },
      ),
      cred,
      "Soulbound",
    );

    // Revocar no libera el path: Ana no puede reclamarlo otra vez
    await xp.write.approve([cred.address, BURN_COST], { account: ana.account });
    await viem.assertions.revertWithCustomError(
      cred.write.claimCredential([1n], { account: ana.account }),
      cred,
      "AlreadyHasCredential",
    );
  });

  it("solo el owner puede revocar", async function () {
    const { cred } = await anaConCredencial();

    await viem.assertions.revertWithCustomError(
      cred.write.revoke([1n, "Intento"], { account: ana.account }),
      cred,
      "OwnableUnauthorizedAccount",
    );

    // Sigue válida
    assert.equal(await cred.read.isValid([1n]), true);
  });

  it("no se puede revocar dos veces la misma credencial", async function () {
    const { cred } = await anaConCredencial();
    await cred.write.revoke([1n, "Primera"], { account: owner.account });

    await viem.assertions.revertWithCustomError(
      cred.write.revoke([1n, "Segunda"], { account: owner.account }),
      cred,
      "AlreadyRevoked",
    );

    // Se conserva el motivo original
    const [, , motivo] = await cred.read.revocationOf([1n]);
    assert.equal(motivo, "Primera");
  });

  it("no se puede revocar una credencial que no existe", async function () {
    const { cred } = await anaConCredencial();

    await assert.rejects(
      cred.write.revoke([999n, "No existe"], { account: owner.account }),
    );
  });

  it("isValid devuelve false y revocationOf no revierte con un token inexistente", async function () {
    const { cred } = await anaConCredencial();

    assert.equal(await cred.read.isValid([999n]), false);

    const [revocada, fecha, motivo] = await cred.read.revocationOf([999n]);
    assert.equal(revocada, false);
    assert.equal(fecha, 0n);
    assert.equal(motivo, "");
  });

  it("revocar una credencial no afecta a las demás", async function () {
    const { xp, cred } = await deployTodo();
    await prepararUsuario(xp, cred, ana);
    await prepararUsuario(xp, cred, luis);
    await cred.write.claimCredential([1n], { account: ana.account }); // tokenId 1
    await cred.write.claimCredential([1n], { account: luis.account }); // tokenId 2

    await cred.write.revoke([1n, "Motivo"], { account: owner.account });

    assert.equal(await cred.read.isValid([1n]), false);
    assert.equal(await cred.read.isValid([2n]), true); // la de Luis sigue válida
  });

  // ---------------------------------------------------------------------
  // Integración: recorrido completo de punta a punta
  // ---------------------------------------------------------------------

  it("recorrido completo: de cero MXP a la credencial, sin que sobre ni falte nada", async function () {
    const { xp, cred } = await deployTodo();

    // Un path de 2 actividades = 20 MXP = exactamente el costo
    await cred.write.createPath([2n, [201n, 202n]], { account: owner.account });

    // 1. Ana empieza sin nada
    assert.equal(await xp.read.balanceOf([ana.account.address]), 0n);
    assert.equal(await xp.read.totalSupply(), 0n);

    // 2. Completa las dos actividades: gana 20 MXP
    await completar(xp, ana, [201n, 202n]);
    assert.equal(await xp.read.balanceOf([ana.account.address]), 2n * DIEZ_MXP);
    assert.equal(await xp.read.claimed([ana.account.address, 201n]), true);
    assert.equal(await xp.read.claimed([ana.account.address, 202n]), true);

    // 3. Aprueba y reclama la credencial
    await xp.write.approve([cred.address, BURN_COST], { account: ana.account });
    await cred.write.claimCredential([2n], { account: ana.account });

    // 4. Resultado: credencial emitida, MXP en 0 y total en 0 (se quemó todo)
    assert.equal(
      getAddress(await cred.read.ownerOf([1n])),
      getAddress(ana.account.address),
    );
    assert.equal(await cred.read.tokenPath([1n]), 2n);
    assert.equal(await xp.read.balanceOf([ana.account.address]), 0n);
    assert.equal(await xp.read.totalSupply(), 0n);

    // 5. Ni los MXP ni la credencial se pueden mover
    await assert.rejects(
      xp.write.transfer([luis.account.address, 1n], { account: ana.account }),
    );
    await assert.rejects(
      cred.write.transferFrom(
        [ana.account.address, luis.account.address, 1n],
        { account: ana.account },
      ),
    );
  });
});