
jQuery(window).ready(function() {
	jQuery.noConflict();
	var isShown;
	jQuery("#lunaText").fitText(0.235, { maxFontSize: '170px'});
	jQuery("#lunaSidebar").hide("slide", {direction: "left"} , 1000);

	jQuery("body").on("mousemove", function(event) {
		if(event.pageX < jQuery("#lunaSidebar").width()) {
			//Show sidebar
			jQuery("#lunaSidebar").show("slide", {direction: "left"}, 500, function() {
			});
		} else if(event.pageX >= jQuery("#lunaSidebar").width() + 150) {
			jQuery("#lunaSidebar").hide("slide", {direction: "left" }, 500, function() {
			});
		}
	});

});

