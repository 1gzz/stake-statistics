const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const fetch = require('node-fetch');
const csv = require('csv-parser');
const axios = require('axios');
const path = require('path');

const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: ['CHANNEL']
});

const clientId = config.clientId;

const userFilesDir = path.join(__dirname, 'user_files');
const userFiles = new Map();

function loadCSV(filePath) {
    return new Promise((resolve, reject) => {
        const transactions = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => transactions.push(row))
            .on('end', () => resolve(transactions))
            .on('error', (error) => {
                console.error(`Error reading CSV file at ${filePath}:`, error);
                reject(new Error('Error reading CSV file.'));
            });
    });
}

async function fetchRatesToEUR(cryptoIds) {
    try {
        const ids = cryptoIds.join(',');
        const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=eur`);
        return response.data;
    } catch (error) {
        console.error('Error fetching conversion rates:', error);
        throw new Error('Failed to fetch conversion rates.');
    }
}

async function fetchCryptoRatesToEUR(cryptoList) {
    const idsMap = {
        btc: 'bitcoin',
        eth: 'ethereum',
        ltc: 'litecoin',
        usdt: 'tether',
        sol: 'solana',
        doge: 'dogecoin',
        bch: 'bitcoin-cash',
        xrp: 'ripple',
        trx: 'tron',
        eos: 'eos',
        bnb: 'binancecoin',
        usdc: 'usd-coin',
        ape: 'apecoin',
        busd: 'binance-usd',
        dai: 'dai',
        cro: 'crypto-com-chain',
        sand: 'the-sandbox',
        link: 'chainlink',
        shib: 'shiba-inu',
        uni: 'uniswap',
        pol: 'polkadot',
        trump: 'official-trump',
    };
    

    const ids = cryptoList
        .map(symbol => idsMap[symbol.toLowerCase()])
        .filter(Boolean)
        .join(',');

    if (!ids) return {};

    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=eur`;

    try {
        const response = await axios.get(url);
        const rates = {};
        for (const [symbol, id] of Object.entries(idsMap)) {
            if (response.data[id]) {
                rates[symbol] = response.data[id].eur;
            }
        }
        return rates;
    } catch (error) {
        console.error('Error fetching crypto rates:', error);
        return {};
    }
}

async function calculateTotal(userId, type) {
    const filePath = getFilePath(userId, type);

    if (!filePath) {
        return { error: `No ${type} file found for this user.` };
    }

    const transactions = await loadCSV(filePath);
    const totals = {};
    const uniqueCurrencies = new Set();

    transactions.forEach(tx => {
        const currency = tx.currency?.toLowerCase();
        const amount = parseFloat(tx.amount);
        if (!isNaN(amount) && currency) {
            uniqueCurrencies.add(currency);
            if (!totals[currency]) totals[currency] = 0;
            totals[currency] += Math.abs(amount);
        }
    });

    const rates = await fetchCryptoRatesToEUR(Array.from(uniqueCurrencies));

    const result = {};
    for (const [currency, total] of Object.entries(totals)) {
        const eurRate = rates[currency] || 0;
        result[currency] = {
            eur: (total * eurRate).toFixed(2)
        };
    }

    return result;
}

function loadUserFiles() {
    console.log('Loading user files...');
    if (!fs.existsSync(userFilesDir)) {
        console.log('No "user_files" directory found. Creating it...');
        fs.mkdirSync(userFilesDir, { recursive: true });
        return;
    }

    const files = fs.readdirSync(userFilesDir);
    if (files.length === 0) {
        console.log('No files found in "user_files" directory.');
        return;
    }

    files.forEach(file => {
        const match = file.match(/(deposit|withdrawal)_(\d+)\.csv/);
        if (!match) {
            console.warn(`Ignoring invalid file format: ${file}`);
            return;
        }

        const [, type, userId] = match;
        const filePath = path.join(userFilesDir, file);

        if (!userFiles.has(userId)) {
            userFiles.set(userId, {});
        }
        userFiles.get(userId)[type] = filePath;
        console.log(`Loaded ${type} file for user ID ${userId}`);
    });

    console.log('User files successfully loaded');
}

function getFilePath(userId, type) {
    const userData = userFiles.get(userId);
    return userData ? userData[type] : null;
}

async function handleFileUpload(interaction, type) {
    const file = interaction.options.getAttachment('file');
    if (!file) {
        throw new Error('No file attachment provided.');
    }

    const filePath = path.join(userFilesDir, `${type}_${interaction.user.id}.csv`);
    const response = await fetch(file.url);
    const buffer = await response.buffer();
    fs.writeFileSync(filePath, buffer);

    if (!userFiles.has(interaction.user.id)) {
        userFiles.set(interaction.user.id, {});
    }
    userFiles.get(interaction.user.id)[type] = filePath;

    console.log(`Uploaded ${type} file for user ID ${interaction.user.id}`);
    await interaction.reply({
        content: `${type.charAt(0).toUpperCase() + type.slice(1)} file uploaded successfully!`,
        ephemeral: true
    });
}

async function registerCommands() {
    const rest = new REST({ version: '10' }).setToken(config.token);

    try {
        const existingCommands = await rest.get(Routes.applicationCommands(clientId));
        for (const command of existingCommands) {
            await rest.delete(Routes.applicationCommand(clientId, command.id));
        }
        console.log('Deleted old commands.');

        const commands = [
            new SlashCommandBuilder()
                .setName('help')
                .setDescription('Shows instructions and an introduction video for using the bot'),
            new SlashCommandBuilder()
                .setName('setdeposit')
                .setDescription('Upload a file for your Stake deposits')
                .addAttachmentOption(option => option.setName('file').setDescription('CSV file').setRequired(true)),
            new SlashCommandBuilder()
                .setName('setwithdrawal')
                .setDescription('Upload a file for your Stake withdrawals')
                .addAttachmentOption(option => option.setName('file').setDescription('CSV file').setRequired(true)),
            new SlashCommandBuilder()
                .setName('clear')
                .setDescription('Deletes your uploaded deposit and withdrawal files'),
            new SlashCommandBuilder()
                .setName('total')
                .setDescription('Calculate deposits, withdrawals, and profit'),
        ];

        await rest.put(Routes.applicationCommands(clientId), { body: commands.map(command => command.toJSON()) });
        console.log('Successfully registered new commands.');

    } catch (error) {
        console.error('Error registering commands:', error);
    }
}

client.once('ready', async () => {
    loadUserFiles();
    await registerCommands();
    console.log('Bot is ready!');
});

client.on('messageCreate', async message => {
    if (message.channel.type === 1 && !message.author.bot) {
        await message.reply("Hi! Use `/help` to see how to upload your Stake files and calculate your stats.");
    }
});

client.on('interactionCreate', async interaction => { 

    if (interaction.isChatInputCommand()) {
        try {
            if (interaction.commandName === 'setdeposit') {
                await handleFileUpload(interaction, 'deposit');
            } else if (interaction.commandName === 'help') {
                const embed = new EmbedBuilder()
                .setTitle('📘 How to Use the Bot')
                .setDescription(
                    `1. Use **/setdeposit** to upload your deposit file from Stake.\n` +
                    `2. Use **/setwithdrawal** to upload your withdrawal file from Stake.\n` +
                    `3. Use **/total** to calculate total deposits, withdrawals, and profit/loss.\n\n`
                     )
                .setColor(0x3498DB)
                .setFooter({ text: 'If you need more help, contact the bot owner.' });
            
            
                await interaction.reply({ embeds: [embed], ephemeral: true });
            } else if (interaction.commandName === 'setwithdrawal') {
                await handleFileUpload(interaction, 'withdrawal');
            } else if (interaction.commandName === 'clear') {
                const userId = interaction.user.id;
                const userData = userFiles.get(userId);
                let deletedFiles = [];
            
                if (userData) {
                    for (const [type, filePath] of Object.entries(userData)) {
                        if (fs.existsSync(filePath)) {
                            fs.unlinkSync(filePath);
                            deletedFiles.push(`${type}.csv`);
                        }
                    }
                    userFiles.delete(userId);
                }
            
                if (deletedFiles.length > 0) {
                    await interaction.reply({ content: 'Successfully deleted your deposit and withdrawal files.', ephemeral: true });
                } else {
                    await interaction.reply({ content: 'No files were found to delete.', ephemeral: true });
                }
            } else if (interaction.commandName === 'total') {
                const deposits = await calculateTotal(interaction.user.id, 'deposit');
                const withdrawals = await calculateTotal(interaction.user.id, 'withdrawal');

                if (deposits.error) {
                    return await interaction.reply({ content: deposits.error, ephemeral: true });
                }

                if (withdrawals.error) {
                    return await interaction.reply({ content: withdrawals.error, ephemeral: true });
                }

                let totalDepositEUR = 0;
                let totalWithdrawalEUR = 0;

                for (const currency in deposits) {
                    totalDepositEUR += parseFloat(deposits[currency].eur || 0);
                }

                for (const currency in withdrawals) {
                    totalWithdrawalEUR += parseFloat(withdrawals[currency].eur || 0);
                }

                const profitRaw = totalWithdrawalEUR - totalDepositEUR;
                const profitStatus = profitRaw >= 0 ? 'Profit' : 'Loss';
                const profitDisplay = profitRaw >= 0
                    ? `€${profitRaw.toFixed(2)}`
                    : `-€${Math.abs(profitRaw).toFixed(2)}`;

                    const embed = new EmbedBuilder()
                    .setTitle('Stake Total Summary')
                    .setColor(profitRaw >= 0 ? 0x00FF00 : 0xFF0000)
                    .addFields(
                        { name: 'Total Deposits (EUR)', value: `€${totalDepositEUR.toFixed(2)}`, inline: true },
                        { name: 'Total Withdrawals (EUR)', value: `€${totalWithdrawalEUR.toFixed(2)}`, inline: true },
                        { name: profitStatus, value: profitDisplay, inline: false }
                    )
                    .setFooter({ text: 'Note: The euro value is updated regularly based on crypto value changes.' });                

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('show_detailed_breakdown')
                        .setLabel('🔍 View Detailed Breakdown')
                        .setStyle(ButtonStyle.Primary)
                );

                await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
            }
        } catch (error) {
            console.error('Error in /total command:', error);
            await interaction.reply({ content: 'An error occurred while calculating.', ephemeral: true });
        }
    }

        if (interaction.customId === 'show_detailed_breakdown') {
            try {
                await interaction.deferUpdate();

                const deposits = await calculateTotal(interaction.user.id, 'deposit');
                const withdrawals = await calculateTotal(interaction.user.id, 'withdrawal');

                let fields = [];
                for (const currency in deposits) {
                    const dep = parseFloat(deposits[currency]?.eur || 0);
                    const wit = parseFloat(withdrawals[currency]?.eur || 0);
                    const profit = (wit - dep).toFixed(2);

                    fields.push(
                        { name: `${currency.toUpperCase()} Deposits`, value: `€${dep.toFixed(2)}`, inline: true },
                        { name: `${currency.toUpperCase()} Withdrawals`, value: `€${wit.toFixed(2)}`, inline: true },
                        { name: `${currency.toUpperCase()} Profit`, value: `€${profit}`, inline: true }
                    );
                }

                const embed = new EmbedBuilder()
                    .setTitle('Stake Detailed Breakdown')
                    .setColor(0x3498DB)
                    .addFields(fields)
                    .setFooter({ text: 'Note: The euro value is updated regularly based on crypto value changes.'});

                await interaction.followUp({ embeds: [embed], ephemeral: true });

            } catch (error) {
                console.error('Error generating detailed breakdown:', error);
                await interaction.followUp({ content: 'Failed to load breakdown.', ephemeral: true });
            }
        }
});

client.login(config.token);