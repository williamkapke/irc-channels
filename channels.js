
var irc = require("irc-connect");
var EventEmitter = require("events").EventEmitter;
var debug = require("debug")('irc-channel');
var push = Array.prototype.push;

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
			.on('JOIN', onjoin)
			.on('QUIT', onquit)
			.on('PART', handler)
			.on('KICK', handler)
			.on('PRIVMSG', handler)
			.on('TOPIC', handler)
		;
	}
}
function handler(event){
	var name = event.params[0].toLowerCase();
	var channel = this.channels[name];
	if(!channel) return;

	if(event.command==='PART'){
		var isYou = event.nick===this.nick();
		removeName(this, channel, isYou, event);
		return;
	}
	emit(channel, event);
}

function onjoin(event){
	var isYou = event.nick===this.nick();
	var cname = event.params[0].toLowerCase();

	if(isYou){
		var channel = initChannel(this, cname);
	}
	else {
		var channel = this.channels[cname];
		if(!channel) return;

		var names = channel.names;
		if(event.nick in names)
			debug[cname]('attempt to add duplicate name: ' + event.nick);
		else
			names.push(event.nick);
	}
	emit(channel, event);
}
function initChannel(client, cname){
	var dbg = debug[cname] = require("debug")('irc-channel:'+cname);
	dbg('channel create');
	var channel = client.channels[cname] = new EventEmitter();
	channel.client = client;
	channel.send = client.send.bind(client);
	channel.name = cname;
	channel.msg = msg;
	channel.part = part;
	channel.topic = {};
	channel.__active = true;
	channel.names = [];

	client.on('RPL_NAMREPLY', namereply);
	function namereply(event){
		if(event.params[2].toLowerCase()!==cname)
			return;

		var names = event.params[3].split(' ');
		if(dbg.enabled) dbg(JSON.stringify(event));
		push.apply(channel.names, names);
	}

	client.on('RPL_TOPIC', intro);
	client.on('RPL_TOPIC_WHO_TIME', intro);
	client.on('RPL_ENDOFNAMES', intro);
	function intro(event){
		if(event.params[1].toLowerCase()!==cname) return;

		if(dbg.enabled) dbg(JSON.stringify(event));

		client.removeListener(event.command, intro);

		switch(event.command){
			case 'RPL_TOPIC':
				channel.topic.message = event.params[2];
				break;
			case 'RPL_TOPIC_WHO_TIME':
				channel.topic.by = event.params[2];
				channel.topic.at = event.params[3];
				break;
			case 'RPL_ENDOFNAMES':
				dbg('There are ' +channel.names.length+ ' channel members');
				//make sure everything is removed
				client.removeListener('RPL_TOPIC', intro);
				client.removeListener('RPL_TOPIC_WHO_TIME', intro);
				client.removeListener('RPL_ENDOFNAMES', intro);
				client.removeListener('RPL_NAMREPLY', namereply);
				channel.emit('joined');
				break;
		}
	}
	return channel;
}

function onquit(event){
	var who = event.nick;
	var isYou = who===this.nick();
	var client = this;

	Object.keys(this.channels).forEach(function (cname) {
		var channel = client.channels[cname];
		removeName(client, channel, isYou, event);
	});
}
function removeName(client, channel, isYou, event) {

	var idx = channel.names.indexOf(event.nick);
	if(~idx) {
		channel.names.splice(idx, 1);
		emit(channel, event);
	}

	if(isYou) {
		channel.__active = false;
		delete client.channels[event.params[0]];
		dbg('channel removed');
	}
}

function emit(channel, event) {
	var dbg = debug[channel.name];
	if(dbg.enabled) dbg(JSON.stringify(event));
	channel.emit(event.command, event);
	channel.emit('data', event);
}