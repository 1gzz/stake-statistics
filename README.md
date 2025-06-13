# Stake Stats Bot

A Discord bot for tracking and summarizing your Stake.com deposits, withdrawals, and profit/loss in EUR. Upload your CSV files and get instant stats and breakdowns.

## Features
- **Upload Stake deposit and withdrawal CSVs** via Discord slash commands
- **Calculate total deposits, withdrawals, and profit/loss** in EUR
- **Detailed breakdown by currency**
- **Live crypto-to-EUR rates** (via CoinGecko)
- **Easy-to-use slash commands**

## Setup

### Prerequisites
- Node.js v16 or higher
- A Discord bot token ([How to create a bot](https://discordjs.guide/preparations/setting-up-a-bot-application.html#creating-your-bot))

### Installation
1. **Clone the repository:**
   ```sh
   git clone <your-repo-url>
   cd STAKE STATS BOT
   ```
2. **Install dependencies:**
   ```sh
   npm install
   ```
3. **Configure the bot:**
   - Copy `config.json.example` to `config.json` (or create `config.json`):
     ```json
     {
       "token": "YOUR_DISCORD_BOT_TOKEN",
       "clientId": "YOUR_BOT_CLIENT_ID"
     }
     ```
   - Replace with your actual Discord bot token and client ID.

4. **Run the bot:**
   ```sh
   node index.js
   ```

## Usage

### Commands
- `/help` — Shows instructions for using the bot
- `/setdeposit` — Upload your Stake deposit CSV file
- `/setwithdrawal` — Upload your Stake withdrawal CSV file
- `/total` — Calculate and display your total deposits, withdrawals, and profit/loss in EUR
- `/clear` — Delete your uploaded files

### Example Workflow
1. Use `/setdeposit` and `/setwithdrawal` to upload your files (CSV format from Stake.com)
2. Use `/total` to see your stats and profit/loss
3. Click the "View Detailed Breakdown" button for a per-currency summary

## File Structure
- `index.js` — Main bot logic
- `config.json` — Bot configuration (token, clientId)
- `user_files/` — Uploaded user CSV files (auto-created)

## Notes
- The bot only works in DMs or servers where it is invited and has the correct permissions.
- All calculations are based on the latest crypto-to-EUR rates from CoinGecko.
- Your uploaded files are private and only accessible to you.

## License
MIT
