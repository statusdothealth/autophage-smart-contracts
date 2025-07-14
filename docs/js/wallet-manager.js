// Wallet Manager for Autophage Protocol
// Manages multiple test wallets for development and testing

class WalletManager {
    constructor() {
        this.wallets = this.loadWallets();
        this.currentWallet = null;
    }

    // Load wallets from localStorage
    loadWallets() {
        const stored = localStorage.getItem('autophage_wallets');
        if (stored) {
            return JSON.parse(stored);
        }
        return [];
    }

    // Save wallets to localStorage
    saveWallets() {
        localStorage.setItem('autophage_wallets', JSON.stringify(this.wallets));
    }

    // Create a new test wallet
    createWallet(name) {
        // Generate a random wallet address for testing
        const wallet = {
            id: Date.now().toString(),
            name: name || `Test Wallet ${this.wallets.length + 1}`,
            address: this.generateTestAddress(),
            type: 'test',
            balances: {
                0: '100',  // RHY - 100 initial balance
                1: '50',   // HLN - 50 initial balance
                2: '200',  // FDN - 200 initial balance
                3: '25'    // CTL - 25 initial balance
            },
            created: new Date().toISOString()
        };
        
        this.wallets.push(wallet);
        this.saveWallets();
        return wallet;
    }

    // Add MetaMask wallet
    addMetaMaskWallet(address, name) {
        const existing = this.wallets.find(w => w.address.toLowerCase() === address.toLowerCase());
        if (existing) {
            return existing;
        }

        const wallet = {
            id: Date.now().toString(),
            name: name || 'MetaMask Wallet',
            address: address,
            type: 'metamask',
            balances: {
                0: '0',
                1: '0',
                2: '0',
                3: '0'
            },
            created: new Date().toISOString()
        };

        this.wallets.push(wallet);
        this.saveWallets();
        return wallet;
    }

    // Generate a test wallet address
    generateTestAddress() {
        const chars = '0123456789abcdef';
        let address = '0x';
        for (let i = 0; i < 40; i++) {
            address += chars[Math.floor(Math.random() * chars.length)];
        }
        return address;
    }

    // Get all wallets
    getWallets() {
        return this.wallets;
    }

    // Get wallet by address
    getWallet(address) {
        return this.wallets.find(w => w.address.toLowerCase() === address.toLowerCase());
    }

    // Set current wallet
    setCurrentWallet(address) {
        const wallet = this.getWallet(address);
        if (wallet) {
            this.currentWallet = wallet;
            localStorage.setItem('autophage_current_wallet', address);
            return wallet;
        }
        return null;
    }

    // Get current wallet
    getCurrentWallet() {
        if (!this.currentWallet) {
            const stored = localStorage.getItem('autophage_current_wallet');
            if (stored) {
                this.currentWallet = this.getWallet(stored);
            }
        }
        return this.currentWallet;
    }

    // Update wallet balances
    updateWalletBalances(address, balances) {
        const wallet = this.getWallet(address);
        if (wallet) {
            wallet.balances = balances;
            this.saveWallets();
        }
    }

    // Remove wallet
    removeWallet(address) {
        this.wallets = this.wallets.filter(w => w.address.toLowerCase() !== address.toLowerCase());
        this.saveWallets();
        
        // If removed wallet was current, clear current
        if (this.currentWallet && this.currentWallet.address.toLowerCase() === address.toLowerCase()) {
            this.currentWallet = null;
            localStorage.removeItem('autophage_current_wallet');
        }
    }

    // Rename wallet
    renameWallet(address, newName) {
        const wallet = this.getWallet(address);
        if (wallet) {
            wallet.name = newName;
            this.saveWallets();
        }
    }

    // Export wallet data
    exportWallets() {
        return JSON.stringify(this.wallets, null, 2);
    }

    // Import wallet data
    importWallets(data) {
        try {
            const imported = JSON.parse(data);
            if (Array.isArray(imported)) {
                this.wallets = imported;
                this.saveWallets();
                return true;
            }
        } catch (e) {
            console.error('Failed to import wallets:', e);
        }
        return false;
    }
}

// Create global instance
window.walletManager = new WalletManager();