// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

// importamos sólo las funciones que precisaremos del contrato MintXP
interface IMintXP {
    function claimed(address user, uint256 activityId) external view returns (bool); // claimed es variable público -> tenemos función
    function burnFrom(address account, uint256 value) external;
}

/// @title MintCredential
/// @notice Credencial educativa no transferible, compatible con ERC-5192 (más que un ERC721).
/// @dev Para reclamarla es necesario que: 
///      (1) En el registro claimed (de MintXP) figuren todas las actividades del curso de la credencial completadas.
///          En el mismo registro, no debe haber ya reclamado la credencial antes.
///      (2) El usuario debió haber hecho un `approve` antes para quemar (pagar) el costo de la credencial en MXP.
contract MintCredential is ERC721, Ownable {
    IMintXP public immutable mxp; // alias para usar las funciones de MintXP

    /// @notice Costo de la credencial. Es inmutable.
    uint256 public immutable burnCost;

    /// @notice Máximo de actividades  por curso. Es inmutable.
    uint256 public constant MAX_ACTIVITIES_PER_PATH = 32; // %%%
	
	/// @notice como son token NFT, tienen identificador (un número)
    uint256 private _nextTokenId = 1; // comenzamos en 1
    string private _baseTokenURI; // para buscar el JSON del token

    // ---------------------------------------------------------------------
    // Registros (son diccionarios)
    // ---------------------------------------------------------------------

    // los cursos se identifican con un número
    mapping(uint256 => bool) public pathExists; // ¿existe tal curso? true false
    mapping(uint256 => uint256[]) private _pathActivities; // lista de actividades de un curso específico
    mapping(address => mapping(uint256 => bool)) public hasCredential; // ¿este usuario reclamó la cred de este curso? true false
    mapping(uint256 => uint256) public tokenPath; // cada tokenId (número de token) se asocia al curso completado

    // ---------------------------------------------------------------------
    // Eventos: se lanzan con emit (excepto unlocked que sólo lo conservamos para cumplir con ERC-5192)
    // Errores: hay condiciones, y al fallar se revierte la transacción
    // y se muestra el nombre del error (a nivel código).
    // ---------------------------------------------------------------------

    event PathCreated(uint256 indexed pathId, uint256[] activityIds);
    event CredentialClaimed(address indexed user, uint256 indexed pathId, uint256 tokenId);
    /// @dev ERC-5192
    event Locked(uint256 tokenId);
    event Unlocked(uint256 tokenId);

    error ZeroAddress();
    error InvalidBurnCost();
    error UnknownPath(uint256 pathId);
    error PathAlreadyExists(uint256 pathId);
    error InvalidPath();
    error PathIncomplete(uint256 missingActivityId);
    error AlreadyHasCredential();
    error Soulbound();

    // ---------------------------------------------------------------------
    // Constructor: se ejecuta una vez, al desplegarse el contrato
    // ---------------------------------------------------------------------

    /// @param mxp_ dirección del contrato MintXP
    constructor(address initialOwner, address mxp_, uint256 burnCost_, string memory baseURI_) ERC721("MintMind Credential", "MMC") Ownable(initialOwner) {
        if (mxp_ == address(0)) revert ZeroAddress(); // error: contrato vacío
        if (burnCost_ == 0) revert InvalidBurnCost(); // error: credencial gratis
        mxp = IMintXP(mxp_); // CASTEO: contrato de dirección mxp_ con la interfaz de arriba (funciones claimed y burnFrom)
        burnCost = burnCost_;
        _baseTokenURI = baseURI_;
    }

    // ---------------------------------------------------------------------
    // Funciones
    // ---------------------------------------------------------------------

    /// @notice Define un learning path (lista de actividades requeridas).
    /// @dev Un path no se puede modificar una vez creado: los requisitos no cambian a mitad de camino.
    /// @param activityIds es una lista de sólo lectura (luego no se modifica).
    function createPath(uint256 pathId, uint256[] calldata activityIds) external onlyOwner {
        if (pathExists[pathId]) revert PathAlreadyExists(pathId); // error: el curso ya existe en el registro pathExists
        if (activityIds.length == 0 || activityIds.length > MAX_ACTIVITIES_PER_PATH) revert InvalidPath(); // error: curso inválido (por longitud de actividades)
        
        // definimos el curso
        pathExists[pathId] = true; // ahora el curso existe
        _pathActivities[pathId] = activityIds; // colocamos sus actividades
        emit PathCreated(pathId, activityIds); // evento: nuevo curso!!
    }


    /// @notice Permite la lectura pública del registro _pathActivities
    function getPathActivities(uint256 pathId) external view returns (uint256[] memory) {
        return _pathActivities[pathId]; // usamos el registro _pathActivities para obtener las actividades
    }


    /// @notice Permite a los usuarios reclamar su credencial
    /// @param pathId es el número del curso
    function claimCredential(uint256 pathId) external {
        if (!pathExists[pathId]) revert UnknownPath(pathId); // error: el curso no existe
        if (hasCredential[msg.sender][pathId]) revert AlreadyHasCredential(); // error: el usuario ya reclamó esta credencial

        uint256[] storage ids = _pathActivities[pathId]; // referencia a la lista de actividades del curso
        uint256 len = ids.length; // len = cantidad de actividades del curso
        // la variable xp tiene el contrato MXP con funciones claimed y burnFrom
        for (uint256 i = 0; i < len; i++) {
            if (!mxp.claimed(msg.sender, ids[i])) revert PathIncomplete(ids[i]); // error: al usuario le faltó hacer claimXP a la actividad i del curso
        }

        // se realiza entonces la asignación de la credencial
        hasCredential[msg.sender][pathId] = true; // en el registro anotamos que el usuario reclamó la credencial de este curso
        uint256 tokenId = _nextTokenId++; // ahora: tokenId = _nextTokenId y también _nextTokenId aumenta en 1
        tokenPath[tokenId] = pathId; // el token del usuario queda relacionado al número de curso

        mxp.burnFrom(msg.sender, burnCost); // se queman los mxp del usuario

        _mint(msg.sender, tokenId); // herencia de ERC721: acuñamos credencial

        emit CredentialClaimed(msg.sender, pathId, tokenId); // evento: se reclamó una credencial!!
        emit Locked(tokenId); // evento: la credencial es intransferible!!
    }

    // ---------------------------------------------------------------------
    // Override: Redefinimos la función _update de nuestro ERC721 heredado -> decidimos transferencia de tokens
    // ---------------------------------------------------------------------

    // retornamos el dueño anterior del token (por ERC721 heredado)
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        if (_ownerOf(tokenId) != address(0)) revert Soulbound(); // error: dirección no vacía, el token ya fue acuñado por otro
            //mint
            return super._update(to, tokenId, auth); // openzeppelin anota el dueño del token, le suma que tiene un token más y dispara el evento Transfere
    }


    // ---------------------------------------------------------------------
    // Locked y supportsInterface: funciones para cumplir el estándar ERC-5192 (NFT)
    // ---------------------------------------------------------------------

    function locked(uint256 tokenId) external view returns (bool) {
        _requireOwned(tokenId);
        return true;
    }

    // consulta de interface: eips.ethereum.org/EIPS/eip-5192
    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return interfaceId == 0xb45a3c0e || super.supportsInterface(interfaceId);
    }


    // ---------------------------------------------------------------------
    // setBaseURI y _baseURI: Para agregar metadatos al token (NFT)
    // ---------------------------------------------------------------------

    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        _baseTokenURI = newBaseURI;
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }
}
