// Modules to control application life and create native browser window
const {app, BrowserWindow, Menu, Tray, ipcMain, net} = require("electron")
const path = require("path")
const Store = require("electron-store");
const store = new Store();
const config = require("./config");
const WebSocket = require("ws");
let ws;
let rrbank = "north";

let mainWindow = null;
let appIcon = null
let firstdata = null;
let firstload = true;
let wsdead = null;
let pingit = null;

// Shut down if this is loading during install/uninstall process
if (require("electron-squirrel-startup")) return app.quit();

function startup() {
	// Create the app menu
	makemenu();
	
	// Get preferred restroom bank
	if (store.get("rrbank")) {
		if (store.get("rrbank")=="south") {
			rrbank = "south";
		}
	}

	connectws();
	
	// Put in system tray
	const iconPath = path.join(__dirname, "icons/trayunknown.png");
	appIcon = new Tray(iconPath);

	const contextMenu = Menu.buildFromTemplate([
	
		{ 
			label: "Show App", 
			click:  function(){
				mainWindow.show();
			} 
		},
		{ 
			label: "Quit", 
			click: function() { thequit(); }
		}
	])

	appIcon.setContextMenu(contextMenu);
	
	appIcon.on("click", function(event) {
		mainWindow.show();
	});
	
	// Show the main window
	createWindow();
}

function connectws() {
	// Connect to WS
	console.log("Attempting to connect to websocket");
	ws = new WebSocket(config.wsurl);
	
	ws.on("open", function open() {
		//ws.send("something"); -- NOTE: if you send anything but the action payload expected, it'll throw a 403 error and you'll spend hours trying to find out why
		// 403 is a stupid error for an unexpected payload
		console.log("Connected to websocket.");
	  
		// Set timeout for heartbeat
		pingit = setTimeout(function() { ws.ping(); }, 30000);
		
		// Get first set of data
		// ... should probably do this with the on open function, but how to was not immediately evident with Lambda. 
		// ... already had this GET written from a very early implementation. Investigate cleaning up.
		var request = net.request(config.apiurl);
		request.on("response", (response) => {
		  if (response.statusCode==200) {
			  
			  response.on("data", (chunk) => {
						console.log("Body received: " + chunk);
						if (!firstload) {
						  // Main window exists - this is a reconnect (or it was really fast to load)
						  msgreceived(chunk);
					  } else {
						// Will use once the window is loaded
						firstdata = chunk;
					  }
                });
			  
		  } else {
			  console.log("Error getting first set of data.");
		  }
		});
		request.end();
		   
		
	});

	ws.on("message", function incoming(data) {
		console.log("Received message: " + data);
		msgreceived(data);
	});
	
	ws.on("pong", function wspong(data) {
		console.log("Restarting wsdead. Received pong.");
		// Clear timeouts, if any
		clearTimeout(pingit);
		clearTimeout(wsdead);
		
		// And reset timeouts
		pingit = setTimeout(function() { ws.ping(); }, 30000);
		wsdead = setTimeout(function() { reconnectws(); }, 40000);
	});

	ws.on("error", function wserror(data) {
	  console.log("Received error: " + data);
	  reconnectws();
	});
	
	ws.on("close", function wsclose(data) {
		console.log("WS connection closed. Code: " + data.code);
		if (data.code!=1000) {
			// Abnormal close
			reconnectws();
		}
			
	});
	
}


function reconnectws() {
	// Show that we no longer know the status
	appIcon.setImage(path.join(__dirname, "icons/trayunknown.png"));
	
	// Clear timeouts, if any
	clearTimeout(pingit);
	clearTimeout(wsdead);
	
	// Set timeout for the websocket to try reconnecting
	console.log("Disconnected. Setting reconnect timeout");
	
	ws.removeAllListeners();
	ws.terminate();
	ws = null;
		
	setTimeout(function() { connectws(); }, 60000);
}
	
function msgreceived(data) {
	data = JSON.parse(data);
	if (data.Items) {
		data = data.Items;
	}
	
	// Figure out which restroom is open, in order of preference
	var openness = [true, true, true, true];
	
	data.forEach(function(rr) {
		console.log("RR" + rr.rrID + " saved as open = " + rr.isopen);
		openness[rr.rrID-1] = rr.isopen;
	});
	
	var prefer = [2, 3, 0, 1];
	
	if (rrbank == "south") {
		prefer = [0, 1, 2, 3];
	}
	
	var firstopen = 0;
	
	for (i = 0; i < 4; i++) {
		console.log("Checking openness[" + prefer[i] + "] is " + openness[prefer[i]]);
		if (openness[prefer[i]]) {
			firstopen = i + 1;
			break;
		}
	}
	
	// Set tray icon
	appIcon.setImage(path.join(__dirname, "icons/tray" + firstopen + ".png"));
	
	// Send to renderer process
	mainWindow.webContents.send("asynchronous-message", data)
}

ipcMain.on("bankchange", (event, arg) => {
	// This won't do anything until the next change, but that's ok. People shouldn't be playing with this setting.
	rrbank = arg;
	console.log("Set preferred rrbank in main process to " + rrbank);
});

function createWindow () {
	
	var winicon = path.join(__dirname, "icons/toilet.png");
	if (process.platform == "win32") {
		winicon = path.join(__dirname, "icons/generic.ico");
	}
	
	// Create the browser window.
	mainWindow = new BrowserWindow({
		width: 1200,
		height: 850,
		icon: winicon,
		webPreferences: {
		  preload: path.join(__dirname, "preload.js"),
		  nodeIntegration: true
		}
	})
	
	
	// and load the index.html of the app.
	mainWindow.loadFile("index.html")

	// Open the DevTools.
	//mainWindow.webContents.openDevTools()
	
	mainWindow.on("close", function (event) {
		// Capture the close event and prevent 
		// so it closes to the tray
		if(!app.isQuiting){
			event.preventDefault();
			mainWindow.hide();
		}
		
		return false;
	});
	
	mainWindow.webContents.on("did-finish-load", function (event) {
		if (firstdata) {
			msgreceived(firstdata);
		}
		console.log("did-finish-load emitted");
		firstload = false;
	});
	
    /*
	// Emitted when the window is closed.
	mainWindow.on("closed", function () {
		// Dereference the window object, usually you would store windows
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		mainWindow = null;
	})
	*/
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", startup);

// Quit when all windows are closed.
app.on("window-all-closed", function () {
	// On macOS it is common for applications and their menu bar
	// to stay active until the user quits explicitly with Cmd + Q
	if (process.platform !== "darwin") {
		//app.quit();
		
		// We want to minimize to tray
	}
});

app.on("activate", function () {
	// On macOS it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	if (mainWindow === null) {
		createWindow();
	}
});

function thequit() {
	console.log("Quitting");
	if (ws) { ws.close(); }
	app.isQuiting = true;
	app.quit();
}

function makemenu() {
	const isMac = process.platform === "darwin";

	const template = [
	  // { role: "appMenu" }
	  ...(isMac ? [{
		label: app.name,
		submenu: [
		  { role: "about" },
		  { type: "separator" },
		  { role: "services" },
		  { type: "separator" },
		  { role: "hide" },
		  { role: "hideothers" },
		  { role: "unhide" },
		  { type: "separator" },
		  { label: "Quit", click: function() { thequit(); } }
		]
	  }] : []),
	  // { role: "fileMenu" }
	  {
		label: "File",
		submenu: [
		  isMac ? { role: "close" } : { label: "Quit", click: function() { thequit(); } }
		  // We can't use the standard "Quit" role here since we're overriding it unless app.isQuiting = true
	  
		]
	  },

	  // { role: "windowMenu" }
	  {
		label: "Window",
		submenu: [
		  { role: "minimize" },
		  
		  ...(isMac ? [
			{ type: "separator" },
			{ role: "front" },
			{ type: "separator" },
			{ role: "window" }
		  ] : [
			{ role: "close" }
		  ])
		]
	  },
	  {
		role: "help",
		submenu: [
		  {
			label: "Learn More",
			click: async () => {
			  const { shell } = require("electron");
			  await shell.openExternal("https://github.com/jpr-c8/rrmonitor");
			}
		  }
		]
	  }
	]

	const menu = Menu.buildFromTemplate(template)
	Menu.setApplicationMenu(menu)
	
	// While we're at it, hide it from the dock (Mac only)
	if (isMac) { app.dock.hide(); }
}
