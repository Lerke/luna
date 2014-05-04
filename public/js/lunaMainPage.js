jQuery(document).ready(function() {
	jQuery("#createStreamBtn").hide();
	jQuery("#gotoStreamBtn").hide();
	//Create WS connection!
	var SERVER = window.location.hostname + ':9002';
	socket = io.connect("http://" + window.location.hostname + ':9002');
	var nameIsAvailable = false;

	jQuery("#createStream").on('click', function() {
		jQuery("#lunaContent").fadeOut(1000);
		jQuery("#createStreamPage").fadeIn(2000);
	});

	jQuery("#streamConfirm").on('click', function() {
		nameIsAvailable = false;
		var streamName = jQuery("#streamname").val();
		if(streamName.length < 3 || streamName.length > 20) {
			var n = jQuery("#feedbackText").css("visibility");
			if(jQuery("#feedbackText").css("visibility") == "hidden") {
			jQuery("#feedbackText").css('visibility', 'visible').hide().fadeIn(400);
			if(streamName.length <3) {
			jQuery("#feedbackText").text("Sorry, this name is too short!");
			} else {
				jQuery("#feedbackText").text("Sorry, this name is too long!");
			}
			jQuery("#feedbackText").removeClass("goodtogoText").addClass("errorText");
		}
		} else {
			jQuery("#feedbackText").fadeOut(400, function() {
				jQuery("#feedbackText").css("visibility", "hidden");
				//check if servername is available
				jQuery("#streamConfirm").prop("disabled", "true");
				socket.emit('isRoomAvailable', {rmname: streamName});
			});

		}
	});

	socket.on('availableResponse', function(roomName) {
			if(!roomName.available) {
		if(jQuery("#feedbackText").css("visibility") == "hidden") {
			jQuery("#feedbackText").css('visibility', 'visible').hide().fadeIn(400);
			jQuery("#feedbackText").removeClass("goodtogoText").addClass("errorText");
			jQuery("#feedbackText").text("Sorry, this name is no longer available!");
			jQuery("#streamConfirm").prop("disabled", "false");
		}
	} else {
		//Room is available!
		jQuery("#streamConfirm").prop("disabled", "false");
		nameisAvailable = true;
		jQuery("#streamname").prop("disabled", true);
					jQuery("#feedbackText").css('visibility', 'visible').hide().fadeIn(400);
		jQuery("#feedbackText").removeClass("errorText").addClass("goodtogoText");
		jQuery("#streamname").addClass("goodtogoInput");
		

		//strip name from punctuation and spaces.
		var strName = jQuery("#streamname").val().toString();
		strName = strName.replace(/[^a-z0-9]/gi,'')
		jQuery("#feedbackText").html("This name is available!<br> Your URL: " + window.location.hostname + "/streams/" + strName);

		//Replace button.
		jQuery("#streamConfirm").unbind("click");;
		jQuery("#streamConfirm").hide();
		jQuery("#createStreamBtn").fadeIn(400);
		jQuery("#createStreamBtn").on("click",function() {
			//CREATE THE STREAM!
			jQuery("#createStreamBtn").unbind("click");
			jQuery("#createStreamBtn").hide();
			//Send creation package.
			jQuery("feedbackText").html("Standby...");
			socket.emit('createNewStream', {roomname: strName});
			//NOW WE WAIT.
		});

	}});
	
	/**
	* The room was succesfully created! Show user the link + the control key.
	*/
	socket.on('successCreation', function(serverData) {
			jQuery("#gotoStreamBtn").fadeIn(400);
			jQuery("#gotoStreamBtn").on("click", function() {

				var adminurl = SERVER + "/streams/" + serverData.roomname + "#control=" + serverData.code;
				if(adminurl.substring(0,3) != "http") {
					adminurl = "http://" + adminurl;
				}
				window.location.assign(adminurl);
				return false;
			});
		    jQuery("#feedbackText").html("Your stream has been created!<br> Your URL: " + SERVER + "/streams/" + serverData.roomname + "<br> " +
			"Your secret code (Important): " + serverData.code);

	});

	/**
	* Something went horribly wrong when creating the room. Display this to the user.
	*/
	socket.on('failCreation', function() {
		jQuery("#feedbackText").removeClass("goodtogoText").addClass("errorText");
				jQuery("#feedbackText").html("Something went very wrong when creating your stream? Either the server is not correctly configured, or someone made this stream before you confirmed it.");

	});


});