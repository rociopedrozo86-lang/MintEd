// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24; // para openzeppelin

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";


/// @title MintXP (MXP)
/// @notice Token ERC-20 que se acuña al completar actividades educativas.
/// @dev La emisión NO es libre: Se validan con una firma EIP-712 del backend (claimSigner).
contract MintXP is ERC20, ERC20Burnable, EIP712, Ownable {

    /// @notice Máximo de MXP por claim (100 MXP, con 18 decimales). Este límite está FIJO, no cambia -> constant.
    uint256 public constant MAX_CLAIM = 100e18;

    // Este es el hex de la plantilla que usa el backend para el claim
    bytes32 private constant CLAIM_TYPEHASH =
        keccak256("Claim(address user,uint256 activityId,uint256 amount,uint256 deadline)");

    /// @notice Dirección del backend (autorizado a firmar los claims).
    address public claimSigner;

    /// @notice Dict[dict[int_actividad: bool]]
    /// claimed[usuario][actividad] == true si ya reclamó esa actividad.
    ///         Esto es un registro para MintCredential.
    mapping(address => mapping(uint256 => bool)) public claimed;

    // ---------------------------------------------------------------------
    // Eventos: definidos con emit (XPClaimed y ClaimSignerUpdated)
    // Errores: definidos con condiciones, al fallar se revierte la transacción
    // y se muestra el nombre del error (nivel código).
    // ---------------------------------------------------------------------

    event XPClaimed(address indexed user, uint256 indexed activityId, uint256 amount);
    event ClaimSignerUpdated(address indexed oldSigner, address indexed newSigner);

    error InvalidSigner();
    error InvalidAmount();
    error SignatureExpired();
    error AlreadyClaimed();
    error ZeroAddress();
    error NonTransferable();

    // ---------------------------------------------------------------------
    // Constructor: se ejecuta una vez, al desplegarse el contrato
    // ---------------------------------------------------------------------

    /// @param initialOwner Wallet del equipo, es quien actualiza la wallet del firmante (backend).
    /// @param initialSigner Dirección del backend que firma los claims (firmante).
    constructor(address initialOwner, address initialSigner)
        ERC20("MintXP", "MXP")
        EIP712("MintXP", "1")
        Ownable(initialOwner)
    {
        if (initialSigner == address(0)) revert ZeroAddress(); // error: firmante vacío
        claimSigner = initialSigner;
        emit ClaimSignerUpdated(address(0), initialSigner); // evento: hay firmante!!
    }

    // ---------------------------------------------------------------------
    // Claim: para reclamar tokens
    // ---------------------------------------------------------------------

    /// @notice Reclama MXP por una actividad completada.
    /// @param activityId Identificador de la actividad.
    /// @param amount     Cantidad de MXP (en unidades de 18 decimales).
    /// @param deadline   Timestamp (segundos) hasta el cual la firma es válida (inclusivo).
    /// @param signature  Firma EIP-712 del backend (claimSigner) sobre Claim(user, activityId, amount, deadline).
    function claimXP(
        uint256 activityId,
        uint256 amount,
        uint256 deadline,
        bytes calldata signature // solo lectura
    ) external {
        if (block.timestamp > deadline) revert SignatureExpired(); // error: la firma se pasó de tiempo (expiró).
        if (amount == 0 || amount > MAX_CLAIM) revert InvalidAmount(); // error: se pide un monto inválido.
        if (claimed[msg.sender][activityId]) revert AlreadyClaimed(); // error: ya había reclamado tokens por esta actividad.

        // digest: (signatura + datos usuario + dominio) en hex
        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(CLAIM_TYPEHASH, msg.sender, activityId, amount, deadline))
        );

        address signer = ECDSA.recover(digest, signature); // quién firmó el digest
        if (signer != claimSigner) revert InvalidSigner(); // error: el firmante no es el backend

        claimed[msg.sender][activityId] = true; // Diccionario: marcamos la actividad como reclamada.
        _mint(msg.sender, amount); // acuñamos token

        emit XPClaimed(msg.sender, activityId, amount); // evento: se emitió token!!
    }

    // ---------------------------------------------------------------------
    // Administración: el owner cambia la wallet del firmante (backend).
    // ---------------------------------------------------------------------

    /// @notice Actualiza el firmante -> Las firmas del firmante anterior dejan de valer.
    /// sólo puede usarla el owner.
    function setClaimSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert ZeroAddress(); // error: dirección de firmante inválida.
        address old = claimSigner;
        claimSigner = newSigner;
        emit ClaimSignerUpdated(old, newSigner); // evento: hay nueva firma backend!!!
    }

    // ---------------------------------------------------------------------
    // Override: Redefinimos la función _update de nuestro ERC20 heredado -> decidimos transferencia de tokens
    // ---------------------------------------------------------------------
    
    function _update(address from, address to, uint256 value) internal override {
        // from address(0) a una dir es mint, de una dir a un address(0) es burn
        if (from != address(0) && to != address(0)) revert NonTransferable(); // error: MintXP no transferible.
        super._update(from, to, value); // openzeppelin ajusta balance y emite evento Transfer
    }
    
}
