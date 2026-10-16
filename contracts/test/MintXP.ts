import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getAddress } from "viem";
import { network } from "hardhat";

describe("MintXP", async function () { // agrupo tests de MintXP
  const { viem } = await network.create(); // podemos llamar al contrato
  const publicClient = await viem.getPublicClient(); // leemos info de la testnet: eventos, etc

  // Cuentas de prueba que da Hardhat
  const [owner, signer, ana, luis, otro] = await viem.getWalletClients();

  const MAX_CLAIM = 100n * 10n ** 18n; // 100 MXP (18 decimales)
  const DIEZ_MXP = 10n * 10n ** 18n;

  // ---------------------------------------------------------------------
  // Ayudas (no son tests, son herramientas para los tests)
  // ---------------------------------------------------------------------

  /** Despliega un MintXP nuevo: owner = owner, firmante = signer. */
  async function deploy() {
    return viem.deployContract("MintXP", [
      owner.account.address,
      signer.account.address,
    ]);
  }

  /** Timestamp (segundos) del último bloque. */
  async function ahora() {
    const block = await publicClient.getBlock();
    return block.timestamp;
  }

  /**
   * Firma un Claim EIP-712 como si fuera el backend.
   */
  async function firmarClaim(params: {
    firmante: typeof signer;
    contrato: Awaited<ReturnType<typeof deploy>>;
    usuario: `0x${string}`;
    activityId: bigint;
    amount: bigint;
    deadline: bigint;
  }) {
    const chainId = await publicClient.getChainId();
    return params.firmante.signTypedData({
      account: params.firmante.account,
      domain: {
        name: "MintXP",
        version: "1",
        chainId,
        verifyingContract: params.contrato.address,
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
      message: {
        user: params.usuario,
        activityId: params.activityId,
        amount: params.amount,
        deadline: params.deadline,
      },
    });
  }

  // ---------------------------------------------------------------------
  // Despliegue
  // ---------------------------------------------------------------------

  it("arranca con la configuración correcta y 0 tokens", async function () {
    const mintXP = await deploy();

    assert.equal(await mintXP.read.name(), "MintXP");
    assert.equal(await mintXP.read.symbol(), "MXP");
    assert.equal(await mintXP.read.totalSupply(), 0n);
    assert.equal(await mintXP.read.MAX_CLAIM(), MAX_CLAIM);
    assert.equal(
      getAddress(await mintXP.read.owner()),
      getAddress(owner.account.address),
    );
    assert.equal(
      getAddress(await mintXP.read.claimSigner()),
      getAddress(signer.account.address),
    );
  });

  it("rechaza desplegar con firmante vacío", async function () {
    await assert.rejects(
      viem.deployContract("MintXP", [
        owner.account.address,
        "0x0000000000000000000000000000000000000000",
      ]),
    );
  });

  // ---------------------------------------------------------------------
  // claimXP: camino feliz
  // ---------------------------------------------------------------------

  it("claimXP con firma válida acuña los MXP y marca la actividad", async function () {
    const mintXP = await deploy();
    const deadline = (await ahora()) + 3600n;

    const firma = await firmarClaim({
      firmante: signer,
      contrato: mintXP,
      usuario: ana.account.address,
      activityId: 1n,
      amount: DIEZ_MXP,
      deadline,
    });

    await viem.assertions.emitWithArgs(
      mintXP.write.claimXP([1n, DIEZ_MXP, deadline, firma], {
        account: ana.account,
      }),
      mintXP,
      "XPClaimed",
      [getAddress(ana.account.address), 1n, DIEZ_MXP],
    );

    // Estado: saldo, registro y total
    assert.equal(await mintXP.read.balanceOf([ana.account.address]), DIEZ_MXP);
    assert.equal(await mintXP.read.claimed([ana.account.address, 1n]), true);
    assert.equal(await mintXP.read.totalSupply(), DIEZ_MXP);
  });

  // ---------------------------------------------------------------------
  // claimXP: casos de ataque
  // ---------------------------------------------------------------------

  it("rechaza el doble claim del mismo par (usuario, actividad)", async function () {
    const mintXP = await deploy();
    const deadline = (await ahora()) + 3600n;
    const firma = await firmarClaim({
      firmante: signer,
      contrato: mintXP,
      usuario: ana.account.address,
      activityId: 1n,
      amount: DIEZ_MXP,
      deadline,
    });

    await mintXP.write.claimXP([1n, DIEZ_MXP, deadline, firma], {
      account: ana.account,
    });

    await viem.assertions.revertWithCustomError(
      mintXP.write.claimXP([1n, DIEZ_MXP, deadline, firma], {
        account: ana.account,
      }),
      mintXP,
      "AlreadyClaimed",
    );

    // El saldo NO subió una segunda vez
    assert.equal(await mintXP.read.balanceOf([ana.account.address]), DIEZ_MXP);
  });

  it("rechaza una firma vencida", async function () {
    const mintXP = await deploy();
    const deadline = (await ahora()) - 1n; // ya pasó
    const firma = await firmarClaim({
      firmante: signer,
      contrato: mintXP,
      usuario: ana.account.address,
      activityId: 1n,
      amount: DIEZ_MXP,
      deadline,
    });

    await viem.assertions.revertWithCustomError(
      mintXP.write.claimXP([1n, DIEZ_MXP, deadline, firma], {
        account: ana.account,
      }),
      mintXP,
      "SignatureExpired",
    );
  });

  it("rechaza monto 0", async function () {
    const mintXP = await deploy();
    const deadline = (await ahora()) + 3600n;
    const firma = await firmarClaim({
      firmante: signer,
      contrato: mintXP,
      usuario: ana.account.address,
      activityId: 1n,
      amount: 0n,
      deadline,
    });

    await viem.assertions.revertWithCustomError(
      mintXP.write.claimXP([1n, 0n, deadline, firma], { account: ana.account }),
      mintXP,
      "InvalidAmount",
    );
  });

  it("rechaza un monto mayor que MAX_CLAIM, aunque esté bien firmado", async function () {
    const mintXP = await deploy();
    const deadline = (await ahora()) + 3600n;
    const demasiado = MAX_CLAIM + 1n;
    const firma = await firmarClaim({
      firmante: signer,
      contrato: mintXP,
      usuario: ana.account.address,
      activityId: 1n,
      amount: demasiado,
      deadline,
    });

    await viem.assertions.revertWithCustomError(
      mintXP.write.claimXP([1n, demasiado, deadline, firma], {
        account: ana.account,
      }),
      mintXP,
      "InvalidAmount",
    );
  });

  it("acepta exactamente MAX_CLAIM", async function () {
    const mintXP = await deploy();
    const deadline = (await ahora()) + 3600n;
    const firma = await firmarClaim({
      firmante: signer,
      contrato: mintXP,
      usuario: ana.account.address,
      activityId: 1n,
      amount: MAX_CLAIM,
      deadline,
    });

    await mintXP.write.claimXP([1n, MAX_CLAIM, deadline, firma], {
      account: ana.account,
    });
    assert.equal(await mintXP.read.balanceOf([ana.account.address]), MAX_CLAIM);
  });

  it("rechaza una firma hecha por alguien que no es el firmante", async function () {
    const mintXP = await deploy();
    const deadline = (await ahora()) + 3600n;
    const firma = await firmarClaim({
      firmante: otro, // NO es el claimSigner
      contrato: mintXP,
      usuario: ana.account.address,
      activityId: 1n,
      amount: DIEZ_MXP,
      deadline,
    });

    await viem.assertions.revertWithCustomError(
      mintXP.write.claimXP([1n, DIEZ_MXP, deadline, firma], {
        account: ana.account,
      }),
      mintXP,
      "InvalidSigner",
    );
  });

  it("rechaza si Ana altera el monto firmado", async function () {
    const mintXP = await deploy();
    const deadline = (await ahora()) + 3600n;
    const firma = await firmarClaim({
      firmante: signer,
      contrato: mintXP,
      usuario: ana.account.address,
      activityId: 1n,
      amount: DIEZ_MXP, // se firmó 10...
      deadline,
    });

    await viem.assertions.revertWithCustomError(
      mintXP.write.claimXP([1n, 2n * DIEZ_MXP, deadline, firma], {
        // ...pero Ana pide 20
        account: ana.account,
      }),
      mintXP,
      "InvalidSigner",
    );
  });

  it("rechaza si Ana altera la actividad firmada", async function () {
    const mintXP = await deploy();
    const deadline = (await ahora()) + 3600n;
    const firma = await firmarClaim({
      firmante: signer,
      contrato: mintXP,
      usuario: ana.account.address,
      activityId: 1n,
      amount: DIEZ_MXP,
      deadline,
    });

    await viem.assertions.revertWithCustomError(
      mintXP.write.claimXP([2n, DIEZ_MXP, deadline, firma], {
        account: ana.account,
      }),
      mintXP,
      "InvalidSigner",
    );
  });

  it("la firma de Ana no sirve para Luis", async function () {
    const mintXP = await deploy();
    const deadline = (await ahora()) + 3600n;
    const firmaDeAna = await firmarClaim({
      firmante: signer,
      contrato: mintXP,
      usuario: ana.account.address,
      activityId: 1n,
      amount: DIEZ_MXP,
      deadline,
    });

    await viem.assertions.revertWithCustomError(
      mintXP.write.claimXP([1n, DIEZ_MXP, deadline, firmaDeAna], {
        account: luis.account, // Luis intenta usar la firma de Ana
      }),
      mintXP,
      "InvalidSigner",
    );
  });

  it("la firma hecha para un contrato no sirve en otro", async function () {
    const mintXP = await deploy();
    const otroMintXP = await deploy(); // otra dirección = otro dominio
    const deadline = (await ahora()) + 3600n;
    const firma = await firmarClaim({
      firmante: signer,
      contrato: otroMintXP,
      usuario: ana.account.address,
      activityId: 1n,
      amount: DIEZ_MXP,
      deadline,
    });

    await viem.assertions.revertWithCustomError(
      mintXP.write.claimXP([1n, DIEZ_MXP, deadline, firma], {
        account: ana.account,
      }),
      mintXP,
      "InvalidSigner",
    );
  });

  it("rechaza una firma mal formada", async function () {
    const mintXP = await deploy();
    const deadline = (await ahora()) + 3600n;

    // Falla dentro de ECDSA (OpenZeppelin), con otro error distinto a InvalidSigner
    await assert.rejects(
      mintXP.write.claimXP([1n, DIEZ_MXP, deadline, "0x1234"], {
        account: ana.account,
      }),
    );
  });

  // ---------------------------------------------------------------------
  // Rotación del firmante
  // ---------------------------------------------------------------------

  it("el owner rota el firmante y se emite ClaimSignerUpdated", async function () {
    const mintXP = await deploy();

    await viem.assertions.emitWithArgs(
      mintXP.write.setClaimSigner([otro.account.address], {
        account: owner.account,
      }),
      mintXP,
      "ClaimSignerUpdated",
      [getAddress(signer.account.address), getAddress(otro.account.address)],
    );

    assert.equal(
      getAddress(await mintXP.read.claimSigner()),
      getAddress(otro.account.address),
    );
  });

  it("después de rotar, la firma del firmante viejo deja de valer", async function () {
    const mintXP = await deploy();
    const deadline = (await ahora()) + 3600n;
    const firmaVieja = await firmarClaim({
      firmante: signer, // firmante anterior
      contrato: mintXP,
      usuario: ana.account.address,
      activityId: 1n,
      amount: DIEZ_MXP,
      deadline,
    });

    await mintXP.write.setClaimSigner([otro.account.address], {
      account: owner.account,
    });

    await viem.assertions.revertWithCustomError(
      mintXP.write.claimXP([1n, DIEZ_MXP, deadline, firmaVieja], {
        account: ana.account,
      }),
      mintXP,
      "InvalidSigner",
    );
  });

  it("después de rotar, la firma del firmante nuevo sí vale", async function () {
    const mintXP = await deploy();
    await mintXP.write.setClaimSigner([otro.account.address], {
      account: owner.account,
    });

    const deadline = (await ahora()) + 3600n;
    const firmaNueva = await firmarClaim({
      firmante: otro, // firmante nuevo
      contrato: mintXP,
      usuario: ana.account.address,
      activityId: 1n,
      amount: DIEZ_MXP,
      deadline,
    });

    await mintXP.write.claimXP([1n, DIEZ_MXP, deadline, firmaNueva], {
      account: ana.account,
    });
    assert.equal(await mintXP.read.balanceOf([ana.account.address]), DIEZ_MXP);
  });

  it("solo el owner puede rotar el firmante", async function () {
    const mintXP = await deploy();

    await viem.assertions.revertWithCustomError(
      mintXP.write.setClaimSigner([otro.account.address], {
        account: ana.account, // Ana no es owner
      }),
      mintXP,
      "OwnableUnauthorizedAccount",
    );
  });

  it("no se puede rotar al firmante vacío", async function () {
    const mintXP = await deploy();

    await viem.assertions.revertWithCustomError(
      mintXP.write.setClaimSigner(
        ["0x0000000000000000000000000000000000000000"],
        { account: owner.account },
      ),
      mintXP,
      "ZeroAddress",
    );
  });

  // ---------------------------------------------------------------------
  // MXP no transferible
  // ---------------------------------------------------------------------

  /** Deja a Ana con 10 MXP, para probar transferencias y burns. */
  async function anaConXP(mintXP: Awaited<ReturnType<typeof deploy>>) {
    const deadline = (await ahora()) + 3600n;
    const firma = await firmarClaim({
      firmante: signer,
      contrato: mintXP,
      usuario: ana.account.address,
      activityId: 1n,
      amount: DIEZ_MXP,
      deadline,
    });
    await mintXP.write.claimXP([1n, DIEZ_MXP, deadline, firma], {
      account: ana.account,
    });
  }

  it("transfer está bloqueado", async function () {
    const mintXP = await deploy();
    await anaConXP(mintXP);

    await viem.assertions.revertWithCustomError(
      mintXP.write.transfer([luis.account.address, 1n], {
        account: ana.account,
      }),
      mintXP,
      "NonTransferable",
    );

    // Los saldos no cambiaron
    assert.equal(await mintXP.read.balanceOf([ana.account.address]), DIEZ_MXP);
    assert.equal(await mintXP.read.balanceOf([luis.account.address]), 0n);
  });

  it("transferFrom (con approve) también está bloqueado", async function () {
    const mintXP = await deploy();
    await anaConXP(mintXP);

    await mintXP.write.approve([luis.account.address, DIEZ_MXP], {
      account: ana.account,
    });

    await viem.assertions.revertWithCustomError(
      mintXP.write.transferFrom(
        [ana.account.address, luis.account.address, 1n],
        { account: luis.account },
      ),
      mintXP,
      "NonTransferable",
    );
  });

  // ---------------------------------------------------------------------
  // Burn (lo usa MintCredential)
  // ---------------------------------------------------------------------

  it("burn sigue funcionando y baja saldo y total", async function () {
    const mintXP = await deploy();
    await anaConXP(mintXP);

    await mintXP.write.burn([4n * 10n ** 18n], { account: ana.account });

    assert.equal(
      await mintXP.read.balanceOf([ana.account.address]),
      6n * 10n ** 18n,
    );
    assert.equal(await mintXP.read.totalSupply(), 6n * 10n ** 18n);
  });

  it("burnFrom funciona con approve y falla sin él", async function () {
    const mintXP = await deploy();
    await anaConXP(mintXP);

    // Sin approve: falla
    await assert.rejects(
      mintXP.write.burnFrom([ana.account.address, 5n * 10n ** 18n], {
        account: luis.account,
      }),
    );

    // Con approve: funciona
    await mintXP.write.approve([luis.account.address, 5n * 10n ** 18n], {
      account: ana.account,
    });
    await mintXP.write.burnFrom([ana.account.address, 5n * 10n ** 18n], {
      account: luis.account,
    });

    assert.equal(
      await mintXP.read.balanceOf([ana.account.address]),
      5n * 10n ** 18n,
    );
  });
});
