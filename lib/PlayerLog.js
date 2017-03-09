var Users = require('./Users.js'),
    Words = require('./Words.js');

module.exports = function(args) {

	var self = this;

	args = args || {};

	/* user => word => [{points,reason}, .. ] */
	self.playerLog = {};

	self.users = new Users(args);
	self.words = new Words(args);

	self.clear = function() {
		self.playerLog = {};
	}

	self.scorePoints = function( user, word, points, reason ) {
		self.playerLog[user]       = self.playerLog[user]       || {};
		self.playerLog[user][word] = self.playerLog[user][word] || [];
		self.playerLog[user][word].push( { points: points, reason: reason } )
	}

	self.getPoints = function() {

		/* playerLog is user => word => [{points,reason}, .. ] */
		var points = [];
		for ( var user in self.playerLog ) {

			var thisUserName = self.users.get(user) || 'unknown',
			    thisUserHash = { user: thisUserName, words: 0, points: 0 },
			    theseWords   = self.playerLog[user];

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


	return self;

}
