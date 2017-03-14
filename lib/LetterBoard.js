var Letters = require('./Letters.js');

module.exports = function() {

	var self = this;

	self.letterBoard  = undefined;
	self.initNewBoard = function( args ) {

		self.letters = new Letters(args);
		self.letters.roll();

		self.clearText();
		self.createText();

	}

	self.getText = function() {
		return self.letterBoard
	}

	self.clearText = function() {
		self.letterBoard = undefined;
	}

	self.createText = function() {

		var holder = [],
		    letters = self.letters.get();
		for ( var l in letters ) {
			var size = letters[l];
			for ( var i = 0; i < size; i++ ) {
				holder.push(l);
			}
		}
		holder.sort();
		self.letterBoard = holder.join(' ');

	}

	return self;
}
