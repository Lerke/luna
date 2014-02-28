var socket;
var video;
var videoIsPlaying = false;
var myRoom;
var throttle = 1; //Alter this for more performance, but more accurate syncing!
var compensationt1 = Math.round(new Date().getTime() / 1000);
var compensationt2;

var portnum = 9002; //Port to listen on.
var SERVER = window.location.hostname + ':' + portnum;

var currentPlayingVideoID;
var isController = false;

$(window).ready(function() {
		//Connect with the server
		socket = io.connect("http://" + SERVER);
		myRoom = rm;
 		//initialize UI Elements.
 		setUIElements();
		//Great. Now lets setup all the socket events.
		setSocketEvents();

		socket.emit('setup', { room: rm});

		//Check if the client is a controller.
		socket.on('shouldShowControlPanel', function(msg) {
			if(msg.result) {
					//Yes, should show it.
					isController = true;
					$("#controlDiv").show();
				}
			});

		socket.emit('shouldShowControlPanel', {myroom: myRoom, controlkey: getControlHash()})

		socket.on('initClient', function(data) {
			compensationt2 = Math.round(new Date().getTime() / 1000);
			var compensation = compensationt2 - compensationt1;
			currentPlayingVideoID = data.currentID;
			highlightCurrentVideo(currentPlayingVideoID);
			initVideo(data.currVid, data.currTime + compensation, data.playing);
		});
	});		

 /** 
  * This initializes the video element of the page. It jumps the video to the correct place
  * and checks if the video should start playing immediately.
  * @param {string} The URL of the current video.
  * @param {number} The time (in seconds) of the current video.
  * @param {boolean} Whether or not the current video should start playing as soon as possible.
  */
  function initVideo(videoURL, videotime, startPlay) {
  	videoURL = videoURL.replace("https", "http").replace("youtube", "youtube-nocookie");
  	//Set videoPlayer options. Also disable that buggy spinner.
  	videojs('videoPlayer', { "techOrder": ["youtube"],
  		"src": videoURL,
  		"controls": true,
  		"autoplay": false,
  		"preload": "auto",
  		"width": 640,
  		"height": 480,
  		"children": {"loadingSpinner": false}}).ready(function() {

  			video = this;

  			this.currentTime(videotime);


  		//Check if video should autostart.
  		(!startPlay) ? video.pause() : video.play();

    	//Okay. lets set up all the video events.
    	setVideoEvents();
    });


  	}

  	function setSocketEvents() {
  		socket.on('changeStream', function(msg) {
  			switch(msg.data) {
  				case "play":
  				playCurrentVideo();
  				break;
  				case "pause":
  				pauseCurrentVideo();
  				break;
  			}
  		});

		//Playlist updated.
		socket.on('playlistUpdate', function(msg) {
			updatePlaylist(msg.playlist, msg.currentID);
			highlightCurrentVideo(msg.currentID);
		});

		socket.on('seekVideo', function(msg) {
			video.currentTime(msg.time);
		});

		socket.on('changeVideo', function(msg) {
			currentPlayingVideoID = msg.videoID;
			highlightCurrentVideo(currentPlayingVideoID);
			video.src(msg.url);
		});

		socket.on('syncShuffle', function(msg) {
			$("#shuffleBox").prop('checked', msg.shuffleState);
		});
	}

 /**
  * Initialises events concerning various UI elements on the page.
  * Such as: Button clicks, text inputs, etcetera.
  */
  function setUIElements() {
  	$("#playbutton").on('click', function() {
  		var selectedID = $("#playlistSelect").find("option:selected").data("songid");
  		currentPlayingVideoID = selectedID;
  		sendSongRequest(selectedID);
  	});

  	$("#removebutton").on('click', function() {
  		var selectedID = $("#playlistSelect").find("option:selected").data("songid");
  		if(selectedID == undefined) {
  			selectedID = currentPlayingVideoID
  		}
  		removeSongFromPlaylist(selectedID);
  	});

  	$("#renamebutton").on('click', function() {
  		var selectedID = $("#playlistSelect").find("option:selected").data("songid");
  		var currentName = $("#playlistSelect").find("option:selected").text();
  		renameSongFromPlaylist(selectedID, currentName);
  	});

  	$("#urlInput").bind("enterKey", function(e) {
  		socket.emit('addVideo', {url: $("#urlInput").val(), myroom: myRoom, controlkey: getControlHash()})
  		$("#urlInput").val("");
  	});
  	$("#urlInput").keyup(function(e) {
  		if(e.keyCode == 13) {
  			$(this).trigger("enterKey");
  		}
  	});

  	$("#shuffleBox").click(function() {
  		socket.emit('syncShuffle', {shuffleState: $(this).is(":checked")});
  	});

  	$("#nextbutton").on('click', function() {
  		if($("#shuffleBox").is(":checked")) {
  			sendShuffledSongRequest()
  		} else {
  			playNextVideo();
  		}
  	});

  	$("#prevbutton").on('click', function() {
  		if($("#shuffleBox").is(":checked")) {
  			sendShuffledSongRequest();
  		} else {
  			playPreviousVideo();
  		}
  	});
  }

 /**
  * Initialises the event handlers concerning the video element of the page.
  * This handles HTML5 events like 'play', 'pause', 'timeupdate', 'durationchange', etc.
  */
  function setVideoEvents() {
  	video.on('play', function() {
  		videoIsPlaying = true;
  		if(getControlHash() != null) {
  			socket.emit('alterStream', {data: 'play', controlkey: getControlHash(), myroom: myRoom});
  		}
  	});

	//Video is paused! Send message to pause other clients!
	video.on('pause', function() {
		videoIsPlaying = false;
		if(getControlHash() != null) {
			socket.emit('alterStream', {data: 'pause', controlkey: getControlHash(), myroom: myRoom});
		}
	});

	//Video time changed. send to server.
	video.on('timeupdate', function() {
		if(getControlHash() != null) {
			if(videoIsPlaying) {
				throttle--;
				if(throttle <= 0) {
					socket.emit('altercurrentvideotime', {currtime: Math.ceil(video.currentTime()), controlkey: getControlHash(), myroom: myRoom});
					throttle = 10;
				}
			}
		}
	});

	//Duration changed. Video must be seeked! (This is a work-around, since seeked/seeking events don't fire!)
	video.on('durationchange', function() {
		if(getControlHash() != null) {
			socket.emit('seekVideo', {currtime: Math.ceil(video.currentTime()), controlkey: getControlHash(), myroom: myRoom});
		}
	});

	video.on('ended', function() {
		if(getControlHash() != null) {
			//Check if shuffle is on.
			if($("#shuffleBox").is(":checked")) {
				//Shuffle it, baby.
				sendShuffledSongRequest();
			} else {
				//error 404, Shuffle (fun) not found.
				socket.emit('playNextVideo', {myroom: myRoom, controlkey: getControlHash(), currentID: currentPlayingVideoID });
			}
		}
	});
}

 /**
  * Plays the current video.
  */
  function playCurrentVideo() {
  	isPlaying = true;
  	video.play();
  }

 /**
  * Pauses the current video.
  */
  function pauseCurrentVideo() {
  	isPlaying = false;
  	video.pause();
  }

 /**
  * Get's the current user's control key from his browser's URL.
  * @return {string} This user's control key. Will return null if no key was found.
  */
  function getControlHash() {
  	return (window.location.hash.substr(0,9) === '#control=') ? window.location.hash.substr(9) : null;
  }

 /**
  * Change the current 'time' in the video. i.e. seek.
  * @param {number} The seconds the video should seek to.
  */
  function changeTime(time) {
  	video.currentTime(time);
  }

 /**
  * Update the current playlist. This will wipe and replace the entire thing.
  * @param {array} The playlist array containing songs objects.
  */
  function updatePlaylist(playlist, newID) {
	//Clear the playlist first!
	$("#playlistSelect").find('option').remove().end();

	var playlistSelect = document.getElementById('playlistSelect');
	if(newID == undefined || newID == null) {
		newID = 0;
	}
	currentPlayingVideoID = newID;
	$("#playlistSelect :nth-child(" + newID + ")").prop('selected', true);


	for(var song in playlist) {
		var option = document.createElement('option');
		option.textContent = "[" + playlist[song].numPlayed + "] " + playlist[song].title;
		option.setAttribute('data-songid', playlist[song].ID);
		playlistSelect.appendChild(option);
	}
}

/**
 * Request to play a video with a certain ID.
 * @param {number} The ID of the video to be played.
 */
 function sendSongRequest(ID) {
 	socket.emit('playSong', {controlkey: getControlHash(), myroom: myRoom, songID: ID});
 }

 /**
  * Ask the server to play a random song.
  */
  function sendShuffledSongRequest() {
  	socket.emit('playNextShuffledVideo', {myroom: myRoom, controlkey: getControlHash(), currentID: currentPlayingVideoID });
  }

/**
 * Removes a video from the playlist. Will only succeed if client has the correct control key.
 * @param {number} The ID of the selected video.
 */
 function removeSongFromPlaylist(ID) {
 	socket.emit('removeVideo', {controlkey: getControlHash(), myroom: myRoom, videoID: ID});
 }

 /**
  * Rename a certain video in the playlist.
  * @param {number} The ID of the video to be renamed.
  * @param {string} The current name of the video.
  */
  function renameSongFromPlaylist(ID, currentName) {
  	var newName = prompt("Enter a new title for this video.", currentName);
  	socket.emit('renameVideo', {controlkey: getControlHash(), myroom: myRoom, currentID: ID, newname: newName})

  }

/**
 * Highlight the current video in the playlist.
 * @param {number} The ID of the video to be highlighted.
 */
 function highlightCurrentVideo(ID) {
 	$("#playlistSelect > option").each(function() {
 		$(this).css('background-color', 'transparent');
 	})
 	$("#playlistSelect > option").each(function() {
 		if($(this).data("songid") == ID) {
 			$(this).css('background-color', 'rgba(172,174,222,1)');
 		}
 	});
 }

/**
 * Play the next video.
 */
 function playNextVideo() {
 	socket.emit('playNextVideo', {myroom: myRoom, controlkey: getControlHash(), currentID: currentPlayingVideoID });
 }

/**
 * Play the previous video.
 */
 function playPreviousVideo() {
 	socket.emit('playPreviousVideo', {myroom: myRoom, controlkey: getControlHash(), currentID: currentPlayingVideoID });
 }