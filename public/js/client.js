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

var bVid, bTime, bPlaying;

jQuery(document).ready(function() {
  jQuery.noConflict();
  jQuery("#lunaSidebar").resizable({
    minWidth: 188,
    maxWidth: 402,
    minHeight: 100,
    maxHeight: 100,
  });
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
					jQuery("#controlDiv").show();
				}
			});

		socket.emit('shouldShowControlPanel', {myroom: myRoom, controlkey: getControlHash()})

		socket.on('initClient', function(data) {
			compensationt2 = Math.round(new Date().getTime() / 1000);
			var compensation = compensationt2 - compensationt1;
			currentPlayingVideoID = data.currentID;
			highlightCurrentVideo(currentPlayingVideoID);
      bVid = data.currVid;
      bTime = data.currTime + compensation;
      bPlaying = data.playing;
      var params = { allowScriptAccess: "always" };
      var atts = { id: "ytplayer" };
      swfobject.embedSWF("https://www.youtube.com/v/M7lc1UVf-VE?enablejsapi=1&fs=1&modestbranding=1&rel=0&autohide=1&version=3", "vbox", "640", "480", "9", null, null, params, atts);

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
    video.addEventListener('onStateChange', 'onYTPlayerStateChange');
    video.cueVideoById(videoURL.split('v=')[1]);

    video.seekTo(videotime);
  //Check if video should autostart.
  (!startPlay) ? pauseCurrentVideo() : playCurrentVideo();

  setInterval(function() {
   pingTimeUpdate();
 },2000);
}

function onYouTubePlayerReady(id) {
  video = document.getElementById("ytplayer");
  initVideo(bVid, bTime, bPlaying)
}

function pingTimeUpdate() {
  if(getControlHash() != null && video.getPlayerState() === 1) {
    socket.emit('altercurrentvideotime', {currtime: Math.ceil(video.getCurrentTime()), controlkey: getControlHash(), myroom: myRoom});

  }
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
      if(msg.time + 3 < video.getCurrentTime() || msg.time -3 > video.getCurrentTime()) {
       video.seekTo(msg.time);
     }
   });

		socket.on('changeVideo', function(msg) {
			currentPlayingVideoID = msg.videoID;
			highlightCurrentVideo(currentPlayingVideoID);
      video.loadVideoById(msg.url.split('v=')[1], 0, "large");
      setTimeout(function(){video.playVideo()},1000);

    });

		socket.on('syncShuffle', function(msg) {
			jQuery("#shuffleBox").prop('checked', msg.shuffleState);
		});
	}

 /**
  * Initialises events concerning various UI elements on the page.
  * Such as: Button clicks, text inputs, etcetera.
  */
  function setUIElements() {
  	jQuery("#playbutton").on('click', function() {
  		var selectedID = jQuery("#playlistSelect").find("option:selected").data("songid");
  		currentPlayingVideoID = selectedID;
  		sendSongRequest(selectedID);
  	});

  	jQuery("#removebutton").on('click', function() {
  		var selectedID = jQuery("#playlistSelect").find("option:selected").data("songid");
  		if(selectedID == undefined) {
  			selectedID = currentPlayingVideoID
  		}
  		removeSongFromPlaylist(selectedID);
  	});

  	jQuery("#renamebutton").on('click', function() {
  		var selectedID = jQuery("#playlistSelect").find("option:selected").data("songid");
  		var currentName = jQuery("#playlistSelect").find("option:selected").text();
  		renameSongFromPlaylist(selectedID, currentName);
  	});

  	jQuery("#urlInput").bind("enterKey", function(e) {
  		socket.emit('addVideo', {url: jQuery("#urlInput").val(), myroom: myRoom, controlkey: getControlHash()})
  		jQuery("#urlInput").val("");
  	});
  	jQuery("#urlInput").keyup(function(e) {
  		if(e.keyCode == 13) {
  			jQuery(this).trigger("enterKey");
  		}
  	});

  	jQuery("#shuffleBox").click(function() {
  		socket.emit('syncShuffle', {shuffleState: jQuery(this).is(":checked"), myroom: myRoom});
  	});

  	jQuery("#nextbutton").on('click', function() {
  		if(jQuery("#shuffleBox").is(":checked")) {
  			sendShuffledSongRequest()
  		} else {
  			playNextVideo();
  		}
  	});

  	jQuery("#prevbutton").on('click', function() {
  		if(jQuery("#shuffleBox").is(":checked")) {
  			sendShuffledSongRequest();
  		} else {
  			playPreviousVideo();
  		}
  	});
  }

  function onYTPlayerStateChange(newState) {
    switch(newState) {
      case 0: //video ended
      socket.emit('altercurrentvideotime', {currtime: Math.ceil(video.getCurrentTime()), controlkey: getControlHash(), myroom: myRoom});
      break;

      case 1: //video playing
      if(getControlHash() != null && !isPlaying) {
       socket.emit('seekVideo', {currtime: Math.ceil(video.getCurrentTime()), controlkey: getControlHash(), myroom: myRoom});
       socket.emit('altercurrentvideotime', {currtime: Math.ceil(video.getCurrentTime()), controlkey: getControlHash(), myroom: myRoom});
       socket.emit('alterStream', {data: 'play', controlkey: getControlHash(), myroom: myRoom});
     } else if(getControlHash() != null && isPlaying) {
      socket.emit('seekVideo', {currtime: Math.ceil(video.getCurrentTime()), controlkey: getControlHash(), myroom: myRoom});
      socket.emit('altercurrentvideotime', {currtime: Math.ceil(video.getCurrentTime()), controlkey: getControlHash(), myroom: myRoom});
    }
    break;
      case 2: //video paused 
      if(getControlHash() != null && isPlaying) {
        socket.emit('seekVideo', {currtime: Math.ceil(video.getCurrentTime()), controlkey: getControlHash(), myroom: myRoom});
        socket.emit('altercurrentvideotime', {currtime: Math.ceil(video.getCurrentTime()), controlkey: getControlHash(), myroom: myRoom});
        socket.emit('alterStream', {data: 'pause', controlkey: getControlHash(), myroom: myRoom});
      } else if (getControlHash() != null && !isPlaying) {
         socket.emit('seekVideo', {currtime: Math.ceil(video.getCurrentTime()), controlkey: getControlHash(), myroom: myRoom});
        socket.emit('altercurrentvideotime', {currtime: Math.ceil(video.getCurrentTime()), controlkey: getControlHash(), myroom: myRoom});
      }
      break;
    }
  }

 /**
  * Plays the current video.
  */
  function playCurrentVideo() {
  	isPlaying = true;
  	video.playVideo();
  }

 /**
  * Pauses the current video.
  */
  function pauseCurrentVideo() {
  	isPlaying = false;
  	video.pauseVideo();
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
  	video.seekTo(time);
  }

 /**
  * Update the current playlist. This will wipe and replace the entire thing.
  * @param {array} The playlist array containing songs objects.
  */
  function updatePlaylist(playlist, newID) {
	//Clear the playlist first!
	jQuery("#playlistSelect").find('option').remove().end();

	var playlistSelect = document.getElementById('playlistSelect');
	if(newID == undefined || newID == null) {
		newID = 0;
	}


	for(var song in playlist) {
		var option = document.createElement('option');
		option.textContent = "[" + playlist[song].numPlayed + "] " + playlist[song].title;
		option.setAttribute('data-songid', playlist[song].ID);
		playlistSelect.appendChild(option);
	}

  currentPlayingVideoID = newID;

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
 	jQuery("#playlistSelect > option").each(function() {
 		jQuery(this).css('background-color', 'transparent');
 	})
 	jQuery("#playlistSelect > option").each(function() {
 		if(jQuery(this).data("songid") == ID) {
 			jQuery(this).css('background-color', 'rgba(172,174,222,1)');
 		}
 	});
  jQuery("#playlistSelect :nth-child(" + (currentPlayingVideoID+1) + ")").prop('selected', true);
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

 function clientPlayVideoWithURL(url) {
  if(url.indexOf("youtube") > -1) {
    //It's a YT url.

  }
}