# Use custom images for scores:

Unzip the numbers_emoji.zip file, upload each seperately, I know!, here:

	https://<your subdomain>.slack.com/customize/emoji

Set EMOJISET: mapsmarker in your config file.

	see [link](https://mapicons.mapsmarker.com/numbers-letters/numbers)
	Thanks for this!

I use a bookmarklet to add a bunch of emojis rapidly. See below for more information on bookmarklets. Entering a lot of text is prone to error making, so this bookmarklet uses the local image file name as the text name of the emoji.

	https://support.mozilla.org/t5/Learn-the-Basics-get-started/Use-bookmarklets-to-quickly-perform-common-web-page-tasks/ta-p/5218

To do this for yourself, in Chrome, do the following:
* Click Bookmarks > Bookmark Manager > Bookmarks Bar
* Right click to create a bookmark, and click Add page... 
* Give the new bookmark a name, I use "add emoji", and enter the following for url:

	javascript:$('#emojiimg').on('change', function(){ var name = $('#emojiimg').val().split('\\').pop().split('\.')[0]; $('#emojiname').val(name) })

* Move your new bookmark up so it shows in your bookmark bar. Yay! You're ready to add a bunch of emoji's.

* Open https://<your subdomain>.slack.com/customize/emoji, but use your subdomain.
* Click your new bookmark.
* Click "Choose File" under "Upload your emoji image" on the right side of the page.
* Choose your local file, and double click it.
* Check it out! The name of the local emoji image is auto filled in to the name text input.
* Click "Save New Emoji" button.

## Create your own

You can create your own emojis, make sure you set "EMOJISET: mapsmarker" in your config file. Be creative and have fun!

Here's all the files you'll need:

	negative_number_1.png
	negative_number_2.png
	negative_number_3.png
	negative_number_4.png
	negative_number_6.png
	negative_number_8.png
	negative_number_12.png
	negative_number_16.png
	negative_number_24.png
	negative_number_32.png
	negative_number_36.png
	negative_number_48.png
	negative_number_72.png

	positive_number_0.png
	positive_number_1.png
	positive_number_2.png
	positive_number_3.png
	positive_number_4.png
	positive_number_6.png
	positive_number_8.png
	positive_number_12.png
	positive_number_16.png
	positive_number_24.png
	positive_number_36.png

