// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Test-only: supports simulating a blacklist-capable stablecoin (USDC/USDT-style)
///      so contracts that hold this token can be tested against a transfer that reverts.
contract MockERC20 is ERC20 {
    uint8 private immutable _decimals;
    mapping(address => bool) public blacklisted;

    constructor(
        string memory name,
        string memory symbol,
        uint8 tokenDecimals
    ) ERC20(name, symbol) {
        _decimals = tokenDecimals;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }

    function setBlacklisted(address account, bool isBlacklisted) public {
        blacklisted[account] = isBlacklisted;
    }

    function _update(address from, address to, uint256 value) internal override {
        require(!blacklisted[to], "MockERC20: recipient blacklisted");
        super._update(from, to, value);
    }
}
