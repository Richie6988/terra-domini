// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TerritoryNFT — HEXOD Territory Ownership
 * @notice Each territory on the HEXOD map is a unique NFT.
 *         TokenId = uint256 representation of the H3 geospatial index.
 *         Carries on-chain metadata: biome, rarity, kingdom assignment.
 * @dev Royalty: 5% on secondary sales (2.5% treasury, 2.5% burned as HEX).
 */
contract TerritoryNFT is ERC721, ERC721Enumerable, ERC721Royalty, AccessControl, ReentrancyGuard {

    bytes32 public constant GAME_ENGINE_ROLE = keccak256("GAME_ENGINE_ROLE");

    // ── Territory Data ──────────────────────────────────────────
    struct Territory {
        bytes15 h3Index;        // H3 geospatial index (15 bytes)
        uint8 biome;            // 0-8 (urban/rural/forest/mountain/coastal/desert/tundra/industrial/landmark)
        uint8 rarity;           // 0-5 (common/uncommon/rare/epic/legendary/mythic)
        uint256 kingdomId;      // 0 = unassigned
        uint64 claimedAt;       // Block timestamp of first claim
        bool isLandmark;        // Special POI (Notre Dame, Pentagon, etc.)
    }

    mapping(uint256 => Territory) public territories;
    mapping(bytes15 => uint256) public h3ToTokenId;

    // Stats
    uint256 public totalClaimed;
    uint256 public totalLandmarks;

    // Biome names for metadata
    string[9] private _biomeNames = [
        "Urban", "Rural", "Forest", "Mountain", "Coastal",
        "Desert", "Tundra", "Industrial", "Landmark"
    ];

    string[6] private _rarityNames = [
        "Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic"
    ];

    // Events
    event TerritoryClaimed(uint256 indexed tokenId, address indexed owner, bytes15 h3Index, uint8 biome, uint8 rarity);
    event TerritoryTransferred(uint256 indexed tokenId, address indexed from, address indexed to);
    event KingdomAssigned(uint256 indexed tokenId, uint256 indexed kingdomId);

    string private _baseTokenURI;

    constructor(address treasury) ERC721("HEXOD Territory", "HEXT") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(GAME_ENGINE_ROLE, msg.sender);

        // 5% royalty to treasury on all secondary sales
        _setDefaultRoyalty(treasury, 500); // 500 = 5%
    }

    /**
     * @notice Claims a territory. Only callable by GameEngine.
     * @param to Player address.
     * @param h3Index H3 geospatial index.
     * @param biome Biome type (0-8).
     * @param rarity Rarity tier (0-5).
     * @param landmark Is this a landmark POI?
     * @return tokenId The minted NFT token ID.
     */
    function claimTerritory(
        address to,
        bytes15 h3Index,
        uint8 biome,
        uint8 rarity,
        bool landmark
    ) external onlyRole(GAME_ENGINE_ROLE) nonReentrant returns (uint256 tokenId) {
        require(h3ToTokenId[h3Index] == 0, "Territory: already claimed");
        require(biome <= 8, "Territory: invalid biome");
        require(rarity <= 5, "Territory: invalid rarity");

        tokenId = uint256(uint120(h3Index)); // Deterministic ID from H3
        require(!_ownerExists(tokenId), "Territory: token exists");

        territories[tokenId] = Territory({
            h3Index: h3Index,
            biome: biome,
            rarity: rarity,
            kingdomId: 0,
            claimedAt: uint64(block.timestamp),
            isLandmark: landmark
        });

        h3ToTokenId[h3Index] = tokenId;
        totalClaimed++;
        if (landmark) totalLandmarks++;

        _safeMint(to, tokenId);

        emit TerritoryClaimed(tokenId, to, h3Index, biome, rarity);
    }

    /**
     * @notice Assigns territory to a kingdom. Only GameEngine or owner.
     */
    function assignKingdom(uint256 tokenId, uint256 kingdomId) external {
        require(
            hasRole(GAME_ENGINE_ROLE, msg.sender) || ownerOf(tokenId) == msg.sender,
            "Territory: not authorized"
        );
        territories[tokenId].kingdomId = kingdomId;
        emit KingdomAssigned(tokenId, kingdomId);
    }

    /**
     * @notice Returns territory data for a given H3 index.
     */
    function getByH3(bytes15 h3Index) external view returns (Territory memory) {
        uint256 tokenId = h3ToTokenId[h3Index];
        require(tokenId != 0, "Territory: not claimed");
        return territories[tokenId];
    }

    /**
     * @notice Returns all token IDs owned by an address.
     */
    function tokensOfOwner(address owner) external view returns (uint256[] memory) {
        uint256 count = balanceOf(owner);
        uint256[] memory ids = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            ids[i] = tokenOfOwnerByIndex(owner, i);
        }
        return ids;
    }

    /**
     * @notice Base URI for token metadata (points to game API).
     */
    function setBaseURI(string calldata uri) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _baseTokenURI = uri;
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    // ── Internal helpers ────────────────────────────────────────

    function _ownerExists(uint256 tokenId) internal view returns (bool) {
        try this.ownerOf(tokenId) returns (address) {
            return true;
        } catch {
            return false;
        }
    }

    // ── Required overrides ──────────────────────────────────────

    function _update(address to, uint256 tokenId, address auth)
        internal override(ERC721, ERC721Enumerable) returns (address) {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, ERC721Enumerable, ERC721Royalty, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        Territory memory t = territories[tokenId];

        // On-chain metadata fallback (if no baseURI set)
        if (bytes(_baseTokenURI).length == 0) {
            return string(abi.encodePacked(
                '{"name":"HEXOD Territory #', _toString(tokenId),
                '","description":"', _biomeNames[t.biome], ' territory',
                t.isLandmark ? ' (Landmark)' : '',
                '","attributes":[{"trait_type":"Biome","value":"', _biomeNames[t.biome],
                '"},{"trait_type":"Rarity","value":"', _rarityNames[t.rarity],
                '"},{"trait_type":"Landmark","value":"', t.isLandmark ? 'Yes' : 'No',
                '"}]}'
            ));
        }

        return super.tokenURI(tokenId);
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
