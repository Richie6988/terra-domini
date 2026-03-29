// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title HEXToken — Hexod Coin
 * @notice ERC-20 token mined through Proof of Territory gameplay.
 * @dev Hard cap: 4,842,432 HEX (matching H3 resolution 7 land cells).
 *      Mining rate halves at supply thresholds.
 *      Anyone can burn. Only MINTER_ROLE can mint (GameEngine contract).
 */
contract HEXToken is ERC20, ERC20Burnable, AccessControl, ReentrancyGuard {

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint256 public constant HARD_CAP = 4_842_432 ether; // 4,842,432 with 18 decimals

    // Halving thresholds
    uint256 public constant PHASE_1_CAP = 500_000 ether;   // 1.0 HEX/claim
    uint256 public constant PHASE_2_CAP = 2_000_000 ether;  // 0.5 HEX/claim
    uint256 public constant PHASE_3_CAP = 4_000_000 ether;  // 0.25 HEX/claim
    uint256 public constant PHASE_4_CAP = 4_800_000 ether;  // 0.1 HEX/claim
    // Remaining 42,432: 0.01 HEX/claim

    uint256 public totalMined;
    uint256 public totalBurned;

    // Withdrawal mechanics
    uint256 public constant WITHDRAWAL_FEE_BPS = 300; // 3%
    uint256 public constant WITHDRAWAL_COOLDOWN = 24 hours;
    mapping(address => uint256) public lastWithdrawal;

    // Events
    event Mined(address indexed to, uint256 amount, uint256 totalMined);
    event Burned(address indexed from, uint256 amount, uint256 totalBurned);
    event WithdrawalRequested(address indexed user, uint256 amount, uint256 fee);

    constructor() ERC20("Hexod Coin", "HEX") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    /**
     * @notice Returns current mining rate based on total supply mined.
     * @return rate Amount of HEX mined per territory claim (in wei).
     */
    function miningRate() public view returns (uint256 rate) {
        if (totalMined < PHASE_1_CAP) return 1 ether;        // 1.0 HEX
        if (totalMined < PHASE_2_CAP) return 0.5 ether;      // 0.5 HEX
        if (totalMined < PHASE_3_CAP) return 0.25 ether;     // 0.25 HEX
        if (totalMined < PHASE_4_CAP) return 0.1 ether;      // 0.1 HEX
        return 0.01 ether;                                     // 0.01 HEX (endgame)
    }

    /**
     * @notice Mines HEX tokens for a territory claim. Only callable by GameEngine.
     * @param to Address to receive mined tokens.
     * @return amount Actual amount mined (may be less near hard cap).
     */
    function mine(address to) external onlyRole(MINTER_ROLE) nonReentrant returns (uint256 amount) {
        require(totalMined < HARD_CAP, "HEX: hard cap reached");

        amount = miningRate();

        // Cap at remaining supply
        if (totalMined + amount > HARD_CAP) {
            amount = HARD_CAP - totalMined;
        }

        totalMined += amount;
        _mint(to, amount);

        emit Mined(to, amount, totalMined);
    }

    /**
     * @notice Burns HEX tokens (skill upgrades, etc). Overrides ERC20Burnable.
     * @param amount Amount to burn.
     */
    function burn(uint256 amount) public override {
        super.burn(amount);
        totalBurned += amount;
        emit Burned(msg.sender, amount, totalBurned);
    }

    /**
     * @notice Withdrawal from in-game to on-chain. Applies 3% fee (burned).
     * @param amount Gross amount requested. Net = amount - 3% fee.
     */
    function processWithdrawal(address user, uint256 amount) external onlyRole(MINTER_ROLE) nonReentrant {
        require(block.timestamp >= lastWithdrawal[user] + WITHDRAWAL_COOLDOWN, "HEX: cooldown active");
        require(amount > 0, "HEX: zero amount");

        uint256 fee = (amount * WITHDRAWAL_FEE_BPS) / 10000;
        uint256 net = amount - fee;

        lastWithdrawal[user] = block.timestamp;

        // Fee is burned (deflationary)
        if (fee > 0) {
            totalBurned += fee;
            // Fee tokens are not minted — they're deducted from the withdrawal
        }

        // Mint net amount to user (withdrawal = game server releases tokens)
        _mint(user, net);

        emit WithdrawalRequested(user, net, fee);
    }

    /**
     * @notice Returns circulating supply (mined - burned).
     */
    function circulatingSupply() external view returns (uint256) {
        return totalMined - totalBurned;
    }

    /**
     * @notice Returns percentage of hard cap mined (basis points for precision).
     */
    function percentMinedBps() external view returns (uint256) {
        return (totalMined * 10000) / HARD_CAP;
    }
}
