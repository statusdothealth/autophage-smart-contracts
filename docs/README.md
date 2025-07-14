# Autophage Protocol Web Interface

This is a web-based interface for interacting with the Autophage Protocol smart contracts. It provides all the functionality of the CLI tool in a user-friendly browser interface.

## Features

- 🌐 **Web3 Integration**: Connect with MetaMask or any Web3 wallet
- 🎮 **Demo Mode**: Try all features without a wallet or real tokens
- 💰 **Token Management**: Mint, transfer, and lock tokens
- 🏃 **Activity Tracking**: Log health activities and earn rewards
- 💱 **Token Exchange**: Buy/sell tokens with USDC
- 📊 **Real-time Updates**: Live balance and decay tracking
- 📱 **Responsive Design**: Works on desktop and mobile

## Deployment

### GitHub Pages

1. The web interface is automatically deployed to GitHub Pages from the `/docs` folder
2. Access it at: `https://[your-username].github.io/autophage-smart-contracts/`

### Local Testing

1. Start a local web server in the docs folder:
   ```bash
   cd docs
   python3 -m http.server 8000
   # or
   npx http-server
   ```

2. Open http://localhost:8000 in your browser

### Contract Setup

1. Deploy the smart contracts to a local network:
   ```bash
   npm run node        # Terminal 1
   npm run deploy      # Terminal 2
   ```

2. When you first connect your wallet, you'll be prompted to enter the contract addresses
3. These addresses are saved in localStorage for future use

## Usage

### Demo Mode (No Wallet Required)

1. Click "Demo Mode" to start
2. You'll have simulated tokens to experiment with
3. All features work but no real blockchain transactions occur

### Real Mode (Requires MetaMask)

1. Install MetaMask browser extension
2. Connect to localhost:8545 (for local testing)
3. Click "Connect Wallet"
4. The app will automatically request minter role if needed

### Features Guide

#### Token Operations
- **Mint**: Create new tokens (requires minter role)
- **Transfer**: Send tokens to another address
- **Vault**: Lock tokens for reduced decay rate
- **Exchange**: Trade tokens for USDC

#### Health Activities
- Click any activity button to log it
- Set duration and intensity
- Earn tokens based on activity type

#### Live Updates
- Balances update every 10 seconds
- Shows real-time decay effects
- Exchange rates refresh automatically

## Development

### Structure
```
docs/
├── index.html          # Main HTML interface
├── css/
│   └── style.css      # Styles and responsive design
├── js/
│   ├── config.js      # Configuration and ABIs
│   ├── contracts.js   # Web3 contract interactions
│   └── app.js         # Main application logic
└── README.md          # This file
```

### Customization

1. **Network Configuration**: Edit `config.js` to add new networks
2. **Token Species**: Modify species configuration in `config.js`
3. **Styling**: Update `style.css` for custom themes
4. **Features**: Extend `app.js` for additional functionality

### Adding New Networks

In `js/config.js`:
```javascript
networks: {
    mainnet: {
        chainId: '0x1',
        chainName: 'Ethereum Mainnet',
        rpcUrl: 'https://mainnet.infura.io/v3/YOUR_KEY'
    }
}
```

## Security Notes

- Contract addresses are stored in localStorage
- No private keys are ever stored
- Demo mode uses simulated transactions
- Always verify contract addresses before use

## Troubleshooting

### "No Web3 provider found"
- Install MetaMask or another Web3 wallet
- Or use Demo Mode for testing

### "Contract addresses not set"
- Deploy contracts first: `npm run deploy`
- Enter addresses when prompted
- Or use Demo Mode

### Transaction Failures
- Ensure you have enough tokens
- Check you're on the correct network
- Verify you have necessary roles (minter, etc.)

## License

Apache 2.0 - See LICENSE file in root directory