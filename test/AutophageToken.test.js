const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("AutophageToken", function () {
  let autophageToken;
  let owner;
  let user1;
  let user2;
  let reservoir;
  let verificationEngine;

  beforeEach(async function () {
    [owner, user1, user2, reservoir, verificationEngine] = await ethers.getSigners();
    
    const AutophageToken = await ethers.getContractFactory("AutophageToken");
    autophageToken = await AutophageToken.deploy();
    await autophageToken.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct name and symbol", async function () {
      expect(await autophageToken.name()).to.equal("Autophage Token");
      expect(await autophageToken.symbol()).to.equal("PHAGE");
    });

    it("Should grant DEFAULT_ADMIN_ROLE to deployer", async function () {
      const DEFAULT_ADMIN_ROLE = await autophageToken.DEFAULT_ADMIN_ROLE();
      expect(await autophageToken.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
    });
  });

  describe("Minting", function () {
    beforeEach(async function () {
      const MINTER_ROLE = await autophageToken.MINTER_ROLE();
      await autophageToken.grantRole(MINTER_ROLE, owner.address);
    });

    it("Should mint tokens correctly", async function () {
      const amount = ethers.parseEther("100");
      await autophageToken.mint(user1.address, 0, amount); // RHYTHM species
      
      const balance = await autophageToken.balanceOf(user1.address, 0);
      expect(balance).to.equal(amount);
    });

    it("Should emit Transfer event on mint", async function () {
      const amount = ethers.parseEther("50");
      await expect(autophageToken.mint(user1.address, 1, amount))
        .to.emit(autophageToken, "Transfer")
        .withArgs(ethers.ZeroAddress, user1.address, 1, amount);
    });

    it("Should revert if non-minter tries to mint", async function () {
      const amount = ethers.parseEther("100");
      await expect(
        autophageToken.connect(user1).mint(user2.address, 0, amount)
      ).to.be.revertedWith("Must have minter role");
    });
  });

  describe("Token Decay", function () {
    beforeEach(async function () {
      const MINTER_ROLE = await autophageToken.MINTER_ROLE();
      await autophageToken.grantRole(MINTER_ROLE, owner.address);
    });

    it("Should apply decay correctly for RHYTHM tokens (5% daily)", async function () {
      const initialAmount = ethers.parseEther("1000");
      await autophageToken.mint(user1.address, 0, initialAmount);
      
      // Advance time by 1 day
      await time.increase(86400);
      
      const balance = await autophageToken.balanceOf(user1.address, 0);
      const expectedBalance = initialAmount * 95n / 100n; // 5% decay
      
      // Allow for small rounding differences
      expect(balance).to.be.closeTo(expectedBalance, ethers.parseEther("1"));
    });

    it("Should apply decay correctly for HEALING tokens (0.75% daily)", async function () {
      const initialAmount = ethers.parseEther("1000");
      await autophageToken.mint(user1.address, 1, initialAmount);
      
      // Advance time by 1 day
      await time.increase(86400);
      
      const balance = await autophageToken.balanceOf(user1.address, 1);
      const expectedBalance = initialAmount * 9925n / 10000n; // 0.75% decay
      
      expect(balance).to.be.closeTo(expectedBalance, ethers.parseEther("1"));
    });

    it("Should handle multiple days of decay", async function () {
      const initialAmount = ethers.parseEther("1000");
      await autophageToken.mint(user1.address, 0, initialAmount);
      
      // Advance time by 5 days
      await time.increase(5 * 86400);
      
      const balance = await autophageToken.balanceOf(user1.address, 0);
      // After 5 days with 5% daily decay: 1000 * 0.95^5 ≈ 773.78
      const expectedBalance = ethers.parseEther("773.78");
      
      expect(balance).to.be.closeTo(expectedBalance, ethers.parseEther("10"));
    });
  });

  describe("Transfers", function () {
    beforeEach(async function () {
      const MINTER_ROLE = await autophageToken.MINTER_ROLE();
      await autophageToken.grantRole(MINTER_ROLE, owner.address);
      await autophageToken.mint(user1.address, 0, ethers.parseEther("1000"));
    });

    it("Should transfer tokens between accounts", async function () {
      const transferAmount = ethers.parseEther("100");
      await autophageToken.connect(user1).transfer(user2.address, 0, transferAmount);
      
      expect(await autophageToken.balanceOf(user2.address, 0)).to.equal(transferAmount);
    });

    it("Should apply decay before transfer", async function () {
      // Advance time by 1 day
      await time.increase(86400);
      
      const transferAmount = ethers.parseEther("100");
      await autophageToken.connect(user1).transfer(user2.address, 0, transferAmount);
      
      // User1's balance should be decayed minus transfer amount
      const user1Balance = await autophageToken.balanceOf(user1.address, 0);
      const expectedBalance = (ethers.parseEther("1000") * 95n / 100n) - transferAmount;
      
      expect(user1Balance).to.be.closeTo(expectedBalance, ethers.parseEther("1"));
    });

    it("Should emit Transfer event", async function () {
      const transferAmount = ethers.parseEther("50");
      await expect(autophageToken.connect(user1).transfer(user2.address, 0, transferAmount))
        .to.emit(autophageToken, "Transfer")
        .withArgs(user1.address, user2.address, 0, transferAmount);
    });

    it("Should revert on insufficient balance", async function () {
      const transferAmount = ethers.parseEther("2000");
      await expect(
        autophageToken.connect(user1).transfer(user2.address, 0, transferAmount)
      ).to.be.revertedWith("Insufficient balance");
    });
  });

  describe("Wellness Vault", function () {
    beforeEach(async function () {
      const MINTER_ROLE = await autophageToken.MINTER_ROLE();
      await autophageToken.grantRole(MINTER_ROLE, owner.address);
      await autophageToken.mint(user1.address, 0, ethers.parseEther("1000"));
    });

    it("Should allow locking tokens in wellness vault", async function () {
      const lockAmount = ethers.parseEther("500");
      const lockDuration = 30; // 30 days
      
      await autophageToken.connect(user1).lockInWellnessVault(0, lockAmount, lockDuration);
      
      const vaultInfo = await autophageToken.getWellnessVaultInfo(user1.address, 0);
      expect(vaultInfo.amount).to.equal(lockAmount);
      expect(vaultInfo.duration).to.equal(lockDuration);
    });

    it("Should reduce decay rate for locked tokens", async function () {
      const lockAmount = ethers.parseEther("500");
      await autophageToken.connect(user1).lockInWellnessVault(0, lockAmount, 30);
      
      // Advance time by 1 day
      await time.increase(86400);
      
      // Check that locked tokens have reduced decay
      const vaultInfo = await autophageToken.getWellnessVaultInfo(user1.address, 0);
      // With 30-day lock, decay should be reduced by 15% (0.5% per 30 days)
      const expectedVaultBalance = lockAmount * 9575n / 10000n; // 4.25% decay instead of 5%
      
      expect(vaultInfo.amount).to.be.closeTo(expectedVaultBalance, ethers.parseEther("10"));
    });

    it("Should prevent unlocking before lock period ends", async function () {
      const lockAmount = ethers.parseEther("500");
      await autophageToken.connect(user1).lockInWellnessVault(0, lockAmount, 30);
      
      // Try to unlock after 15 days
      await time.increase(15 * 86400);
      
      await expect(
        autophageToken.connect(user1).unlockFromWellnessVault(0)
      ).to.be.revertedWith("Lock period not ended");
    });

    it("Should allow unlocking after lock period", async function () {
      const lockAmount = ethers.parseEther("500");
      await autophageToken.connect(user1).lockInWellnessVault(0, lockAmount, 30);
      
      // Advance time by 31 days
      await time.increase(31 * 86400);
      
      await autophageToken.connect(user1).unlockFromWellnessVault(0);
      
      const vaultInfo = await autophageToken.getWellnessVaultInfo(user1.address, 0);
      expect(vaultInfo.amount).to.equal(0);
    });
  });

  describe("Batch Operations", function () {
    beforeEach(async function () {
      const MINTER_ROLE = await autophageToken.MINTER_ROLE();
      await autophageToken.grantRole(MINTER_ROLE, owner.address);
    });

    it("Should handle batch mints", async function () {
      const recipients = [user1.address, user2.address];
      const species = [0, 1];
      const amounts = [ethers.parseEther("100"), ethers.parseEther("200")];
      
      await autophageToken.batchMint(recipients, species, amounts);
      
      expect(await autophageToken.balanceOf(user1.address, 0)).to.equal(amounts[0]);
      expect(await autophageToken.balanceOf(user2.address, 1)).to.equal(amounts[1]);
    });

    it("Should handle batch transfers", async function () {
      await autophageToken.mint(user1.address, 0, ethers.parseEther("500"));
      await autophageToken.mint(user1.address, 1, ethers.parseEther("500"));
      
      const recipients = [user2.address, user2.address];
      const species = [0, 1];
      const amounts = [ethers.parseEther("100"), ethers.parseEther("200")];
      
      await autophageToken.connect(user1).batchTransfer(recipients, species, amounts);
      
      expect(await autophageToken.balanceOf(user2.address, 0)).to.equal(amounts[0]);
      expect(await autophageToken.balanceOf(user2.address, 1)).to.equal(amounts[1]);
    });
  });

  describe("Pause Functionality", function () {
    beforeEach(async function () {
      const MINTER_ROLE = await autophageToken.MINTER_ROLE();
      await autophageToken.grantRole(MINTER_ROLE, owner.address);
      await autophageToken.mint(user1.address, 0, ethers.parseEther("1000"));
    });

    it("Should pause and unpause transfers", async function () {
      await autophageToken.pause();
      
      await expect(
        autophageToken.connect(user1).transfer(user2.address, 0, ethers.parseEther("100"))
      ).to.be.revertedWith("Pausable: paused");
      
      await autophageToken.unpause();
      
      await expect(
        autophageToken.connect(user1).transfer(user2.address, 0, ethers.parseEther("100"))
      ).to.not.be.reverted;
    });

    it("Should only allow admin to pause", async function () {
      await expect(
        autophageToken.connect(user1).pause()
      ).to.be.revertedWith("Must have admin role");
    });
  });

  describe("Whale Protection", function () {
    beforeEach(async function () {
      const MINTER_ROLE = await autophageToken.MINTER_ROLE();
      await autophageToken.grantRole(MINTER_ROLE, owner.address);
    });

    it("Should apply accelerated decay for large balances", async function () {
      // Mint a large amount that exceeds whale threshold
      const whaleAmount = ethers.parseEther("1000000"); // 1M tokens
      await autophageToken.mint(user1.address, 0, whaleAmount);
      
      // Advance time by 1 day
      await time.increase(86400);
      
      const balance = await autophageToken.balanceOf(user1.address, 0);
      // Whale decay should be higher than normal 5%
      const normalDecay = whaleAmount * 95n / 100n;
      
      expect(balance).to.be.lt(normalDecay);
    });
  });
});