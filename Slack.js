#!/usr/bin/env node

var Config = require('yaml-configuration-loader'),
    config = Config.load( process.env.CONFIG || ( __dirname + '/config/default.yaml' ) );

    config.NAME = config.NAME || 'wordsy';

var myName = config.NAME,
    debug  = process.env.DEBUG || false;

var Botkit  = require('botkit'),
    slack   = Botkit.slackbot({ debug: debug }),
    spawn   = slack.spawn({
                        token: config.BOTKIT_TOKEN,
                        "incoming_webhook": {
                                'url': config.BOTKIT_URL
                        }
                });



config.DICTIONARY = {};
var fs = require('fs');
var loadDictionary = function(file,fn) {
	fs.readFile( file, 'utf8', function (err,data) {

		if (err) { return console.log(err); }

		data.split(/\n+/).forEach(function(d) {
			config.DICTIONARY[d] = true;
		});

	});

	fn();
}

var Game = require('./lib/Game.js');

/* channel => new game.js */
var theseGames = {};
var createGame = function( bot, msg ) {
	var thisConf            = JSON.parse(JSON.stringify(config));
	thisConf.SEND_MSG_FN    = function( txt, fn ) {
						fn = fn || function() { return true };
						bot.say( { channel: msg.channel, text: '```' + txt + '```' }, function(error,response) {
							fn( bot, response );
						});
				   };

	thisConf.SEND_ALERT_FN   = function( txt, fn ) {
						fn = fn || function() { return true };
						bot.say( { channel: msg.channel, text: '`' + txt + '`' }, function(error,response) {
							fn( bot, response );
						});
				   };

	thisConf.LOOKUP_PLAYER_NAME = function( id, fn ) {
						bot.api.users.info({user: id}, function(error, userResponse) {
							fn( id, userResponse.user.name );
						})
				   };
	thisConf.GAME_BEGIN_FN  = function( me ) {
						if ( ! me ) { return };
						bot.api.channels.setTopic({ channel: msg.channel, topic: '*' + me.letterBoard.getText() + '*' } , function(error, topicResponse) {
							if ( error ) { console.log( 'GAME_BEGIN_FN setTopic', error ); return }
						});
				   }

	theseGames[msg.channel] = new Game(thisConf);
}

var init = function() {

	slack.hears('^help', 'direct_mention', function( bot, msg ) {

		var helpMsg  = myName + " is a word game. I'll show you letters, you make words.\n"
		                      + "  You get " + ( config.TIME_OF_GAME || 45 ) + " seconds.\n"
		                      + "  Good Words earn you points.\n"
		                      + "  Bad Words earn you negative points.\n"
		                      + "  Dupes earn you a lot of negative points.\n",
		    helpOpts = "To start a game:\n   @"                 + myName + " start a game\n"
		              + "To play a word in a game:\n  "                  + " type it in and hit return\n"
			      + "To end a game early:\n   @"            + myName + " game over\n"
		              + "To see time left in a game:\n   @"     + myName + " time left\n"
			      + "To see the scoreboard:\n   @"          + myName + " score\n"
			      + "To see the letters in a game:\n   @"   + myName + " letters\n";

		helpOpts.replace( / /, 0xC2, 'g' );

		var help = '```' + helpMsg + helpOpts + '```';
		bot.say( { channel: msg.channel, text: help } );

	})

	/* create */
	slack.hears('^(go|(start|begin)((\\s+a)?\\s+game)?)', 'direct_mention', function( bot, msg ) {

		if ( ! theseGames[thisChannel] ) { createGame( bot, msg ); }

		var thisChannel = msg.channel;
 		if ( theseGames[thisChannel].STATE == 'GAME OVER' ) {
			theseGames[thisChannel].runGame();
		} else {
			/* this should be a leaky bucket, no spamming */
			bot.say( { channel: thisChannel, text: 'Game in progress. Try * @' + myName + ' stop game *' } );
		}

	});

	/* stop */
	slack.hears('^(game\\s+over|(end|stop)(\\s+game)?)', 'direct_mention', function( bot, msg ) {
		var thisChannel = msg.channel;

		if ( ! theseGames[thisChannel] || theseGames[thisChannel].GAME_OVER ) {
			bot.say( { channel: thisChannel, text: "Stop what? There's no game going.." } );
		} else {
			theseGames[thisChannel].gameOver();
		}
	})

	/* time */
	slack.hears('^time(\\s+left)?', 'direct_mention', function( bot, msg ) {
		var thisChannel = msg.channel;
		if ( ! theseGames[thisChannel] ) {
			bot.say( { channel: thisChannel, text: "There's no game, there's no time." } );
		} else {
			theseGames[thisChannel].timeLeft();
		}
	})

	/* score */
	slack.hears('^(game\\s+)?score', 'direct_mention', function( bot, msg ) {
		var thisChannel = msg.channel;
		if ( ! theseGames[thisChannel] ) {
			bot.say( { channel: thisChannel, text: "What score? There's no game.." } );
		} else {
			theseGames[thisChannel].scoreBoard();
		}
	})

	/* letters */
	slack.hears('^letters?(\\s*board)?', 'direct_mention', function( bot, msg ) {
		var thisChannel = msg.channel;
		if ( ! theseGames[thisChannel] ) {
			bot.say( { channel: thisChannel, text: "Letters? Start a game first.." } );
		} else {
			theseGames[thisChannel].letterBoard.getText();
		}
	})

	var resultToEmoji = {
		'duplicate':  'busts_in_silhouette',
		'bad match':  'capital_abcd',
		'shorty':     'fried_shrimp',
		'not a word': 'x',
		'word up':    'thumbsup',

		'+':          'heavy_plus_sign',
                '-':          'heavy_minus_sign',
                '0':          'zero',
                '1':          'one',
                '2':          'two',
                '3':          'three',
                '4':          'four',
                '5':          'five',
                '6':          'six',
                '7':          'seven',
                '8':          'eight',
                '9':          'nine',
                '.':          'black_circle_for_record'

	};
	slack.hears('^\\w', 'ambient', function( bot, msg ) {
		var thisChannel = msg.channel,
		    thisGame    = theseGames[thisChannel];
		if ( ! thisGame )                      { return }
		if ( thisGame.STATE != 'IN PROGRESS' ) { return }

		var ret = thisGame.submitWord( msg.text, msg.user );
		thisGame.SEND_ALERT_FN( thisGame.letterBoard.getText() );

		if ( ret && ret.reason ) {

			var thisPoints  = '' + ret.points,
			    thesePoints = thisPoints.split('');

			if ( thesePoints[0] == '-' ) { thesePoints.shift() }

			bot.api.reactions.add({ channel: msg.channel, timestamp: msg.ts, name: resultToEmoji[ ret.reason ] }, function(error,response) {

				var thisFn = function() {
					if ( ! thesePoints || ! thesePoints.length ) { return };

				       var thisChar = thesePoints.shift(),
					    thisEmoji = resultToEmoji[ thisChar ];
					bot.api.reactions.add({ channel: msg.channel, timestamp: msg.ts, name: thisEmoji }, function(error,response) {
						thisFn();
					})
				}
				thisFn();

				// console.log( 'reaction', msg, error, response );
			})
		}

	});

	spawn.startRTM();

}


loadDictionary( config.dictionary, init );
