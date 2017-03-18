var LetterBoard = require('./LetterBoard.js'),
    PlayerLog   = require('./PlayerLog.js');

module.exports = function(args) {

	var self = this;

	self.STARTED = undefined;

	/* possible states -> game over, starting, in progress */
	self.STATE     = 'GAME OVER';

	self.name = args.name    || 'wordsy';
	self.time = args.time    || 60; /* seconds */

	self.gameName = args.gameName || 'default';

	self.POINTS_MULTIPLIER = 1;

	self.messaging = args.messaging;
	self.services  = args.services;

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
	self.onYourMarks = function(fn) {

		var goFn = function( bot, resp ) {
			self._timeouts.STARTING = setTimeout( function() {self.messaging.UPDATE_MSG_FN( bot, resp, 'Go!', fn )}, 1500 )
		}

		var getSetFn = function( bot, resp ) {
			self._timeouts.STARTING = setTimeout( function() {self.messaging.UPDATE_MSG_FN( bot, resp, 'Get Set', goFn )}, 2000 )
		}

		var marksFn = function( bot, resp ) {
			self._timeouts.STARTING = setTimeout( function() {self.messaging.UPDATE_MSG_FN( bot, resp, 'On Your Marks', getSetFn )}, 3000 )
		}

		self._timeouts.STARTING = setTimeout( function() { self.messaging.SEND_MSG_FN( 'Game beginning', 'alert', marksFn ) }, 1000 );

	}

	self.runGame = function( config ) {

		self.time = config.time || 60;

		self.letterBoard.initNewBoard( config );
		self.messaging.SET_TOPIC_FN( self.letterBoard.getText(), 'highlight|bold' );

		self.STATE = 'STARTING';
		self.playerLog.words.MIN_WORD_LENGTH = config.MIN_WORD_LENGTH;
		self.gameName = config.gameName || 'default';

		var reps = [
			{ text: self.letterBoard.getText(), level: 'highlight|bold' },
			{ text: ' - ', level: 'plain' },
			{ text: self.getTimeLeft(0, 'short'), level: 'italics' },
			{ text: ' | ', level: 'plain' },
			{ text: self.playerLog.words.MIN_WORD_LENGTH + '+ letters', level: 'italics' },
			{ text: ' | ', level: 'plain' },
			{ text: self.gameName + ' game', level: 'italics' }
		];
		self.messaging.SEND_MSG_FN( reps, 'highlight' );

		var runGameFn = function() {

			self.STATE   = 'IN PROGRESS';
			self.STARTED = new Date();

			/* just in case! */
			self._timeouts.GAME_OVER_BACKUP = setTimeout( self.gameOver, ( self.time + 30 ) * 1000 );

			self.setPeriods( );
		}
		self.onYourMarks(runGameFn);
	}

	self.gameOver = function() {

		self.STATE = 'GAME OVER';
		for ( var tm in self._timeouts ) {
			clearTimeout( self._timeouts[tm] );
		}
		self.messaging.SEND_MSG_FN( 'GAME OVER', 'alert', self.scoreBoard );

	}

	self.setPeriods = function( ) {

		var bonusFn = function(bot,resp) {
			self._timeouts.PERIOD = setTimeout(
							function() {
								self.POINTS_MULTIPLIER = 3;
								self.messaging.UPDATE_MSG_FN( bot, resp, 'Bonus! Words are worth even more.', self.gameOverCountDown )
							},
							( self.time * 1000 / 2 )
						)
		}

		self._timeouts.PERIOD = setTimeout(
							function() {
								self.messaging.SEND_MSG_FN( 'Second half! Words are worth more.', bonusFn );
								self.POINTS_MULTIPLIER = 2
							},
							( self.time * 1000 / 2 )
						)

	}

	/* these times are not "right", they're mroe dramatic */
	self.gameOverCountDown = function() {

		var clearFn = function(bot,resp ) {
			self._timeouts.GAME_OVER = setTimeout( function() {self.messaging.UPDATE_MSG_FN( bot, resp, 'The Game is now over', self.gameOver )}, 2500 )
		}

		var oneFn = function(bot,resp ) {
			self._timeouts.GAME_OVER = setTimeout( function() {self.messaging.UPDATE_MSG_FN( bot, resp, 'Game over in 1!!!', clearFn )}, 1500 )
		}

		var twoFn = function(bot,resp ) {
			self._timeouts.GAME_OVER = setTimeout( function() {self.messaging.UPDATE_MSG_FN( bot, resp, 'Game over in 2', oneFn )}, 1500 )
		}

                self._timeouts.GAME_OVER = setTimeout( function() { self.messaging.SEND_MSG_FN( 'Game over in 3..', 'alert', twoFn ) }, 4000 );

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

		self.messaging.SEND_MSG_FN(thisMsg);

	}

	/* needs a timer */
	self.getTimeLeft = function( perc, format ) {

		if ( perc == undefined ) {
			perc = 2;
		}
		var cission = Math.pow(10, perc);

		var left;
		if ( self.STATE == 'GAME OVER' ) {
			left = "Game's already over."; 
		} else if ( self.STATE == 'STARTING' ) {
			if ( format == 'short' ) {
				left = self.time + 's';
			} else {
				left = "Game's just starting..";
			}
		} else {	
			var now         = new Date(),
			    nowTime     = now.getTime(),
			    startedTime = self.STARTED.getTime(),
			    diff        = (nowTime - startedTime)/1000,
			    left        = self.time - diff,
			    rnd         = Math.round( left * cission ) / cission;

			if ( rnd <= 7 ) {
				left = 'almost over!'
			} else {
				left = rnd + ( format && format == 'short' ? 's' : ' seconds' );
			}
		}

		return left;
	}

	return self;

}
