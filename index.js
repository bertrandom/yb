var _ = require('lodash');
var inquirer = require("inquirer");
var rawPhrases = require(__dirname + '/data/phrases.json');
var request = require('request');
var chalk = require('chalk');
var level = require('level');

var db = level(__dirname + '/users.db');

var packs = [];

var phrasesByPack = {};

var phrases = [];

rawPhrases['Phrase Packs'].forEach(function(rawPack) {

	var packName = rawPack.name.toUpperCase();

	packs.push(packName);
	phrasesByPack[packName] = [];

	rawPack.phrases.forEach(function(phrase, index) {

		var choice = {
			name: phrase.message,
			value: phrase
		};

		phrasesByPack[packName].push(choice);
		phrases.push(choice);

	});

});

phrases = _.sortBy(phrases, function(phrase) { return phrase.name; });

function getPhrase(callback) {

	inquirer.prompt([{
		type: 'list',
		choices: phrases,
		message: 'Choose a pack:',
		name: 'phrase'
	}], function(phraseAnswers) {

		var phrase = phraseAnswers.phrase;
		callback(phrase);

	});

}

function getPhraseByPack(callback) {

	inquirer.prompt([{
		type: 'list',
		choices: packs,
		message: 'Choose a pack:',
		name: 'pack'
	}], function(packAnswers) {

		inquirer.prompt([{
			type: 'list',
			choices: phrasesByPack[packAnswers.pack],
			message: 'Choose a phrase:',
			name: 'phrase'
		}], function(phraseAnswers) {

			var phrase = phraseAnswers.phrase;
			callback(phrase);

		});	

	});

}

function addUser(callback) {

	inquirer.prompt([{
		type: 'input',
		message: 'Username:',
		name: 'user',
		value: '',
		filter: function(user) {
			return user.toUpperCase();
		},
		validate: function(user) {
			return user && user.length > 0;
		}
	}], function(answers) {

		callback(answers.user);

	});

}

function getUser(callback) {

	db.get('users', function(err, users) {

		if (err) {
			addUser(callback);
			return;
		}

		var choices = [];

		users = JSON.parse(users);

		if (_.isEmpty(users)) {
			addUser(callback);
			return;
		}

		users = _.sortBy(_.keys(users), function(user) {
			return users[user] * -1;
		});

		users.forEach(function(user) {

			choices.push({
				name: user,
				value: user
			});

		});

		choices.push({
			name: '+',
			value: '+'
		});

		inquirer.prompt([{
			type: 'list',
			choices: choices,
			message: 'Yo B*TCH!',
			name: 'user'
		}], function(answers) {

			if (answers.user === '+') {

				addUser(callback);

			} else {

				callback(answers.user);

			}

		});		

	});

}

function deleteUser(user, callback) {

	db.get('users', function(err, users) {

		if (err) {
			return callback();
		}

		users = JSON.parse(users);

		if (users[user]) {
			delete users[user];
		}

		db.put('users', JSON.stringify(users), function(err) {

			return callback();

		});

	});

}

function getPayload(user, callback) {

	inquirer.prompt([{
		type: 'list',
		choices: [
			{
				name: 'Packs',
				value: 'packs'
			},
			{
				name: 'Phrases',
				value: 'phrases'
			},
			{
				name: 'Remove ' + user,
				value: 'delete'
			}
		],
		message: 'Yo B*TCH!',
		name: 'action'
	}], function(answers) {

		var phraseCallback = function(phrase) {

			inquirer.prompt([{
				type: 'input',
				message: 'Message',
				default: phrase.message,
				name: 'message',
				filter: function(message) {

					if (message != phrase.message) {
						return message.toUpperCase() + ', B*TCH!';					
					}

					return message;

				}
			}], function(answers) {

				callback(phrase, answers.message);

			});

		};

		if (answers.action === 'packs') {
			getPhraseByPack(phraseCallback);
		} else if (answers.action === 'phrases') {
			getPhrase(phraseCallback);
		} else if (answers.action === 'delete') {
			deleteUser(user, function() {
				console.log(user + ' removed.');
			});
		}

	});

}

function sendMessage(user, phrase, message, callback) {

	request({
		method: 'POST',
		url: 'https://api.parse.com/2/client_function',
		headers: {
			'Authorization': 'OAuth oauth_signature="7gaY38SgK8nvWa%2FZPZ4qFeMLNsA%3D", oauth_signature_method="HMAC-SHA1", oauth_nonce="8EAECC25-8EC5-4E71-9D54-5D774768F2BF", oauth_version="1.0", oauth_timestamp="1420515020", oauth_consumer_key="UMO2IPUqKNiIKYXvDxI0A4aqG7kfT6C35R2FPD6M"',
			'User-Agent': 'YB/2 (iPhone; iOS 8.1.2; Scale/2.00)',
			'Accept-Language': 'en;q=1',
			'X-NewRelic-ID': 'UAUDV1dRGwYAU1ZaAQE='
		},
		json: true,
		body: {
		    "appBuildVersion": "2",
		    "appDisplayVersion": "1.1",
		    "data": {
		        "channel": user,
		        "data": {
		            "message": message,
		            "sound": phrase.sound
		        }
		    },
		    "function": "send_yo_bitch",
		    "iid": "DE460E4A-C429-4C17-8112-094A32C70DE6",
		    "osVersion": "Version 8.1.2 (Build 12B440)",
		    "session_token": "l09OALG70mWjVGXUP8PNR1shK",
		    "uuid": "8A2A59B9-DB76-4D1A-A9AF-9BFC19DD6728",
		    "v": "i1.4.1"
		},
		gzip: true
	}, function(err, response, body) {

		if (err) {
			return callback(err);
		}

		if (response.statusCode === 200) {
			callback(null, body);
		} else {
			callback(new Error('API returned ' + response.statusCode));
		}

	});

}

module.exports = function() {

	getUser(function(user) {
		getPayload(user, function(phrase, message) {
			sendMessage(user, phrase, message, function(err, response) {

				if (err) {
					console.log(chalk.bold.red('There was an error sending your message.'));
					return;
				}

				console.log(chalk.bold.green('Message sent!'));

				db.get('users', function(err, users) {

					if (err) {

						var lookup = {};
						lookup[user] = 1;

						db.put('users', JSON.stringify(lookup), function(err) {
							// All done!
						});
						return;

					}

					users = JSON.parse(users);

					if (users[user]) {
						users[user] += 1;
					} else {
						users[user] = 1;					
					}

					db.put('users', JSON.stringify(users));

				});

			});
		});
	});

};