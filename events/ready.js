const Discord = require("discord.js"); // eslint-disable-line no-unused-vars

module.exports = class {
  constructor (client) {
    this.client = client;
  }

  async run () {
    await this.client.wait(1000);

    await this.client.user.setStatus("online");
    await this.client.user.setActivity(`${this.client.guilds.size} Servers | ${this.client.config.prefix}help`, { type: "WATCHING" });

    let users = 0;
    this.client.guilds.map(g => users += g.memberCount);

    this.client.logger.ready(`Logged in as ${this.client.user.tag}! Serving ${this.client.guilds.size} Servers and ${users} Users.`);
  }
};
