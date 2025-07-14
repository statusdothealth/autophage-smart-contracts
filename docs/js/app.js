// Main application logic with wallet management

class AutophageApp {
    constructor() {
        this.contractManager = new ContractManager();
        this.currentAccount = null;
        this.updateInterval = null;
        this.transactions = [];
    }

    async init() {
        // Load saved contract addresses
        loadContractAddresses();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Check for saved wallet
        const current = window.walletManager.getCurrentWallet();
        if (current) {
            await this.switchWallet(current.address);
        }
        
        // Initialize UI
        this.updateUI();
        
        // Set USDC balance to 0 on init (will be set to 88.88 when wallet is created)
        const usdcElement = document.getElementById('usdcBalance');
        if (usdcElement && !this.currentAccount) {
            usdcElement.textContent = '0.00';
        }
        
        // Initialize system metrics
        this.updateSystemMetrics();
        
        // Update last modified date
        this.updateLastModified();
    }
    
    async updateLastModified() {
        const deploymentDateElement = document.getElementById('deployment-date');
        if (!deploymentDateElement) return;
        
        try {
            // Fetch the current page to get its last-modified header
            const response = await fetch(window.location.pathname, {
                method: 'HEAD'
            });
            
            const lastModified = response.headers.get('last-modified');
            if (lastModified) {
                const date = new Date(lastModified);
                deploymentDateElement.textContent = date.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            } else {
                // Fallback to current date
                deploymentDateElement.textContent = new Date().toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            }
        } catch (error) {
            // If fetch fails, use current date
            deploymentDateElement.textContent = new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
    }

    setupEventListeners() {
        // Wallet connection
        const createWalletBtn = document.getElementById('createWallet');
        if (createWalletBtn) {
            createWalletBtn.addEventListener('click', () => this.createTestWallet());
        }
        
        const manageWalletsBtn = document.getElementById('manageWallets');
        if (manageWalletsBtn) {
            manageWalletsBtn.addEventListener('click', () => this.showWalletModal());
        }
        
        // Wallet selector
        const walletSelect = document.getElementById('walletSelect');
        if (walletSelect) {
            walletSelect.addEventListener('change', (e) => this.switchWallet(e.target.value));
        }
        
        // Tabs
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
        
        // Forms
        document.getElementById('mintForm').addEventListener('submit', (e) => this.handleMint(e));
        document.getElementById('transferForm').addEventListener('submit', (e) => this.handleTransfer(e));
        document.getElementById('vaultForm').addEventListener('submit', (e) => this.handleVault(e));
        document.getElementById('exchangeForm').addEventListener('submit', (e) => this.handleExchange(e));
        document.getElementById('activityForm').addEventListener('submit', (e) => this.handleActivity(e));
        
        // Activity buttons
        document.querySelectorAll('.btn-activity').forEach(btn => {
            btn.addEventListener('click', (e) => this.showActivityModal(e.target.dataset.activity));
        });
        
        // Modal
        document.querySelector('.close').addEventListener('click', () => this.closeModal());
        
        // Vault duration slider
        document.getElementById('vaultDuration').addEventListener('input', (e) => {
            const reduction = Math.min(e.target.value * 0.5, 50);
            document.getElementById('decayReduction').textContent = reduction.toFixed(1) + '%';
        });
        
        // Vault objective selector
        const vaultObjective = document.getElementById('vaultObjective');
        if (vaultObjective) {
            vaultObjective.addEventListener('change', (e) => {
                const display = document.getElementById('objectiveDisplay');
                if (display) {
                    display.textContent = e.target.selectedOptions[0].text || '-';
                }
            });
        }
        
        // Activity intensity slider
        document.getElementById('activityIntensity').addEventListener('input', (e) => {
            document.getElementById('intensityValue').textContent = e.target.value;
            this.updateRewardEstimate();
        });
        
        document.getElementById('activityDuration').addEventListener('input', () => this.updateRewardEstimate());
        
        // Exchange amount input
        document.getElementById('exchangeAmount').addEventListener('input', () => this.updateExchangeEstimate());
        document.getElementById('exchangeSpecies').addEventListener('change', () => this.updateExchangeEstimate());
        document.getElementById('exchangeOperation').addEventListener('change', () => this.updateExchangeEstimate());
        
        // Multi-activity form
        this.setupMultiActivityListeners();
    }
    
    setupMultiActivityListeners() {
        const activities = ['Exercise', 'Therapy', 'Nutrition', 'Checkup'];
        
        activities.forEach(activity => {
            const checkbox = document.getElementById(`multi${activity}`);
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    const inputs = e.target.parentElement.nextElementSibling;
                    if (inputs) {
                        inputs.style.display = e.target.checked ? 'block' : 'none';
                    }
                    this.updateMultiActivityEstimate();
                });
            }
            
            // Listen to duration/intensity changes
            const duration = document.getElementById(`multi${activity}Duration`);
            const intensity = document.getElementById(`multi${activity}Intensity`);
            if (duration) duration.addEventListener('input', () => this.updateMultiActivityEstimate());
            if (intensity) intensity.addEventListener('input', () => this.updateMultiActivityEstimate());
        });
        
        // Multi-activity form submission
        document.getElementById('multiActivityForm')?.addEventListener('submit', (e) => this.handleMultiActivity(e));
    }

    async connectMetaMask() {
        try {
            this.showToast('Connecting to MetaMask...', 'info');
            
            await this.contractManager.init();
            const address = await this.contractManager.connectWallet();
            
            // Add to wallet manager
            const wallet = window.walletManager.addMetaMaskWallet(address);
            window.walletManager.setCurrentWallet(address);
            
            this.currentAccount = address;
            window.currentAccount = address;
            
            // Load contracts
            if (!CONTRACT_ADDRESSES.AutophageToken) {
                const addresses = await this.promptForContractAddresses();
                if (addresses) {
                    saveContractAddresses(addresses);
                }
            }
            
            await this.contractManager.loadContracts();
            
            // Check and grant minter role if needed
            const hasMinterRole = await this.contractManager.hasMinterRole(this.currentAccount);
            if (!hasMinterRole) {
                await this.contractManager.grantMinterRole(this.currentAccount);
            }
            
            // Update UI
            document.querySelector('.wallet-controls').style.display = 'none';
            document.getElementById('walletInfo').style.display = 'block';
            
            this.updateWalletSelector();
            this.updateWalletDisplay();
            this.updateRecipientWalletSelector();
            
            // Start balance updates
            this.startBalanceUpdates();
            
            this.showToast('MetaMask connected successfully!', 'success');
        } catch (error) {
            console.error('Connection error:', error);
            this.showToast('Failed to connect: ' + error.message, 'error');
        }
    }

    createTestWallet() {
        const wallet = window.walletManager.createWallet();
        window.walletManager.setCurrentWallet(wallet.address);
        
        CONFIG.demoMode.enabled = true;
        this.currentAccount = wallet.address;
        window.currentAccount = wallet.address;
        
        // Initialize demo mode
        this.contractManager.init();
        this.contractManager.contracts = this.contractManager.createMockContracts();
        
        // Update UI - keep wallet info visible
        document.getElementById('walletInfo').style.display = 'block';
        
        // Hide controls only if this is the first wallet
        if (window.walletManager.getWallets().length === 1) {
            document.querySelector('.wallet-controls').style.display = 'none';
        }
        
        this.updateWalletSelector();
        this.updateWalletDisplay();
        this.updateRecipientWalletSelector();
        
        // Start balance updates
        this.startBalanceUpdates();
        
        this.showToast(`Test wallet created: ${wallet.name}`, 'success');
        return wallet;
    }

    updateWalletSelector() {
        const select = document.getElementById('walletSelect');
        if (!select) return;
        
        const wallets = window.walletManager.getWallets();
        const current = window.walletManager.getCurrentWallet();
        
        select.innerHTML = '';
        wallets.forEach(wallet => {
            const option = document.createElement('option');
            option.value = wallet.address;
            option.textContent = `${wallet.name} (${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)})`;
            if (current && wallet.address === current.address) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    }

    updateWalletDisplay() {
        const current = window.walletManager.getCurrentWallet();
        if (current) {
            document.querySelector('.address').textContent = 
                current.address.slice(0, 6) + '...' + current.address.slice(-4);
            document.querySelector('.network').textContent = 
                current.type === 'metamask' ? 'MetaMask' : 'Test Wallet';
        }
    }

    async switchWallet(address) {
        if (!address) return;
        
        const wallet = window.walletManager.setCurrentWallet(address);
        if (wallet) {
            this.currentAccount = wallet.address;
            window.currentAccount = wallet.address;
            
            if (wallet.type === 'metamask') {
                // Re-connect to MetaMask if needed
                CONFIG.demoMode.enabled = false;
                await this.contractManager.init();
                await this.contractManager.loadContracts();
            } else {
                // Use demo mode for test wallets
                CONFIG.demoMode.enabled = true;
                // Set the mock balances to the wallet's stored balances
                if (wallet.balances) {
                    CONFIG.demoMode.mockBalances = wallet.balances;
                }
                this.contractManager.init();
                this.contractManager.contracts = this.contractManager.createMockContracts();
            }
            
            // Update UI
            document.querySelector('.wallet-controls').style.display = 'none';
            document.getElementById('walletInfo').style.display = 'block';
            
            this.updateWalletDisplay();
            this.updateRecipientWalletSelector();
            this.startBalanceUpdates();
            this.showToast(`Switched to ${wallet.name}`, 'info');
        }
    }

    showWalletModal() {
        this.updateWalletList();
        document.getElementById('walletModal').style.display = 'flex';
    }

    updateWalletList() {
        const walletList = document.getElementById('walletList');
        const wallets = window.walletManager.getWallets();
        const current = window.walletManager.getCurrentWallet();
        
        walletList.innerHTML = '';
        
        if (wallets.length === 0) {
            walletList.innerHTML = '<p class="empty-state">No wallets yet. Create a test wallet or connect MetaMask.</p>';
            return;
        }
        
        wallets.forEach(wallet => {
            const div = document.createElement('div');
            div.className = 'wallet-item' + (current && wallet.address === current.address ? ' current' : '');
            div.innerHTML = `
                <div class="wallet-item-info">
                    <div class="wallet-item-name">${wallet.name}</div>
                    <div class="wallet-item-address">${wallet.address}</div>
                    <div class="wallet-item-type">${wallet.type}</div>
                </div>
                <div class="wallet-item-actions">
                    <button onclick="app.switchWallet('${wallet.address}')">Use</button>
                    <button onclick="app.renameWallet('${wallet.address}')">Rename</button>
                    <button onclick="app.removeWallet('${wallet.address}')">Remove</button>
                </div>
            `;
            walletList.appendChild(div);
        });
    }

    renameWallet(address) {
        const wallet = window.walletManager.getWallet(address);
        if (wallet) {
            const newName = prompt('Enter new name:', wallet.name);
            if (newName) {
                window.walletManager.renameWallet(address, newName);
                this.updateWalletList();
                this.updateWalletSelector();
                this.updateRecipientWalletSelector();
                this.showToast('Wallet renamed', 'success');
            }
        }
    }

    removeWallet(address) {
        if (confirm('Remove this wallet?')) {
            window.walletManager.removeWallet(address);
            this.updateWalletList();
            this.updateWalletSelector();
            this.updateRecipientWalletSelector();
            
            // If removed current wallet, clear UI
            const current = window.walletManager.getCurrentWallet();
            if (!current) {
                document.querySelector('.wallet-controls').style.display = 'flex';
                document.getElementById('walletInfo').style.display = 'none';
                this.currentAccount = null;
                this.stopBalanceUpdates();
            }
            
            this.showToast('Wallet removed', 'success');
        }
    }

    async promptForContractAddresses() {
        // In a real app, this would be a proper modal
        const message = `Please enter contract addresses (or cancel to use defaults):
        
AutophageToken address:`;
        const autophageToken = prompt(message);
        
        if (!autophageToken) return null;
        
        return {
            AutophageToken: autophageToken,
            MockUSDC: prompt('MockUSDC address:'),
            ReservoirContract: prompt('ReservoirContract address:'),
            VerificationEngine: prompt('VerificationEngine address:'),
            GovernanceContract: prompt('GovernanceContract address:')
        };
    }

    startBalanceUpdates() {
        this.updateBalances();
        this.updateExchangeRates();
        this.updateSystemMetrics();
        
        // Update every 10 seconds
        this.updateInterval = setInterval(() => {
            this.updateBalances();
            this.updateExchangeRates();
            this.updateSystemMetrics();
        }, 10000);
    }

    stopBalanceUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    async updateBalances() {
        if (!this.currentAccount) {
            // Show 0 when no account connected
            const usdcElement = document.getElementById('usdcBalance');
            if (usdcElement) {
                usdcElement.textContent = '0.00';
            }
            
            // Set all token USDC values to 0
            document.querySelectorAll('.token-card .usdc-amount').forEach(el => {
                el.textContent = '0.00';
            });
            
            return;
        }
        
        if (!this.contractManager.contracts.autophageToken) return;
        
        // Update USDC balance
        try {
            const usdcBalance = await this.contractManager.getUSDCBalance(this.currentAccount);
            const usdcElement = document.getElementById('usdcBalance');
            if (usdcElement) {
                usdcElement.textContent = parseFloat(usdcBalance).toFixed(2);
            }
        } catch (error) {
            console.error('Failed to update USDC balance:', error);
            // Keep current value on error
        }
        
        const decayRates = [0.05, 0.0075, 0.001, 0.05]; // Daily decay rates
        const tokenNames = ['RHY', 'HLN', 'FDN', 'CTL'];
        
        for (let i = 0; i < 4; i++) {
            try {
                const balance = await this.contractManager.getBalance(this.currentAccount, i);
                const balanceFloat = parseFloat(balance);
                
                // Update balance display
                document.querySelectorAll('.token-card .balance')[i].textContent = 
                    balanceFloat.toFixed(2);
                
                // Update USDC value display
                const exchangeRates = [1.5, 2.0, 5.0, 0.8]; // Exchange rates per token
                const metabolicPrice = parseFloat(document.getElementById('metabolicPrice')?.textContent || '0.0023');
                const usdcValue = balanceFloat * exchangeRates[i] * metabolicPrice;
                const usdcElement = document.querySelectorAll('.token-card .usdc-amount')[i];
                if (usdcElement) {
                    usdcElement.textContent = usdcValue.toFixed(2);
                }
                
                // Get metric elements
                const metricsElement = document.querySelectorAll('.token-card .token-metrics')[i];
                const lifetimeValueElement = document.querySelectorAll('.token-card .lifetime-value')[i];
                const lossValueElement = document.querySelectorAll('.token-card .loss-value')[i];
                const suggestionElement = document.querySelectorAll('.token-card .suggestion-text')[i];
                
                if (balanceFloat > 0) {
                    // Calculate lifetime
                    const lifetime = this.calculateTokenLifetime(balanceFloat, decayRates[i]);
                    lifetimeValueElement.textContent = lifetime;
                    
                    // Calculate daily loss
                    const dailyLoss = balanceFloat * decayRates[i];
                    lossValueElement.textContent = `${dailyLoss.toFixed(2)} ${tokenNames[i]}`;
                    
                    // Get usage suggestion
                    const suggestion = this.getUsageSuggestion(i, balanceFloat, decayRates[i]);
                    suggestionElement.textContent = suggestion;
                    
                    metricsElement.style.display = 'block';
                } else {
                    metricsElement.style.display = 'none';
                }
            } catch (error) {
                console.error('Failed to update balance:', error);
            }
        }
    }
    
    calculateTokenLifetime(balance, dailyDecayRate) {
        // Calculate when balance will reach 0.01 (effectively zero)
        const minBalance = 0.01;
        
        if (balance <= minBalance) return 'expired';
        
        // Using exponential decay formula: balance * (1 - rate)^days = minBalance
        // days = log(minBalance/balance) / log(1 - rate)
        const days = Math.log(minBalance / balance) / Math.log(1 - dailyDecayRate);
        
        if (days < 1) {
            const hours = Math.floor(days * 24);
            return `${hours} hours`;
        } else if (days < 30) {
            return `${Math.floor(days)} days`;
        } else if (days < 365) {
            const months = Math.floor(days / 30);
            const remainingDays = Math.floor(days % 30);
            if (remainingDays > 0) {
                return `${months}mo ${remainingDays}d`;
            }
            return `${months} months`;
        } else {
            const years = Math.floor(days / 365);
            const remainingMonths = Math.floor((days % 365) / 30);
            if (remainingMonths > 0) {
                return `${years}y ${remainingMonths}mo`;
            }
            return `${years} years`;
        }
    }
    
    getUsageSuggestion(species, balance, decayRate) {
        const days = Math.log(0.01 / balance) / Math.log(1 - decayRate);
        const dailyLoss = balance * decayRate;
        
        switch(species) {
            case 0: // Rhythm
                if (days < 7) {
                    return 'Use soon! Perfect for daily exercise tracking';
                } else if (days < 30) {
                    return 'Lock in wellness vault for 50% decay reduction';
                } else {
                    return 'Consider exchanging some for immediate health activities';
                }
                
            case 1: // Healing
                if (days < 60) {
                    return 'Schedule therapy sessions this month';
                } else if (days < 180) {
                    return 'Lock 30% in vault for long-term recovery goals';
                } else {
                    return 'Strong balance - maintain regular wellness activities';
                }
                
            case 2: // Foundation
                if (days < 365) {
                    return 'Use for preventive care checkups';
                } else if (days < 730) {
                    return 'Consider long-term vault lock (365 days) for 90% decay reduction';
                } else {
                    return 'Excellent reserve - plan annual health goals';
                }
                
            case 3: // Catalyst
                if (balance < 100) {
                    return 'Build reserves for marketplace participation';
                } else if (dailyLoss > 10) {
                    return 'High decay rate - use in marketplace or exchange';
                } else {
                    return 'Ready for marketplace activities';
                }
                
            default:
                return 'Monitor balance and plan usage';
        }
    }

    async updateExchangeRates() {
        if (!this.contractManager.contracts.reservoir) return;
        
        const symbols = ['RHY', 'HLN', 'FDN', 'CTL'];
        const rateElements = document.querySelectorAll('.rate-item span');
        
        for (let i = 0; i < 4; i++) {
            try {
                const rate = await this.contractManager.getExchangeRate(i);
                rateElements[i].textContent = parseFloat(rate).toFixed(4);
            } catch (error) {
                console.error('Failed to update rate:', error);
            }
        }
        
        // Also update USDC values for all token balances when rates change
        await this.updateBalances();
    }
    
    async updateSystemMetrics() {
        // Check if contracts are initialized
        if (!this.contractManager.contracts || !this.contractManager.contracts.reservoir) {
            // Use demo values if contracts not ready
            document.getElementById('metabolicPrice').textContent = '0.0023';
            this.updateDemoSupply();
            
            // Set reservoir to initial state
            document.getElementById('tokenChamber').textContent = '0';
            document.getElementById('usdcReserve').textContent = '0.00';
            document.getElementById('pendingClaims').textContent = '0';
            const solvencyElement = document.getElementById('solvencyStatus');
            solvencyElement.innerHTML = '<svg class="icon icon-inline icon-warning"><use href="assets/icons.svg#icon-warning"></use></svg>';
            solvencyElement.className = 'status-indicator warning';
            return;
        }
        
        // Update metabolic price
        try {
            const price = await this.contractManager.getMetabolicPrice();
            document.getElementById('metabolicPrice').textContent = parseFloat(price).toFixed(4);
        } catch (error) {
            // Use demo value if not connected
            document.getElementById('metabolicPrice').textContent = '0.0023';
        }
        
        // Update token supply
        try {
            const supplies = await this.contractManager.getTokenSupplies();
            const total = supplies.reduce((sum, supply) => sum + parseFloat(supply), 0);
            
            document.getElementById('totalSupply').textContent = this.formatNumber(total);
            
            const tokenNames = ['rhythm', 'healing', 'foundation', 'catalyst'];
            supplies.forEach((supply, i) => {
                const amount = parseFloat(supply);
                const percent = total > 0 ? (amount / total * 100).toFixed(1) : '0';
                
                document.getElementById(`${tokenNames[i]}Supply`).textContent = this.formatNumber(amount);
                document.getElementById(`${tokenNames[i]}Percent`).textContent = percent + '%';
            });
            
            // Update catalyst ratio for price formula
            const catalystRatio = total > 0 ? (parseFloat(supplies[3]) / total * 100).toFixed(1) : '0';
            document.getElementById('catalystRatio').textContent = catalystRatio + '%';
        } catch (error) {
            // Use demo values
            this.updateDemoSupply();
        }
        
        // Update reservoir status
        try {
            const stats = await this.contractManager.getReservoirStats();
            document.getElementById('tokenChamber').textContent = this.formatNumber(stats.tokenBalance);
            document.getElementById('usdcReserve').textContent = parseFloat(stats.usdcReserve).toFixed(2);
            document.getElementById('pendingClaims').textContent = stats.pendingClaims;
            
            const solvencyElement = document.getElementById('solvencyStatus');
            // Check if USDC reserve is 0
            const usdcValue = parseFloat(stats.usdcReserve || '0');
            const isTrulySolvent = usdcValue > 0 && stats.isSolvent;
            
            if (isTrulySolvent) {
                solvencyElement.innerHTML = '<svg class="icon icon-inline icon-success"><use href="assets/icons.svg#icon-check"></use></svg>';
                solvencyElement.className = 'status-indicator';
            } else {
                solvencyElement.innerHTML = '<svg class="icon icon-inline icon-warning"><use href="assets/icons.svg#icon-warning"></use></svg>';
                solvencyElement.className = 'status-indicator warning';
            }
        } catch (error) {
            // Use demo values
            document.getElementById('tokenChamber').textContent = '0';
            document.getElementById('usdcReserve').textContent = '0.00';
            document.getElementById('pendingClaims').textContent = '0';
            const solvencyElement = document.getElementById('solvencyStatus');
            solvencyElement.innerHTML = '<svg class="icon icon-inline icon-warning"><use href="assets/icons.svg#icon-warning"></use></svg>';
            solvencyElement.className = 'status-indicator warning';
        }
    }
    
    updateDemoSupply() {
        // Demo token distribution
        const supplies = {
            rhythm: 2500000,
            healing: 3200000,
            foundation: 4100000,
            catalyst: 2300000
        };
        
        const total = Object.values(supplies).reduce((sum, val) => sum + val, 0);
        
        document.getElementById('totalSupply').textContent = this.formatNumber(total);
        
        Object.entries(supplies).forEach(([token, supply]) => {
            const percent = (supply / total * 100).toFixed(1);
            document.getElementById(`${token}Supply`).textContent = this.formatNumber(supply);
            document.getElementById(`${token}Percent`).textContent = percent + '%';
        });
        
        const catalystRatio = (supplies.catalyst / total * 100).toFixed(1);
        document.getElementById('catalystRatio').textContent = catalystRatio + '%';
    }
    
    formatNumber(num) {
        return new Intl.NumberFormat('en-US').format(Math.floor(num));
    }

    switchTab(tabName) {
        // Update active tab
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // Show corresponding pane
        document.querySelectorAll('.tab-pane').forEach(p => p.style.display = 'none');
        document.getElementById(`${tabName}Tab`).style.display = 'block';
        
        // Update vaults list when switching to My Vaults tab
        if (tabName === 'myvaults') {
            this.updateVaultsList();
        }
    }

    async handleMint(e) {
        e.preventDefault();
        
        if (!this.currentAccount) {
            if (this.promptWalletCreation()) {
                setTimeout(() => this.handleMint(e), 500);
            }
            return;
        }
        
        const recipient = document.getElementById('mintRecipient').value;
        const species = parseInt(document.getElementById('mintSpecies').value);
        const amount = document.getElementById('mintAmount').value;
        
        try {
            this.showToast('Minting tokens...', 'info');
            
            const receipt = await this.contractManager.mintTokens(recipient, species, amount);
            
            this.addTransaction('Mint', {
                species: CONFIG.species[species].symbol,
                amount,
                recipient,
                txHash: receipt.transactionHash
            });
            
            this.showToast(`Successfully minted ${amount} ${CONFIG.species[species].name} tokens!`, 'success');
            
            // Reset form and update balances
            e.target.reset();
            await this.updateBalances();
            
            // Sync wallet balances for test wallets
            if (window.walletManager.getCurrentWallet()?.type === 'test') {
                const balances = {};
                for (let i = 0; i < 4; i++) {
                    const balance = await this.contractManager.getBalance(this.currentAccount, i);
                    balances[i] = balance;
                }
                window.walletManager.updateWalletBalances(this.currentAccount, balances);
            }
        } catch (error) {
            this.showToast('Minting failed: ' + error.message, 'error');
        }
    }

    async handleTransfer(e) {
        e.preventDefault();
        
        if (!this.currentAccount) {
            if (this.promptWalletCreation()) {
                setTimeout(() => this.handleTransfer(e), 500);
            }
            return;
        }
        
        const recipient = document.getElementById('transferRecipient').value;
        const species = parseInt(document.getElementById('transferSpecies').value);
        const amount = document.getElementById('transferAmount').value;
        
        try {
            this.showToast('Transferring tokens...', 'info');
            
            const receipt = await this.contractManager.transferTokens(recipient, species, amount);
            
            this.addTransaction('Transfer', {
                species: CONFIG.species[species].symbol,
                amount,
                recipient,
                txHash: receipt.transactionHash
            });
            
            this.showToast(`Successfully transferred ${amount} ${CONFIG.species[species].name} tokens!`, 'success');
            
            // Reset form and update balances
            e.target.reset();
            await this.updateBalances();
            
            // Sync wallet balances for test wallets
            if (window.walletManager.getCurrentWallet()?.type === 'test') {
                const balances = {};
                for (let i = 0; i < 4; i++) {
                    const balance = await this.contractManager.getBalance(this.currentAccount, i);
                    balances[i] = balance;
                }
                window.walletManager.updateWalletBalances(this.currentAccount, balances);
            }
        } catch (error) {
            this.showToast('Transfer failed: ' + error.message, 'error');
        }
    }

    async handleVault(e) {
        e.preventDefault();
        
        if (!this.currentAccount) {
            if (this.promptWalletCreation()) {
                setTimeout(() => this.handleVault(e), 500);
            }
            return;
        }
        
        const objective = document.getElementById('vaultObjective').value;
        const species = parseInt(document.getElementById('vaultSpecies').value);
        const amount = document.getElementById('vaultAmount').value;
        const duration = parseInt(document.getElementById('vaultDuration').value);
        
        if (!objective) {
            this.showToast('Please select a health objective', 'error');
            return;
        }
        
        try {
            this.showToast('Locking tokens in vault...', 'info');
            
            const receipt = await this.contractManager.lockInVault(species, amount, duration);
            
            const objectiveText = document.getElementById('vaultObjective').selectedOptions[0].text;
            
            // Save vault to localStorage
            const vault = {
                id: Date.now().toString(),
                objective: objectiveText,
                objectiveKey: objective,
                species: species,
                amount: parseFloat(amount),
                duration: duration,
                startDate: new Date().toISOString(),
                endDate: new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString(),
                txHash: receipt.transactionHash,
                active: true
            };
            
            const vaults = JSON.parse(localStorage.getItem('wellnessVaults') || '[]');
            vaults.push(vault);
            localStorage.setItem('wellnessVaults', JSON.stringify(vaults));
            
            this.addTransaction('Vault Lock', {
                objective: objectiveText,
                species: CONFIG.species[species].symbol,
                amount,
                duration: duration + ' days',
                txHash: receipt.transactionHash
            });
            
            this.showToast(`Successfully locked ${amount} ${CONFIG.species[species].name} tokens for ${duration} days toward ${objectiveText}!`, 'success');
            
            // Reset form and update balances
            e.target.reset();
            document.getElementById('objectiveDisplay').textContent = '-';
            this.updateBalances();
            this.updateVaultsList();
        } catch (error) {
            this.showToast('Vault lock failed: ' + error.message, 'error');
        }
    }

    async handleExchange(e) {
        e.preventDefault();
        
        if (!this.currentAccount) {
            if (this.promptWalletCreation()) {
                setTimeout(() => this.handleExchange(e), 500);
            }
            return;
        }
        
        const operation = document.getElementById('exchangeOperation').value;
        const species = parseInt(document.getElementById('exchangeSpecies').value);
        const amount = document.getElementById('exchangeAmount').value;
        
        try {
            this.showToast(`${operation === 'buy' ? 'Buying' : 'Selling'} tokens...`, 'info');
            
            let receipt;
            if (operation === 'buy') {
                receipt = await this.contractManager.buyTokens(species, amount);
            } else {
                receipt = await this.contractManager.sellTokens(species, amount);
            }
            
            this.addTransaction(operation === 'buy' ? 'Buy' : 'Sell', {
                species: CONFIG.species[species].symbol,
                amount,
                txHash: receipt.transactionHash
            });
            
            this.showToast(`Successfully ${operation === 'buy' ? 'bought' : 'sold'} ${amount} ${CONFIG.species[species].name} tokens!`, 'success');
            
            // Reset form and update balances
            e.target.reset();
            await this.updateBalances();
            this.updateExchangeRates();
            
            // Sync wallet balances for test wallets
            if (window.walletManager.getCurrentWallet()?.type === 'test') {
                const balances = {};
                for (let i = 0; i < 4; i++) {
                    const balance = await this.contractManager.getBalance(this.currentAccount, i);
                    balances[i] = balance;
                }
                window.walletManager.updateWalletBalances(this.currentAccount, balances);
            }
        } catch (error) {
            this.showToast('Exchange failed: ' + error.message, 'error');
        }
    }

    showActivityModal(activityType) {
        if (!this.currentAccount) {
            if (this.promptWalletCreation()) {
                setTimeout(() => this.showActivityModal(activityType), 500);
            }
            return;
        }
        
        document.getElementById('activityType').value = activityType;
        document.getElementById('activityModal').style.display = 'flex';
        this.updateMultiplierStatus();
        this.updateRewardEstimate();
    }
    
    updateMultiplierStatus() {
        // Get today's activities from localStorage
        const today = new Date().toDateString();
        const activityHistory = JSON.parse(localStorage.getItem('activityHistory') || '{}');
        const todayActivities = activityHistory[today] || [];
        
        // Count unique activities today
        const uniqueActivities = new Set(todayActivities.map(a => a.type)).size;
        
        // Calculate multiplier based on activities
        let multiplier = 1;
        if (uniqueActivities >= 4) multiplier = 5;
        else if (uniqueActivities >= 3) multiplier = 3;
        else if (uniqueActivities >= 2) multiplier = 2;
        
        // Calculate streak bonus
        let streakDays = parseInt(localStorage.getItem('streakDays') || '0');
        const streakBonus = Math.min(streakDays * 0.1, 0.7); // 10% per day, max 70%
        
        // Get CTL balance for boost calculation
        let ctlBoost = 0;
        if (this.currentAccount) {
            try {
                const ctlBalance = parseFloat(document.querySelectorAll('.token-card .balance')[3]?.textContent || '0');
                ctlBoost = Math.min(ctlBalance * 0.001, 0.5); // 0.1% per token, max 50%
            } catch (error) {
                console.error('Failed to get CTL balance:', error);
            }
        }
        
        // Update UI
        document.getElementById('activitiesToday').textContent = uniqueActivities;
        document.getElementById('currentMultiplier').textContent = multiplier + 'x';
        document.getElementById('streakDays').textContent = streakDays;
        document.getElementById('ctlBonus').textContent = (ctlBoost * 100).toFixed(1);
        
        // Update streak bonus display
        const streakElement = document.getElementById('streakDays').parentElement;
        streakElement.innerHTML = `Streak days: <span id="streakDays">${streakDays}</span> (${(streakBonus * 100).toFixed(0)}% bonus)`;
        
        // Update CTL boost display
        const ctlElement = document.getElementById('ctlBonus').parentElement;
        ctlElement.innerHTML = `CTL holdings: <span id="ctlBonus">${document.querySelectorAll('.token-card .balance')[3]?.textContent || '0'}</span> tokens (${(ctlBoost * 100).toFixed(1)}% boost)`;
        
        // Store current multiplier info for reward calculation
        this.currentMultiplier = multiplier * (1 + streakBonus + ctlBoost);
    }

    closeModal() {
        document.getElementById('activityModal').style.display = 'none';
    }
    
    promptWalletCreation() {
        if (confirm('You need a wallet to perform this action. Would you like to create a test wallet now?')) {
            this.createTestWallet();
            return true;
        }
        return false;
    }
    
    showMultiActivityModal() {
        if (!this.currentAccount) {
            if (this.promptWalletCreation()) {
                setTimeout(() => this.showMultiActivityModal(), 500);
            }
            return;
        }
        
        document.getElementById('multiActivityModal').style.display = 'flex';
        this.updateMultiActivityEstimate();
    }
    
    closeMultiActivityModal() {
        document.getElementById('multiActivityModal').style.display = 'none';
    }
    
    updateMultiActivityEstimate() {
        const activities = ['Exercise', 'Therapy', 'Nutrition', 'Checkup'];
        let selectedCount = 0;
        let totalReward = 0;
        let totalUSDC = 0;
        
        activities.forEach((activity, index) => {
            const checkbox = document.getElementById(`multi${activity}`);
            if (checkbox && checkbox.checked) {
                selectedCount++;
                
                const duration = parseInt(document.getElementById(`multi${activity}Duration`).value) || 30;
                const intensity = parseInt(document.getElementById(`multi${activity}Intensity`).value) || 50;
                
                const baseReward = CONFIG.activities[index].baseReward;
                const durationMultiplier = Math.min(duration / 30, 2);
                const intensityMultiplier = intensity / 100;
                
                const reward = baseReward * durationMultiplier * intensityMultiplier;
                totalReward += reward;
                
                // Calculate USDC value
                const exchangeRates = [1.5, 2.0, 5.0, 0.8];
                const metabolicPrice = parseFloat(document.getElementById('metabolicPrice')?.textContent || '0.0023');
                totalUSDC += reward * exchangeRates[index] * metabolicPrice;
            }
        });
        
        // Calculate multiplier based on selected activities
        let multiplier = 1;
        if (selectedCount >= 4) multiplier = 5;
        else if (selectedCount >= 3) multiplier = 3;
        else if (selectedCount >= 2) multiplier = 2;
        
        // Apply multiplier to totals
        totalReward *= multiplier;
        totalUSDC *= multiplier;
        
        // Update UI
        document.getElementById('multiSelectedCount').textContent = selectedCount;
        document.getElementById('multiMultiplier').textContent = multiplier + 'x';
        document.getElementById('multiTotalReward').textContent = totalReward.toFixed(2);
        document.getElementById('multiTotalUSDC').textContent = totalUSDC.toFixed(2);
    }

    updateRewardEstimate() {
        const activityType = parseInt(document.getElementById('activityType').value);
        const duration = parseInt(document.getElementById('activityDuration').value) || 30;
        const intensity = parseInt(document.getElementById('activityIntensity').value) || 50;
        
        const baseReward = CONFIG.activities[activityType].baseReward;
        const durationMultiplier = Math.min(duration / 30, 2);
        const intensityMultiplier = intensity / 100;
        
        // Use the current multiplier if available
        const multiplier = this.currentMultiplier || 1;
        
        const totalReward = baseReward * durationMultiplier * intensityMultiplier * multiplier;
        
        document.getElementById('rewardEstimate').textContent = totalReward.toFixed(2);
        
        // Calculate USDC value
        const exchangeRates = [1.5, 2.0, 5.0, 0.8]; // Exchange rates per token
        const metabolicPrice = parseFloat(document.getElementById('metabolicPrice')?.textContent || '0.0023');
        const usdcValue = totalReward * exchangeRates[activityType] * metabolicPrice;
        document.getElementById('rewardUsdcEstimate').textContent = usdcValue.toFixed(2);
    }

    async handleActivity(e) {
        e.preventDefault();
        
        if (!this.currentAccount) {
            if (this.promptWalletCreation()) {
                setTimeout(() => this.handleActivity(e), 500);
            }
            return;
        }
        
        const activityType = parseInt(document.getElementById('activityType').value);
        const duration = parseInt(document.getElementById('activityDuration').value);
        const intensity = parseInt(document.getElementById('activityIntensity').value);
        
        try {
            this.showToast('Recording activity...', 'info');
            
            // Calculate reward with multipliers
            const baseReward = CONFIG.activities[activityType].baseReward;
            const durationMultiplier = Math.min(duration / 30, 2);
            const intensityMultiplier = intensity / 100;
            
            // Apply the current multiplier
            const multiplier = this.currentMultiplier || 1;
            const totalReward = baseReward * durationMultiplier * intensityMultiplier * multiplier;
            
            // Track activity for multipliers
            const today = new Date().toDateString();
            const activityHistory = JSON.parse(localStorage.getItem('activityHistory') || '{}');
            if (!activityHistory[today]) activityHistory[today] = [];
            activityHistory[today].push({
                type: activityType,
                time: Date.now(),
                duration: duration,
                intensity: intensity,
                reward: totalReward
            });
            localStorage.setItem('activityHistory', JSON.stringify(activityHistory));
            
            // Update streak if this is the first activity today
            const yesterday = new Date(Date.now() - 86400000).toDateString();
            if (activityHistory[today].length === 1) {
                if (activityHistory[yesterday] && activityHistory[yesterday].length > 0) {
                    // Continue streak
                    const currentStreak = parseInt(localStorage.getItem('streakDays') || '0');
                    localStorage.setItem('streakDays', (currentStreak + 1).toString());
                } else {
                    // Start new streak
                    localStorage.setItem('streakDays', '1');
                }
            }
            
            // Mint reward tokens
            const receipt = await this.contractManager.mintTokens(
                this.currentAccount,
                activityType,
                totalReward.toString()
            );
            
            this.addTransaction('Activity Reward', {
                activity: CONFIG.activities[activityType].name,
                duration: duration + ' min',
                intensity: intensity + '%',
                reward: totalReward.toFixed(2) + ' ' + CONFIG.species[activityType].symbol,
                txHash: receipt.transactionHash
            });
            
            this.showToast(`Earned ${totalReward.toFixed(2)} ${CONFIG.species[activityType].name} tokens!`, 'success');
            
            // Close modal and update balances
            this.closeModal();
            e.target.reset();
            this.updateBalances();
        } catch (error) {
            this.showToast('Activity submission failed: ' + error.message, 'error');
        }
    }
    
    async handleMultiActivity(e) {
        e.preventDefault();
        
        if (!this.currentAccount) {
            if (this.promptWalletCreation()) {
                // Wallet created, wait a moment for it to initialize
                setTimeout(() => this.handleMultiActivity(e), 500);
            }
            return;
        }
        
        const activities = ['Exercise', 'Therapy', 'Nutrition', 'Checkup'];
        const selectedActivities = [];
        let totalRewardByType = {};
        
        // Collect selected activities and calculate individual rewards
        activities.forEach((activity, index) => {
            const checkbox = document.getElementById(`multi${activity}`);
            if (checkbox && checkbox.checked) {
                const duration = parseInt(document.getElementById(`multi${activity}Duration`).value) || 30;
                const intensity = parseInt(document.getElementById(`multi${activity}Intensity`).value) || 50;
                
                const baseReward = CONFIG.activities[index].baseReward;
                const durationMultiplier = Math.min(duration / 30, 2);
                const intensityMultiplier = intensity / 100;
                const reward = baseReward * durationMultiplier * intensityMultiplier;
                
                selectedActivities.push({
                    type: index,
                    name: activity,
                    duration: duration,
                    intensity: intensity,
                    baseReward: reward
                });
                
                if (!totalRewardByType[index]) totalRewardByType[index] = 0;
                totalRewardByType[index] += reward;
            }
        });
        
        if (selectedActivities.length < 2) {
            this.showToast('Please select at least 2 activities for multiplier boost', 'error');
            return;
        }
        
        // Calculate multiplier
        let multiplier = 1;
        if (selectedActivities.length >= 4) multiplier = 5;
        else if (selectedActivities.length >= 3) multiplier = 3;
        else if (selectedActivities.length >= 2) multiplier = 2;
        
        try {
            this.showToast(`Recording ${selectedActivities.length} activities with ${multiplier}x multiplier...`, 'info');
            
            // Track activities in history
            const today = new Date().toDateString();
            const activityHistory = JSON.parse(localStorage.getItem('activityHistory') || '{}');
            if (!activityHistory[today]) activityHistory[today] = [];
            
            // Process each activity type and mint tokens
            for (const [activityType, baseReward] of Object.entries(totalRewardByType)) {
                const finalReward = baseReward * multiplier;
                
                // Mint tokens for this activity type
                await this.contractManager.mintTokens(
                    this.currentAccount,
                    parseInt(activityType),
                    finalReward.toString()
                );
                
                // Add to history
                const activity = selectedActivities.find(a => a.type == activityType);
                activityHistory[today].push({
                    type: parseInt(activityType),
                    time: Date.now(),
                    duration: activity.duration,
                    intensity: activity.intensity,
                    reward: finalReward,
                    multiplier: multiplier
                });
            }
            
            localStorage.setItem('activityHistory', JSON.stringify(activityHistory));
            
            // Update streak
            const yesterday = new Date(Date.now() - 86400000).toDateString();
            if (activityHistory[today].length === selectedActivities.length) {
                if (activityHistory[yesterday] && activityHistory[yesterday].length > 0) {
                    const currentStreak = parseInt(localStorage.getItem('streakDays') || '0');
                    localStorage.setItem('streakDays', (currentStreak + 1).toString());
                } else {
                    localStorage.setItem('streakDays', '1');
                }
            }
            
            // Create transaction summary
            const activitySummary = selectedActivities.map(a => 
                `${a.name}: ${a.duration}min @ ${a.intensity}%`
            ).join(', ');
            
            const totalTokens = Object.entries(totalRewardByType).reduce((sum, [type, reward]) => 
                sum + (reward * multiplier), 0
            );
            
            this.addTransaction('Multi-Activity Reward', {
                activities: activitySummary,
                multiplier: multiplier + 'x',
                totalReward: totalTokens.toFixed(2) + ' tokens',
                breakdown: selectedActivities.map(a => ({
                    name: a.name,
                    reward: (totalRewardByType[a.type] * multiplier).toFixed(2) + ' ' + CONFIG.species[a.type].symbol
                }))
            });
            
            this.showToast(`Successfully logged ${selectedActivities.length} activities with ${multiplier}x multiplier! Earned ${totalTokens.toFixed(2)} tokens total.`, 'success');
            
            // Close modal and update balances
            this.closeMultiActivityModal();
            e.target.reset();
            this.updateBalances();
            
        } catch (error) {
            this.showToast('Multi-activity submission failed: ' + error.message, 'error');
        }
    }

    addTransaction(type, details) {
        const tx = {
            type,
            details,
            timestamp: new Date()
        };
        
        this.transactions.unshift(tx);
        this.updateTransactionList();
    }

    updateTransactionList() {
        const txList = document.getElementById('txList');
        
        if (this.transactions.length === 0) {
            txList.innerHTML = '<p class="empty-state">No transactions yet</p>';
            return;
        }
        
        txList.innerHTML = this.transactions.slice(0, 10).map(tx => {
            const timeAgo = this.getTimeAgo(tx.timestamp);
            let detailsHtml = '';
            
            for (const [key, value] of Object.entries(tx.details)) {
                if (key !== 'txHash') {
                    detailsHtml += `${key}: ${value} | `;
                }
            }
            
            return `
                <div class="tx-item">
                    <div>
                        <div class="tx-type">${tx.type}</div>
                        <div class="tx-details">${detailsHtml.slice(0, -3)}</div>
                    </div>
                    <div class="tx-time">${timeAgo}</div>
                </div>
            `;
        }).join('');
    }

    getTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return Math.floor(seconds / 60) + ' min ago';
        if (seconds < 86400) return Math.floor(seconds / 3600) + ' hours ago';
        return Math.floor(seconds / 86400) + ' days ago';
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <svg class="icon icon-inline ${type === 'success' ? 'icon-success' : type === 'error' ? 'icon-error' : ''}"><use href="assets/icons.svg#icon-${type === 'success' ? 'check' : type === 'error' ? 'x' : 'star'}"></use></svg>
            <span>${message}</span>
        `;
        
        document.getElementById('toastContainer').appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    copyCurrentAddress() {
        const current = window.walletManager.getCurrentWallet();
        if (current) {
            navigator.clipboard.writeText(current.address).then(() => {
                this.showToast('Address copied to clipboard', 'success');
            }).catch(() => {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = current.address;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                this.showToast('Address copied to clipboard', 'success');
            });
        }
    }
    
    updateUI() {
        // Initial UI updates
        this.updateTransactionList();
        this.updateWalletSelector();
        this.updateRecipientWalletSelector();
        this.updateVaultsList();
    }
    
    async setMaxExchangeAmount() {
        const operation = document.getElementById('exchangeOperation').value;
        const species = parseInt(document.getElementById('exchangeSpecies').value);
        
        if (operation === 'sell') {
            // Get token balance for selling
            const balance = await this.contractManager.getBalance(this.currentAccount, species);
            document.getElementById('exchangeAmount').value = parseFloat(balance).toFixed(2);
        } else {
            // Get USDC balance for buying
            try {
                const usdcBalance = await this.contractManager.getUSDCBalance(this.currentAccount);
                document.getElementById('exchangeAmount').value = parseFloat(usdcBalance).toFixed(2);
            } catch (error) {
                // Use demo value
                document.getElementById('exchangeAmount').value = '1000.00';
            }
        }
        
        this.updateExchangeEstimate();
    }
    
    async setMaxVaultAmount() {
        const species = parseInt(document.getElementById('vaultSpecies').value);
        
        try {
            // Get token balance for the selected species
            const balance = await this.contractManager.getBalance(this.currentAccount, species);
            document.getElementById('vaultAmount').value = parseFloat(balance).toFixed(2);
        } catch (error) {
            // If no balance, set to 0
            document.getElementById('vaultAmount').value = '0.00';
        }
    }
    
    async updateExchangeEstimate() {
        const amount = parseFloat(document.getElementById('exchangeAmount').value) || 0;
        const species = parseInt(document.getElementById('exchangeSpecies').value);
        const operation = document.getElementById('exchangeOperation').value;
        
        if (amount > 0) {
            try {
                const metabolicPrice = await this.contractManager.getMetabolicPrice();
                const priceFloat = parseFloat(metabolicPrice);
                
                let estimatedValue;
                if (operation === 'buy') {
                    // Buying tokens with USDC - amount is USDC, calculate tokens
                    estimatedValue = amount;
                } else {
                    // Selling tokens for USDC - amount is tokens, calculate USDC
                    estimatedValue = amount * priceFloat;
                }
                
                document.getElementById('estimatedValue').textContent = estimatedValue.toFixed(2);
                document.getElementById('exchangeEstimate').style.display = 'block';
            } catch (error) {
                // Use default metabolic price
                const defaultPrice = 0.0023;
                const estimatedValue = operation === 'buy' ? amount : amount * defaultPrice;
                document.getElementById('estimatedValue').textContent = estimatedValue.toFixed(2);
                document.getElementById('exchangeEstimate').style.display = 'block';
            }
        } else {
            document.getElementById('exchangeEstimate').style.display = 'none';
        }
    }
    
    updateRecipientWalletSelector() {
        const select = document.getElementById('recipientWalletSelect');
        if (!select) return;
        
        const wallets = window.walletManager.getWallets();
        const current = window.walletManager.getCurrentWallet();
        
        select.innerHTML = '<option value="">Select wallet...</option>';
        wallets.forEach(wallet => {
            // Don't show current wallet as recipient option
            if (current && wallet.address === current.address) return;
            
            const option = document.createElement('option');
            option.value = wallet.address;
            option.textContent = `${wallet.name} (${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)})`;
            select.appendChild(option);
        });
    }
    
    selectRecipientWallet(address) {
        if (address) {
            document.getElementById('transferRecipient').value = address;
        }
    }
    
    updateVaultsList() {
        const vaultsList = document.getElementById('vaultsList');
        if (!vaultsList) return;
        
        const vaults = JSON.parse(localStorage.getItem('wellnessVaults') || '[]')
            .filter(vault => vault.active);
        
        if (vaults.length === 0) {
            vaultsList.innerHTML = '<p class="empty-state">No active vaults</p>';
            return;
        }
        
        vaultsList.innerHTML = vaults.map(vault => {
            const startDate = new Date(vault.startDate);
            const endDate = new Date(vault.endDate);
            const now = new Date();
            
            const totalDuration = endDate - startDate;
            const elapsed = now - startDate;
            const remaining = endDate - now;
            const progress = Math.min(100, (elapsed / totalDuration) * 100);
            
            const daysRemaining = Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
            const decayReduction = Math.min(vault.duration * 0.5, 50);
            
            // Calculate current value with exchange rate
            const currentValue = this.calculateVaultValue(vault);
            
            // Calculate early withdrawal penalty
            const penalty = this.calculateWithdrawalPenalty(vault);
            const withdrawalAmount = vault.amount - penalty;
            
            return `
                <div class="vault-item">
                    <div class="vault-header">
                        <h3 class="vault-objective">${vault.objective}</h3>
                        <span class="vault-status">${daysRemaining > 0 ? `${daysRemaining} days remaining` : 'Matured'}</span>
                    </div>
                    
                    <div class="vault-details">
                        <div class="vault-detail">
                            <span class="vault-detail-label">Locked Amount</span>
                            <span class="vault-detail-value">${vault.amount.toFixed(2)} ${CONFIG.species[vault.species].symbol}</span>
                        </div>
                        <div class="vault-detail">
                            <span class="vault-detail-label">Current Value</span>
                            <span class="vault-detail-value">≈ $${currentValue.toFixed(2)} USDC</span>
                        </div>
                        <div class="vault-detail">
                            <span class="vault-detail-label">Decay Reduction</span>
                            <span class="vault-detail-value">${decayReduction.toFixed(1)}%</span>
                        </div>
                        <div class="vault-detail">
                            <span class="vault-detail-label">Lock Period</span>
                            <span class="vault-detail-value">${vault.duration} days</span>
                        </div>
                    </div>
                    
                    <div class="vault-progress">
                        <div class="vault-progress-bar" style="width: ${progress}%"></div>
                    </div>
                    
                    <div class="vault-actions">
                        ${daysRemaining > 0 ? `
                            <button class="btn btn-secondary" onclick="app.withdrawFromVault('${vault.id}')">
                                Early Withdraw (${withdrawalAmount.toFixed(2)} ${CONFIG.species[vault.species].symbol})
                            </button>
                            <p class="withdrawal-warning">
                                Early withdrawal penalty: ${penalty.toFixed(2)} tokens (${((penalty/vault.amount)*100).toFixed(1)}%)
                            </p>
                        ` : `
                            <button class="btn btn-primary" onclick="app.claimVault('${vault.id}')">
                                Claim Full Amount (${vault.amount.toFixed(2)} ${CONFIG.species[vault.species].symbol})
                            </button>
                        `}
                    </div>
                </div>
            `;
        }).join('');
    }
    
    calculateVaultValue(vault) {
        // Get current exchange rate for the species
        const rates = [0.0023, 0.0154, 0.1023, 0.0512]; // Demo rates
        const rate = rates[vault.species];
        return vault.amount * rate;
    }
    
    calculateWithdrawalPenalty(vault) {
        const now = new Date();
        const startDate = new Date(vault.startDate);
        const endDate = new Date(vault.endDate);
        
        const totalDuration = endDate - startDate;
        const remaining = Math.max(0, endDate - now);
        
        // P_withdrawal = V_locked × (t_remaining/t_total) × p_factor
        // where p_factor = 0.5
        const timeRatio = remaining / totalDuration;
        const pFactor = 0.5;
        
        return vault.amount * timeRatio * pFactor;
    }
    
    async withdrawFromVault(vaultId) {
        const vaults = JSON.parse(localStorage.getItem('wellnessVaults') || '[]');
        const vault = vaults.find(v => v.id === vaultId);
        
        if (!vault) {
            this.showToast('Vault not found', 'error');
            return;
        }
        
        const penalty = this.calculateWithdrawalPenalty(vault);
        const withdrawalAmount = vault.amount - penalty;
        
        const confirmMsg = `Early withdrawal will incur a penalty of ${penalty.toFixed(2)} ${CONFIG.species[vault.species].symbol}.\\n\\n` +
                          `You will receive: ${withdrawalAmount.toFixed(2)} ${CONFIG.species[vault.species].symbol}\\n\\n` +
                          `Continue with early withdrawal?`;
        
        if (!confirm(confirmMsg)) return;
        
        try {
            // In production, this would call the smart contract
            // For demo, we'll update balances directly
            await this.contractManager.mintTokens(this.currentAccount, vault.species, withdrawalAmount.toString());
            
            // Mark vault as withdrawn
            vault.active = false;
            vault.withdrawnDate = new Date().toISOString();
            vault.withdrawnAmount = withdrawalAmount;
            vault.penalty = penalty;
            
            localStorage.setItem('wellnessVaults', JSON.stringify(vaults));
            
            this.addTransaction('Early Vault Withdrawal', {
                objective: vault.objective,
                species: CONFIG.species[vault.species].symbol,
                withdrawn: withdrawalAmount.toFixed(2),
                penalty: penalty.toFixed(2),
                originalAmount: vault.amount.toFixed(2)
            });
            
            this.showToast(`Successfully withdrew ${withdrawalAmount.toFixed(2)} ${CONFIG.species[vault.species].symbol} (penalty: ${penalty.toFixed(2)} tokens)`, 'success');
            
            this.updateBalances();
            this.updateVaultsList();
        } catch (error) {
            this.showToast('Withdrawal failed: ' + error.message, 'error');
        }
    }
    
    async claimVault(vaultId) {
        const vaults = JSON.parse(localStorage.getItem('wellnessVaults') || '[]');
        const vault = vaults.find(v => v.id === vaultId);
        
        if (!vault) {
            this.showToast('Vault not found', 'error');
            return;
        }
        
        try {
            // In production, this would call the smart contract
            // For demo, we'll update balances directly
            await this.contractManager.mintTokens(this.currentAccount, vault.species, vault.amount.toString());
            
            // Mark vault as claimed
            vault.active = false;
            vault.claimedDate = new Date().toISOString();
            
            localStorage.setItem('wellnessVaults', JSON.stringify(vaults));
            
            this.addTransaction('Vault Claim', {
                objective: vault.objective,
                species: CONFIG.species[vault.species].symbol,
                amount: vault.amount.toFixed(2),
                duration: vault.duration + ' days completed'
            });
            
            this.showToast(`Successfully claimed ${vault.amount.toFixed(2)} ${CONFIG.species[vault.species].symbol} from vault!`, 'success');
            
            this.updateBalances();
            this.updateVaultsList();
        } catch (error) {
            this.showToast('Claim failed: ' + error.message, 'error');
        }
    }
    
    clearAllData() {
        if (confirm('Are you sure you want to clear all application data? This will delete all test wallets and reset the application.')) {
            // Clear all localStorage data
            localStorage.clear();
            
            // Reset application state
            this.currentAccount = null;
            this.transactions = [];
            window.walletManager.wallets = [];
            
            // Show success message
            this.showToast('All data cleared successfully', 'success');
            
            // Reload the page to reset everything
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        }
    }
}

// Global functions for wallet modal
window.closeWalletModal = function() {
    document.getElementById('walletModal').style.display = 'none';
};

window.createTestWallet = function() {
    app.createTestWallet();
    app.updateWalletList();
    app.updateRecipientWalletSelector();
};

window.exportWallets = function() {
    const data = window.walletManager.exportWallets();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'autophage-wallets.json';
    a.click();
    URL.revokeObjectURL(url);
    app.showToast('Wallets exported', 'success');
};

window.importWallets = function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                if (window.walletManager.importWallets(e.target.result)) {
                    app.updateWalletList();
                    app.updateWalletSelector();
                    app.updateRecipientWalletSelector();
                    app.showToast('Wallets imported', 'success');
                } else {
                    app.showToast('Import failed', 'error');
                }
            };
            reader.readAsText(file);
        }
    };
    input.click();
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new AutophageApp();
    app.init();
    
    // Make app available globally for debugging
    window.app = app;
});