const restify = require('restify');
const builder = require('botbuilder');
const firebase = require("firebase");
const _ = require("lodash");

/////////////////////////////////////
// START : Firebase initialization //
/////////////////////////////////////

const config = {
    apiKey: "AIzaSyCYf3d5DTf__YYrZzeaC99PS7XLw_EC0lc",
    authDomain: "ms-bot-firebase-demo.firebaseapp.com",
    databaseURL: "https://ms-bot-firebase-demo.firebaseio.com",
};
firebase.initializeApp(config);

///////////////////////////////////
// END : Firebase initialization //
///////////////////////////////////

//////////////////////////////
// START : bot boiler plate //
//////////////////////////////

// Setup Restify Server
const server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, () => {
    console.log('%s listening to %s', server.name, server.url);
});

// Create chat connector for communicating with the Bot Framework Service
const connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});

// Listen for messages from users
server.post('/api/messages', connector.listen());

// Receive messages from the user and respond by echoing each message back (prefixed with 'You said:')
const bot = new builder.UniversalBot(connector, (session) => {
    session.send("You said: %s", session.message.text);
});

////////////////////////////
// END : bot boiler plate //
////////////////////////////

/**
 * Invoked when `show users` is entered in the chat window
 */
bot.dialog("showUsers", [
    (session) => {

        const channelId = session.message.address.channelId;

        // Load all users for the specified channel
        firebase.database().ref(`chat-users/${channelId}`)
            .once("value")
            .then((snapshots) => {
                // Get the ref data
                const users = snapshots.val();

                // simply map each user into a list of userIds
                const actions = _.map(users, (user) => {
                    return user.userId;
                });

                // Present the chat with a list of known chat users
                builder.Prompts.choice(session, "Each button represents a stored user",
                    actions, { listStyle: builder.ListStyle.button }
                );
            })
            .catch((err) => console.log(err));
    },
    (session, result, next) => {

        const userId = result.response.entity;
        const channelId = session.message.address.channelId;

        // Load the specified user
        firebase.database().ref(`chat-users/${channelId}/${userId}`)
            .once('value')
            .then((snapshot) => {
                // Get the ref data
                let user = snapshot.val();

                // Protection whilst simulating
                // This checks you haven't changed address, this happens every new conversation in the emulator
                if (user.address.conversation.id !== session.message.address.conversation.id) {
                    session.send(`It looks you need to simulate adding the bot again!`);
                }

                // Send message to chat
                session.send(`Loaded firebase user ${user.username} at ref ${snapshot.ref}`);

                // Send direct message
                bot.send(new builder.Message()
                    .address(user.address) // Only users at this address will receive the message
                    .text("Hi, this is a direct message"));
            })
            .catch((err) => console.log(err));
    }
]).triggerAction({ matches: /^show users/i });

/**
 * Invoked when a user adds the bot to there contacts list - e.g. bot added event in the emulator
 */
bot.on("contactRelationUpdate", (message) => {

    const userId = message.user.id;
    const username = message.user.name || "--";
    const channelId = message.address.channelId;
    const address = message.address;

    // When the users adds the bot
    if (message.action === "add") {

        // Persist the user to firebase
        // Create a reference for the specific channel and user e.g. `emulator/userA` or `slack/userA` or `skype/userB`
        firebase.database().ref(`chat-users/${channelId}/${userId}`)
            .set({
                userId, username, channelId, address, // Data stored in firebase
            })
            .then(() => {
                // Once we've stored this simply reply to the user welcoming them
                bot.send(new builder.Message()
                    .address(message.address)
                    .text("Hello %s... Thanks for adding the bot", username));
            })
            .catch((err) => console.log(err));
    }

    // When a user removes the bot
    if (message.action === "remove") {

        // Remove the user from firebase (optional)
        firebase.database().ref(`chat-users/${channelId}/${userId}`)
            .remove()
            .then(() => {
                // Once removed send them a good bye message
                bot.send(new builder.Message()
                    .address(message.address)
                    .text("%s has removed the bot", username));
            })
            .catch((err) => console.log(err));
    }
});