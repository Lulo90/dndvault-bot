const { Schema, model } = require('mongoose');

const Event = Schema({
    "guildID": {
        "type": "String",
        index: true
    },
    "title": {
        type: String
    },
    "dm": {
        type: String
    },
    "duration_hours": {
        type: Number
    },
    "date_time": {
        type: Date,
        index: true
    },
    "number_player_slots": {
        type: Number
    },
    "users_signed_up": {
        type: [{
            "userID": String,
            "date_time": Date
        }]
    },
    "campaign": {
        type: String,
        index: true
    },
    "description": {
        type: String
    },
    "userID": {
        type: String
    },
    "deployedByID": {
        type: String
    },
    "channelID": {
        type: String,
        index: true
    },
    "messageID": {
        type: String,
        index: true
    }
})
module.exports = model('Event', Event);