const {ipcRenderer} = require('electron')
const Store = require('electron-store');
const store = new Store();

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
  
});

// load initial bank preference
if (store.get("rrbank")) {
	if (store.get("rrbank")=="south") {
		document.getElementById("southbank").checked = true;
	}
}

// store any future bank preference changes
function savepref(bank) {
	store.set("rrbank", bank);
	console.log("Saved prefered bank as " + bank);
	ipcRenderer.send("bankchange", bank);
}

