module.exports = function(args) {

	var self = this;

	args = args || {};

	self.LOOKUP_PLAYER_NAME = args.LOOKUP_PLAYER_NAME || function() { return false };

	self.names = {};

	self.clear = function() {
		self.names = {};
	}

	self.set = function(id,name) {
		self.names[id] = name
		return name;
	}

	self.get = function( id ) {
		return self.names[id];
	}

	self.getNameFromServer = function( id ) {
		if ( ! self.names[id] ) { 
                        self.names[id] = 'unknown';
			var fn = function(id,name) { self.set(id,name) }
                        self.LOOKUP_PLAYER_NAME( id, fn );
                }
	}

	return self;

}
