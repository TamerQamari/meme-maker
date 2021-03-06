if (Number(process.version.slice(1).split(".")[0]) < 8) throw new Error("Node 8.0.0 or higher is required. Update Node on your system.");

const { Client, Collection } = require("discord.js");
const { promisify } = require("util");
const readdir = promisify(require("fs").readdir);
const klaw = require("klaw");
const path = require("path");

class Bot extends Client {
  constructor (options) {
    super(options);
    this.config = require("./config.js");
    this.commands = new Collection();
    this.aliases = new Collection();
    this.logger = require("./modules/logger.js");

    this.wait = require("util").promisify(setTimeout);

    this.awaitReply = async (msg, question, limit = 60000) => {
      const filter = m => m.author.id === msg.author.id;
      const ms = await msg.channel.send(question);
      try {
        const collected = await msg.channel.awaitMessages(filter, { max: 1, time: limit, errors: ["time"] });
        await collected.first().delete();
        await ms.delete();
        return collected.first().content;
      } catch (e) {
        return false;
      }
    };

    this.separateText = (text, lineChar, maxChar) => {
      if (!text) return "";
      if (!lineChar) return "NOLINEMAXCHAR";
      if (!maxChar) return "NOWORDMAXCHAR";

      const words = [];
      const fetched = [];
      var lineLength = 0;

      const txt = text.split(" ");
      for (const word of txt) {
        words.push(word);
      }

      if (words.length < 2 && words[0].length < maxChar) {
        return words[0];
      }

      for (var word of words) {
        lineLength += word.length;
        if (lineLength > lineChar) {
          fetched[fetched.length - 1] = fetched[fetched.length - 1] += "\n";
          lineLength = word.length;
        } if (word.length > lineChar) {
          const regEx = new RegExp("(.{1," +  lineChar + "})", "g");
          word = word.replace(regEx, '$1-\n');
        }

        fetched.push(word);
    }

  return fetched.join(" ");
};
    this.textLocation = (size, from, to, fromTrue, toTrue, fromRem, toRem) => {
      // from <- - | + ->

      //  + | | ^ -
      // to V

      for (var i = 0; i < size; i++) {
        if (fromTrue === true) {
          from -= fromRem; 
        }

        if (toTrue === true) {
         to -= toRem;
        }
      }
      return { from: from, to: to };
    };

    this.clean = async (client, text) => {
      if (text && text.constructor.name == "Promise") text = await text;
      if (typeof evaled !== "string") text = require("util").inspect(text, {depth: 0});
    
      text = text.replace(/`/g, "`" + String.fromCharCode(8203))
        .replace(/@/g, "@" + String.fromCharCode(8203))
        .replace(client.token, "nani");
    
      return text;
    };
  }

  permlevel (message) {
    let permlvl = 0;

    const permOrder = this.config.permLevels.slice(0).sort((p, c) => p.level < c.level ? 1 : -1);

    while (permOrder.length) {
      const currentLevel = permOrder.shift();
      if (message.guild && currentLevel.guildOnly) continue;
      if (currentLevel.check(message)) {
        permlvl = currentLevel.level;
        break;
      }
    }
    return permlvl;
  }

  loadCommand (commandPath, commandName) {
    try {
      const props = new (require(`${commandPath}${path.sep}${commandName}`))(this);
      this.logger.log(`Loading Command: ${props.help.name}. 👌`, "log");
      props.conf.location = commandPath;
      if (props.init) {
        props.init(this);
      }
      this.commands.set(props.help.name, props);
      props.conf.aliases.forEach(alias => {
        this.aliases.set(alias, props.help.name);
      });
      return false;
    } catch (e) {
      return `Unable to load command ${commandName}: ${e}`;
    }
  }

  async unloadCommand (commandPath, commandName) {
    let command;
    if (this.commands.has(commandName)) {
      command = this.commands.get(commandName);
    } else if (this.aliases.has(commandName)) {
      command = this.commands.get(this.aliases.get(commandName));
    }
    if (!command) return `The command \`${commandName}\` doesn"t seem to exist, nor is it an alias. Try again!`;

    if (command.shutdown) {
      await command.shutdown(this);
    }
    delete require.cache[require.resolve(`${commandPath}${path.sep}${commandName}.js`)];
    return false;
  }
}

const client = new Bot();
// console.log(client.config.permLevels.map(p => `${p.level}: ${p.name}`.join("\n")));

const init = async () => {
  klaw("./commands").on("data", (item) => {
    const cmdFile = path.parse(item.path);
    if (!cmdFile.ext || cmdFile.ext !== ".js") return;
    const response = client.loadCommand(cmdFile.dir, `${cmdFile.name}${cmdFile.ext}`);
    if (response) client.logger.error(response);
  });
    
  const evtFiles = await readdir("./events/");
  client.logger.log(`Loading a total of ${evtFiles.length} events.`, "log");
  evtFiles.forEach(file => {
    const eventName = file.split(".")[0];
    client.logger.log(`Loading Event: ${eventName}`);
    const event = new (require(`./events/${file}`))(client);

    client.on(eventName, (...args) => event.run(...args));
    delete require.cache[require.resolve(`./events/${file}`)];
  });
    
  client.levelCache = {};
  for (let i = 0; i < client.config.permLevels.length; i++) {
    const thisLevel = client.config.permLevels[i];
    client.levelCache[thisLevel.name] = thisLevel.level;
  }

  client.login(client.config.token);
};

init();

client.on("disconnect", () => client.logger.warn("Bot is disconnecting..."));
client.on("reconnecting", () => client.logger.log("Bot reconnecting...", "log"));
client.on("error", e => client.logger.error(e));
client.on("warn", info => client.logger.warn(info));

process.on("uncaughtException", (err) => {
  const errorMsg = err.stack.replace(new RegExp(`${__dirname}/`, "g"), "./");
  console.error("Uncaught Exception: ", errorMsg);
  process.exit(1);
});