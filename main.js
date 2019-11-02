// Modules to control application life and create native browser window
const {app, BrowserWindow, Menu, Tray, ipcMain} = require('electron')
const path = require('path')
const Store = require('electron-store');
const store = new Store();
const config = require('./config');
const WebSocket = require('ws');
let ws;
let rrbank = "north";

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow = null;
let appIcon = null
let firstdata = null;

function startup() {
	// Create the app menu
	makemenu();
	
	// Get preferred restroom bank
	if (store.get('rrbank')) {
		if (store.get('rrbank')=='south') {
			rrbank = "south";
		}
	}
	
	// Connect to WS
	ws = new WebSocket(config.wsurl);
	
	// TODO: Check for online/offline: https://electronjs.org/docs/tutorial/online-offline-events
  
	ws.on('open', function open() {
		//ws.send('something'); -- NOTE: if you send anything but the action payload expected, it'll throw a 403 error and you'll spend hours trying to find out why
		// 403 is a stupid error for an unexpected payload
		console.log("Connected to websocket.");
	  
		// Get first set of data
		var request = require('request');
		request(config.apiurl, function (error, response, body) {
		  if (response.statusCode==200) {
			  console.log("Received first set of data: " + body);
			  // Will use once the window is loaded
			  firstdata = body;
		  } else {
			  console.log("Error: " + error);
		  }
		});
		   
		
	});

	ws.on('message', function incoming(data) {
		console.log('Received message: ' + data);
		msgreceived(data);
	});

	ws.on('error', function wserror(data) {
	  console.log('Received error: ' + data);
	  // Need some attempt to reconnect here
	});
	
	// Put in system tray
	const iconPath = path.join(__dirname, "icons/trayunknown.png");
	appIcon = new Tray(iconPath);

	const contextMenu = Menu.buildFromTemplate([
	
		{ 
			label: 'Show App', 
			click:  function(){
				mainWindow.show();
			} 
		},
		{ 
			label: 'Quit', 
			click:  function(){
				app.isQuiting = true;
				app.quit();
			} 
		}
	])

	appIcon.setContextMenu(contextMenu);
	
	appIcon.on('click', function(event) {
		mainWindow.show();
	});
	
	// Show the main window
	createWindow();
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
	
	var prefer = [0, 1, 2, 3];
	
	if (rrbank == "south") {
		prefer = [2, 3, 0, 1];
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
	mainWindow.webContents.send('asynchronous-message', data)
}

function createWindow () {
	
	// Create the browser window.
	mainWindow = new BrowserWindow({
		width: 600,
		height: 810,
		icon: './toilet.png',
		webPreferences: {
		  preload: path.join(__dirname, 'preload.js'),
		  nodeIntegration: true
		}
	})
	
	
	// and load the index.html of the app.
	mainWindow.loadFile('index.html')

	// Open the DevTools.
	mainWindow.webContents.openDevTools()
	
	mainWindow.on('close', function (event) {
		// Capture the close event and prevent 
		// so it closes to the tray
		if(!app.isQuiting){
			event.preventDefault();
			mainWindow.hide();
		}
		
		return false;
	});
	
	mainWindow.webContents.on('did-finish-load', function (event) {
		if (firstdata) {
			msgreceived(firstdata);
		}
	});
	
    /*
	// Emitted when the window is closed.
	mainWindow.on('closed', function () {
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
app.on('ready', startup);

// Quit when all windows are closed.
app.on('window-all-closed', function () {
	// On macOS it is common for applications and their menu bar
	// to stay active until the user quits explicitly with Cmd + Q
	if (process.platform !== 'darwin') {
		//app.quit();
		
		// We want to minimize to tray
	}
});

app.on('activate', function () {
	// On macOS it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	if (mainWindow === null) {
		createWindow();
	}
});

function makemenu() {
	const isMac = process.platform === 'darwin';

	const template = [
	  // { role: 'appMenu' }
	  ...(isMac ? [{
		label: app.name,
		submenu: [
		  { role: 'about' },
		  { type: 'separator' },
		  { role: 'services' },
		  { type: 'separator' },
		  { role: 'hide' },
		  { role: 'hideothers' },
		  { role: 'unhide' },
		  { type: 'separator' },
		  { role: 'quit' }
		]
	  }] : []),
	  // { role: 'fileMenu' }
	  {
		label: 'File',
		submenu: [
		  isMac ? { role: 'close' } : { role: 'quit' }
		  // Probably have to change the role to a label and subscribe
		  // or perhaps can make the app.on windows close listener check where the event came from. Only time we ignore is the X in the browser... all menu items should actually quit.
		]
	  },

	  // { role: 'windowMenu' }
	  {
		label: 'Window',
		submenu: [
		  { role: 'minimize' },
		  
		  ...(isMac ? [
			{ type: 'separator' },
			{ role: 'front' },
			{ type: 'separator' },
			{ role: 'window' }
		  ] : [
			{ role: 'close' }
		  ])
		]
	  },
	  {
		role: 'help',
		submenu: [
		  {
			label: 'Learn More',
			click: async () => {
			  const { shell } = require('electron');
			  await shell.openExternal('https://github.com/jpr-c8/rrmonitor');
			}
		  }
		]
	  }
	]

	const menu = Menu.buildFromTemplate(template)
	Menu.setApplicationMenu(menu)
}
