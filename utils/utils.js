const { MessageEmbed, APIMessage } = require("discord.js");

const COLORS = {
    BLUE: '0099ff',
    GREEN: '#57f542',
    RED: '#fc0335',
}

/**
 *
 * @param {EmbedFieldData[]} fields
 * @param {Message} msg will be used to determine link back, as well as user if user is not passed
 * @param {User} user will be used to DM
 * @param {Boolean} skipDM
 */
async function sendDirectOrFallbackToChannelError(error, msg, user, skipDM, urlToLinkBank) {
    let embed = new MessageEmbed()
        .setColor(COLORS.RED);
    embed.addFields({ name: `Error`, value: `<@${user ? user.id : msg.author ? msg.author.id : 'unknown user'}> - ${error.message}` });
    return sendDirectOrFallbackToChannelEmbeds([embed], msg, user, skipDM, urlToLinkBank);
}

/**
 *
 * @param {EmbedFieldData[]} fields
 * @param {Message} msg will be used to determine link back, as well as user if user is not passed
 * @param {User} user will be used to DM
 * @param {Boolean} skipDM
 */
async function sendDirectOrFallbackToChannel(fields, msg, user, skipDM, urlToLinkBank) {
    if (!Array.isArray(fields)) {
        fields = [fields];
    }
    let embed = new MessageEmbed()
        .setColor(COLORS.BLUE);
    for (let field of fields) {
        field.name = typeof field.name !== 'undefined' && '' + field.name != '' ? field.name : 'UNSET';
        field.value = typeof field.value !== 'undefined' && '' + field.value != '' ? field.value : 'UNSET';
    }
    embed.addFields(fields);
    return sendDirectOrFallbackToChannelEmbeds([embed], msg, user, skipDM, urlToLinkBank);
}

/**
 *
 * @param {MessageEmbed[]} embedsArray
 * @param {Message} msg will be used to determine link back, as well as user if user is not passed
 * @param {User} user will be used to DM
 * @param {Boolean} skipDM
 */
async function sendDirectOrFallbackToChannelEmbeds(embedsArray, msg, user, skipDM, urlToLinkBank) {
    try {
        if (!Array.isArray(embedsArray)) {
            embedsArray = [embedsArray];
        }
        if (embedsArray.length < 1) {
            throw new Error('No embeds passed to send');
        }
        if (!user && msg) {
            user = msg.author;
        }
        if (!urlToLinkBank) {
            urlToLinkBank = msg.url;
        }
        if (!user) {
            throw new Error('no valid message or user was passed to be able to respond.');
        }
        // console.log('user: ' + user.id);
        // console.log('msg member: ' + msg.member.id);
        let messageSent = false;
        let sentMessage;
        if (user && !skipDM) {
            try {
                if (urlToLinkBank) {
                    let goBackMessage = '[Go Back To Message]';
                    // ensure that if this embed was 'reused', that we don't add the gobackmessage repeatedly
                    let lastFieldValue = embedsArray[embedsArray.length - 1].fields[embedsArray[embedsArray.length - 1].fields.length - 1].value;
                    if (!lastFieldValue.startsWith(goBackMessage)) {
                        embedsArray[embedsArray.length - 1].addFields({ name: '\u200B', value: `${goBackMessage}(${urlToLinkBank})`, inline: false });
                    }
                }
                // if it's an interaction (slash command) and there is only 1 embed, then just reply with it
                if (msg.interaction && embedsArray.length == 1) {
                    for (let embed of embedsArray) {
                        clientWsReply(msg.interaction, embed);
                    }
                // otherwise reply with the array of embeds, directly to user, and then follow up with the ws response to the interaction
                } else {
                    for (let embed of embedsArray) {
                        sentMessage = await user.send(embed);
                    }
                    if (msg.interaction) {
                        let interactionEmbed = new MessageEmbed()
                            .setColor(embedsArray[embedsArray.length - 1].color ? embedsArray[embedsArray.length - 1].color : COLORS.GREEN)
                            .addField('Response', `[Check your DMs here](${sentMessage.url}) for response.`);
                        clientWsReply(msg.interaction, interactionEmbed);
                    }
                }
                messageSent = true;
            } catch (error) {
                console.error('sendDirectOrFallbackToChannelEmbeds: could not DC with user, will fallback to channel send. - %s %s', error.message, error);
            }
        }
        if (!messageSent && (msg.channel || msg.interaction)) {
            try {
                for (let embed of embedsArray) {
                    embed.addFields({ name: `Responding To`, value: `<@${user.id}>`, inline: false });
                    if (msg.interaction) {
                        await clientWsReply(msg.interaction, embed);
                    } else {
                        await msg.channel.send(embed);
                    }
                }
            } catch (error) {
                error.message += ': could not channel send.';
                throw error;
            }
        } else if (!messageSent) {
            throw new Error('No channel or DM method to send messaeg');
        }
    } catch (error) {
        console.error('sendDirectOrFallbackToChannelEmbeds: - %s', error.message);
    }
}

/**
 * find the approximate size of an embed
 * @param {MessageEmbed} embed
 * @returns {number}
 */
function lengthOfEmbed(embed) {
    let embedLength = (embed.title ? embed.title.length : 0)
        + (embed.url ? embed.url.length : 0)
        + (embed.description ? embed.description.length : 0)
        + (embed.footer && embed.footer.text ? embed.footer.text.length : 0)
        + (embed.author && embed.author.name ? embed.author.name.length : 0);
    for (let field of embed.fields) {
        // embed.fields.forEach((field) => {
        embedLength += field.name.length + field.value.length;
    }
    console.log('EmbedLengthCheck: %d', embedLength);
    return embedLength;
}

/**
 *
 * @param {Message} msg
 * @param {String} roleID
 * @returns {Role}
 */
async function retrieveRoleForID(guild, roleID) {
    // console.log('retrieveRoleID: %s', roleID);
    let roleForID = await guild.roles.resolve(roleID);
    // console.log('retrieveRoleID, name: %s ', roleForID.name);
    return roleForID;
}

/**
 *
 * @param {Guild} guild
 * @param {String} roleName
 * @returns {Role}
 */
async function retrieveRoleIdForName(guild, roleName) {
    let roleForName;
    // ensure that the guild is populated ... this sometimes can not be populated on a new server join
    // guild = await guild.fetch();
    console.log('retrieveRoleIdForName: about to fetch roles cache');
    await guild.roles.fetch();
    // console.log('retrieveRoleIdForName: roles: ', guild.roles.cache);
    for (let [key, role] of guild.roles.cache) {
        // console.log(`retrieveRoleIdForName: ${key}:${role.name}`);
        if (role.name == roleName || '@' + role.name == roleName) {
            roleForName = role;
        }
    }
    // console.log("found rolename: " + roleForName.id);
    return roleForName.id;
}

function appendStringsForEmbedChanges(stringArray) {
    let fieldSize = 16;
    let separator = ' | ';
    return appendStringsForEmbed(stringArray, fieldSize, separator);
}

function appendStringsForEmbed(stringArray, fieldSize, separator, dontQuote, padChar) {
    let returnValue = '';
    let quote = '`';
    if (dontQuote) {
        quote = '';
    }
    stringArray.forEach((value) => {
        returnValue = returnValue + quote + stringOfSize(value, fieldSize, padChar) + quote + separator;
    })
    return returnValue.substring(0, returnValue.length - separator.length);
}

function stringOfSize(value, size, padChar, padBefore) {
    if (!padChar) {
        padChar = ' ';
    }
    value = value.substring(0, size);
    if (value.length < size) {
        if (padBefore) {
            value = padChar.repeat(size - value.length) + value;
        } else {
            value = value + padChar.repeat(size - value.length);
        }
    }
    return value;
}

/**
 * Return a url to this message
 * https://discord.com/channels/@me/795116627309232158/827549541494161419
 * https://discord.com/channels/785567026512527390/791376005935136768/827549498246561823
 * @param {String} guildId
 * @param {String} channelId
 * @param {String} messageId
 * @returns
 */
function getDiscordUrl(guildId, channelId, messageId) {
    if (!guildId) {
        guildId = '@me';
    }
    return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}

/**
 * Evaluate if the value passed represents a 'true'
 * @param {} value
 * @returns
 */
function isTrue(value) {
    if (typeof (value) === 'string') {
        value = value.trim().toLowerCase();
    }
    switch (value) {
        case true:
        case "true":
        case 1:
        case "1":
        case "on":
        case "yes":
            return true;
        default:
            return false;
    }
}

/**
 * ensure that the bot has proper permissions in the channel
 * @param {Message} msg
 */
async function checkChannelPermissions(msg) {
    // throw new Error(`test error`);
    //check that I have the proper permissions
    let requiredPerms = ['MANAGE_MESSAGES', 'SEND_MESSAGES', 'ADD_REACTIONS', 'READ_MESSAGE_HISTORY'];
    let botPerms = msg.channel.permissionsFor(msg.guild.me);
    // if (!await botPerms.has(requiredPerms)) {
    //     throw new Error(`Server channel (${msg.channel.name}) is missing a Required Permission (please inform a server admin to remove the bot from that channel or ensure the bot has the following permissions): ${requiredPerms}`);
    // }
    for (reqPerm of requiredPerms) {
        if (!await botPerms.has(reqPerm)) {
            throw new Error(`Server channel (${msg.channel.name}) is missing a Required Permission (please inform a server admin to remove the bot from that channel or ensure the bot has the following permission: ${reqPerm}`);
        }
    }
    // debug info below for permissions debugging in a channel
    // for (let [permOverKey, permOver] of msg.channel.permissionOverwrites.entries()) {
    //     let permOverKeyRoleName = (await utils.retrieveRoleForID(msg.guild, permOverKey)).name;
    //     console.log(permOverKeyRoleName + ': allowed:', permOver.allow);
    //     for (allowed of await permOver.allow.toArray()) {
    //         console.log(allowed);
    //     }
    //     console.log(permOverKeyRoleName + ': denied:', permOver.deny);
    //     for (denied of permOver.deny.toArray()) {
    //         console.log(denied);
    //     }
    // }
    // for (perm of msg.guild.me.permissions) {
    //     console.log(perm);
    // }
}

/**
 * sending messages for websockets
 */
async function clientWsReply(interaction, replyMessage) {
    try {
        let data = {
            content: replyMessage,
        }
        //check for embeds
        if (typeof replyMessage === 'object') {
            data = await createAPIMessage(interaction, replyMessage);
        }
        await client.api.interactions(interaction.id, interaction.token).callback.post({
            data: {
                type: 4,
                data: data
            }
        });
    } catch (error) {
        console.error('Caught error while trying to send WsReply', error);
    }
}

/**
 * Create APIMessage for interaction embeds
 * @param {*} interaction
 * @param {*} content
 * @returns
 */
async function createAPIMessage(interaction, content) {
    const channel = await client.channels.resolve(interaction.channel_id);
    const { data, files } = await APIMessage.create(channel, content).resolveData().resolveFiles();
    return { ...data, files };
}

exports.stringOfSize = stringOfSize;
exports.sendDirectOrFallbackToChannel = sendDirectOrFallbackToChannel;
exports.sendDirectOrFallbackToChannelEmbeds = sendDirectOrFallbackToChannelEmbeds;
exports.sendDirectOrFallbackToChannelError = sendDirectOrFallbackToChannelError;
exports.lengthOfEmbed = lengthOfEmbed;
exports.retrieveRoleForID = retrieveRoleForID;
exports.retrieveRoleIdForName = retrieveRoleIdForName;
exports.appendStringsForEmbed = appendStringsForEmbed;
exports.appendStringsForEmbedChanges = appendStringsForEmbedChanges;
exports.checkChannelPermissions = checkChannelPermissions;
exports.isTrue = isTrue;
exports.getDiscordUrl = getDiscordUrl;
exports.clientWsReply = clientWsReply;
exports.COLORS = COLORS;
