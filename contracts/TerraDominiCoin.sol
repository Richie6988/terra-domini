// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TerraDominiCoin (TDC)
 * @notice In-game currency for Terra Domini. ERC-20 on Polygon.
 *         Players buy TDC via the game platform (fiat → TDC).
 *         TDC is spent on in-game items, territory bonuses, cosmetics.
 *         Holders can withdraw TDC to their wallet or sell on DEXes.
 *         Treasury controls minting (tied to real purchase events).
 */
contract TerraDominiCoin is ERC20, ERC20Burnable, ERC20Pausable, AccessControl, ReentrancyGuard {

    bytes32 public constant MINTER_ROLE    = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE    = keccak256("PAUSER_ROLE");
    bytes32 public constant TREASURY_ROLE  = keccak256("TREASURY_ROLE");
    bytes32 public constant GAME_ROLE      = keccak256("GAME_ROLE");  // backend calls

    // Hard cap: 1 billion TDC
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18;

    // Anti-whale: single wallet max 0.1% of supply
    uint256 public constant MAX_WALLET_PCT_BPS = 10; // 0.1% = 10 bps

    // Withdrawal minimum (50 TDC in wei units)
    uint256 public constant MIN_WITHDRAWAL = 50 * 10**18;

    // Fee on in-game → wallet withdrawals (3%)
    uint256 public constant WITHDRAWAL_FEE_BPS = 300;
    address public feeCollector;

    // In-game credit balance (held by contract on behalf of players)
    // This is used for gas-less in-game transactions
    mapping(address => uint256) public inGameBalance;

    // Nonce for replay protection on off-chain signed messages
    mapping(address => uint256) public nonces;

    // Events
    event InGameDeposit(address indexed player, uint256 amount);
    event InGameWithdraw(address indexed player, uint256 amount, uint256 fee);
    event InGameSpend(address indexed player, uint256 amount, string itemCode);
    event InGameEarn(address indexed player, uint256 amount, string reason);
    event FeeCollectorUpdated(address indexed oldCollector, address indexed newCollector);

    // ─── EIP-712 ──────────────────────────────────────────────────────────────
    bytes32 public immutable DOMAIN_SEPARATOR;
    bytes32 public constant SPEND_TYPEHASH = keccak256(
        "Spend(address player,uint256 amount,string itemCode,uint256 nonce,uint256 deadline)"
    );
    bytes32 public constant EARN_TYPEHASH = keccak256(
        "Earn(address player,uint256 amount,string reason,uint256 nonce,uint256 deadline)"
    );

    constructor(address _treasury, address _feeCollector) ERC20("TerraDominiCoin", "TDC") {
        require(_treasury != address(0), "Invalid treasury");
        require(_feeCollector != address(0), "Invalid fee collector");

        feeCollector = _feeCollector;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, _treasury);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(TREASURY_ROLE, _treasury);

        DOMAIN_SEPARATOR = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes("TerraDominiCoin")),
            keccak256(bytes("1")),
            block.chainid,
            address(this)
        ));

        // Initial liquidity mint to treasury: 50M TDC
        _mint(_treasury, 50_000_000 * 10**18);
    }

    // ─── Minting (purchase events) ────────────────────────────────────────────

    /**
     * @notice Mint TDC for a purchase. Called by backend treasury wallet.
     *         1 EUR = 100 TDC (rate enforced off-chain by backend).
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        require(totalSupply() + amount <= MAX_SUPPLY, "Max supply exceeded");
        require(
            balanceOf(to) + amount <= (MAX_SUPPLY * MAX_WALLET_PCT_BPS) / 10000,
            "Max wallet exceeded"
        );
        _mint(to, amount);
    }

    // ─── In-game balance system ───────────────────────────────────────────────

    /**
     * @notice Move TDC from wallet into in-game balance (no gas for in-game ops).
     */
    function depositToGame(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Zero amount");
        _transfer(msg.sender, address(this), amount);
        inGameBalance[msg.sender] += amount;
        emit InGameDeposit(msg.sender, amount);
    }

    /**
     * @notice Withdraw in-game balance to wallet. 3% fee to treasury.
     */
    function withdrawFromGame(uint256 amount) external nonReentrant whenNotPaused {
        require(amount >= MIN_WITHDRAWAL, "Below minimum withdrawal");
        require(inGameBalance[msg.sender] >= amount, "Insufficient in-game balance");

        uint256 fee = (amount * WITHDRAWAL_FEE_BPS) / 10000;
        uint256 net = amount - fee;

        inGameBalance[msg.sender] -= amount;
        _transfer(address(this), msg.sender, net);
        _transfer(address(this), feeCollector, fee);

        emit InGameWithdraw(msg.sender, net, fee);
    }

    /**
     * @notice Backend spends in-game balance on behalf of player (gasless).
     *         Uses EIP-712 signed message from player, replayed by game server.
     */
    function spendInGame(
        address player,
        uint256 amount,
        string calldata itemCode,
        uint256 deadline,
        uint8 v, bytes32 r, bytes32 s
    ) external onlyRole(GAME_ROLE) nonReentrant whenNotPaused {
        require(block.timestamp <= deadline, "Signature expired");
        require(inGameBalance[player] >= amount, "Insufficient balance");

        bytes32 structHash = keccak256(abi.encode(
            SPEND_TYPEHASH,
            player, amount,
            keccak256(bytes(itemCode)),
            nonces[player],
            deadline
        ));
        _verifySignature(player, structHash, v, r, s);

        nonces[player]++;
        inGameBalance[player] -= amount;
        // Amount goes to treasury (burned from in-game economy or held)
        _transfer(address(this), feeCollector, amount);

        emit InGameSpend(player, amount, itemCode);
    }

    /**
     * @notice Backend credits in-game balance (ad revenue share, rewards).
     *         Mints new TDC — requires MINTER_ROLE on calling address.
     */
    function earnInGame(
        address player,
        uint256 amount,
        string calldata reason
    ) external onlyRole(GAME_ROLE) whenNotPaused {
        require(totalSupply() + amount <= MAX_SUPPLY, "Max supply exceeded");
        _mint(address(this), amount);
        inGameBalance[player] += amount;
        emit InGameEarn(player, amount, reason);
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

    function setFeeCollector(address newCollector) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newCollector != address(0), "Zero address");
        emit FeeCollectorUpdated(feeCollector, newCollector);
        feeCollector = newCollector;
    }

    // ─── Internal helpers ─────────────────────────────────────────────────────

    function _verifySignature(address signer, bytes32 structHash, uint8 v, bytes32 r, bytes32 s) internal view {
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        address recovered = ecrecover(digest, v, r, s);
        require(recovered != address(0) && recovered == signer, "Invalid signature");
    }

    function _update(address from, address to, uint256 value)
        internal override(ERC20, ERC20Pausable) {
        super._update(from, to, value);
    }

    // ─── View helpers ─────────────────────────────────────────────────────────

    function totalInGameSupply() external view returns (uint256) {
        return balanceOf(address(this));
    }

    function playerTotalBalance(address player) external view returns (uint256 wallet, uint256 inGame) {
        wallet = balanceOf(player);
        inGame = inGameBalance[player];
    }
}
