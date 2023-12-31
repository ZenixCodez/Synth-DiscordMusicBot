const fs = require("node:fs");
const path = require("node:path");
const {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  GatewayDispatchEvents,
} = require("discord.js");
const { Manager } = require("magmastream");

class Main extends Client {
  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.commands = new Collection();
    this.nodes = [
      {
        host: "127.0.0.1",
        identifier: "Node 1",
        password: "youshallnotpass",
        port: 2333,
        retryAmount: 1000,
        retrydelay: 10000,
        resumeStatus: true,
        resumeTimeout: 1000,
        secure: false,
      },
    ];

    this.manager = new Manager({
      nodes: this.nodes,
      send: (id, payload) => {
        const guild = this.guilds.cache.get(id);
        if (guild) guild.shard.send(payload);
      },
    });

    this.wakeUp(process.env.Token);
    this.initCommands();
    this.initEvents();
  }

  emitWarning(warning) {
    import("chalk").then(({ default: chalk }) => {
      return console.log(chalk.yellow(warning));
    });
  }

  emitStatus(status) {
    import("chalk").then(({ default: chalk }) => {
      return console.log(chalk.green(status));
    });
  }

  emitError(error) {
    import("chalk").then(({ default: chalk }) => {
      return console.log(chalk.red(error));
    });
  }

  initCommands() {
    const commandPath = path.join(__dirname, "..", "Commands");
    const commandFiles = fs
      .readdirSync(commandPath)
      .filter((x) => x.endsWith(".js"));
    const commandList = [];

    for (let file of commandFiles) {
      const command = require(path.join(commandPath, file));
      if ("info" in command && "run" in command) {
        this.commands.set(command.info.name, command);
        commandList.push(command.info.toJSON());
      } else {
        this.emitWarning(
          `[Synth Music - WARNING]: The structure of the command is incomplete (${path.join(
            commandPath,
            file
          )})`
        );
      }
    }

    (async () => {
      const rest = new REST().setToken(process.env.Token);
      const request = await rest.put(
        Routes.applicationCommands(process.env.Client_ID),
        { body: commandList }
      );
      this.emitStatus(
        `[Synth Music - Status]: Successfully registered ${request.length} [/] commands`
      );
    })();
  }

  initEvents() {
    this.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) {
        this.emitError(
          `[Synth Music - ERROR]: Uh-oh, we couldn't find a command named ${interaction.commandName}`
        );
        return;
      }

      try {
        await command.run(interaction);
      } catch (error) {
        this.emitError(`[Synth Music - ERROR]: ${error}`);
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content:
              "[Synth Music - ERROR]: An unexpected error arose during the execution of this command",
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content:
              "[Synth Music - ERROR]: An unexpected error arose during the execution of this command",
            ephemeral: true,
          });
        }
      }
    });

    this.on(Events.ClientReady, () => {
      this.emitStatus(`[Synth Music - Status]: I'm awake [${this.user.tag}]`);
      this.manager.init(this.user.id);
    });

    this.manager.on("nodeConnect", (node) => {
      this.emitStatus(`[Synth Music - Status]: Successfully connected to Lavalink ${node.options.identifier}`);
    });

    this.manager.on("nodeError", (node, error) => {
      this.emitError(
        `[Synth Music - ERROR]: ${node.options.identifier} encountered an error: ${error.message}`
      );
    });

    this.on("raw", (d) => this.manager.updateVoiceState(d));
  }

  async wakeUp(token) {
    await this.login(token);
  }
}

module.exports = Main;
