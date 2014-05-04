var VERSIONID = '1.0.2';

/*
 * Required modules.
 */
 var express = require('express');
 var http = require('http');
 var fs = require('fs');
 var path = require('path');
 var YTF = require('youtube-feeds');
 var colors = require('colors');
 var _ = require('underscore');
 //var SCR = require('soundcloud-resolve');

 var startDate;

 var lastrandom = [];

 /* Important Variables. */

 /* End important variables. */

/**
 * Port number LUNA should listen on. Default is 9002.
 * @final
 */
 var portnum;

/**
 Read important variables.
 */
 initVariables();


/**
 * Rooms object. Keep this in memory while the program runs to enhance performance. 
 * When needed, this (or parts of it) will get written to the disk.
 */
 var rooms = {}; 

/**
 * The express server.
 * @final
 */
 var app = express();
 var server = http.createServer(app).listen(portnum);

/**
 * The socket.io object.
 * @final
 */
 var io = require('socket.io').listen(server);


io.set('log level', 1); //Set log level minimal.

/*
 * Read streams before initializing the server.
 */
 createRoomsObject();

/*
 * Express3 page serving
 */

//use a public directory to serve Javascript and Luna's CSS styles.
app.use(express.static(path.join(__dirname, 'public')));

//Handler for / urls. -> ex. http://luna.berrypunch.net
app.get('/', function(request, response) {
	response.render('landing.ejs');
});

//handler for the /credits link. Serves the credits page. -> ex. http://luna.berrypunch.net/credits
app.get('/credits', function(request, response) {
	response.render('credits.ejs', {VERSION: VERSIONID});
});

app.get('/info', function(request, response) {
	var currTime = new Date();

	var sec = Math.floor((currTime - (startDate))/1000);
	var min = Math.floor(sec/60);
	var hours = Math.floor(min/60);
	var days = Math.floor(hours/24);
	hours = hours-(days*24);

	min = min-(days*24*60)-(hours*60);
	sec = sec-(days*24*60*60)-(hours*60*60)-(min*60);
	var os = require("os");

	response.render('info.ejs', {u_days: days, u_hours: hours, u_min: min, u_sec: sec, VERSION: VERSIONID, randomsample: lastrandom, osinfo: os});
});

//Handler for /streams/ urls. -> ex. http://luna.berrypunch.net/streams/myStream
app.get('/streams/:stream', function(request, response) {
	var streamFile = "streams/" + request.params.stream + ".json";
	fs.exists(streamFile, function(exists) {
		if(!exists) {
			//Stream doesn't exist! Maybe user should create it first?
			//Return non-existant stream page.
			response.render('nonexistantstream.ejs');
		} else {
			//Woop, stream exists. Return the stream.
			fs.readFile(streamFile, 'utf8', function(err, data) {
				//Read the file.
				var streamDat = JSON.parse(data);
				response.render('stream.ejs', {streamData: streamDat, roomName: request.params.stream});	
			});
		}
	});
});

/**
 * Set up Socket.io
 */
 io.sockets.on('connection', function(client) {
				//'Streamdata for this client'
				var streamDat;
				var streamFile;

					/*
					 * Handle the 'setup' message from the user.
					 * This will subscribe the user to the correct socket.io room
					 * And send this user the latest playlist and the current video + time.
					 */
					 client.on('setup', function(data) {
					 	var userRoom = data.room;
					 	logDebugMessage("A client registered on room: " + data.room);
					 	client.set("room", data.room);
					 	if(rooms[data.room] == undefined) {
					 		rooms[data.room] = data.room;
					 	}
						client.join(data.room); //Join the socket.io room.
						streamFile = "streams/" + data.room + ".json";
						//READ THIS ROOM'S DATA.
						fs.readFile(streamFile, 'utf8', function(err, data) {
							var streamDat = JSON.parse(data);
							var vidnum = streamDat["currentvideo"];
							var currentplaying = "";
							for(var track in streamDat["tracks"]) {
								if(streamDat["currentvideo"] == streamDat["tracks"][track]["id"]) {
									currentplaying = streamDat["tracks"][track]["url"];
								}
							}
							client.emit('initClient', {currVid: currentplaying,
								currTime: rooms[userRoom].currTime,
								playing: streamDat["playing"],
								currentID: rooms[userRoom].currentvideo });
								//Send client latest playlist.
								sendClientPlaylist(client, userRoom);
							});
					});

					/*
					 * Handler for the 'alterStream' message from the user.
					 * If a user is a controller, this message will be used to either
					 * Pause or play a video. It will also be broadcasted to every user who
					 * is currently in this room (and thus in the same socket.io room).
					 */
					 client.on('alterStream', function(msg) {
					 	client.get("room", function(err, room) {
							//check if client has the control link!
							if(doesClientHaveStreamKey(msg.myroom, msg.controlkey)) {
								switch(msg.data) {
									case "play":
									setPlayPause(msg.myroom, true);
									break;
									case "pause":
									setPlayPause(msg.myroom, false);
									break;
								}
								io.sockets.in(room).emit('changeStream', {data: msg.data});
							}
						});
					 });

					/*
					 * Handler for the 'disconnect' message from the user.
					 * Fired when a client disconnects.
					 */
					 client.on('disconnect', function() {
					 	client.get("room", function(err, room) {
							//Have the client leave his current socket.io room.
							client.leave(room);
						});
					 });

					/*
					 * Handle the 'altercurrentvideotime' message from the user.
					 * This changes the current time of the video in the application's memory and on the disk.
					 * Will only be altered if the user has control over the stream.
					 */
					 client.on('altercurrentvideotime', function(userData) {
						//Check if client has the correct stream key.
						if(doesClientHaveStreamKey(userData.myroom, userData.controlkey)) {
							//Set the room's time.
							setRoomTime(userData.myroom, userData.currtime);
						}
					});

					/*
					 * Handle the 'seekVideo' message from the client.
					 * This message should let other users know the video time has been altered
					 * (by a user with control over the room).
					 */
					 client.on('seekVideo', function(userData) {
						//Check if client has the correct stream key.
						if(doesClientHaveStreamKey(userData.myroom, userData.controlkey)) {
							//change the room time.
							setRoomTime(userData.myroom, userData.currtime);
							//Let other clients know the video has been seeked.
							io.sockets.in(userData.myroom).emit('seekVideo', {time: userData.currtime});
						}
					});

					/*
					 * Handle the 'playSong' message from the client.
					 * This tries to play a certain song (given by ID) in the user's room.
					 */
					 client.on('playSong', function(userData) {
						//Check if client has the correct stream key.
						if(doesClientHaveStreamKey(userData.myroom, userData.controlkey)) {
							//Try to change the song.
							playVideoInRoom(userData.songID, userData.myroom);
						}
					});

					/*
					 * Handle the 'isRoomAvailable' message from the client.
					 * Check if the given room is available.
					 */
					 client.on('isRoomAvailable', function(userData) {
					 	var isAvailable = isRoomAvailable(userData.rmname, client);
					 });

					/*
					 * Handle the 'createNewStream' message from the client.
					 */
					 client.on('createNewStream', function(userData) {
						//Try to create a room with the given name for the current client.
						createRoom(userData.roomname, client);
					});

					/*
					 * Handle the 'playNextVideo' message from the client.
					 */
					 client.on('playNextVideo', function(userData) {
					 	//Check if client has the correct stream key.
					 	if(doesClientHaveStreamKey(userData.myroom, userData.controlkey)) {
					 		//Only change if the ID's match. This is to prevent multiple calls to this method.
					 		if(userData.currentID === rooms[userData.myroom].currentvideo) {
					 			playNextVideoInRoom(userData.myroom);
					 		}
					 	}
					 });

					 client.on('playPreviousVideo', function(userData) {
					 	//Check if client has the correct stream key.
					 	if(doesClientHaveStreamKey(userData.myroom, userData.controlkey)) {
					 		//Only change if the ID's match. This is to prevent multiple calls to this method.
					 		if(userData.currentID === rooms[userData.myroom].currentvideo) {
					 			playPreviousVideoInRoom(userData.myroom);
					 		}
					 	}
					 });

					 client.on('playNextShuffledVideo', function(userData) {
					 	//Check if client has the correct stream key.
					 	if(doesClientHaveStreamKey(userData.myroom, userData.controlkey)) {
					 	//Only change if the ID's match. This is to prevent multiple calls to this method.
					 	if(userData.currentID == rooms[userData.myroom].currentvideo) {
					 		playNextVideoInRoomShuffle(userData.myroom);
					 	}
					 }
					});

					/*
					 * Handle the 'addVideo' message from the client.
					 */
					 client.on('addVideo', function(userData) {
						//Check if client has the correct stream key.
						if(doesClientHaveStreamKey(userData.myroom, userData.controlkey)) {
							//Add the song to the user's room.

							//Check if YouTube.
							if(userData.url.indexOf("youtube.com") > -1) {
								addYoutubeSong(userData.url, userData.myroom);
							}
							//Check SoundCloud.
							/*if(userData.url.indexOf("soundcloud.com") > -1) {
								addSoundcloudTrack(userData.url, userData.myroom);
							}*/
						}
					});

					/*
					 * Handle the 'removeVideo' message from the cient.
					 */
					 client.on('removeVideo', function(userData) {
						//Check if client has the correct stream key.
						if(doesClientHaveStreamKey(userData.myroom, userData.controlkey)) {
							removeVideoFromStream(userData.videoID, userData.myroom);
						}
					});

					 /**
					  * Handle the 'renameVideo' message from the client.
					  */
					  client.on('renameVideo', function(userData) {
					  	//Check if client has the correct stream key.
					  	if(doesClientHaveStreamKey(userData.myroom, userData.controlkey)) {
					  		renameVideoInRoom(userData.myroom, userData.currentID, userData.newname);
					  	}
					  });

					  client.on('syncShuffle', function(userData) {
					  	//Set shuffle on object.
					  	setRoomShuffleState(userData.myroom, userData.shuffleState);
					  	//Sync shuffle between clients
					  	io.sockets.in(userData.myroom).emit('syncShuffle', {shuffleState: getRoomShuffleState(userData.myroom)});

					  });

					  client.on('shouldShowControlPanel', function(userData) {
					  	client.emit('shouldShowControlPanel', {result: doesClientHaveStreamKey(userData.myroom, userData.controlkey)});
					  });
					});


logDebugMessage("Listening on port " + portnum + "...");

/**
 * Check if the client's streamkey corresponds with the room's streamkey.
 * @param {string} The client's room.
 * @param {string} The client's key.
 * @return {boolean} T: If the keys match, F otherwise.
 */
 function doesClientHaveStreamKey(currentRoom, key) {
 	return (key == rooms[currentRoom].controlkey) ? true : false;
 }

/**
 * Set the shuffle state of this room.
 * @param {string} The client's room.
 * @param {boolean} Whether shuffle should be on or off.
 */
 function setRoomShuffleState(currentRoom, state) {
 	rooms[currentRoom].isShuffle = state;
 	saveStream(currentRoom);
 }

/**
 * Get the shuffle state of this room.
 * @param {string} The client's room.
 * @return {boolean} Whether this room is on shuffle mode or not.
 */
 function getRoomShuffleState(room) {
 	return rooms[room].isShuffle;
 }

/**
 * Set the current video (in memory) to either playing or paused.
 * @param {string} The room in question.
 * @param {boolean} The state of the video. T = Playing, F = Paused.
 */
 function setPlayPause(currentRoom, state) {
	rooms[currentRoom].playing = state; // Set the state of the video.
	saveStream(currentRoom); //Save it to the disk.
}

/**
 * Set the current room time (= time passed on the current video).
 * @param {string} The current room
 * @param {number} The current time in seconds.
 */
 function setRoomTime(currentRoom, time) {
	rooms[currentRoom].currTime = time; //Set the time of the video.
	saveStream(currentRoom); //Save it to the disk.


	if(getCurrentVideoDuration(currentRoom) <= (rooms[currentRoom].currTime)) {
		//Check if Shuffle is on for this room.
		if(getRoomShuffleState(currentRoom)) {
			//Play a shuffled video in this room.
			playNextVideoInRoomShuffle(currentRoom);
		} else {
			//Play the next video in line.
			playNextVideoInRoom(currentRoom);
		}
	}
}

function getCurrentVideoDuration(currentRoom) {
	for(var song in rooms[currentRoom].tracks) { //Iterate over songs in this room's track array.
		if(rooms[currentRoom].tracks[song].id == rooms[currentRoom].currentvideo) { //If ID's match, play this song!
			//This is the song we want! Send URL!
			//Let all clients know the current song has changed!
			return rooms[currentRoom].tracks[song].duration;
		}
	}
}

function isShuffleEnabledForRoom(currentRoom) {
	return rooms[currentRoom].isShuffle;
}

/**
 * Initialize the rooms object. This should be done when the application launches!
 */
 function createRoomsObject() {
	var dir = './streams/'; //Directory to read.
	var files = fs.readdirSync(dir); //Synchronized reading. This should be done at the start of the program.

	logDebugMessage("Reading rooms from disk...");
	for(var i = 0; i < files.length; i++) { //Read the rooms.
		var roomname = files[i].split(".json")[0];
		var filejson = JSON.parse(fs.readFileSync(dir + files[i], 'utf8'));
		rooms[roomname] = filejson; //add room objects from disk to the rooms object in memory.
	}
}

/**
 * Stream object. Used to create new streams.
 * @param {string} The title of this stream.
 * @param {string} The secret control key of this stream.
 */
 function Stream(title, controlkey) {
 	this.streamTitle = title;
 	this.controlkey = controlkey;
 	this.currentvideo = "";
 	this.tracks = [];
 	this.playing = false;
 	this.currTime = 0;
 	this.nextID = 0;
 	this.isShuffle = false;
 }

/**
 * Create a new room for the given client with the given name.
 * @param {string} The name of the room.
 * @param {socket.io client} The current client.
 */
 function createRoom(roomName, currClient) {
 	logDebugMessage("Got a request to create a new room!");
	//Create a room with given roomname. Also generate ID
	var roomSecret = makeSecretID();
	//Create file in streams dir.
	var dir = './streams/';
	
	//Check if the room is available. (FINAL CHECK!)
	if(isRoomAvailableNC(roomName)) {
		//We're ready to create!
		var newStream = new Stream(roomName, roomSecret);

		//stringify this object so that it can be written.
		var fContents = JSON.stringify(newStream);

		//Write the new stream to ./streams/<roomname>.json
		fs.writeFile('./streams/' + roomName + ".json", fContents, function(err) {
			if(err) {
				logDebugMessage("Something went terribly wrong when creating a room (file write unsuccesfull)!");
			//Send error!
			currClient.emit('failCreation');
		} else {
			logDebugMessage("A new stream was made!");
					//send success packet with roomname and the room's secret code!
					currClient.emit('successCreation', {roomname: roomName, code: roomSecret});
					//Add the new room to the memory.
					rooms[roomName] = newStream;
					//The room file has already been created on disk. No need to write.
				}
			});
	}

}

/**
 * Create a 7-length secret code for this stream.
 * @return {string} A randomly generated secret code.
 */
 function makeSecretID()
 {
	var secretID=""; //The ID that will eventually get returned.
	var characterset="abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ"; //The characterset.
	while(secretID.length < 7) {
		//Add a random character from the characterset to the secret ID.
		secretID += characterset.charAt(Math.floor(Math.random() * characterset.length));
	}
    return secretID; //Return the secret ID.
}

function Song(songname, songID, numPlayed) {
	this.title = songname;
	this.ID = songID;
	this.numPlayed = numPlayed;
}

Song.prototype.toString = function() {
	return "[" + this.numPlayed + "] " + this.title;
}

/**
 * Send the current client an up-to-date playlist of the current room.
 * @param {socket.io client} The current client.
 * @param {string} The client's current room.
 */
 function sendClientPlaylist(currClient, room) {
	var songs = []; //The array of songs that will get sent.
	 for(var roomname in rooms[room].tracks) { //Populate it with this room's tracks.
	 	var song = new Song(rooms[room].tracks[roomname].title, rooms[room].tracks[roomname].id, rooms[room].tracks[roomname].views);
	 	songs.push(song); //add this track to the songs array.
	 }
	 currClient.emit('playlistUpdate', {playlist: songs, currentID: rooms[room].currentvideo}); //send songs.
	}

/**
 * Sends all clients in the specified room an updated playlist.
 * @param {string} The room that should be updated.
 */
 function sendClientsInRoomUpdatedPlaylist(room) {
 	var songs = []; //The array of songs that will get sent.
	 for(var roomname in rooms[room].tracks) { //Populate it with this room's tracks.
	 	var song = new Song(rooms[room].tracks[roomname].title, rooms[room].tracks[roomname].id, rooms[room].tracks[roomname].views);
	 	songs.push(song); //add this track to the songs array.
	 }
	 io.sockets.in(room).emit('playlistUpdate', {playlist: songs, currentID: rooms[room].currentvideo});
	}

/**
 * Save the current stream (room) to the disk. This will simply stringify this room's object representation and
 * save it to ./streams/<streamname>.json. This is done after any operation that alters a room's state.
 * @param {string} The stream (room) that should be saved.
 */
 function saveStream(stream) {
	//The file that should be written.
	//Streams are always associated with a <streamname>.json file.
	var streamFile = "streams/" + stream + ".json"; 
	fs.writeFileSync(streamFile, JSON.stringify(rooms[stream])); //Synchronized writing.
}

/**
 * Play a video with a certain ID in a certain room. 
 * @param {number} the ID of the video that should be played.
 * @param {string} the room which should play this video.
 */
 function playVideoInRoom(ID, room) {
	//Get song and send it.
	for(var song in rooms[room].tracks) { //Iterate over songs in this room's track array.
		if(rooms[room].tracks[song].id == ID) { //If ID's match, play this song!
			//This is the song we want! Send URL!
			//Let all clients know the current song has changed!
			io.sockets.in(room).emit('changeVideo', {url: rooms[room].tracks[song].url, videoID: ID});
			rooms[room].currentvideo = ID; //Update the in-memory state of the room. Will be saved to the disk soon!
			increaseVideoNumPlayed(room, ID);
		}
	}
	saveStream(room); //Set the currentvideo to the ID of the song that is playing.
	sendClientsInRoomUpdatedPlaylist(room);
}

/**
 * Check if a room is available, i.e. if it can be used for the creation of a new room.
 * @param {string} The name of the room that should be checked.
 * @param {socket.io client} the client that should be reported of the status of said room.
 */
 function isRoomAvailable(roomName, currClient) {
	var dir = './streams/' //Directory to read.
	var isAvailable = false;
		fs.readdir(dir, function(err, files) { //Iterate over the filenames in the ./streams/ dir.
			for(var i = 0; i < files.length; i++) {
				if(files[i].split(".json")[0] == roomName) {
					isAvailable = false; //Alas, the room is already taken. Inform the client.
					currClient.emit('availableResponse', {available: isAvailable});
					return;
				}
			}
			isAvailable = true; //Huzzah, the room is available. Let the client know this!
			currClient.emit('availableResponse', {available: isAvailable});
			return;
		});
	}

/**
 * Synchronized version of isRoomsAvailable. Use this when the program should wait.
 * NOTE: Only use this if absolutely necessary. Use the callback variant if possible.
 * @param {string} The name of the room that should be checked.
 * @return {boolean} True if the room is available, false if not.
 */
 function isRoomAvailableNC(roomName) {
	var dir = './streams/' //Directory to read.
	var files = fs.readdirSync(dir); //Return an array with files.

	for(var i; i < files.length; i++) {
		if(files[i].split(".json")[0] == roomName) {
			return false; //Room is not available.
		}
	}
	return true; //Huzzah, the room is available.
}

/**
 * Adds a new YT song to the current room's playlist.
 * @param {string} The URL of the YT video.
 * @param {string} The name of the room.
 * @param {socket.io client} The current client.
 * @return {boolean} false if the video can't be added due to it being an invalid url.
 */
 function addYoutubeSong(url, room) {
 	try {
		url = url.split('v=')[1].split('&')[0]; //Get the correct url. We don't want any of that YT bullshit after the video ID.
	} catch(err) {
	//This video is not valid.
	return;
	}
	YTF.video(url, function(err, data) { //Get video info for the current video ID.
		if(err) {
			return; //something went wrong. Just exit out.
		}

	//Create song object.
	var newSong = {
		"title": data.title,
		"url": data.player["default"].split('&')[0],
		"views": 0,
		"id": rooms[room].nextID,
		"duration": data.duration
	}

	//Check if new song is legit.
	if(newSong.title == undefined || newSong.url == undefined || newSong.id == undefined) {
		return false; // It aint cool!
	}
	//Add new Song object to the current room.
	rooms[room].tracks.push(newSong);

	//Increase the nextID of this room.
	rooms[room].nextID += 1;

	//Save stream to disk (Async)
	saveStream(room);

	//Sort playlist and set
	sortPlaylist(room);
});
}

function addSoundcloudTrack(url, room) {
	SCR(soundCloudClientID, url, function(err, data) {
		if(err) {
			return;
		} else {
			var newTrack = {
				"title": data.title,
				"url": data.permalink_url,
				"views": 0,
				"id": rooms[room].nextID
			}

			//Check if track is legit.
			if(newTrack.title == undefined || newTrack.url == undefined || newTrack.id == undefined) {
				return false;
			}

			//Add new video object to current room.
			rooms[room].tracks.push(newTrack);

			//Increase the nextID of ths room.
			rooms[room].nextID += 1;

			//Save stream.
			saveStream(room);

			//Sort and redistribute.
			sortPlaylist(room);
		}
	});
}

 /**
  * Remove a video from the stream using this video's ID.
  * @param {number} The ID of the video to be removed.
  * @param {string} The room from which the video should be removed.
  */
  function removeVideoFromStream(videoID, room, currClient) {
	//Try to find the ID of the song. If found, remove it from the stream's tracklist.
	rooms[room].tracks = _.reject(rooms[room].tracks, function(el) { return el.id == videoID; });
	//Save stream!
	saveStream(room);
	//Play next video
	playNextVideoInRoom(room);
	//Sort playlist
	sortPlaylist(room);
}

/**
 * Log a debug message with the LUNA colours.
 * @param {string} The message that should be shown.
 */
 function logDebugMessage(message) {
 	console.log("LUNA:".bold.cyan + " " + message);
 }

 /**
  * Increase a video's numPlayed property in the given room.
  * @param {string} The room in question.
  * @param {number} The ID of the video.
  */
  function increaseVideoNumPlayed(room, videoID) {
 	for(var song in rooms[room].tracks) { //Iterate over songs in this room's track array.
		if(rooms[room].tracks[song].id == videoID) { //ID's match, increase this song's numplayed.
			rooms[room].tracks[song].views += 1; //Cool! We're finished. Stream should be saved outside this method.
			return; //Just return
		}
	}
}

 /**
  * Play the next video in the current room. If the end of the playlist is reached,
  * The first video will play.
  * @param {string} The current room.
  */
  function playNextVideoInRoom(room) {
	//Get the next video ID of this room.
	var nextID = rooms[room].currentvideo + 1;
	//Check if this ID is valid.
	for(var vid in rooms[room].tracks) {
		if(rooms[room].tracks[vid].id == nextID) {
			//It is! Just play this song.
			playVideoInRoom(nextID, room);
			return;
		}
	}
	//We've found no matching ID's yet. Try scrolling through the list until we find the closest one!
	nextID++;
	while(nextID < rooms[room].nextID) {
		for(var vid in rooms[room].tracks) {
			if(rooms[room].tracks[vid].id == nextID) {
				playVideoInRoom(nextID, room);
				return;
			}
		}
		nextID++;
	}
	//We STILL found no matching ID's. Just set the video to the first video.
	nextID = _.first(rooms[room].tracks).id
	playVideoInRoom(nextID, room);
}

 /**
  * Play the previous video in the current room. If the end of the playlist is reached,
  * The last video will play.
  * @param {string} The current room.
  */
  function playPreviousVideoInRoom(room) {
	//Get the next video ID of this room.
	var nextID = rooms[room].currentvideo - 1;
	//Check if this ID is valid.
	for(var vid in rooms[room].tracks) {
		if(rooms[room].tracks[vid].id == nextID) {
			//It is! Just play this song.
			playVideoInRoom(nextID, room);
			return;
		}
	}
	//We've found no matching ID's yet. Try scrolling through the list until we find the closest one!
	nextID--;
	while(nextID >= 0) {
		for(var vid in rooms[room].tracks) {
			if(rooms[room].tracks[vid].id == nextID) {
				playVideoInRoom(nextID, room);
				return;
			}
		}
		nextID--;
	}
	//We STILL found no matching ID's. Just set the video to the last video.
	nextID = _.last(rooms[room].tracks).id
	playVideoInRoom(nextID, room);
}

/**
 * Plays the next video. The video ID of the next video will be randomly generated.
 * @param {string} The current room.
 */
 function playNextVideoInRoomShuffle(room) {
 	var nextTrack = Math.floor(Math.random() * (rooms[room].tracks.length));

 	//Keep track of random generated values.
 	if(lastrandom.length == 25) {
 		lastrandom = _.last(lastrandom, lastrandom.length-1);
 	}
 	lastrandom.push(nextTrack);

 	var nextID = rooms[room].tracks[nextTrack].id;
 	playVideoInRoom(nextID, room);
 }

 /**
  * Rename a video with a certain video in a certain room.
  * @param {string} Name of the room
  * @param {number} ID of the video.
  * @param {string} New name for the video.
  */
  function renameVideoInRoom(room, videoID, newName) {
 	for(var vid in rooms[room].tracks) { //Iterate over songs in this room's track array.
		if(rooms[room].tracks[vid].id == videoID) { //ID's match, increase this song's numplayed.
			rooms[room].tracks[vid].title = newName; //Set title to new title in memory.
			//Save it to disk
			saveStream(room);
			//Sort playlist
			sortPlaylist(room);			
		}
	}
}

function sortPlaylist(room) {
	var currRoom = rooms[room];
	var tracks = currRoom["tracks"];
	var currentv;

	//Sort the playlist!
	tracks.sort(function(a,b) {
		return (a.title.toLowerCase() < b.title.toLowerCase()) ? -1 : ((a.title.toLowerCase() > b.title.toLowerCase()) ? 1 : 0);
	});

	//Iterate over it and replace the ID numbers.
	for(var i = 0; i < tracks.length; i++) {
		if(tracks[i].id == currRoom.currentvideo) {
			currentv = tracks[i].id;
		}
		tracks[i].id = i;
		currRoom.nextID = i+1;
	}
	currRoom.currentvideo = currentv;

	//Save the playlist!
	rooms[room] = currRoom;

	//Save stream
	saveStream(room);

	//Notify clients!
	sendClientsInRoomUpdatedPlaylist(room);
}

function initVariables() {
	var optionVars = JSON.parse(fs.readFileSync('options.json'));
	portnum = optionVars["port"];

	//Set start date
	startDate = new Date();
}