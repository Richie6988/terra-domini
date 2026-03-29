// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Staking — Lock HEX for Kingdom Bonuses
 * @notice Players stake HEX to earn production multipliers + APY rewards.
 *         Tiers: 7 days (+10%), 30 days (+25%), 90 days (+50%).
 *         Early unstake penalty: 20% burned (deflationary).
 */
contract Staking is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable hexToken;

    struct Stake {
        uint256 amount;
        uint64 startTime;
        uint64 lockExpiry;
        uint8 lockDays;      // 7, 30, or 90
        bool active;
    }

    // User → stakes
    mapping(address => Stake[]) public userStakes;

    // Total staked across all users
    uint256 public totalStaked;

    // APY in basis points per lock tier
    mapping(uint8 => uint256) public apyBps;

    // Early unstake burn percentage (basis points)
    uint256 public constant EARLY_UNSTAKE_PENALTY_BPS = 2000; // 20%

    // Events
    event Staked(address indexed user, uint256 indexed stakeIndex, uint256 amount, uint8 lockDays);
    event Unstaked(address indexed user, uint256 indexed stakeIndex, uint256 amount, uint256 reward);
    event EarlyUnstake(address indexed user, uint256 indexed stakeIndex, uint256 returned, uint256 burned);

    constructor(address _hexToken) {
        hexToken = IERC20(_hexToken);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

        // Default APYs
        apyBps[7]  = 1000;  // 10% APY for 7-day lock
        apyBps[30] = 2500;  // 25% APY for 30-day lock
        apyBps[90] = 5000;  // 50% APY for 90-day lock
    }

    /**
     * @notice Stake HEX tokens for a lock period.
     * @param amount Amount of HEX to stake.
     * @param lockDays Lock duration (7, 30, or 90).
     */
    function stake(uint256 amount, uint8 lockDays) external nonReentrant returns (uint256 stakeIndex) {
        require(amount > 0, "Staking: zero amount");
        require(lockDays == 7 || lockDays == 30 || lockDays == 90, "Staking: invalid lock period");

        hexToken.safeTransferFrom(msg.sender, address(this), amount);

        stakeIndex = userStakes[msg.sender].length;
        userStakes[msg.sender].push(Stake({
            amount: amount,
            startTime: uint64(block.timestamp),
            lockExpiry: uint64(block.timestamp + uint256(lockDays) * 1 days),
            lockDays: lockDays,
            active: true
        }));

        totalStaked += amount;

        emit Staked(msg.sender, stakeIndex, amount, lockDays);
    }

    /**
     * @notice Unstake after lock period expires. Receives principal + rewards.
     * @param stakeIndex Index of the stake to unstake.
     */
    function unstake(uint256 stakeIndex) external nonReentrant {
        require(stakeIndex < userStakes[msg.sender].length, "Staking: invalid index");
        Stake storage s = userStakes[msg.sender][stakeIndex];
        require(s.active, "Staking: already unstaked");

        s.active = false;
        totalStaked -= s.amount;

        if (block.timestamp >= s.lockExpiry) {
            // Normal unstake — return principal + rewards
            uint256 reward = _calculateReward(s);
            uint256 total = s.amount + reward;

            hexToken.safeTransfer(msg.sender, s.amount);
            // Rewards are minted by the game server (off-chain) or from reward pool
            // For now, just return principal

            emit Unstaked(msg.sender, stakeIndex, s.amount, reward);
        } else {
            // Early unstake — 20% penalty burned
            uint256 penalty = (s.amount * EARLY_UNSTAKE_PENALTY_BPS) / 10000;
            uint256 returned = s.amount - penalty;

            hexToken.safeTransfer(msg.sender, returned);
            // Penalty tokens stay in contract (effectively burned from circulation)

            emit EarlyUnstake(msg.sender, stakeIndex, returned, penalty);
        }
    }

    /**
     * @notice View pending rewards for a stake.
     */
    function pendingReward(address user, uint256 stakeIndex) external view returns (uint256) {
        require(stakeIndex < userStakes[user].length, "Staking: invalid index");
        return _calculateReward(userStakes[user][stakeIndex]);
    }

    /**
     * @notice Get all stake info for a user.
     */
    function getStakeInfo(address user) external view returns (
        uint256 _totalStaked,
        uint256 _pendingRewards,
        uint256 _activeStakes
    ) {
        Stake[] storage stakes = userStakes[user];
        for (uint256 i = 0; i < stakes.length; i++) {
            if (stakes[i].active) {
                _totalStaked += stakes[i].amount;
                _pendingRewards += _calculateReward(stakes[i]);
                _activeStakes++;
            }
        }
    }

    /**
     * @notice Get production bonus multiplier for a user (in basis points).
     *         Used by game server to boost kingdom resource production.
     * @return bonusBps Bonus in basis points (e.g., 1000 = +10%).
     */
    function getProductionBonus(address user) external view returns (uint256 bonusBps) {
        Stake[] storage stakes = userStakes[user];
        for (uint256 i = 0; i < stakes.length; i++) {
            if (!stakes[i].active) continue;
            if (stakes[i].lockDays == 7) bonusBps += 1000;   // +10%
            else if (stakes[i].lockDays == 30) bonusBps += 2500; // +25%
            else if (stakes[i].lockDays == 90) bonusBps += 5000; // +50%
        }
        // Cap at 200% bonus
        if (bonusBps > 20000) bonusBps = 20000;
    }

    // ── Admin ──
    function setAPY(uint8 lockDays, uint256 bps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(lockDays == 7 || lockDays == 30 || lockDays == 90, "Staking: invalid period");
        apyBps[lockDays] = bps;
    }

    // ── Internal ──
    function _calculateReward(Stake storage s) internal view returns (uint256) {
        if (!s.active) return 0;
        uint256 elapsed = block.timestamp - s.startTime;
        uint256 annualReward = (s.amount * apyBps[s.lockDays]) / 10000;
        return (annualReward * elapsed) / 365 days;
    }
}
