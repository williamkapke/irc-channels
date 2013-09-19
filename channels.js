
var irc = require("irc-connect");
var EventEmitter = require("events").EventEmitter;

function msg(msg){
	if(this.__active)
		this.send('PRIVMSG ', this.name, ' :', msg);
	return this;
}
function part(msg){
	if(!this.__active) return;

	if(msg) this.send('PART ', this.name, ' :', msg);
	else this.send('PART ', this.name);
}

module.exports = {
	__irc: function(client){
		client.channels = {};
		client.join = function(name, cb){
			name = name && name.toLowerCase();
			if(!name || name in this.channels) return;

			this.send('JOIN ', name);

			if(!cb) return;

			this.on('JOIN', join);
			function join(){
				var channel = this.channels[name];
				if(!channel) return;
				this.removeListener('JOIN', join);

				//wait for names and topic to finish
				channel.once('joined', function (){
					cb.call(channel, channel);
				});
			}
		};
		client
			.on('JOIN', handler)
			.on('PART', handler)
			.on('KICK', handler)
			.on('PRIVMSG', handler)
			.on('TOPIC', handler)
			.on('QUIT', function (event) {
				var who = event.nick;
				var isYou = who===this.nick();

				Object.keys(this.channels).forEach(function (channel) {
					channel = client.channels[channel];
					if(isYou) channel.__active = false;
					var idx = channel.names.indexOf(who);
					if(~idx) {
						channel.names.splice(idx, 1);
						channel.emit('QUIT', event);
						channel.emit('data', event);
					}
				});
			})
		;
	}
}

function handler(event){
	var isYou = event.nick===this.nick();
	var name = event.params[0].toLowerCase();

	var channel = this.channels[name];

	if(isYou && event.command==='JOIN'){
		if(!channel){
			channel = this.channels[name] = new EventEmitter();
			channel.client = this;
			channel.send = this.send.bind(this);
			channel.name = name;
			channel.msg = msg;
			channel.part = part;
			channel.topic = {};
			irc.names.__irc(channel);
		}
		channel.__active = true;
		var names = channel.names = [];

		this.on('RPL_TOPIC', intro);
		this.on('RPL_TOPIC_WHO_TIME', intro);
		this.on('RPL_ENDOFNAMES', intro);

		this.on('RPL_NAMREPLY', namereply);
		function namereply(event){
			if(event.params[2].toLowerCase()!==name) return;
			names.push.apply(names, event.params[3].split(' '));
		}

		function intro(event){
			if(event.params[1].toLowerCase()!==name) return;

			this.removeListener(event.command, intro);
			switch(event.command){
				case 'RPL_TOPIC':
					channel.topic.message = event.params[2];
					break;
				case 'RPL_TOPIC_WHO_TIME':
					channel.topic.by = event.params[2];
					channel.topic.at = event.params[3];
					break;
				case 'RPL_ENDOFNAMES':
					//make sure everything is removed
					this.removeListener('RPL_TOPIC', intro);
					this.removeListener('RPL_TOPIC_WHO_TIME', intro);
					this.removeListener('RPL_ENDOFNAMES', intro);
					this.removeListener('RPL_NAMREPLY', namereply);
					channel.emit('joined');
					break;
			}
		}
	}
	if(!channel) return;

	if(isYou && event.command==='PART'){
		channel.__active = false;
		delete this.channels[event.params[0]];
	}
	channel.emit('PART', event);
	channel.emit('data', event);
}

function end(event) {
	if(!event)
		return this.emit('names', 'timeout', null, channel);

	var names = this.__names;
	delete this.__names;
	this.emit('names', null, names);
}

function reply(event){
	if(!this.__names) this.__names = {};
	var names = this.__names;
	var chan = event.params[2].toLowerCase();

	chan = names[chan] || (names[chan] = []);
	chan.push.apply(chan, event.params[3].split(' '));
}
