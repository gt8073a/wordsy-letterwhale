module.exports = function() {

	var self = this;

	self.MIN_WORD_LENGTH = 2;
	self.DICTIONARY      = {};
	self.initNewRound = function( config ) {
		self.clear();
		self.MIN_WORD_LENGTH = config.MIN_WORD_LENGTH || 2;
		self.DICTIONARY      = config.DICTIONARY      || { words: {}};
	}

	self.submittedWords = {};
	self.clear = function() {
		self.submittedWords = {};
	}

	self.store = function(word, user ) {
		var thisWord = word.toLowerCase();
		self.submittedWords[thisWord] = [ user, Date.now() ];
	}

        self.isInDictionary = function(word) {
		var thisWord = word.toLowerCase();
		return ( self.DICTIONARY.words[thisWord] );
	}

	self.isSeen = function(word) {
		word = word || '';
		var thisWord = word.toLowerCase();
		return ( self.submittedWords[thisWord] );
	}

	self.isLongEnough = function(word) {
		return ( word.length >= self.MIN_WORD_LENGTH );
	}

	return self;

}
