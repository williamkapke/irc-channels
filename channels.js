
var EventEmitter = require("events").EventEmitter;
var debug = require("debug")('irc-channel');

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
function getNames() {
	this.send('NAMES ' + this.name);
}
module.exports = {
	__irc: function(client){
		client.channels = {};
		client.join = function(name, cb){
			name = name && name.toLowerCase();
			if(!name || name in this.channels) return;

			this.send('JOIN ', name);

			if(!cb) return;

			//wait for names and topic to finish
			this.on('joined', waitforjoined);
			function waitforjoined(channel){
				debug('joined', channel.name);
				if(channel.name!==name) return;
				this.removeListener('joined', waitforjoined);
				cb.call(channel, channel);
			}
		};
		client
			.on('JOIN', onjoin)
			.on('QUIT', onquit)
			.on('PART', onpart)
			.on('KICK', onpart)
			.on('NICK', handler)
			.on('PRIVMSG', handler)
			.on('TOPIC', handler)
			.on('RPL_TOPIC', joining)
			.on('RPL_TOPIC_WHO_TIME', joining)
		;
		client.on('names', function (cname, names) {
			debug('relaying names');
			this.channels[cname].emit('names', names);
		});
	}
}
function handler(event){
	var name = event.params[0].toLowerCase();
	var channel = this.channels[name];
	if(!channel) return;

	channel.__emit(event);
}
function joining(event){
	var cname = event.params[1].toLowerCase();
	var channel = this.channels[cname];

	var dbg = channel.debug;
	if(dbg.enabled) dbg(JSON.stringify(event));

	if(event.command === 'RPL_TOPIC'){
		channel.topic.message = event.params[2];
	}
	else if(event.command === 'RPL_TOPIC'){
		channel.topic.by = event.params[2];
		channel.topic.at = event.params[3];
	}
}

function initChannel(client, cname){
	var channel = client.channels[cname] = new EventEmitter();
	channel.debug = require("debug")('irc-channel:'+cname);
	channel.client = client;
	channel.send = client.send.bind(client);
	channel.name = cname;
	channel.msg = msg;
	channel.part = part;
	channel.topic = {};
	channel.__active = true;
	channel.getNames = getNames;
	channel.debug('channel created');
	channel.__emit = function emit(event) {
		var dbg = this.debug;
		if(dbg.enabled) dbg(JSON.stringify(event));
		this.emit(event.command, event);
		this.emit('data', event);
	};
	Object.defineProperty(channel, 'names', {
		get: function(){
			var names = this.client.names;
			return names? names[this.name] : undefined;
		}
	});

	client.once('RPL_ENDOFNAMES', namesend);
	function namesend(event) {
		var cname2 = event.params[1].toLowerCase();
		if(cname2!==cname)
			client.once('RPL_ENDOFNAMES', namesend);
		else {
			channel.debug('joined');
			client.emit('joined', channel);
			channel.emit('joined', channel);
		}
	}

	return channel;
}

function onjoin(event){
	var isYou = event.nick===this.nick();
	var cname = event.params[0].toLowerCase();
	var channel = isYou? initChannel(this, cname) : this.channels[cname];
	channel.__emit(event);
}

function onquit(event){
	var client = this;
	var isYou = event.nick===this.nick();

	Object.keys(this.channels).forEach(function (cname) {
		var channel = client.channels[cname];
		if(isYou){
			destroy(channel);
		}
		channel.__emit(event);
	});
}
function onpart(event) {
	var isYou = event.nick===this.nick();
	var cname = event.params[0].toLowerCase();
	var channel = this.channels[cname];
	if(isYou){
		destroy(channel);
	}
	channel.__emit(event);
}

function destroy(channel) {
	channel.__active = false;
	delete channel.client.channels[channel.name];
	channel.debug('channel removed');
}
