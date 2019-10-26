// Modules to control application life and create native browser window
const {app, BrowserWindow, Menu, Tray, ipcMain} = require('electron')
const path = require('path')
const config = require('./config');
const WebSocket = require('ws');
let ws;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow = null;
let appIcon = null

function startup() {
	// Connect to WS
	ws = new WebSocket(config.url);
  
	ws.on('open', function open() {
	  //ws.send('something'); -- NOTE: if you send anything but the action payload expected, it'll throw a 403 error and you'll spend hours trying to find out why
	  // 403 is a stupid error for an unexpected payload
	  console.log("Connected to websocket.");
	});

	ws.on('message', function incoming(data) {
		console.log('Received message: ' + data);
		// Send to renderer process
		mainWindow.webContents.send('asynchronous-message', data)
	});

	ws.on('error', function wserror(data) {
	  console.log('Received error: ' + data);
	  // Need some attempt to reconnect here
	});
	
	// Put in system tray
	const iconName = process.platform === 'win32' ? 'windows-icon.png' : 'iconTemplate.png';
	const iconPath = path.join(__dirname, iconName);
	//const iconPath = path.join(__dirname, 'iconTemplate.png');
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

	appIcon.setToolTip('Open TBD');
	appIcon.setContextMenu(contextMenu);
	
	appIcon.on('click', function(event) {
		mainWindow.show();
	});
	
	// Show the main window
	createWindow();
}

function createWindow () {
	
	// Create the browser window.
	mainWindow = new BrowserWindow({
		width: 600,
		height: 810,
		icon: './iconTemplate.png',
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
})

app.on('activate', function () {
	// On macOS it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	if (mainWindow === null) {
		createWindow();
	}
})
