irc-channels
============

Channel features for [irc-connect](https://github.com/williamwicks/irc-connect).

```javascript
var channels = require('irc-channels');
var irc = require("irc-connect");

irc.connect('irc.freenode.net')
	.use(irc.pong, channels)
	.on('welcome', function (msg) {
		console.log(msg);

		this.join('#node.js', function(channel){

			channel.on('data', function (event) {
				console.log(JSON.stringify(event));
			});

			console.log(channel.topic);
			channel.msg('I got https://npmjs.org/package/irc-channels working!');
		})
	})
;
```



### The channel object
It is an `EventEmitter` with some extras.

#### channel.send(text[,text]...)
A proxy to `irc-connect`'s `send()` function;
It sends the text followed by a `\n`.

#### channel.name
Gets the name of the channel.

#### channel.msg(text)
Sends a `PRIVMSG` to the channel.

#### channel.part()
Leave the channel.

#### channel.topic
Gets current topic of the channel. Returns an `object`.

```javascript
console.log(JSON.stringify(channel.topic, null, 2));
//{
//  "message": "Hello irc-connect ppl",
//  "by": "wwicks!~wwicks@0.0.0.0",
//  "at": "1379547726"
//}
```

#### channel.names
Gets and `Array` of the current channel members. The list is updated when
`QUIT` | `JOIN` | `PART` happen.

## Events
The channel will emit the following channel specific events:

#### Event:'JOIN'
#### Event:'PART'
#### Event:'KICK'
#### Event:'PRIVMSG'
#### Event:'TOPIC'
#### Event:'QUIT'
#### Event:'names'
Emitted anytime the names list has been parsed for this channel.

### license
MIT
