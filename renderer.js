const {ipcRenderer} = require('electron')

ipcRenderer.on('asynchronous-message', (event, arg) => {
	console.log("Received: " + arg);

	var data = arg;

	data.forEach(function(rr) {
		var newclass;
		var newinfo;
		var nexttime;
		  
		if (rr.isopen) {
			newclass = "rrOpen";
			nexttime = new Date(rr.ProbableClose);
			newinfo = "Closes around " + nexttime.toLocaleTimeString();
			
		} else {
			newclass = "rrClosed";
			nexttime = new Date(rr.ProbableOpen);
			newinfo = "Opens around " + nexttime.toLocaleTimeString();	
		}
	  
		if (nexttime > Date()) {
			document.getElementById('rr' + rr.rrID + 'time').innerHTML = newinfo;
		} else {
			document.getElementById('rr' + rr.rrID + 'time').innerHTML = "No current stats";
		}
			
		document.getElementById('room' + rr.rrID).className = newclass;
	});
  
})