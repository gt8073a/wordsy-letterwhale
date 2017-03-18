#!/usr/bin/env node

var Config = require('yaml-configuration-loader'),
    config = Config.load( process.env.CONFIG || ( __dirname + '/config/default.yaml' ) );

    config.NAME     = config.NAME || 'wordsy';
    config.EMOJISET = config.EMOJISET || 'default';

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

var DICTIONARY = {};
var fs = require('fs');
var loadDictionary = function( game ) {
	game = game || {};
	if ( ! game.file ) { return }
	var thisFile = game.file;
	if ( ! thisFile.match(/^\//) ) {
		thisFile = __dirname + '/' + thisFile;
	}

	fs.readFile( thisFile, 'utf8', function (err,data) {

		if (err) { return console.log(err); }

		var thisList = {};
		data.split(/\n+/).forEach(function(d) {
			var wordVal = d.split(/\t/);
			if ( ! wordVal[0].match(/\w+/) ) { return };
			thisList[wordVal[0].toLowerCase()] = wordVal[1] | true;
		});
		DICTIONARY[game.name] = thisList;

	});

}

var decorators = {
	'message':   ['```','```'],
	'highlight': ['`','`'],
	'alert':     ['<!channel> *','*'],
	'bold':      ['*','*'],
	'italics':   ['_','_'],
	'plain':     ['','']
 }

var FORMAT_MSG_FN  = function( txt, level ) {

	level = level || 'message';
	if ( typeof level == 'string' ) {
		level = level.split('|')
	}

	var ret = txt;
	level.forEach(function(l) {
		if ( ! decorators[l] ) {
			l = 'message'
		};
		var pre = decorators[l][0],
		    app = decorators[l][1];
		ret = pre + ret + app;
	})

	return ret;
};

var MULTI_FORMAT_FN = function( msgs, level ) {
	msgs  = msgs  || [];
	level = level || 'plain';
	var str = '';
	msgs.forEach(function(msg) {
		var txt = msg.text,
		    lvl = msg.level || level,
		    fmt = FORMAT_MSG_FN( txt, lvl );
		str = str + fmt
	})
	return str;
}

var FORMAT_PREPPER = function( txt, level, fn ) {
	var thisMsg;
	level = level || 'message';
	fn    = fn    || function() { return true };
	if ( typeof txt == 'string' ) {
		if ( typeof level == 'function' ) {
			fn    = level;
			level = 'message';
		}
		thisMsg = FORMAT_MSG_FN( txt, level );
	} else if ( txt instanceof Array ) {
		thisMsg = MULTI_FORMAT_FN( txt, level );
		level = 'plain'
	}
	return { text: thisMsg, level: level, fn: fn };
}

var Game = require('./lib/Game.js');

/* channel => new game.js */
var theseGames = {};
var createGame = function( bot, msg ) {
	var thisConf       = JSON.parse(JSON.stringify(config));

	thisConf.messaging = {};
	thisConf.messaging._prepper        = FORMAT_PREPPER;
	thisConf.messaging.FORMAT_MSG_FN   = FORMAT_MSG_FN;
	thisConf.messaging.MULTI_FORMAT_FN = MULTI_FORMAT_FN;

	thisConf.messaging.SEND_MSG_FN    = function( txt, level, fn ) {
						var obj = thisConf.messaging._prepper( txt, level, fn );
						bot.say( { channel: msg.channel, text: obj.text }, function(error,response) {
							if ( error ) { console.log( 'thisConf.messaging.SEND_MSG_FN', error ) };
							obj.fn( bot, response );
						});
				   };

	thisConf.messaging.UPDATE_MSG_FN = function( bot, response, txt, level, fn  ) {
						var obj = thisConf.messaging._prepper( txt, level, fn );
						bot.api.chat.update({ ts: response.ts, channel: response.channel, text: obj.text }, function( error, resp ) {
							if ( error ) { console.log( 'thisConf.messaging.UPDATE_MSG_FN', error ) };
							obj.fn( bot, resp );
						})
	}

	thisConf.messaging.SET_TOPIC_FN    = function( txt, level, fn ) {
						var obj = thisConf.messaging._prepper( txt, level, fn )
						bot.api.channels.setTopic({ channel: msg.channel, topic: obj.text } , function(error, resp) {
							if ( error ) { console.log( 'thisConf.messaging.SET_TOPIC_FN', error ) };
							obj.fn( bot, resp );
						})
	}

	thisConf.services = {};
	thisConf.services.LOOKUP_PLAYER_NAME = function( id, fn ) {
						bot.api.users.info({user: id}, function(error, userResponse) {
							if ( error ) { console.log( 'thisConf.messaging.LOOKUP_PLAYER_NAME', error ) };
							fn( id, userResponse.user.name );
						})
				   };

	theseGames[msg.channel] = new Game(thisConf);
}

var init = function() {

	slack.hears('^help', 'direct_mention', function( bot, msg ) {

		var helpMsg, helpOpts;
		if ( msg.text.match(/game/) ) {
			helpMsg  = "To start a game:\n   @" + myName + " go\n",
			helpOpts = "To set the smallest size a word can be to get points:\n   smallest word 123\n"
					+ "To set the number of letters, defaults to 17:\n   letters 123\n"
					+ "To set the time of the game, defaults to 60 sec:\n   timer 123\n"
					+ "Example:\n      @" + myName + " smallest word 5 timer 30 go\n"
		} else {
			helpMsg  = myName + " is a word game. I'll show you letters, you make words.\n"
					      + "  You get " + ( config.TIME_OF_GAME || 60 ) + " seconds.\n"
					      + "  Good Words earn you points.\n"
					      + "  Bad Words earn you negative points.\n"
					      + "  Dupes earn you a lot of negative points.\n",
			helpOpts = "To start a game ( see help game for more ):\n   @"                 + myName + " go\n"
				      + "To play a word in a game:\n  "                  + " type it in and hit return\n"
				      + "To see all the games:\n   @"           + myName + " dictionaries\n"
				      + "To end a game early:\n   @"            + myName + " game over\n"
				      + "To see time left in a game:\n   @"     + myName + " time left\n"
				      + "To see the scoreboard:\n   @"          + myName + " score\n"
				      + "To see the letters in a game:\n   @"   + myName + " letters\n";
		}

		helpOpts.replace( / /, 0xC2, 'g' );

		var help = '```' + helpMsg + helpOpts + '```';
		bot.say( { channel: msg.channel, text: help } );

	})

	/* create */
	slack.hears('(^|\\s+)(go|start|begin)$', 'direct_mention', function( bot, msg ) {

		if ( ! theseGames[thisChannel] ) { createGame( bot, msg ); }

		var matches    = msg.text.match(/(the\s+)?game(\s+is\s+|\s*=\s*|\s+)?(\w+)/),
		    gameName   = matches ? matches[ matches.length - 1] : 'default',
		    thisConfig = JSON.parse(JSON.stringify( config[gameName] || config )),
		    thisDict   = DICTIONARY[gameName] || DICTIONARY['default'];

		var tMatches = msg.text.match(/(the\s+)?timer?(\s+is\s+|\s*=\s*|\s+)?(\d+)/);
		thisConfig.time = tMatches ? tMatches[ tMatches.length - 1] : 60;

		var mMatches = msg.text.match(/letters(\s+is\s+|\s*=\s*|\s+)?(\d+)/i);
		thisConfig.size = mMatches ? mMatches[ mMatches.length - 1] : 17;

		/* needs a setter */
		var wMatches = msg.text.match(/(small(est)?\s+words?|length|word( length)?)(\s+is\s+|\s*=\s*|\s+)?(\d+)/i);
		thisConfig.MIN_WORD_LENGTH = wMatches ? wMatches[ wMatches.length - 1] : 2;

		var thisChannel = msg.channel;
 		if ( theseGames[thisChannel].STATE == 'GAME OVER' ) {
			theseGames[thisChannel].playerLog.words.setDictionary(thisDict);
			theseGames[thisChannel].runGame(thisConfig);
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
			bot.say( { channel: msg.channel, text: "There's no game, there's no time." } );
		} else {
			var time = theseGames[thisChannel].getTimeLeft();
			theseGames[thisChannel].messaging.SEND_MSG_FN( time, 'plain' );
		}
	})

	/* score */
	slack.hears('^(game\\s+)?score', 'direct_mention', function( bot, msg ) {
		var thisChannel = msg.channel;
		if ( ! theseGames[thisChannel] ) {
			bot.say( { channel: msg.channel, text: "There's no game, there's no score. Sheesh.." } );
		} else {
			theseGames[thisChannel].scoreBoard();
		}
	})

	slack.hears('^(list\\s+)?(games?|dictionar(y|ies))', 'direct_mention', function( bot, msg ) {
		if ( ! config.games.length ) { return }
		var txt = '';
		config.games.forEach(function(g) {
			txt = txt + g.name + ":\n     " + g.short + "\n"
		})
		txt = FORMAT_MSG_FN( txt, 'message' );
		bot.say( { channel: msg.channel, text: txt } );
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

		var reps = [
			{ text: thisGame.letterBoard.getText(), level: 'highlight|bold' },
			{ text: ' - ', level: 'plain' },
			{ text: thisGame.getTimeLeft(0), level: 'italics' },
			{ text: ' | ', level: 'plain' },
			{ text: thisGame.playerLog.words.MIN_WORD_LENGTH + '+ letter words', level: 'italics' }
		];
		thisGame.messaging.SEND_MSG_FN( reps, 'highlight' );

		if ( ret && ret.reason ) {

			var thisFn;
			if ( config.EMOJISET == 'mapsmarker' ) {

				var prefix    = ret.points < 0 ? 'negative' : 'positive',
				    thisEmoji = prefix + '_number_' + Math.abs(ret.points);
				thisFn = function() {bot.api.reactions.add({ channel: msg.channel, timestamp: msg.ts, name: thisEmoji }) };

			} else {

				var thisPoints  = '' + ret.points,
				    thesePoints = thisPoints.split('');

				if ( thesePoints[0] == '-' ) { thesePoints.shift() }

				thisFn = function() {
					if ( ! thesePoints || ! thesePoints.length ) { return };

				       var thisChar = thesePoints.shift(),
					    thisEmoji = resultToEmoji[ thisChar ];
					bot.api.reactions.add({ channel: msg.channel, timestamp: msg.ts, name: thisEmoji }, function(error,response) {
						thisFn();
					})
				}
			}

			bot.api.reactions.add({ channel: msg.channel, timestamp: msg.ts, name: resultToEmoji[ ret.reason ] }, function(error,response) {
				thisFn();
			})

		}

	});

	spawn.startRTM();

}

var theseGames = config.games || [];
theseGames.forEach(function(g) { loadDictionary(g) });
init();
