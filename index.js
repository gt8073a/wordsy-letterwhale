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

var Game = require('./game.js');

/* channel => new game.js */
var theseGames = {};
var createGame = function( bot, msg ) {
	var thisConf            = JSON.parse(JSON.stringify(config));
	thisConf.SEND_MSG_FN    = function( txt, opts, fn ) {
						opts = opts || '';
						var thisMsg = txt;
						if ( opts.match(/b/) ) { thisMsg = '*' + thisMsg + '*' };
						if ( opts.match(/i/) ) { thisMsg = '_' + thisMsg + '_' };
						bot.say( { channel: msg.channel, text: thisMsg } );
				   };
	thisConf.GET_PLAYER_NAME = function( id, fn ) {
						bot.api.users.info({user: id}, function(error, userResponse) {
							fn( id, userResponse.user.name );
						})
				   };
	thisConf.GAME_BEGIN_FN  = function( me ) {
						if ( ! me ) { return };
						bot.api.channels.setTopic({ channel: msg.channel, topic: me.getLetterBoard() } , function(error, topicResponse) {
							if ( error ) { console.log( 'GAME_BEGIN_FN setTopic', error ); return }
						});
				   }
	thisConf.GAME_OVER_FN   = function( me ) {
						if ( ! me ) { return };
						bot.api.channels.setTopic({ channel: msg.channel, topic: 'GAME OVER' } , function(error, topicResponse) {
							if ( error ) { console.log( 'GAME_OVER_FN setTopic', error ); return }
						});
				   }


	theseGames[msg.channel] = new Game(thisConf);
}

var init = function() {

	slack.hears('^help', 'direct_mention', function( bot, msg ) {

		var helpMsg  = myName + " is a word game. I'll show you letters, you make words.\n",
		    helpOpts = "To start a game, enter\n   @"           + myName + " start a game\n"
			      + "To see the scoreboard:\n   @"          + myName + " score\n"
			      + "To see the letters in a game:\n   @"   + myName + " letters\n"
			      + "To end a game earlier:\n   @"          + myName + " game over\n";

		helpOpts.replace( / /, 0xC2, 'g' );

		var help = '```' + helpMsg + helpOpts + '```';
		bot.say( { channel: msg.channel, text: help } );

	})

	/* create */
	slack.hears('^(go|(start|begin)((\\s+a)?\\s+game)?)', 'direct_mention', function( bot, msg ) {

		if ( ! theseGames[thisChannel] ) { createGame( bot, msg ); }

		var thisChannel = msg.channel;
 		if ( theseGames[thisChannel].GAME_OVER ) {
			theseGames[thisChannel].startGame();
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
			createGame( bot, msg );
			theseGames[thisChannel].startGame();
		} else {
			theseGames[thisChannel].showLetterBoard();
		}
	})

	var resultToEmoji = {
		'duplicate':  'busts_in_silhouette',
		'bad match':  'capital_abcd',
		'shorty':     'fried_shrimp',
		'not a word': 'x',
		'word up':    'thumbsup'
	};
	slack.hears('.*', 'ambient', function( bot, msg ) {
		var thisChannel = msg.channel,
		    thisGame    = theseGames[thisChannel];
		if ( ! thisGame )         { return }
		if ( thisGame.GAME_OVER ) { return }

		var ret = thisGame.submitWord( msg.text, msg.user );
		thisGame.showLetterBoard();

		if ( ret && ret.reason ) {
			bot.api.reactions.add({ channel: msg.channel, timestamp: msg.ts, name: resultToEmoji[ ret.reason ] }, function(error,response) {
				// console.log( 'reaction', msg, error, response );
			})
		}

	});

	spawn.startRTM();

}


loadDictionary( config.dictionary, init );
