// Main application logic

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
        
        // Check for Web3
        if (typeof window.ethereum === 'undefined' && !CONFIG.demoMode.enabled) {
            this.showToast('Please install MetaMask to use this dApp', 'error');
            document.getElementById('demoMode').click(); // Auto-switch to demo mode
        }
        
        // Initialize UI
        this.updateUI();
    }

    setupEventListeners() {
        // Wallet connection
        document.getElementById('connectWallet').addEventListener('click', () => this.connectWallet());
        document.getElementById('demoMode').addEventListener('click', () => this.enableDemoMode());
        
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
        
        // Activity intensity slider
        document.getElementById('activityIntensity').addEventListener('input', (e) => {
            document.getElementById('intensityValue').textContent = e.target.value;
            this.updateRewardEstimate();
        });
        
        document.getElementById('activityDuration').addEventListener('input', () => this.updateRewardEstimate());
    }

    async connectWallet() {
        try {
            this.showToast('Connecting wallet...', 'info');
            
            await this.contractManager.init();
            this.currentAccount = await this.contractManager.connectWallet();
            window.currentAccount = this.currentAccount;
            
            // Load contracts
            if (!CONTRACT_ADDRESSES.AutophageToken) {
                // Show contract setup modal
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
            document.getElementById('connectWallet').style.display = 'none';
            document.getElementById('demoMode').style.display = 'none';
            document.getElementById('walletInfo').style.display = 'block';
            document.querySelector('.address').textContent = 
                this.currentAccount.slice(0, 6) + '...' + this.currentAccount.slice(-4);
            document.querySelector('.network').textContent = 'Connected';
            
            // Start balance updates
            this.startBalanceUpdates();
            
            this.showToast('Wallet connected successfully!', 'success');
        } catch (error) {
            console.error('Connection error:', error);
            this.showToast('Failed to connect: ' + error.message, 'error');
        }
    }

    enableDemoMode() {
        CONFIG.demoMode.enabled = true;
        this.currentAccount = '0xDemoUser1234567890123456789012345678901234';
        window.currentAccount = this.currentAccount;
        
        // Initialize demo mode
        this.contractManager.init();
        this.contractManager.contracts = this.contractManager.createMockContracts();
        
        // Update UI
        document.getElementById('connectWallet').style.display = 'none';
        document.getElementById('demoMode').style.display = 'none';
        document.getElementById('walletInfo').style.display = 'block';
        document.querySelector('.address').textContent = 'Demo Mode';
        document.querySelector('.network').textContent = 'Simulated';
        
        // Start balance updates
        this.startBalanceUpdates();
        
        this.showToast('Demo mode activated! Try out all features risk-free.', 'success');
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
        
        // Update every 10 seconds
        this.updateInterval = setInterval(() => {
            this.updateBalances();
            this.updateExchangeRates();
        }, 10000);
    }

    async updateBalances() {
        if (!this.currentAccount || !this.contractManager.contracts.autophageToken) return;
        
        for (let i = 0; i < 4; i++) {
            try {
                const balance = await this.contractManager.getBalance(this.currentAccount, i);
                document.querySelectorAll('.token-card .balance')[i].textContent = 
                    parseFloat(balance).toFixed(2);
            } catch (error) {
                console.error('Failed to update balance:', error);
            }
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
    }

    switchTab(tabName) {
        // Update active tab
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // Show corresponding pane
        document.querySelectorAll('.tab-pane').forEach(p => p.style.display = 'none');
        document.getElementById(`${tabName}Tab`).style.display = 'block';
    }

    async handleMint(e) {
        e.preventDefault();
        
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
            this.updateBalances();
        } catch (error) {
            this.showToast('Minting failed: ' + error.message, 'error');
        }
    }

    async handleTransfer(e) {
        e.preventDefault();
        
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
            this.updateBalances();
        } catch (error) {
            this.showToast('Transfer failed: ' + error.message, 'error');
        }
    }

    async handleVault(e) {
        e.preventDefault();
        
        const species = parseInt(document.getElementById('vaultSpecies').value);
        const amount = document.getElementById('vaultAmount').value;
        const duration = parseInt(document.getElementById('vaultDuration').value);
        
        try {
            this.showToast('Locking tokens in vault...', 'info');
            
            const receipt = await this.contractManager.lockInVault(species, amount, duration);
            
            this.addTransaction('Vault Lock', {
                species: CONFIG.species[species].symbol,
                amount,
                duration: duration + ' days',
                txHash: receipt.transactionHash
            });
            
            this.showToast(`Successfully locked ${amount} ${CONFIG.species[species].name} tokens for ${duration} days!`, 'success');
            
            // Reset form and update balances
            e.target.reset();
            this.updateBalances();
        } catch (error) {
            this.showToast('Vault lock failed: ' + error.message, 'error');
        }
    }

    async handleExchange(e) {
        e.preventDefault();
        
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
            this.updateBalances();
            this.updateExchangeRates();
        } catch (error) {
            this.showToast('Exchange failed: ' + error.message, 'error');
        }
    }

    showActivityModal(activityType) {
        document.getElementById('activityType').value = activityType;
        document.getElementById('activityModal').style.display = 'flex';
        this.updateRewardEstimate();
    }

    closeModal() {
        document.getElementById('activityModal').style.display = 'none';
    }

    updateRewardEstimate() {
        const activityType = parseInt(document.getElementById('activityType').value);
        const duration = parseInt(document.getElementById('activityDuration').value) || 30;
        const intensity = parseInt(document.getElementById('activityIntensity').value) || 50;
        
        const baseReward = CONFIG.activities[activityType].baseReward;
        const durationMultiplier = Math.min(duration / 30, 2);
        const intensityMultiplier = intensity / 100;
        const totalReward = baseReward * durationMultiplier * intensityMultiplier;
        
        document.getElementById('rewardEstimate').textContent = totalReward.toFixed(2);
    }

    async handleActivity(e) {
        e.preventDefault();
        
        const activityType = parseInt(document.getElementById('activityType').value);
        const duration = parseInt(document.getElementById('activityDuration').value);
        const intensity = parseInt(document.getElementById('activityIntensity').value);
        
        try {
            this.showToast('Recording activity...', 'info');
            
            // Calculate reward
            const baseReward = CONFIG.activities[activityType].baseReward;
            const durationMultiplier = Math.min(duration / 30, 2);
            const intensityMultiplier = intensity / 100;
            const totalReward = baseReward * durationMultiplier * intensityMultiplier;
            
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
            <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
            <span>${message}</span>
        `;
        
        document.getElementById('toastContainer').appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    updateUI() {
        // Initial UI updates
        this.updateTransactionList();
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new AutophageApp();
    app.init();
    
    // Make app available globally for debugging
    window.app = app;
});