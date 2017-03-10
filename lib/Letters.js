module.exports = function(args) {

        var self = this;

        args = args || {};

        self.LETTER_COUNT = args.LETTER_COUNT || 17;
        self.letters      = {};

	/* default taken from https://en.wikipedia.org/wiki/Letter_frequency */
        self.vowels     = args.vowels     || 'aaaaaaaeeeeeeeeeeeeeiiiiiiioooooooouuu';
        self.consonants = args.consonants || 'bbcccddddffgghhhhhhjkllllmmmnnnnnnnppqrrrrrrsssssstttttttttvwwxyyz';

	self.get   = function() {
		return self.letters;
	}

	self.clear = function() {
		self.letters = {}
	};

	self.roll = function() {

		self.clear();

		var v = self.vowels.split('').sort( function(a,b) { return Math.random() - Math.random() } ),
		    c = self.consonants.split('').sort( function(a,b) { return Math.random() - Math.random() } );

		var vowelCount = Math.random() >= 0.5 ? 5 : 4;
		for ( var i = 0; i < vowelCount; i++ ) {
			var thisIndex  = Math.floor(Math.random() * v.length),
			    thisLetter = v.splice(thisIndex,1);
			self.letters[thisLetter] = self.letters[thisLetter] || 0;
			self.letters[thisLetter]++;
		}

		for ( var i = vowelCount; i < self.LETTER_COUNT; i++ ) {
			var thisIndex  = Math.floor(Math.random() * c.length),
			    thisLetter = c.splice(thisIndex,1);
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
			if ( ! l.match(/\w/ ) ) { return };
			letterCounts[l] = letterCounts[l] || 0;
			letterCounts[l]++;
		})

		for ( var ll in letterCounts ) {
			var wordCount  = letterCounts[ll],
			    boardCount = self.letters[ll] || 0;
			if ( wordCount > boardCount ) {
				return false; /* short circuit */
			}
		}

		return true;

	}

	return self;

}
