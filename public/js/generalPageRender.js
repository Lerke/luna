
jQuery(window).ready(function() {
	jQuery.noConflict();
	var isShown;
	jQuery("#lunaText").fitText(0.235);
	jQuery("#lunaSidebar").hide("slide", {direction: "left"} , 1000);

	jQuery("body").on("mousemove", function(event) {
		if(event.pageX < 200) {
			//Show sidebar
			jQuery("#lunaSidebar").show("slide", {direction: "left"}, 500, function() {
			});
		} else if(event.pageX >= 400) {
			jQuery("#lunaSidebar").hide("slide", {direction: "left" }, 500, function() {
			});
		}
	});

});

