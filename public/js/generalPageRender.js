$(window).ready(function() {
	var isShown;
	jQuery("#lunaText").fitText(0.235);
	$("#lunaSidebar").hide("slide", {direction: "left"} , 1000);

	$("body").on("mousemove", function(event) {
		if(event.pageX < 200) {
			//Show sidebar
			$("#lunaSidebar").show("slide", {direction: "left"}, 500, function() {
			});
		} else if(event.pageX >= 400) {
			$("#lunaSidebar").hide("slide", {direction: "left" }, 500, function() {
			});
		}
	});

});

