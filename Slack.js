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

var Services = require('./lib/Slack/Services.js'),
    Game     = require('./lib/Game.js');

/* channel => new game.js */
var myName    = 'wordsy',
   theseGames = {};
var setName = function( bot ) {
	try { myName = bot.identity.name }
	catch (e) { console.log( 'bot has no identity?', e ) }
}
var createGame = function( bot, msg ) {
	setName(bot);
	var services = new Services( { bot: bot, message: msg } );
	theseGames[msg.channel] = new Game({services: services, name: myName});
}

var init = function() {

	slack.hears('^help', 'direct_mention', function( bot, msg ) {

		setName(bot);

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

		var thisChannel = msg.channel;
		if ( ! theseGames[thisChannel] ) { createGame( bot, msg ); }
 		if ( theseGames[thisChannel].STATE != 'GAME OVER' ) {
			bot.say( { channel: thisChannel, text: 'Game in progress. Try * @' + myName + ' stop game *' } );
			return;
		}

		var thisConfig = {};

		var matches       = msg.text.match(/(the\s+)?(game|book)(\s+is\s+|\s*=\s*|\s+)?(\w+)/);
		thisConfig.book   = matches ? matches[ matches.length - 1] : undefined;

		var tMatches      = msg.text.match(/(the\s+)?timer?(\s+is\s+|\s*=\s*|\s+)?(\d+)/);
		thisConfig.time   = tMatches ? tMatches[ tMatches.length - 1] : 60;

		var mMatches      = msg.text.match(/letters(\s+is\s+|\s*=\s*|\s+)?(\d+)/i);
		thisConfig.size   = mMatches ? mMatches[ mMatches.length - 1] : 17;

		var wMatches      = msg.text.match(/(small(est)?\s+words?|length|word( length)?)(\s+is\s+|\s*=\s*|\s+)?(\d+)/i);
		thisConfig.length = wMatches ? wMatches[ wMatches.length - 1] : 2;

		theseGames[thisChannel].runGame(thisConfig);

	});

	/* stop */
	slack.hears('^(game\\s+over|(end|stop)(\\s+game)?)', 'direct_mention', function( bot, msg ) {
		var thisChannel = msg.channel;
		if ( ! theseGames[thisChannel] ) { createGame( bot, msg ); }

		if ( theseGames[thisChannel].GAME_OVER ) {
			bot.say( { channel: thisChannel, text: "Stop what? There's no game going.." } );
		} else {
			theseGames[thisChannel].gameOver();
		}
	})

	slack.hears('^(list\\s+)?(games?|dictionar(y|ies))', 'direct_mention', function( bot, msg ) {

		var thisChannel = msg.channel;
		if ( ! theseGames[thisChannel] ) { createGame( bot, msg ); }

		var thisGame   = theseGames[thisChannel],
		    theseBooks = thisGame.dictionary.books || {};
		if ( ! Object.keys(theseBooks).length ) {
			bot.say( {channel: thisChannel, text: 'No games loaded yet..' });
			return;
		}

		var txt = '';
		for ( var key in theseBooks ) {
			var g = theseBooks[key];
			txt = txt + g.name + ":\n     " + g.short + "\n"
		}
		txt = thisGame.services.FORMAT_MSG_FN( txt, 'message' );
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
		thisGame.services.SEND_MSG_FN( reps, 'highlight' );

		if ( ret && ret.reason ) {

			var thisFn;
			if ( thisGame.emoji == 'mapsmarker' ) {

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

init();
