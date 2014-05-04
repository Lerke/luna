/**
 * This application is meant for older rooms (<= 1.0.2). It will attempt to update these rooms to
 * be compatible with versions 1.1.0 and up.
 */

 /**
  * REQUIRES YOUTUBE-FEEDS, SYNC, NODE-WALKER. NPM THESE!
  */

 var fs = require('fs');
 var YTF = require('youtube-feeds');
 var sync = require('sync');
 var walker = require('node-walker');

 /**
  * <=1.0.2 format:
  * {"streamTitle":"","controlkey":"","currentvideo":x,"tracks":[{title:"", url:"", views:x, id: x],"playing":bool,"currTime":x,"nextID":x}
  * >1.1 format
  * {"streamTitle":"","controlkey":"","currentvideo":x,"tracks":[{title:"", url:"", views:x, id: x, duration: x], "playing":bool, "currTime":x,  "nextID":x, "isShuffle":bool }
  */

  function Stream(title, controlkey, currentvideo, tracks, playing, currTime, nextID, isShuffle) {
  	this.streamTitle = title;
  	this.controlkey = controlkey;
  	this.currentvideo = currentvideo;
  	this.tracks = tracks;
  	this.playing = playing;
  	this.currTime = currTime;
  	this.nextID = nextID;
  	this.isShuffle = isShuffle;
  }

  function Track(title, url, views, id, duration) {
  	this.title = title;
  	this.url = url;
  	this.views = views;
  	this.id = id;
  	this.duration = duration;
  }



  function convertAndSaveStream(streamFile) {
  	var stream = JSON.parse(fs.readFileSync(streamFile));
  	var newTracks = [];
  	var roomName = streamFile.substr(__dirname.length + "streams/".length +1).split('.json')[0];
  	var i = stream.tracks.length;
  	var j = 0;
    var idCounter= 0

  	for(var track in stream.tracks) {
  		YTF.video(stream.tracks[track].url.split('v=')[1].split('&')[0], function(err, data) {
  			if(err) {
  				console.log(err);
  				return;  			
  			}
  			ytvideo = data;
  			var newTrack = new Track(ytvideo.title, ytvideo.player["default"].split('&')[0], stream.tracks[track].views, idCounter++, ytvideo.duration);
  			newTracks.push(newTrack);
  			j++;
  			if(j == i) {
  				console.log("all tracks done here. Got : " + i + " / " + j);
  				var newStream = new Stream(stream.streamTitle, stream.controlkey, stream.currentvideo, newTracks, stream.playing, 0, idCounter, false);
  				console.log('writing...\n');

  						//stringify this object so that it can be written.
  						var fContents = JSON.stringify(newStream);

		//Write the new stream to ./streams/<roomname>.json
		fs.writeFile('./streams/' + roomName + ".json", fContents, function(err) {
			if(err) {
				console.log("Something went terribly wrong when creating a room (file write unsuccesfull)!");
			//Send error!
		} else {
			console.log("A new stream was made!");
				}
			});

	}
});

}

}

	function main() {
		var streamsDirectory = __dirname+"/streams";
		console.log("\nReading streams in: " + streamsDirectory + "...\n");

		var j = 0;
		walker(streamsDirectory, function(errorObject, fileName, fnNext) {

			if(errorObject) throw errorObject;

			if(fileName !== null) {
				j++;

				fileName = fileName.substr(root.length +1);
				console.log(j + '.\t' + fileName);
				convertAndSaveStream(fileName);

				fnNext();

			} else {
				console.log("\nFinished!");
			}

		});

	}

	main();