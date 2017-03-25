var fs = require('fs');

module.exports = function(args) {

	var self = this;

	self.books = {};
	self.default  = args.default;

	self.loadBook = function( meta ) {

		meta = meta || {};
		if ( ! meta.file  ) { return }

		if ( ! meta.name  ) {
			meta.name = 'randoGame-o # ' + (Math.random().toString(16).substr(-6));
			meta.short = meta.short || 'random game';
		}

		if (   meta.words ) { return } 

		self.books[meta.name] = meta;
		self.default = self.default || meta.name;

		var thisFile = meta.file;
		if ( ! thisFile.match(/^\//) ) {
			thisFile = __dirname + '/../' + thisFile;
		}

		fs.readFile( thisFile, 'utf8', function (err,data) {

			if (err) { return console.log(err); }

			var thisList = {};
			data.split(/\n+/).forEach(function(d) {
				var wordVal = d.split(/\t/);
				if ( ! wordVal[0].match(/\w+/) ) { return };
				thisList[wordVal[0].toLowerCase()] = wordVal[1] || true;
			});
			meta.words = thisList;

		});

	}
	self.loadBooks = function( list ) {
		list = list || [];
		list.forEach(function(b) { self.loadBook(b) });
	}

	self.getWords = function( name ) {
		if ( self.books[name] && self.books[name].words ) {
			return self.books[name].words;
		} else {
			return;
		}
	}

	self.init = function( args ) {

		if ( ! args.books ) {
			if ( args.file ) {
				args = args || {};
				var thisBook = {
					file:  args.file,
					name:  args.name,
					short: args.short,
				}
				args.books = [ thisBook ];
			}
		}
		self.loadBooks(args.books);

	}
	self.init( args );
	return self;

}
