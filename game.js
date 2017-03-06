module.exports = function(args) {

	var self = this;

	self.STARTED = undefined;
	self.GAME_OVER = true;

	self.NAME            = args.NAME            || 'wordsy';
	self.DICTIONARY      = args.DICTIONARY;
	self.MIN_WORD_LENGTH = args.MIN_WORD_LENGTH || 3;
	self.TIME_OF_GAME    = args.TIME_OF_GAME    || 45; /* seconds */
	self.LETTER_BOARD_INTERVAL = args.LETTER_BOARD_INTERVAL || 10;
	self.LETTER_COUNT    = args.LETTER_COUNT    || 11;
	self._letters        = {};

	self.POINTS_MULTIPLIER = 1;

	self.GAME_BEGIN_FN   = args.GAME_BEGIN_FN   || function() { return true };
	self.GAME_OVER_FN    = args.GAME_OVER_FN    || function() { return true };
	self.SEND_MSG_FN     = args.SEND_MSG_FN     || function() { return true };
	self.SEND_ALERT_FN   = args.SEND_MSG_FN     || function() { return true };
	self.GET_PLAYER_NAME = args.GET_PLAYER_NAME || function() { return true };

	/* word => [user,timestamp] */
	self._submittedWords = {};
	self.clearSubmittedWords = function() { self._submittedWords = {}; }
	self.rememberWord = function(word, user ) {
		self._submittedWords[word] = [ user, Date.now() ];
	}

	/* user => word => [{points,reason}, .. ] */
	self._playerLog = {};
	self.clearPlayerLog = function() {self._playerLog = {};};

	self.scorePoints = function( user, word, points, reason ) {
		self._playerLog[user]       = self._playerLog[user]       || {};
		self._playerLog[user][word] = self._playerLog[user][word] || [];
		self._playerLog[user][word].push( { points: points, reason: reason } )
	}

	self.scoreWord = function(word) {

		/* FIRST!! don't repeat, that's the biggest ding */
		if ( ! self.wordIsValidNotSeen(word) ) {
			return { points: self.POINTS_MULTIPLIER * -2 * word.length, reason: 'duplicate' };
		}

		if ( ! self.wordIsValidLetters(word) ) {
			return { points: self.POINTS_MULTIPLIER * -1 * word.length, reason: 'bad match' };
		};

		/* no penalty */
		if ( ! self.wordIsValidLength(word) ) {
			return { points: 0, reason: 'shorty' };
		};

		if ( ! self.wordIsValidIsAWord(word) ) {
			return { points: self.POINTS_MULTIPLIER * -1 * word.length, reason: 'not a word' };
		}

		return { points: self.POINTS_MULTIPLIER * 1 * word.length, reason: 'word up' };
	}


	/* id => name */
	self._users       = {};
	self._clearUsers  = function() { self._users = {}; }
	self._setUserName = function(id,name) { self._users[id] = name };
	self.submitWord   = function(word,user) {

		if ( self.GAME_OVER ) { return };

		/* set username */
		if ( ! self._users[user] ) {
			self._users[user] = 'unknown';
			self.GET_PLAYER_NAME(user,self._setUserName)
		}

		var thisScoreLog = self.scoreWord(word);
		self.rememberWord( word, user);
		self.scorePoints( user, word, thisScoreLog.points, thisScoreLog.reason );

		return thisScoreLog;

	}

	self.wordIsValidLength  = function(word) { return ( word.length >= self.MIN_WORD_LENGTH );        }
	self.wordIsValidNotSeen = function(word) { return ( ! self._submittedWords[word.toLowerCase()] ); }
	self.wordIsValidIsAWord = function(word) { return (   self.DICTIONARY[word.toLowerCase()] );      }

	self.wordIsValidLetters = function(word) {
		var theseLetters = word.split(''),
		    letterCounts = {};

		theseLetters.forEach(function(l) {
			letterCounts[l] = letterCounts[l] || 0;
			letterCounts[l]++;
		})

		for ( var ll in theseLetters ) {
			var wordCount  = theseLetters[ll],
			    boardCount = self._letters[ll] || 0;
			if ( wordCount > boardCount ) {
				return false;
			}
		}

		return true;

	}

	/* identifier => tm */
	self._timeouts = {};
	self.setPointMultiplierTimeouts = function() {
		self._timeouts.START_SECOND_PERIOD = setTimeout(
							function() { self.SEND_MSG_FN( 'Second half! Words are worth more.', 'b' ); self.POINTS_MULTIPLIER = 1.5 },
							( self.TIME_OF_GAME * 1000 / 2 )
						)

		self._timeouts.START_BONUS_PERIOD  = setTimeout(
							function() { self.SEND_MSG_FN( 'Bonus! Words are worth even more.', 'b' ); self.POINTS_MULTIPLIER = 2 },
							( self.TIME_OF_GAME - 7 ) * 1000
						)
	}

	self.scheduleShowBoard = function() {
		self._timeouts.REPEATEDLY_SHOW_BOARD = setInterval(
							self._showLetterBoard,
							( self.LETTER_BOARD_INTERVAL * 1000 )
						)
	}

	self._letters      = {};
	self._clearLetters = function() { self._letters = {} };
	self._rollLetters  = function() {

		var vowels = 'aeiou'.split(''),
		    alphas = 'abcdefghijklmnopqrstuvwxyz'.split('');

		var firstVowel = vowels[Math.floor(Math.random() * vowels.length)];
		self._letters[firstVowel] = 1;

		for ( var i = 1; i <= self.LETTER_COUNT; i++ ) {
			var thisLetter = alphas[Math.floor(Math.random() * alphas.length)];
			self._letters[thisLetter] = self._letters[thisLetter] || 0;
			self._letters[thisLetter]++;
		}

	}
	self.rerollLetters = function() {

		self.clearPlayerLog();

		self._clearLetters();
		self._rollLetters();

		self._clearLetterBoard();
		self.createLetterBoard();

	}

	self._letterBoard      = undefined;
	self._clearLetterBoard = function() { self._letterBoard = undefined; }
	self.getLetterBoard    = function() { return self._letterBoard };
	self.createLetterBoard = function() {
		self._clearLetterBoard();

		var holder = [];
		for ( var l in self._letters ) {
			var size = self._letters[l];
			for ( var i = 0; i < size; i++ ) {
				holder.push(l);
			}
		}
		holder.sort();
		self._letterBoard = holder.join(' ');

	}
	self._showLetterBoard = function() {
		self.SEND_MSG_FN( self._letterBoard, 'i' );
	}
	self.showLetterBoard = function() {
		if ( ! self._letterBoard ) { return };
		// clearTimeout( self._timeouts.REPEATEDLY_SHOW_BOARD );
		self._showLetterBoard();
		// if ( ! self.GAME_OVER ) { self.scheduleShowBoard(); }
	}
	

	self.onYourMarks = function(fn) {
		self._timeouts.START_IN_THREE = setTimeout( function() { self.SEND_MSG_FN( 'On your marks' ) }, 1 * 1000 );
		self._timeouts.START_IN_TWO   = setTimeout( function() { self.SEND_MSG_FN( 'Get Set' ) },       2 * 1000 );
		self._timeouts.START_IN_ONE   = setTimeout( function() { self.SEND_MSG_FN( 'Go!!', 'b' ); fn() },    3 * 1500 );
	}

	self.startGame = function() {
		self._clearLetterBoard();
		self.rerollLetters();
		self.showLetterBoard();
	}

	self.runGame = function() {

		var runGameFn = function() {
			self.STARTED   = new Date();
			self._timeouts.GAME_OVER = setTimeout( self.gameOver, self.TIME_OF_GAME * 1000 );

			// self.scheduleShowBoard();
			self.setPointMultiplierTimeouts();
			self.tickTockTickTock();

			self._clearUsers();

			self.GAME_OVER = false;

			self.GAME_BEGIN_FN(self);
		}

		self.onYourMarks(runGameFn);
	}

	self.gameOver = function() {

		self.GAME_OVER = true;

		for ( var tm in self._timeouts ) {
			clearTimeout( self._timeouts[tm] );
		}

		self.SEND_MSG_FN( 'GAME OVER', 'b' );
		self.scoreBoard();

		self.GAME_OVER_FN( self );
	}

	self.tickTockTickTock = function() {
		self._timeouts.GAME_IN_THREE = setTimeout( function() { self.SEND_MSG_FN( 'Game over in 3' ) },      ( self.TIME_OF_GAME - 3 ) * 1000 );
		self._timeouts.GAME_IN_TWO   = setTimeout( function() { self.SEND_MSG_FN( '2', 'b' ) },              ( self.TIME_OF_GAME - 2 ) * 1000 );
		self._timeouts.GAME_IN_ONE   = setTimeout( function() { self.SEND_MSG_FN( '1 !!!', 'b' ) },          ( self.TIME_OF_GAME - 1 ) * 1000 );
		
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
		    thisMsg     = '```' + userHeader + wordHeader + totalHeader + "\n" + '-'.repeat(33) + "\n";

		var points = self.calculatePoints();
		points.forEach(function(p) {
			var userStr  = self.padString(p.user,userMaxLength),
			    wordStr  = self.padCount(p.words,wordsMaxLength),
			    totalStr = self.padCount(p.points,totalMaxLength);

			thisMsg = thisMsg + userStr + wordStr + totalStr + "\n";
		})

		thisMsg = thisMsg + '```';
		self.SEND_MSG_FN(thisMsg);

	}

	self.calculatePoints = function() {


		/* _playerLog is user => word => [{points,reason}, .. ] */
		var points = [];
		for ( var user in self._playerLog ) {

			var thisUserName = self._users[user] || 'unknown',
			    thisUserHash = { user: thisUserName, words: 0, points: 0 },
			    theseWords   = self._playerLog[user];

			for ( var thisWord in theseWords ) {

				var thesePoints   = theseWords[thisWord],
				    foundPositive = false;

				thesePoints.forEach(function(p) {
					if ( p.points > 0 ) { foundPositive = true };
					thisUserHash.points = thisUserHash.points + p.points;
				})

				if ( foundPositive ) { thisUserHash.words++ };

			}

			thisUserHash.points = Math.floor( thisUserHash.points );
			points.push( thisUserHash );
		}

		points.sort(function(a,b) {
			return ( a.points - b.points ) || ( a.words - b.words )
		})

		return points;
	}

	self.timeLeft = function() {

		if ( self.GAME_OVER ) {
			self.SEND_MSG_FN( "Game's already over." );
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
