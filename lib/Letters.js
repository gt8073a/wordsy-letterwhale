module.exports = function(args) {

        var self = this;

        args = args || {};

	self.size       = args.size       || 17;

	self.letters    = args.letters;
        self.vowels     = args.vowels     || 'aaaaaaaeeeeeeeeeeeeiiiiiiioooooooouuu';
        self.consonants = args.consonants || 'bbcccddddffgghhhhhhjkllllmmmnnnnnnppqrrrrrssssstttttttvwwxyyz';

        self.gameLetters      = {};
	self.clear = function() { self.gameLetters = {} };
	self.get   = function() { return self.gameLetters; }

	self.setLetters     = function(str)  { self.letters     = str  };
	self.setVowels      = function(str)  { self.vowels      = str  };
	self.setConsonants  = function(str)  { self.consonants  = str  };
	self.setGameLetters = function(hash) { self.gameLetters = hash };
	self.setCount       = function(num)  { self.size        = num  };

	self.roll = function() {
		self.clear();
		var theseLetters = self.letters ? self.rollFromLetters() : self.rollFromVC();
		self.setGameLetters(theseLetters);
		return self.get();
	}

	self.rollFromLetters = function() {

		var theseLetters = {};
		var v = self.letters.split('').sort( function(a,b) { return Math.random() - Math.random() } );

		for ( var i = 0; i < self.size; i++ ) {
			var thisIndex  = Math.floor(Math.random() * v.length),
			    thisLetter = v.splice(thisIndex,1);
			theseLetters[thisLetter] = theseLetters[thisLetter] || 0;
			theseLetters[thisLetter]++;
		}
		return theseLetters;
	}

	self.rollFromVC = function() {

		var theseLetters = {};

		var v = self.vowels.split('').sort( function(a,b) { return Math.random() - Math.random() } ),
		    c = self.consonants.split('').sort( function(a,b) { return Math.random() - Math.random() } );

		/* 1:3 v:c, if 16 letters total, 4 should be vowels */
		var minVowelLength = Math.max(Math.floor(self.size/4),1),
		    vowelCount = minVowelLength + ( Math.random() >= 0.5 ? 1 : 0 );
		for ( var i = 0; i < vowelCount; i++ ) {
			var thisIndex  = Math.floor(Math.random() * v.length),
			    thisLetter = v.splice(thisIndex,1);
			theseLetters[thisLetter] = theseLetters[thisLetter] || 0;
			theseLetters[thisLetter]++;
		}

		for ( var i = vowelCount; i < self.size; i++ ) {
			var thisIndex  = Math.floor(Math.random() * c.length),
			    thisLetter = c.splice(thisIndex,1);
			theseLetters[thisLetter] = theseLetters[thisLetter] || 0;
			theseLetters[thisLetter]++;
		}

		return theseLetters;

	}

	self.validWord = function(word) {

		var thisWord     = word.toLowerCase(),
		    theseLetters = thisWord.split(''),
		    letterCounts = {};

		theseLetters.forEach(function(l) {
			if ( ! l.match(/\w/ ) ) { return };
			letterCounts[l] = letterCounts[l] || 0;
			letterCounts[l]++;
		})

		for ( var ll in letterCounts ) {
			var wordCount  = letterCounts[ll],
			    boardCount = self.gameLetters[ll] || 0;
			if ( wordCount > boardCount ) {
				return false; /* short circuit */
			}
		}

		return true;

	}

	return self;

}
