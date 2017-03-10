module.exports = function(args) {

	var self = this;
	args = args || {};

	self.MIN_WORD_LENGTH = args.MIN_WORD_LENGTH || 2;
	self.DICTIONARY      = args.DICTIONARY      || {};

	self.clear = function() {
		self.submittedWords = {};
	}

	self.store = function(word, user ) {
		var thisWord = word.toLowerCase();
		self.submittedWords[thisWord] = [ user, Date.now() ];
	}

        self.isInDictionary = function(word) {
		var thisWord = word.toLowerCase();
		return ( self.DICTIONARY[thisWord] );
	}

	self.isSeen = function(word) {
		word = word || '';
		var thisWord = word.toLowerCase();
		return ( self.submittedWords[thisWord] );
	}

	self.isLongEnough = function(word) {
		return ( word.length >= self.MIN_WORD_LENGTH );
	}

	self.clear();

	return self;

}
