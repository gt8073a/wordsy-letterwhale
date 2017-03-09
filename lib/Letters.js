module.exports = function(args) {

        var self = this;

        args = args || {};

        self.LETTER_COUNT = args.LETTER_COUNT || 11;
        self.letters      = {};

        /* pass in 'aaaaaaaaaaaaaeiou' if you want */
        self.vowels   = args.vowels   || 'aeiou';
        self.alphabet = args.alphabet || 'abcdefghijklmnopqrstuvwxyz';

	self.get   = function() {
		return self.letters;
	}

	self.clear = function() {
		self.letters = {}
	};

	self.roll = function() {

		self.clear();

		var vowels = self.vowels.split(''),
		    alphas = self.alphabet.split('');

		var firstVowel = vowels[Math.floor(Math.random() * vowels.length)];
		self.letters[firstVowel] = 1;

		for ( var i = 1; i <= self.LETTER_COUNT; i++ ) {
			var thisLetter = alphas[Math.floor(Math.random() * alphas.length)];
			self.letters[thisLetter] = self.letters[thisLetter] || 0;
			self.letters[thisLetter]++;
		}

		return self.get();

	}

	self.validWord = function(word) {

		var thisWord     = word.toLowerCase(),
		    theseLetters = thisWord.split(''),
		    letterCounts = {};

		theseLetters.forEach(function(l) {
			letterCounts[l] = letterCounts[l] || 0;
			letterCounts[l]++;
		})

		for ( var ll in theseLetters ) {
			var wordCount  = theseLetters[ll],
			    boardCount = self.letters[ll] || 0;
			if ( wordCount > boardCount ) {
				return false; /* short circuit */
			}
		}

		return true;

	}

	return self;

}
