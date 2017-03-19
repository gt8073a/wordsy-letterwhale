# wordsy-letterwhale
A word game for Slack

To install, enter npm install.

Read config/README for config help. It's two steps, minimal effort.

In slack, /invite wordsy to a channel, direct messages don't work. Enter @wordsy help for .. help. Then, try @wordsy go

Note: Wordsy Letterwhale only works in channels. Direct messages won't register, and groups may throw errors.

## TODO
 * add game headers and footers ( this game was brought to you by the letter c )
 * create kiq version
 * fb messenger version
 * batch "actions", do alot per transaction ( do we really need that? )
 * fix slack score format on phone. needs utf8 nonbreaking space
 * track common words, score them 0 points
 * add file: to config, and load it, stored as if in og file
 * move dictionary to it's own object
 * move formatting to Slack/Format.js

