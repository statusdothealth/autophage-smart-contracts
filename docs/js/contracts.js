// Contract interaction module

class ContractManager {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.contracts = {};
        this.connected = false;
        this.mockBalances = null;
        this.mockTransactions = [];
    }

    // Initialize provider and signer
    async init() {
        if (CONFIG.demoMode.enabled) {
            // Demo mode - no real blockchain connection
            this.connected = true;
            return true;
        }

        if (typeof window.ethereum === 'undefined') {
            throw new Error('No Web3 provider found. Please install MetaMask.');
        }

        try {
            // Wait for ethers to be loaded
            await waitForEthers();
            
            // Create provider without immediately requesting accounts
            this.provider = new ethers.providers.Web3Provider(window.ethereum, 'any');
            
            // Handle chain changed
            window.ethereum.on('chainChanged', () => {
                window.location.reload();
            });
            
            // Handle accounts changed
            window.ethereum.on('accountsChanged', (accounts) => {
                if (accounts.length === 0) {
                    // User disconnected wallet
                    window.location.reload();
                } else {
                    // User switched accounts
                    window.location.reload();
                }
            });
            
            this.connected = true;
            return true;
        } catch (error) {
            console.error('Failed to initialize provider:', error);
            throw error;
        }
    }

    // Connect wallet
    async connectWallet() {
        if (CONFIG.demoMode.enabled) {
            return '0xDemoUser1234567890123456789012345678901234';
        }

        try {
            // Check if MetaMask is installed
            if (!window.ethereum) {
                throw new Error('MetaMask is not installed');
            }
            
            // Request accounts with proper error handling
            let accounts;
            try {
                accounts = await window.ethereum.request({ 
                    method: 'eth_requestAccounts' 
                });
            } catch (err) {
                console.error('MetaMask error:', err);
                if (err.code === -32002) {
                    throw new Error('Please unlock MetaMask and try again');
                } else if (err.code === 4001) {
                    throw new Error('User rejected the connection request');
                } else if (err.message && err.message.includes('User rejected')) {
                    throw new Error('User rejected the connection request');
                }
                // Generic error
                throw new Error('Failed to connect to MetaMask: ' + (err.message || err.code || 'Unknown error'));
            }
            
            if (!accounts || accounts.length === 0) {
                throw new Error('No accounts found');
            }
            
            // Get signer after successful connection
            this.signer = this.provider.getSigner();
            
            // Log network info but don't force switch
            try {
                const network = await this.provider.getNetwork();
                console.log('Connected to network:', network.name, 'Chain ID:', network.chainId);
            } catch (netError) {
                console.warn('Could not detect network:', netError);
            }
            
            return accounts[0];
        } catch (error) {
            console.error('Failed to connect wallet:', error);
            throw error;
        }
    }

    // Switch network
    async switchNetwork(networkName) {
        const network = CONFIG.networks[networkName];
        if (!network) throw new Error('Unknown network');

        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: network.chainId }],
            });
        } catch (switchError) {
            // This error code indicates that the chain has not been added to MetaMask
            if (switchError.code === 4902) {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: network.chainId,
                        chainName: network.chainName,
                        rpcUrls: [network.rpcUrl],
                    }],
                });
            }
        }
    }

    // Load contracts
    async loadContracts() {
        if (!CONTRACT_ADDRESSES.AutophageToken) {
            throw new Error('Contract addresses not set. Please deploy contracts first.');
        }

        if (CONFIG.demoMode.enabled) {
            // Return mock contracts for demo mode
            this.contracts = this.createMockContracts();
            return;
        }

        try {
            this.contracts.autophageToken = new ethers.Contract(
                CONTRACT_ADDRESSES.AutophageToken,
                CONFIG.abis.AutophageToken,
                this.signer
            );

            this.contracts.mockUSDC = new ethers.Contract(
                CONTRACT_ADDRESSES.MockUSDC,
                CONFIG.abis.MockERC20,
                this.signer
            );

            this.contracts.reservoir = new ethers.Contract(
                CONTRACT_ADDRESSES.ReservoirContract,
                CONFIG.abis.ReservoirContract,
                this.signer
            );

            this.contracts.verificationEngine = new ethers.Contract(
                CONTRACT_ADDRESSES.VerificationEngine,
                CONFIG.abis.VerificationEngine,
                this.signer
            );

            this.contracts.governance = new ethers.Contract(
                CONTRACT_ADDRESSES.GovernanceContract,
                CONFIG.abis.GovernanceContract,
                this.signer
            );
        } catch (error) {
            console.error('Failed to load contracts:', error);
            throw error;
        }
    }

    // Create mock contracts for demo mode
    createMockContracts() {
        this.mockBalances = { ...CONFIG.demoMode.mockBalances };
        this.mockTransactions = [];

        return {
            autophageToken: {
                balanceOf: async (address, species) => {
                    // Simulate decay
                    const balance = ethers.utils.parseEther(this.mockBalances[species] || '0');
                    const decayRate = CONFIG.species[species].decay;
                    const decayed = balance.mul(100 - Math.floor(decayRate * 100)).div(100);
                    return decayed;
                },
                mint: async (to, species, amount) => {
                    const currentBalance = parseFloat(this.mockBalances[species] || '0');
                    this.mockBalances[species] = (currentBalance + parseFloat(ethers.utils.formatEther(amount))).toString();
                    this.mockTransactions.push({
                        type: 'Mint',
                        species,
                        amount: ethers.utils.formatEther(amount),
                        timestamp: Date.now()
                    });
                    return { wait: async () => ({ transactionHash: '0xdemo' + Date.now() }) };
                },
                transfer: async (to, species, amount) => {
                    const currentBalance = parseFloat(this.mockBalances[species] || '0');
                    const transferAmount = parseFloat(ethers.utils.formatEther(amount));
                    if (currentBalance >= transferAmount) {
                        this.mockBalances[species] = (currentBalance - transferAmount).toString();
                        this.mockTransactions.push({
                            type: 'Transfer',
                            species,
                            amount: ethers.utils.formatEther(amount),
                            to,
                            timestamp: Date.now()
                        });
                    }
                    return { wait: async () => ({ transactionHash: '0xdemo' + Date.now() }) };
                },
                lockInVault: async (species, amount, lockDays) => {
                    this.mockTransactions.push({
                        type: 'Lock',
                        species,
                        amount: ethers.utils.formatEther(amount),
                        lockDays,
                        timestamp: Date.now()
                    });
                    return { wait: async () => ({ transactionHash: '0xdemo' + Date.now() }) };
                },
                hasRole: async () => true,
                grantRole: async () => ({ wait: async () => ({}) }),
                totalSupply: async (species) => {
                    // Return mock total supply for each species
                    const supplies = {
                        0: ethers.utils.parseEther('2500000'), // 2.5M RHY
                        1: ethers.utils.parseEther('3200000'), // 3.2M HLN
                        2: ethers.utils.parseEther('4100000'), // 4.1M FDN
                        3: ethers.utils.parseEther('2300000')  // 2.3M CTL
                    };
                    return supplies[species] || ethers.utils.parseEther('0');
                }
            },
            mockUSDC: {
                balanceOf: async () => ethers.utils.parseUnits(this.mockBalances.usdc || '88.88', 6), // USDC has 6 decimals
                approve: async () => ({ wait: async () => ({}) })
            },
            reservoir: {
                calculateMetabolicPrice: async () => ethers.utils.parseEther('0.0023'),
                getReservoirStats: async () => {
                    // Return mock reservoir stats
                    // USDC reserve starts at 0 for demo
                    return {
                        tokenBalances: [
                            ethers.utils.parseEther('0'),
                            ethers.utils.parseEther('0'),
                            ethers.utils.parseEther('0'),
                            ethers.utils.parseEther('0')
                        ],
                        usdcReserve: ethers.utils.parseUnits('0', 6), // 0 USDC with 6 decimals
                        pendingClaims: ethers.BigNumber.from(0),
                        isSolvent: false // Not solvent when no USDC
                    };
                }
            }
        };
    }

    // Get balance for a specific species
    async getBalance(address, species) {
        try {
            const balance = await this.contracts.autophageToken.balanceOf(address, species);
            return ethers.utils.formatEther(balance);
        } catch (error) {
            console.error('Failed to get balance:', error);
            return '0.00';
        }
    }
    
    // Get USDC balance
    async getUSDCBalance(address) {
        if (CONFIG.demoMode.enabled) {
            // Return the mock USDC balance for the address
            return this.mockBalances.usdc || '88.88';
        }
        try {
            const balance = await this.contracts.mockUSDC.balanceOf(address);
            return ethers.utils.formatUnits(balance, 6); // USDC has 6 decimals
        } catch (error) {
            console.error('Failed to get USDC balance:', error);
            return '0.00';
        }
    }

    // Mint tokens
    async mintTokens(recipient, species, amount) {
        try {
            const tx = await this.contracts.autophageToken.mint(
                recipient,
                species,
                ethers.utils.parseEther(amount.toString())
            );
            return await tx.wait();
        } catch (error) {
            console.error('Mint failed:', error);
            throw error;
        }
    }

    // Transfer tokens
    async transferTokens(recipient, species, amount) {
        try {
            const tx = await this.contracts.autophageToken.transfer(
                recipient,
                species,
                ethers.utils.parseEther(amount.toString())
            );
            return await tx.wait();
        } catch (error) {
            console.error('Transfer failed:', error);
            throw error;
        }
    }

    // Lock tokens in vault
    async lockInVault(species, amount, lockDays) {
        try {
            const tx = await this.contracts.autophageToken.lockInVault(
                species,
                ethers.utils.parseEther(amount.toString()),
                lockDays
            );
            return await tx.wait();
        } catch (error) {
            console.error('Lock failed:', error);
            throw error;
        }
    }


    // Check if user has minter role
    async hasMinterRole(address) {
        try {
            const MINTER_ROLE = await this.contracts.autophageToken.MINTER_ROLE();
            return await this.contracts.autophageToken.hasRole(MINTER_ROLE, address);
        } catch (error) {
            console.error('Role check failed:', error);
            return false;
        }
    }

    // Grant minter role (for demo)
    async grantMinterRole(address) {
        try {
            const MINTER_ROLE = await this.contracts.autophageToken.MINTER_ROLE();
            const tx = await this.contracts.autophageToken.grantRole(MINTER_ROLE, address);
            return await tx.wait();
        } catch (error) {
            console.error('Grant role failed:', error);
            throw error;
        }
    }
    
    // Get metabolic price
    async getMetabolicPrice() {
        if (CONFIG.demoMode.enabled) {
            return '0.0023';
        }
        try {
            const price = await this.contracts.reservoir.calculateMetabolicPrice();
            return ethers.utils.formatUnits(price, 18);
        } catch (error) {
            console.error('Failed to get metabolic price:', error);
            return '0.0023';
        }
    }
    
    // Get token supplies
    async getTokenSupplies() {
        if (CONFIG.demoMode.enabled) {
            return ['2500000', '3200000', '4100000', '2300000'];
        }
        try {
            const supplies = [];
            for (let i = 0; i < 4; i++) {
                const supply = await this.contracts.autophageToken.totalSupply(i);
                supplies.push(ethers.utils.formatUnits(supply, 18));
            }
            return supplies;
        } catch (error) {
            console.error('Failed to get token supplies:', error);
            return ['0', '0', '0', '0'];
        }
    }
    
    // Get reservoir stats
    async getReservoirStats() {
        if (CONFIG.demoMode.enabled) {
            return {
                tokenBalance: 125430,
                usdcReserve: '45200',
                pendingClaims: 3,
                isSolvent: true
            };
        }
        try {
            const stats = await this.contracts.reservoir.getReservoirStats();
            const totalTokens = stats.tokenBalances.reduce((sum, bal) => 
                sum.add(bal), ethers.BigNumber.from(0));
            
            return {
                tokenBalance: parseFloat(ethers.utils.formatUnits(totalTokens, 18)),
                usdcReserve: ethers.utils.formatUnits(stats.usdcReserve, 6), // USDC has 6 decimals
                pendingClaims: stats.pendingClaims.toNumber(),
                isSolvent: stats.isSolvent
            };
        } catch (error) {
            console.error('Failed to get reservoir stats:', error);
            return {
                tokenBalance: 0,
                usdcReserve: '0',
                pendingClaims: 0,
                isSolvent: false // Not solvent when no USDC
            };
        }
    }
}

// Export for use in app.js
window.ContractManager = ContractManager;