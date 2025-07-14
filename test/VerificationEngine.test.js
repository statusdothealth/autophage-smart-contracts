const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("VerificationEngine", function () {
  let verificationEngine;
  let autophageToken;
  let reservoir;
  let owner;
  let user1;
  let user2;
  let verifier;
  let app1;

  beforeEach(async function () {
    [owner, user1, user2, verifier, app1] = await ethers.getSigners();
    
    // Deploy AutophageToken
    const AutophageToken = await ethers.getContractFactory("AutophageToken");
    autophageToken = await AutophageToken.deploy();
    await autophageToken.waitForDeployment();
    
    // Deploy mock USDC
    const MockToken = await ethers.getContractFactory("AutophageToken");
    const mockUSDC = await MockToken.deploy();
    await mockUSDC.waitForDeployment();
    
    // Deploy ReservoirContract
    const ReservoirContract = await ethers.getContractFactory("ReservoirContract");
    reservoir = await ReservoirContract.deploy(
      await autophageToken.getAddress(),
      await mockUSDC.getAddress()
    );
    await reservoir.waitForDeployment();
    
    // Deploy VerificationEngine
    const VerificationEngine = await ethers.getContractFactory("VerificationEngine");
    verificationEngine = await VerificationEngine.deploy(
      await autophageToken.getAddress(),
      await reservoir.getAddress()
    );
    await verificationEngine.waitForDeployment();
    
    // Setup roles
    const MINTER_ROLE = await autophageToken.MINTER_ROLE();
    await autophageToken.grantRole(MINTER_ROLE, await verificationEngine.getAddress());
    
    const VERIFIER_ROLE = await verificationEngine.VERIFIER_ROLE();
    await verificationEngine.grantRole(VERIFIER_ROLE, verifier.address);
  });

  describe("Deployment", function () {
    it("Should set the correct token and reservoir addresses", async function () {
      expect(await verificationEngine.autophageToken()).to.equal(await autophageToken.getAddress());
      expect(await verificationEngine.reservoir()).to.equal(await reservoir.getAddress());
    });

    it("Should initialize base rewards correctly", async function () {
      const exerciseReward = await verificationEngine.baseRewards(0); // EXERCISE
      expect(exerciseReward).to.equal(ethers.parseEther("50"));
    });
  });

  describe("App Management", function () {
    it("Should register new apps", async function () {
      await verificationEngine.registerApp(app1.address, "FitnessTracker");
      
      const appInfo = await verificationEngine.getAppInfo(app1.address);
      expect(appInfo.name).to.equal("FitnessTracker");
      expect(appInfo.isActive).to.be.true;
      expect(appInfo.reputationScore).to.equal(100);
    });

    it("Should emit AppRegistered event", async function () {
      await expect(verificationEngine.registerApp(app1.address, "HealthApp"))
        .to.emit(verificationEngine, "AppRegistered")
        .withArgs(app1.address, "HealthApp");
    });

    it("Should slash malicious apps", async function () {
      await verificationEngine.registerApp(app1.address, "BadApp");
      
      await verificationEngine.slashApp(app1.address, 50);
      
      const appInfo = await verificationEngine.getAppInfo(app1.address);
      expect(appInfo.reputationScore).to.equal(50);
    });

    it("Should deactivate apps with zero reputation", async function () {
      await verificationEngine.registerApp(app1.address, "BadApp");
      
      await verificationEngine.slashApp(app1.address, 100);
      
      const appInfo = await verificationEngine.getAppInfo(app1.address);
      expect(appInfo.isActive).to.be.false;
    });
  });

  describe("Activity Verification", function () {
    beforeEach(async function () {
      await verificationEngine.registerApp(app1.address, "FitnessApp");
    });

    it("Should verify single activity proof", async function () {
      const proof = {
        user: user1.address,
        activityType: 0, // EXERCISE
        timestamp: await time.latest(),
        duration: 3600, // 1 hour
        intensity: 70,
        proofData: ethers.hexlify(ethers.randomBytes(32))
      };
      
      await verificationEngine.connect(verifier).verifyActivity(
        proof,
        app1.address
      );
      
      const balance = await autophageToken.balanceOf(user1.address, 0);
      expect(balance).to.be.gt(0);
    });

    it("Should apply streak multipliers", async function () {
      // First activity
      const proof1 = {
        user: user1.address,
        activityType: 0,
        timestamp: await time.latest(),
        duration: 3600,
        intensity: 70,
        proofData: ethers.hexlify(ethers.randomBytes(32))
      };
      
      await verificationEngine.connect(verifier).verifyActivity(proof1, app1.address);
      const balance1 = await autophageToken.balanceOf(user1.address, 0);
      
      // Second activity next day
      await time.increase(86400);
      const proof2 = {
        user: user1.address,
        activityType: 0,
        timestamp: await time.latest(),
        duration: 3600,
        intensity: 70,
        proofData: ethers.hexlify(ethers.randomBytes(32))
      };
      
      await verificationEngine.connect(verifier).verifyActivity(proof2, app1.address);
      const balance2 = await autophageToken.balanceOf(user1.address, 0);
      
      // Second reward should be higher due to streak
      const reward2 = balance2 - balance1;
      expect(reward2).to.be.gt(balance1);
    });

    it("Should handle batch verification", async function () {
      const proofs = [];
      for (let i = 0; i < 5; i++) {
        proofs.push({
          user: user1.address,
          activityType: 0,
          timestamp: await time.latest() - i * 3600,
          duration: 3600,
          intensity: 70,
          proofData: ethers.hexlify(ethers.randomBytes(32))
        });
      }
      
      await verificationEngine.connect(verifier).batchVerifyActivities(
        proofs,
        app1.address
      );
      
      const balance = await autophageToken.balanceOf(user1.address, 0);
      expect(balance).to.be.gt(0);
    });

    it("Should apply quality multipliers", async function () {
      // Low quality activity
      const lowQualityProof = {
        user: user1.address,
        activityType: 0,
        timestamp: await time.latest(),
        duration: 600, // 10 minutes
        intensity: 30,
        proofData: ethers.hexlify(ethers.randomBytes(32))
      };
      
      await verificationEngine.connect(verifier).verifyActivity(lowQualityProof, app1.address);
      const lowQualityBalance = await autophageToken.balanceOf(user1.address, 0);
      
      // High quality activity
      const highQualityProof = {
        user: user2.address,
        activityType: 0,
        timestamp: await time.latest(),
        duration: 3600, // 1 hour
        intensity: 80,
        proofData: ethers.hexlify(ethers.randomBytes(32))
      };
      
      await verificationEngine.connect(verifier).verifyActivity(highQualityProof, app1.address);
      const highQualityBalance = await autophageToken.balanceOf(user2.address, 0);
      
      expect(highQualityBalance).to.be.gt(lowQualityBalance);
    });
  });

  describe("Group Activities", function () {
    beforeEach(async function () {
      await verificationEngine.registerApp(app1.address, "GroupFitness");
    });

    it("Should create and verify group activities", async function () {
      const participants = [user1.address, user2.address];
      
      await verificationEngine.createGroupActivity(
        "Morning Run",
        participants,
        0 // EXERCISE
      );
      
      // Verify group activity for each participant
      const proof = {
        user: user1.address,
        activityType: 0,
        timestamp: await time.latest(),
        duration: 3600,
        intensity: 70,
        proofData: ethers.hexlify(ethers.randomBytes(32))
      };
      
      await verificationEngine.connect(verifier).verifyActivity(proof, app1.address);
      
      // Should get group bonus
      const balance = await autophageToken.balanceOf(user1.address, 0);
      expect(balance).to.be.gt(ethers.parseEther("50")); // More than base reward
    });
  });

  describe("Genetic Traits", function () {
    it("Should assign genetic traits to users", async function () {
      await verificationEngine.assignGeneticTrait(user1.address, 0); // Fast metabolism
      
      const traits = await verificationEngine.getUserTraits(user1.address);
      expect(traits[0]).to.be.true;
    });

    it("Should apply genetic trait bonuses", async function () {
      // User with trait
      await verificationEngine.assignGeneticTrait(user1.address, 0);
      
      const proof = {
        user: user1.address,
        activityType: 0,
        timestamp: await time.latest(),
        duration: 3600,
        intensity: 70,
        proofData: ethers.hexlify(ethers.randomBytes(32))
      };
      
      await verificationEngine.registerApp(app1.address, "App");
      await verificationEngine.connect(verifier).verifyActivity(proof, app1.address);
      
      const balanceWithTrait = await autophageToken.balanceOf(user1.address, 0);
      
      // User without trait
      proof.user = user2.address;
      await verificationEngine.connect(verifier).verifyActivity(proof, app1.address);
      
      const balanceWithoutTrait = await autophageToken.balanceOf(user2.address, 0);
      
      expect(balanceWithTrait).to.be.gt(balanceWithoutTrait);
    });
  });

  describe("Challenge System", function () {
    it("Should allow challenging suspicious activities", async function () {
      await verificationEngine.registerApp(app1.address, "App");
      
      const proof = {
        user: user1.address,
        activityType: 0,
        timestamp: await time.latest(),
        duration: 3600,
        intensity: 70,
        proofData: ethers.hexlify(ethers.randomBytes(32))
      };
      
      await verificationEngine.connect(verifier).verifyActivity(proof, app1.address);
      
      // Challenge the activity
      await verificationEngine.challengeActivity(
        user1.address,
        0, // activity index
        "Suspicious heart rate data"
      );
      
      const challenge = await verificationEngine.getActiveChallenge(user1.address, 0);
      expect(challenge.reason).to.equal("Suspicious heart rate data");
    });
  });

  describe("Reward Updates", function () {
    it("Should allow updating base rewards", async function () {
      const newReward = ethers.parseEther("75");
      
      await verificationEngine.updateBaseReward(0, newReward);
      
      expect(await verificationEngine.baseRewards(0)).to.equal(newReward);
    });

    it("Should emit RewardUpdated event", async function () {
      const newReward = ethers.parseEther("100");
      
      await expect(verificationEngine.updateBaseReward(1, newReward))
        .to.emit(verificationEngine, "RewardUpdated")
        .withArgs(1, newReward);
    });
  });

  describe("Statistics", function () {
    beforeEach(async function () {
      await verificationEngine.registerApp(app1.address, "StatsApp");
    });

    it("Should track user statistics", async function () {
      const proof = {
        user: user1.address,
        activityType: 0,
        timestamp: await time.latest(),
        duration: 3600,
        intensity: 70,
        proofData: ethers.hexlify(ethers.randomBytes(32))
      };
      
      await verificationEngine.connect(verifier).verifyActivity(proof, app1.address);
      
      const stats = await verificationEngine.getUserStats(user1.address);
      expect(stats.totalActivities).to.equal(1);
      expect(stats.currentStreak).to.equal(1);
    });

    it("Should calculate average activity metrics", async function () {
      // Submit multiple activities
      for (let i = 0; i < 5; i++) {
        const proof = {
          user: user1.address,
          activityType: 0,
          timestamp: await time.latest() + i * 3600,
          duration: 3600,
          intensity: 60 + i * 5,
          proofData: ethers.hexlify(ethers.randomBytes(32))
        };
        
        await verificationEngine.connect(verifier).verifyActivity(proof, app1.address);
        await time.increase(3600);
      }
      
      const stats = await verificationEngine.getUserStats(user1.address);
      expect(stats.totalActivities).to.equal(5);
      expect(stats.averageIntensity).to.be.gt(0);
    });
  });
});