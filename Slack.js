#!/usr/bin/env node

var Config      = require('yaml-configuration-loader'),
    credentials = Config.load( process.env.CREDENTIALS || ( __dirname + '/config/slack_credentials.yaml' ) );

var debug  = process.env.DEBUG || false;
var Botkit  = require('botkit'),
    slack   = Botkit.slackbot({ debug: debug }),
    spawn   = slack.spawn({
                        token: credentials.BOTKIT_TOKEN,
                        "incoming_webhook": {
                                'url': credentials.BOTKIT_URL
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


var Servies = require('./lib/Slack/Services.js'),
    Game    = require('./lib/Game.js');

/* channel => new game.js */
var myName    = 'wordsy',
   theseGames = {};
var createGame = function( bot, msg ) {

	try { myName = bot.identity.name }
	catch (e) { console.log( 'bot has no identity?', e ) }

	var services = new Services( { bot: bot, message: msg } );
	theseGames[msg.channel] = new Game({services: services, name: myName});

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
			helpMsg  = myName + " is a timed word game. I'll show you letters, you make words.\n"
					      + "  Good Words earn you points.\n"
					      + "  Bad Words earn you negative points.\n"
					      + "  Dupes earn you a lot of negative points.\n",
			helpOpts = "To start a game ( see help game for more ):\n   @"                 + myName + " go\n"
				      + "To play a word in a game:\n  "                  + " type it in and hit return\n"
				      + "To see all the games:\n   @"           + myName + " dictionaries\n"
				      + "To end a game early:\n   @"            + myName + " game over\n"
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
		    thisConfig = JSON.parse(JSON.stringify( config.games[gameName] || config )),
		    thisDict   = DICTIONARY[gameName] || DICTIONARY['default'];
		thisConfig.gameName = gameName;

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
                        { text: '   - ', level: 'plain' },
                        { text: thisGame.getTimeLeft(0, 'short'), level: 'italics' },
                        { text: ' | ', level: 'plain' },
                        { text: thisGame.playerLog.words.MIN_WORD_LENGTH + '+ letters', level: 'italics' },
                        { text: ' | ', level: 'plain' },
                        { text: thisGame.gameName + ' game', level: 'italics' }
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

var theseGames = config.games || {};
for ( var key in config.games ) {
	var toLoad = config.games[key];
	loadDictionary(toLoad);
}
init();
