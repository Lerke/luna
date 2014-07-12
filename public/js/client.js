"use strict";
var socket;
var video;
var videoIsPlaying = false;
var myRoom;
var throttle = 1; //Alter this for more performance, but more accurate syncing!
var compensationt1 = Math.round(new Date().getTime() / 1000);
var compensationt2;
var isPlaying;

var portnum = 9002; //Port to listen on.
var SERVER = window.location.hostname + ':' + portnum;

var currentPlayingVideoID = 0;
var isController = false;

var bVid, bTime, bPlaying;

var myNickname;

var standaloneVideo = false;
var lastMessage = "";
var lastNick = "";
var lastAdminMessage = "";

jQuery(document).ready(function() {
  jQuery.noConflict();
  jQuery("#lunaSidebar").resizable({
    handles: 'e',
    minWidth: 188,
    maxWidth: 402,
    minHeight: 100,
    maxHeight: 100,
    resize: function(event, ui) {
      lunaSidebarResizeEvent(event, ui);
    }
  });
  jQuery("#chatBox").resizable({
    handles:  'w',
    minWidth: 215,
    maxWidth: 402,
    minHeight: 100,
    maxHeight: 100,
    resize: function(event, ui) {
      lunaChatbarResizeEvent(event, ui);
    }
  });

  jQuery("#playlistSelect").resizable({
    handles: 's',
    minHeight: 100,
  });

  jQuery("#playlistSelect").parent().css("width", "95%");
  jQuery("#playlistSelect").parent().css("min-width", "95%");

  jQuery("#playlistSelect").parent().css("margin", "0 auto");

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
      jQuery("#controlDiv").show();
      if(msg.result) {
					//Yes, should show it.
					isController = true;
					jQuery("#controllerOptions").show();
				}
			});

    //Configure tooltips
    jQuery('[title!=""]').qtip({
      style: {
        classes: 'qtip-youtube qtip-rounded qtip-shadow'
      }
    });
    toggleToolTips(jQuery("#showToolTips").is(":checked"));
    toggleFullScreen(jQuery("#fullScreen").is(":checked"));



    socket.emit('shouldShowControlPanel', {myroom: myRoom, controlkey: getControlHash()});  
    socket.on('initClient', function(data) {
     compensationt2 = Math.round(new Date().getTime() / 1000);
     var compensation = compensationt2 - compensationt1;
     var isPlayingID = /^\d+$/.test(data.currentID);
     if(isPlayingID) {
      currentPlayingVideoID = data.currentID;
      highlightCurrentVideo(currentPlayingVideoID);
    } else {
      currentPlayingVideoID = data.currentID;
    }
    bVid = data.currVid;
    bTime = data.currTime + compensation;
    bPlaying = data.playing;

    jQuery("#shuffleBox").attr('checked', data.shuffleState);
    var params = { allowScriptAccess: "always" };
    var atts = { id: "ytplayer" };
    swfobject.embedSWF("https://www.youtube.com/v/C0DPdy98e4c?enablejsapi=1&modestbranding=1&rel=0&autohide=1", "vbox", "640", "480", "9", null, null, params, atts);
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
    video.addEventListener('onError', 'onYTPlayerError');
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
      standaloneVideo = false;
      currentPlayingVideoID = msg.videoID;
      highlightCurrentVideo(currentPlayingVideoID);
      video.loadVideoById({videoId: msg.url.split('v=')[1], startSeconds: msg.start, endSeconds: msg.end, suggestedQuality: "large"});
      setTimeout(function(){
        video.playVideo();
      },1000);
    });

    socket.on('incomingChatMessage', function(msg) {
      var message = jQuery("<div class=chatMessage></div>");
      var nick = jQuery("<strong></strong>");
      nick.append(document.createTextNode("<" + msg.nickname + "> "));
      message.append(nick);
      message.append(document.createTextNode(msg.message));
      if((msg.message != lastMessage) || (msg.message == lastMessage && lastNick != msg.nickname)) {
        jQuery("#chatMessages").append(message);
        jQuery("#chatMessages").scrollTop(jQuery("#chatMessages")[0].scrollHeight);
        lastMessage = msg.message
        lastNick = jQuery("#chatMessages").children().last().text().split(">")[0].split("<")[1].trim(); 
      }
    });

    socket.on('syncShuffle', function(msg) {
     jQuery("#shuffleBox").prop('checked', msg.shuffleState);
   });

    socket.on('incomingAdminChatMessage', function(msg) {
      addMessageToBox(msg.message, 0);
    });

    socket.on('playVideoWithUrl', function(msg) {
      standaloneVideo = true;
      currentPlayingVideoID = msg.url;
      video.loadVideoById({videoId: msg.url.split('v=')[1], startSeconds: msg.start, suggestedQuality: "large"});
      setTimeout(function(){video.playVideo()},1000);
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
      var startTime = resolveEnteredTime(jQuery("#videoInputTimeBegin").val());
      var endTime = resolveEnteredTime(jQuery("#videoInputTimeEnd").val());
      if(startTime == 0) {
        startTime = null;
      }
      if(endTime == 0) {
        endTime = null;
      }
      if(startTime != null && endTime != null) {
        if(endTime <= startTime) {
          addMessageToBox("End time cannot occur before or at the start time.",2);
          return;
        }
        if(startTime < 0 || endTime < 0) {
          addMessageToBox("Start or End cannot be smaller than 0.", 2);
          return;
        }
      }
      socket.emit('addVideo', {url: jQuery("#urlInput").val(), myroom: myRoom, controlkey: getControlHash(), autoplay: shouldAutoplay(), start: startTime, end: endTime})
      jQuery("#urlInput").val("");
      jQuery("#videoInputTimeBegin").val("");
      jQuery("#videoInputTimeEnd").val("");
    });

jQuery("#urlInput").keyup(function(e) {
  if(e.keyCode == 13) {
   jQuery(this).trigger("enterKey");
 }
});

jQuery("#videoInputTimeBegin").keyup(function(e) {
  if(e.keyCode == 13) {
    jQuery("#urlInput").trigger("enterKey");
  }
});

jQuery("#videoInputTimeEnd").keyup(function(e) {
  if(e.keyCode == 13) {
    jQuery("#urlInput").trigger("enterKey");
  }
});

jQuery("#onetimevideoinput").keyup(function(e) {
  if(e.keyCode == 13) {
    jQuery(this).trigger("enterKey");
  }
});

jQuery("#videoInputTimeBeginOnce").keyup(function(e) {
  if(e.keyCode == 13) {
    jQuery("#onetimevideoinput").trigger("enterKey");
  }
});

jQuery("#videoInputTimeBegin").keyup(function(e) {
  if(e.keyCode == 13) {
    jQuery("#urlinput").trigger("enterKey");
  }
});

jQuery("#videoInputTimeEnd").keyup(function(e) {
  if(e.keyCode == 13) {
    jQuery("#urlinput").trigger("enterKey");
  }
});

jQuery("#onetimevideoinput").bind("enterKey", function(e) {
  var startTime = resolveEnteredTime(jQuery("#videoInputTimeBeginOnce").val());
  if(startTime < 0) {
    addMessageToBox("Starting time cannot be smaller than 0.", 2);
    return;
  }
  var url = "https://gdata.youtube.com/feeds/api/videos/" + jQuery("#onetimevideoinput").val().split("v=")[1] + "?v=2&alt=json";
  jQuery.get(url, function(data) {
    socket.emit("playOneVideo", {url: jQuery("#onetimevideoinput").val(), myroom: myRoom, controlkey: getControlHash(), start: startTime});
    jQuery("#onetimevideoinput").val("");
    jQuery("#videoInputTimeBeginOnce").val("");
  }).fail(function(jqXHR, textStatus) {
    addMessageToBox("Video not found.", 2);
    jQuery("#onetimevideoinput").val("");
    jQuery("#videoInputTimeBeginOnce").val("");
  });

});

jQuery("#shuffleBox").click(function() {
  socket.emit('syncShuffle', {shuffleState: jQuery(this).is(":checked"), myroom: myRoom});
});

jQuery("#fullScreen").click(function() {
  toggleFullScreen(jQuery(this).is(":checked"));
});

jQuery("#showToolTips").click(function() {
  toggleToolTips(jQuery(this).is(":checked"));
});

jQuery("#nextbutton").on('click', function() {
  if(jQuery("#shuffleBox").is(":checked")) {
   sendShuffledSongRequest()
 } else {
   playNextVideo();
 }
});

jQuery("#nicknameInput").keypress(function(e) {
  if(e.which === 13 && (jQuery("#nicknameInput").val().replace(/ /g, '').length > 0) && (jQuery("#nicknameInput").val().replace(/ /g, '').length < 16)) {
   jQuery("#nicknameInput").unbind();
   myNickname = jQuery("#nicknameInput").val();
   jQuery("#chatNicknameBox").hide();
   jQuery("#chatTextInputBox").show();
 }
});

jQuery("#messageInput").keypress(function(e) {
  if(e.which === 13 && jQuery("#messageInput").val().length > 0) {
    socket.emit('sendChatMessage', {nickname: myNickname, myroom: myRoom, message: jQuery("#messageInput").val().trim()});
    jQuery("#messageInput").val("");
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

 function onYTPlayerError(errorCode) {
    /*
    2 – The request contains an invalid parameter value. For example, this error occurs if you specify a video ID that does not have 11 characters, or if the video ID contains invalid characters, such as exclamation points or asterisks.
100 – The video requested was not found. This error occurs when a video has been removed (for any reason) or has been marked as private.
101 – The owner of the requested video does not allow it to be played in embedded players.
150 – This error is the same as 101. It's just a 101 error in disguise!
*/
if(errorCode == 2 || errorCode == 100 || errorCode == 101 || errorCode == 150) {
  var errorID = currentPlayingVideoID;
  if(getControlHash() != null) {
    var url = "https://gdata.youtube.com/feeds/api/videos/" + video.getVideoUrl().split("v=")[1] + "?v=2&alt=json";
    jQuery.get(url, function(data) {
      var videoTitle = data.entry.title.$t || 'video not found!';
      jQuery("#playlistSelect > option").each(function() {
       if(jQuery(this).data("songid") == errorID) {
        errorID = jQuery(this).data("songid");
        socket.emit('sendErrorMessage', {videoID: errorID, errorcode: errorCode, myroom: myRoom, controlkey: getControlHash(), title: jQuery(this).text().split(/\[\d+\]/)[1]});
      }    
    });
    });
  }
}
}

//TODO: Convert all messages to this method
function addMessageToBox(msg, messagetype) {
  //type 0 = admin
  //type 1 = chat
  //type 2 = system
  switch(messagetype) {
    case 2:
    var message = jQuery("<div class='systemMessage'></div>");
    message.append(document.createTextNode("SYSTEM: " + msg));
    if(lastAdminMessage != msg) {
      jQuery("#chatMessages").append(message);
      jQuery("#chatMessages").scrollTop(jQuery("#chatMessages")[0].scrollHeight);
    }
    break;
    case 1:
    break;
    case 0:
    var message = jQuery("<div class='adminMessage'></div>");
    message.append(document.createTextNode(msg));
    if(lastAdminMessage != msg) {
      jQuery("#chatMessages").append(message);
      jQuery("#chatMessages").scrollTop(jQuery("#chatMessages")[0].scrollHeight);
      lastAdminMessage = msg;
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
  	var newName = prompt("Enter a new title for this video.", currentName.split(" ")[1]);
    if(newName != null) {
     socket.emit('renameVideo', {controlkey: getControlHash(), myroom: myRoom, currentID: ID, newname: newName});
   }
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

function shouldAutoplay() {
  return jQuery("#playOnEnter").is(":checked");
}

/**
 * Checks the validity of the begin/endtime.
 * Should be possibly to enter:
 * a) Seconds. i.e.: 76
 * b) in minutes. i.e.: 1m16s
 * c) in hours. i.e.: 1h16m16s
 * @return {number} time in seconds
 */
 function resolveEnteredTime(time) {
  if(!isNaN(time)) {
    if(time == "") {
      return 0;
    }
    return time;
  }
  var hours = 0;
  var minutes = 0;
  var seconds = 0;
  if(time.match(/(\d+)[s]/) != null) {
   seconds = time.match(/(\d+)[s]/)[1];
 }
 if(time.match(/(\d+)[m]/) != null) {
  minutes = time.match(/(\d+)[m]/)[1];
}
if(time.match(/(\d+)[h]/) != null) {
  hours = time.match(/(\d+)[h]/)[1]
}
var totaltime = hours*60*60 + minutes * 60 + seconds*1;
return totaltime;
}

/**
 * Enable or disable tooltips on the stream page.
 */
 function toggleToolTips(enabled) {
  if(enabled) {
    jQuery('*').qtip("enable");
  } else {
    jQuery('*').qtip("hide");
    jQuery('*').qtip("disable");
  }
}

function toggleFullScreen(fullscreen) {
  if(fullscreen) {
    jQuery("#videoPlayerBox").css('width', '100%');
    jQuery("#videoPlayerBox").css('height', '100%');
    jQuery("#videoPlayerBox").css('top', '0');
    var leftAdjust = parseInt(jQuery("#lunaSidebar").css("width").split("px")[0]) - 188;
    jQuery("#videoPlayerBox").css('left', leftAdjust);
    jQuery("#ytplayer").css('width', '100%');
    jQuery("#ytplayer").css('height', '100%');
    jQuery("#lockSidebar").prop('checked', true);
    jQuery("#lockSidebar").prop('disabled', "disabled");
    var widthAdjust;
    if(jQuery("#chatBox").css("display") == "none") {
      widthAdjust = 0;
    } else {
      widthAdjust = parseInt(jQuery("#chatBox").css("width").split("px")[0]);
    }
    var totalWidth = parseInt(jQuery("#videoPlayerBox").css("width").split("px")[0]) - widthAdjust - leftAdjust;
    jQuery("#videoPlayerBox").css('width', totalWidth);
    jQuery("#videoPlayerBox").css('margin', 0);
    
  } else {
    jQuery("#videoPlayerBox").css('width', '640px');
    jQuery("#videoPlayerBox").css('height', '480px');
    jQuery("#videoPlayerBox").css('top', '25%');
    jQuery("#videoPlayerBox").css('margin', '0 auto');
    jQuery("#videoPlayerBox").css('left', '-215px');
    jQuery("#ytplayer").css('width', '100%');
    jQuery("#ytplayer").css('width', '100%');
    jQuery("#lockSidebar").removeAttr('disabled');
  }
}

function lunaSidebarResizeEvent(event, ui) {
  if(jQuery("#fullScreen").is(":checked")) {
    toggleFullScreen(true);
  }
}

function lunaChatbarResizeEvent(event, ui) {
 if(jQuery("#fullScreen").is(":checked")) {
  toggleFullScreen(true);
}
}

jQuery(window).resize(function() {
  lunaChatbarResizeEvent(null, null);
  lunaSidebarResizeEvent(null,null);
})