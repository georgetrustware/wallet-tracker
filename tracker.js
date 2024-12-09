require('dotenv').config();
const { Client, GatewayIntentBits, ButtonBuilder, ActionRowBuilder, ButtonStyle, PermissionsBitField, Events } = require('discord.js');
const axios = require('axios');

// Load environment variables
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const TRADING_CATEGORY_ID = process.env.TRADING_CATEGORY_ID;
const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY;
const BASESCAN_API_URL = process.env.BASESCAN_API_URL;

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// Store wallet addresses mapped to users
const userWallets = new Map();
let lastTxHash = null;

// Function to fetch and analyze recent token transfers
async function fetchTokenTransfers(walletAddress, channel) {
  try {
    const response = await axios.get(BASESCAN_API_URL, {
      params: {
        module: 'account',
        action: 'tokentx',
        address: walletAddress,
        sort: 'desc',
        apikey: BASESCAN_API_KEY,
      },
    });

    const transactions = response.data.result;

    if (!transactions || transactions.length === 0) {
      channel.send('No transactions found.');
      return;
    }

    // Find the index of the last processed transaction
    let startIndex = 0;
    if (lastTxHash) {
      startIndex = transactions.findIndex((tx) => tx.hash === lastTxHash);
      startIndex = startIndex === -1 ? 0 : startIndex + 1;
    }

    const newTransactions = transactions.slice(startIndex).reverse();

    // Process the new transactions
    for (const tx of newTransactions) {
      if (tx.to.toLowerCase() === walletAddress.toLowerCase()) {
        const message = `\n**Token Purchase Detected:**\n` +
                        `**Transaction Hash:** ${tx.hash}\n` +
                        `**Token:** ${tx.tokenName} (${tx.tokenSymbol})\n` +
                        `**Amount:** ${tx.value / Math.pow(10, tx.tokenDecimal)}\n` +
                        `**From:** ${tx.from}\n` +
                        `**To:** ${tx.to}\n` +
                        `**Timestamp:** ${new Date(tx.timeStamp * 1000).toLocaleString()}`;
        channel.send(message);
      }
    }

    // Update the last processed transaction hash
    if (transactions.length > 0) {
      lastTxHash = transactions[0].hash;
    }
  } catch (error) {
    console.error(`Error fetching token transfers: ${error.message}`);
    channel.send('Error fetching token transfers. Please try again.');
  }
}

// Event: Bot is ready
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);

  const guild = await client.guilds.fetch(GUILD_ID);
  const startingChannel = await guild.channels.fetch('1315536815289008138'); // Starting channel ID

  const button = new ButtonBuilder()
    .setCustomId('create_private_channel')
    .setLabel('Request Private Channel')
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(button);

  await startingChannel.send({
    content: 'Click the button below to create a private trading channel with the bot.',
    components: [row],
  });
});

// Event: Handle button interactions
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'create_private_channel') {
    try {
      const guild = interaction.guild;
      const user = interaction.user;

      // Create a private channel
      const channel = await guild.channels.create({
        name: `trading-${user.username}`,
        parent: TRADING_CATEGORY_ID,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel],
          },
          {
            id: user.id,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
          },
          {
            id: client.user.id,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
          },
        ],
      });

      await interaction.reply({
        content: `Private channel created: ${channel}`,
        ephemeral: true,
      });

      await channel.send(`Welcome, ${user}! Please provide your wallet address by typing: \`!setwallet <your_wallet_address>\``);
    } catch (error) {
      console.error(`Error creating private channel: ${error.message}`);
      await interaction.reply({
        content: 'An error occurred while creating your private channel. Please try again.',
        ephemeral: true,
      });
    }
  }
});

// Event: Handle wallet address input
client.on('messageCreate', async (message) => {
  if (message.content.startsWith('!setwallet')) {
    const [_, walletAddress] = message.content.split(' ');

    if (!walletAddress) {
      message.reply('Please provide a valid wallet address. Usage: `!setwallet <wallet_address>`');
      return;
    }

    userWallets.set(message.author.id, walletAddress);
    message.reply(`Wallet address set to: \`${walletAddress}\`. The bot will now monitor this address.`);

    // Start fetching token transfers for the provided wallet
    fetchTokenTransfers(walletAddress, message.channel);
  }
});

// Log in the bot
client.login(DISCORD_BOT_TOKEN);

