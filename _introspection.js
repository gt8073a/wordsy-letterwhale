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

slack.hears('^dump', 'direct_mention', function( bot, msg ) {

	if ( msg.text.match(/bot/) ) {
		console.log( 'bot:', bot );
	} else if ( msg.text.match(/msg/) ) {
		console.log( 'msg:', msg );
	} else if ( msg.text.match(/slack/) ) {
		console.log( 'slack:', slack );
	} else {
		bot.say( { channel: msg.channel, text: 'options are `slack`, `bot` or `msg`' } );
		return;
	}

	bot.say( { channel: msg.channel, text: 'check your console' } );

});

spawn.startRTM();
