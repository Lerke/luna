$(document).ready(function() {
	$("#createStreamBtn").hide();
	$("#gotoStreamBtn").hide();
	//Create WS connection!
	var SERVER = window.location.hostname + ':9002';
	socket = io.connect("http://" + window.location.hostname + ':9002');
	var nameIsAvailable = false;

	$("#createStream").on('click', function() {
		$("#lunaContent").fadeOut(1000);
		$("#createStreamPage").fadeIn(2000);
	});

	$("#streamConfirm").on('click', function() {
		nameIsAvailable = false;
		var streamName = $("#streamname").val();
		if(streamName.length < 3 || streamName.length > 20) {
			var n = $("#feedbackText").css("visibility");
			if($("#feedbackText").css("visibility") == "hidden") {
			$("#feedbackText").css('visibility', 'visible').hide().fadeIn(400);
			if(streamName.length <3) {
			$("#feedbackText").text("Sorry, this name is too short!");
			} else {
				$("#feedbackText").text("Sorry, this name is too long!");
			}
			$("#feedbackText").removeClass("goodtogoText").addClass("errorText");
		}
		} else {
			$("#feedbackText").fadeOut(400, function() {
				$("#feedbackText").css("visibility", "hidden");
				//check if servername is available
				$("#streamConfirm").prop("disabled", "true");
				socket.emit('isRoomAvailable', {rmname: streamName});
			});

		}
	});

	socket.on('availableResponse', function(roomName) {
			if(!roomName.available) {
		if($("#feedbackText").css("visibility") == "hidden") {
			$("#feedbackText").css('visibility', 'visible').hide().fadeIn(400);
			$("#feedbackText").removeClass("goodtogoText").addClass("errorText");
			$("#feedbackText").text("Sorry, this name is no longer available!");
			$("#streamConfirm").prop("disabled", "false");
		}
	} else {
		//Room is available!
		$("#streamConfirm").prop("disabled", "false");
		nameisAvailable = true;
		$("#streamname").prop("disabled", true);
					$("#feedbackText").css('visibility', 'visible').hide().fadeIn(400);
		$("#feedbackText").removeClass("errorText").addClass("goodtogoText");
		$("#streamname").addClass("goodtogoInput");
		

		//strip name from punctuation and spaces.
		var strName = $("#streamname").val().toString();
		strName = strName.replace(/[^a-z0-9]/gi,'')
		console.log(strName);
		$("#feedbackText").html("This name is available!<br> Your URL: " + SERVER + "/streams/" + strName);

		//Replace button.
		$("#streamConfirm").unbind("click");;
		$("#streamConfirm").hide();
		$("#createStreamBtn").fadeIn(400);
		$("#createStreamBtn").on("click",function() {
			//CREATE THE STREAM!
			$("#createStreamBtn").unbind("click");
			$("#createStreamBtn").hide();
			//Send creation package.
			$("feedbackText").html("Standby...");
			socket.emit('createNewStream', {roomname: strName});
			//NOW WE WAIT.
		});

	}});
	
	/**
	* The room was succesfully created! Show user the link + the control key.
	*/
	socket.on('successCreation', function(serverData) {
			$("#gotoStreamBtn").fadeIn(400);
			$("#gotoStreamBtn").on("click", function() {

				var adminurl = SERVER + "/streams/" + serverData.roomname + "#control=" + serverData.code;
				if(adminurl.substring(0,3) != "http") {
					adminurl = "http://" + adminurl;
				}
				window.location.assign(adminurl);
				return false;
			});
		    $("#feedbackText").html("Your stream has been created!<br> Your URL: " + SERVER + "/streams/" + serverData.roomname + "<br> " +
			"Your secret code (Important): " + serverData.code);

	});

	/**
	* Something went horribly wrong when creating the room. Display this to the user.
	*/
	socket.on('failCreation', function() {
		$("#feedbackText").removeClass("goodtogoText").addClass("errorText");
				$("#feedbackText").html("Something went very wrong when creating your stream? Either the server is not correctly configured, or someone made this stream before you confirmed it.");

	});


});