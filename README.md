# wordsy-letterwhale
A word game for Slack

To install, enter npm install.

Read config/README for config help. It's two steps, minimal effort.

In slack, /invite wordsy to a channel, direct messages don't work. Enter @wordsy help for .. help. Then, try @wordsy go

Note: Wordsy Letterwhale only works in channels. Direct messages won't register, and groups may throw errors.

## TODO
 * complete game.js / slack.js split, or just merge them. whatever, just do something because it sucks now
 * add more games ( requires 1000s of words. dogs is too small, maybe animals would work )
 * add game headers and footers ( this game was brought to you by the letter c )
 * add 3 columns, tsv, for dictionaries: word, true/false, response
 * create kiq version
 * batch "actions", do alot per transaction ( do we really need that? )
 * format game list
 * fix slack score format on phone. needs utf8 nonbreaking space


