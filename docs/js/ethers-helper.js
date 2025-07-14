// Ethers.js helper to ensure it's loaded properly

// Wait for ethers to be available
function waitForEthers() {
    return new Promise((resolve) => {
        if (window.ethers) {
            resolve();
        } else {
            // Check every 100ms for ethers to be loaded
            const checkInterval = setInterval(() => {
                if (window.ethers) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
            
            // Timeout after 10 seconds
            setTimeout(() => {
                clearInterval(checkInterval);
                resolve(); // Resolve anyway to prevent hanging
            }, 10000);
        }
    });
}

// Initialize ethers when ready
window.addEventListener('load', async () => {
    await waitForEthers();
    
    // Make ethers available globally without window prefix
    if (window.ethers) {
        window.BigNumber = window.ethers.BigNumber;
        window.utils = window.ethers.utils;
        window.providers = window.ethers.providers;
        window.Contract = window.ethers.Contract;
        
        console.log('✅ Ethers.js loaded successfully');
    } else {
        console.error('❌ Failed to load Ethers.js');
    }
});