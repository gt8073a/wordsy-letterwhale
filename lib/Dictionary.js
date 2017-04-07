var fs = require('fs');

var singleton;
module.exports = function(args) {

	if ( singleton ) { return singleton };

	singleton = this;

	singleton.books = {};
	singleton._files = {};
	singleton.default  = args.default;

	singleton.loadBook = function( meta ) {

		meta = meta || {};

		var thisFile = meta.file;
		if ( ! thisFile  ) { return }

		if ( ! thisFile.match(/^\//) ) {
			thisFile = __dirname + '/../' + thisFile;
		}

		meta.name = meta.name || singleton._files[thisFile];
		if ( ! meta.name  ) {
			meta.name = 'randoGame-o # ' + (Math.random().toString(16).substr(-6));
			meta.short = meta.short || 'random game';
		}
		singleton._files[thisFile] = meta.name;

		singleton.books[meta.name] = meta;
		singleton.default = singleton.default || meta.name;

		if (  meta.words ) { return } 

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
	singleton.loadBooks = function( list ) {
		list = list || [];
		list.forEach(function(b) { singleton.loadBook(b) });
	}

	singleton.getWords = function( name ) {
		if ( singleton.books[name] && singleton.books[name].words ) {
			return singleton.books[name].words;
		} else {
			return;
		}
	}

	singleton.init = function( args ) {

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
		singleton.loadBooks(args.books);

	}
	singleton.init( args );
	return singleton;

}
