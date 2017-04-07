module.exports = function( args ) {

	var self = this;

	self.bot     = args.bot;
	self.message = args.message;

	self.decorators = {
		'message':   ['```','```'],
		'highlight': ['`','`'],
		'alert':     ['<!channel> *','*'],
		'bold':      ['*','*'],
		'italics':   ['_','_'],
		'plain':     ['','']
	 }

	self.FORMAT_MSG_FN  = function( txt, level ) {

		level = level || 'message';
		if ( typeof level == 'string' ) {
			level = level.split('|')
		}

		var ret = txt;
		ret.replace( / /g, 0xC2A0 );

		level.forEach(function(l) {
			if ( ! self.decorators[l] ) {
				l = 'message'
			};
			var pre = self.decorators[l][0],
			    app = self.decorators[l][1];
			ret = pre + ret + app;
		})

		return ret;
	};

	self.MULTI_FORMAT_FN = function( msgs, level ) {
		msgs  = msgs  || [];
		level = level || 'plain';
		var str = '';
		msgs.forEach(function(msg) {
			var txt = msg.text,
			    lvl = msg.level || level,
			    fmt = self.FORMAT_MSG_FN( txt, lvl );
			str = str + fmt
		})
		return str;
	}

	self.FORMAT_PREPPER = function( args ) {

		var text   = args.text  || '',
		    level  = args.level || 'message',
		    fn     = args.fn    || function() { return true },
		    attach = args.attachments || undefined,
		    thisMsg;

		if ( typeof text == 'string' ) {
			thisMsg = self.FORMAT_MSG_FN( text, level );
		} else if ( text instanceof Array ) {
			thisMsg = self.MULTI_FORMAT_FN( text, level );
			level = 'plain'
		}

		if ( attach ) {
			if ( typeof attach == 'string' ) {
				var a = self.FORMAT_PREPPER({ text: attach, level: 'italics'});
				attach = { text: a.text };
			};
			if ( ! (attach instanceof Array) ) { attach = [ attach ] };
		}

		return { text: thisMsg, level: level, fn: fn, attachments: attach };
	}

	self.SEND_MSG_FN    = function( args ) {
		var obj = self.FORMAT_PREPPER( args );

		var msg = { channel: self.message.channel, text: obj.text };
		if ( obj.attachments ) {
			msg.attachments = obj.attachments;
		}

		self.bot.say( msg, function(error,response) {
			if ( error ) { console.log( 'SEND_MSG_FN', error ) };
			obj.fn( self.bot, response );
		});
	}

	self.UPDATE_MSG_FN = function( response, txt, level, fn  ) {
		/* this needs to be an args */
		if ( typeof level == 'function' ) {
			fn    = level;
			level = 'message';
		}
		var obj = self.FORMAT_PREPPER( { text: txt, level: level, fn: fn } );
		self.bot.api.chat.update({ ts: response.ts, channel: response.channel, text: obj.text }, function( error, resp ) {
			if ( error ) { console.log( 'UPDATE_MSG_FN', error ) };
			obj.fn( self.bot, resp );
		})
	}

	self.SET_TOPIC_FN    = function( txt, level, fn ) {
		var obj = self.FORMAT_PREPPER( { text: txt, level: level, fn: fn} )
		self.bot.api.channels.setTopic({ channel: self.message.channel, topic: obj.text } , function(error, resp) {
			if ( error ) { console.log( 'SET_TOPIC_FN', error ) };
			obj.fn( self.bot, resp );
		})
	}

	self.LOOKUP_PLAYER_NAME = function( id, fn ) {
		self.bot.api.users.info({user: id}, function(error, userResponse) {
			if ( error ) { console.log( 'LOOKUP_PLAYER_NAME', error ) };
			fn( id, userResponse.user.name );
		})
	};


	return self;

}
