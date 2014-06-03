
jQuery(window).ready(function() {
	jQuery.noConflict();
	var isShown;
	jQuery("#lunaText").fitText(0.235, { maxFontSize: '170px'});
	if(!jQuery("#lockSidebar").is(":checked")) {
	jQuery("#lunaSidebar").hide("slide", {direction: "left"} , 1000);
	}
	if(!jQuery("#lockChatBar").is(":checked")) {
	jQuery("#chatBox").hide("slide", {direction: "right"} , 500);
	}

	jQuery("body").on("mousemove", function(event) {
	if(!jQuery("#lockSidebar").is(":checked")) {
		if(event.pageX < jQuery("#lunaSidebar").width()) {
			//Show sidebar
			jQuery("#lunaSidebar").show("slide", {direction: "left"}, 500, function() {
			});
		} else if(event.pageX >= jQuery("#lunaSidebar").width() + 150) {
			jQuery("#lunaSidebar").hide("slide", {direction: "left" }, 500, function() {
			});
		}
	}
	});

	jQuery("#lockChatBar").change(function() {
		if(jQuery(this).is(":checked")) {
			jQuery("#chatBox").show("slide", {direction: "right"} , 500);
		} else {
			jQuery("#chatBox").hide("slide", {direction: "right"} , 500);
		}
	});


});

