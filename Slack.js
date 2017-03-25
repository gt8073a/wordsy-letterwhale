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
		var thisMsg;
		if ( msg.text.match(/game/) ) {
			thisMsg = {
				channel: msg.channel,
				mrkdwn: true,
				attachments: [
					{
						title: myName + ' is a timed word game. I show letters, you make words.',
						text: "To start a game:\n"
							+ " _ @" + myName + " go_\n"
							+ " _ @" + myName + " game is french timer is 30 go_\n"
							+ " _ @" + myName + " smallest word 5 letters 20 go_",
						mrkdwn_in: ['text']
					},

					{ mrkdwn_in: ['text'], text: "To set the smallest size a word can be to get points:\n *-* _ smallest word 123_" },
					{ mrkdwn_in: ['text'], text: "To set the number of letters, defaults to 17:\n *-* _ letters 123_" },
					{ mrkdwn_in: ['text'], text: "To set the dictionary for the game:\n *-* _ game is spanish_" },
					{ mrkdwn_in: ['text'], text: "To set the time of the game, defaults to 60 sec:\n *-* _ timer 123_" },
				]
			}
		} else {
			thisMsg = {
				channel: msg.channel,
				mrkdwn: true,
				attachments: [
					{
						title: myName + ' is a timed word game. I show letters, you make words.',
						text: "*-* Good Words earn points.\n*-* Bad Words lose points.\n*-* Dupes lose *a lot* of points.\n",
						mrkdwn_in: ['text']
					},
					{ mrkdwn_in: ['text'], text: "To start a game ( see help game ):\n  _ @" + myName + " go_" },
					{ mrkdwn_in: ['text'], text: "To play a word in a game:\n  _ type it in and hit return_" },
					{ mrkdwn_in: ['text'], text: "To see all the games:\n  _ @" + myName + " dictionaries_" },
					{ mrkdwn_in: ['text'], text: "To end a game early:\n  _ @" + myName + " game over_" }
				]
			}
		}

		bot.say( thisMsg );

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
