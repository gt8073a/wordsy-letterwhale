var LetterBoard = require('./LetterBoard.js'),
    PlayerLog   = require('./PlayerLog.js');

module.exports = function(args) {

	var self = this;

	self.STARTED = undefined;

	/* possible states -> game over, starting, in progress */
	self.STATE     = 'GAME OVER';

	self.NAME            = args.NAME            || 'wordsy';
	self.TIME_OF_GAME    = args.TIME_OF_GAME    || 60; /* seconds */

	self.POINTS_MULTIPLIER = 1;

	self.GAME_BEGIN_FN   = args.GAME_BEGIN_FN   || function() { return true };
	self.SEND_MSG_FN     = args.SEND_MSG_FN     || function() { return true };
	self.GET_PLAYER_NAME = args.GET_PLAYER_NAME || function() { return true };

	self.letterBoard = new LetterBoard( args );
	self.playerLog   = new PlayerLog( args );

	self.scoreWord = function(word) {

		var lengthPoints = 0;
		     if ( word.length <= 2 ) { lengthPoints =  1 }
		else if ( word.length <= 4 ) { lengthPoints =  2 }
		else if ( word.length <= 6 ) { lengthPoints =  4 }
		else if ( word.length <= 9 ) { lengthPoints =  8 }
		else                         { lengthPoints = 12 }


		/* FIRST!! don't repeat, that's the biggest ding */
		if ( self.playerLog.words.isSeen(word) ) {
			return { points: self.POINTS_MULTIPLIER * -2 * lengthPoints, reason: 'duplicate' };
		}

		if ( ! self.letterBoard.letters.validWord(word) ) {
			return { points: self.POINTS_MULTIPLIER * -1 * lengthPoints, reason: 'bad match' };
		};

		/* no penalty */
		if ( ! self.playerLog.words.isLongEnough(word) ) {
			return { points: 0, reason: 'shorty' };
		};

		if ( ! self.playerLog.words.isInDictionary(word) ) {
			return { points: self.POINTS_MULTIPLIER * -1 * lengthPoints, reason: 'not a word' };
		}

		return { points: self.POINTS_MULTIPLIER * 1 * lengthPoints, reason: 'word up' };
	}


	self.submitWord   = function(word,user) {

		
		if ( self.STATE != 'IN PROGRESS' ) { return };

		self.playerLog.users.getNameFromServer(user);

		var thisWord = word.toLowerCase();
		var thisScoreLog = self.scoreWord(thisWord);
		self.playerLog.words.store( thisWord, user);
		self.playerLog.scorePoints( user, thisWord, thisScoreLog.points, thisScoreLog.reason );

		return thisScoreLog;

	}

	/* identifier => tm */
	self._timeouts = {};
	self.setPointMultiplierTimeouts = function() {
		self._timeouts.START_SECOND_PERIOD = setTimeout(
							function() { self.SEND_MSG_FN( 'Second half! Words are worth more.' ); self.POINTS_MULTIPLIER = 2 },
							( self.TIME_OF_GAME * 1000 / 2 )
						)

		self._timeouts.START_BONUS_PERIOD  = setTimeout(
							function() { self.SEND_MSG_FN( 'Bonus! Words are worth even more.' ); self.POINTS_MULTIPLIER = 3 },
							( self.TIME_OF_GAME - 7 ) * 1000
						)
	}

	self.onYourMarks = function(fn) {

		var goFn = function( bot, resp ) {
			bot.api.chat.update({ ts: resp.ts, channel: resp.channel, text: '```Go!```' }, function( err, resp ) {
				fn();
			})
		}

		var getSetFn = function( bot,resp ) {
			bot.api.chat.update({ ts: resp.ts, channel: resp.channel, text: '```Get Set```' }, function( err, resp ) {
				self._timeouts.START_IN_ONE = setTimeout( function() { goFn( bot, resp ) }, 1500 );
			})
		};

		var marksFn = function(bot,resp) {
			bot.api.chat.update({ ts: resp.ts, channel: resp.channel, text: '```On your marks```' }, function( err, resp ) {
				self._timeouts.START_IN_TWO = setTimeout( function() { getSetFn(bot,resp) }, 2000 );
			})
		};

		
		self._timeouts.START_IN_THREE = setTimeout( function() { self.SEND_MSG_FN( 'Game beginning', 'alert', marksFn ) }, 1000 );
	}

	self.runGame = function() {

		self.letterBoard.initNewBoard();
		self.GAME_BEGIN_FN(self, function() { self.SEND_MSG_FN( self.letterBoard.getText(), 'highlight' ) } );

		self.STATE = 'STARTING';

		var runGameFn = function() {


			self.STATE     = 'IN PROGRESS';
			self.STARTED   = new Date();
			self._timeouts.GAME_OVER_BACKUP = setTimeout( self.gameOver, ( self.TIME_OF_GAME + 15 ) * 1000 );

			self.setPointMultiplierTimeouts();
			self.tickTockTickTock();
		}

		self.onYourMarks(runGameFn);
	}

	self.gameOver = function() {

		self.STATE = 'GAME OVER';
		for ( var tm in self._timeouts ) {
			clearTimeout( self._timeouts[tm] );
		}
		self.SEND_MSG_FN( 'GAME OVER', 'alert', self.scoreBoard );

	}

	self.tickTockTickTock = function() {

		var clearFn = function(bot,resp ) {
			bot.api.chat.update({ ts: resp.ts, channel: resp.channel, text: '```Game is over.```' }, function( err, resp ) {
				self._timeouts.GAME_OVER = setTimeout( self.gameOver, 1000 );
			})
		}

		var oneFn = function( bot,resp ) {
			bot.api.chat.update({ ts: resp.ts, channel: resp.channel, text: '```1!!```' }, function( err, resp ) {
				self._timeouts.CLEAR_END = setTimeout( function() { clearFn(bot,resp ) }, 1500 );
			})
		};

		var twoFn = function( bot,resp ) {
			bot.api.chat.update({ ts: resp.ts, channel: resp.channel, text: '```2!```' }, function( err, resp ) {
				self._timeouts.END_IN_ONE = setTimeout( function() { oneFn( bot, resp ) }, 1500 );
			})
		};

		var threeFn = function( bot, resp ) {
                        self._timeouts.END_IN_TWO = setTimeout( function() { twoFn(bot,resp) }, 2000 );
		}

		/* it's a lie.. */
                self._timeouts.END_IN_THREE = setTimeout( function() { self.SEND_MSG_FN( 'Game over in 3..', threeFn ) }, ( self.TIME_OF_GAME - 3 ) * 1000 );

	}

	/* this should be a non-breaking utf8 space */
	var spacer = ' ';

	/* add spacers to end of string */
	self.padString = function( str, maxLength ) {

		var newString = str,
		    strLength = str.length;
		if ( strLength > maxLength ) {
			/* chop it if it's too long */
			newString = newString.substring(0, maxLength - 2) + '..';
		} else {
			newString = newString + spacer.repeat(maxLength);
			newString = newString.substring(0, maxLength);
		}
		newString.replace(/\s/, spacer, 'g' );
		return newString;
	}

	self.padCount = function( str, maxLength ) {
		var countDisplay = spacer.repeat(maxLength) + str;
		countDisplay     = countDisplay.slice(-1 * maxLength);
		return countDisplay;
	}

	self.scoreBoard = function() {

		/* based on 33 char width */
		/* user words points */
		var userMaxLength  = 19,
		    wordsMaxLength = 6,
		    totalMaxLength = 8;

		var userHeader  = self.padString('Player',userMaxLength),
		    wordHeader  = self.padCount('Words',wordsMaxLength),
		    totalHeader = self.padCount('Score',totalMaxLength),
		    thisMsg     = userHeader + wordHeader + totalHeader + "\n" + '-'.repeat(33) + "\n";

		var points = self.playerLog.getPoints();
		points.forEach(function(p) {
			var userStr  = self.padString(p.user,userMaxLength),
			    wordStr  = self.padCount(p.words,wordsMaxLength),
			    totalStr = self.padCount(p.points,totalMaxLength);

			thisMsg = thisMsg + userStr + wordStr + totalStr + "\n";
		})

		self.SEND_MSG_FN(thisMsg);

	}

	/* needs a timer */
	self.timeLeft = function() {

		if ( self.STATE == 'GAME OVER' ) {
			self.SEND_MSG_FN( "Game's already over." );
		} else if ( self.STATE == 'STARTING' ) {
			self.SEND_MSG_FN( "Game's just starting.." );
		} else {	
			var now         = new Date(),
			    nowTime     = now.getTime(),
			    startedTime = self.STARTED.getTime(),
			    diff        = (nowTime - startedTime)/1000,
			    left        = self.TIME_OF_GAME - diff,
			    rnd         = Math.round( left * 100 ) / 100;
			self.SEND_MSG_FN( rnd + ' seconds' );
			
		}
	}

	return self;

}
