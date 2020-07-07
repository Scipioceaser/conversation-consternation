const { app, BrowserWindow, ipcMain, Menu, MenuItem } = require('electron');
var path = require('path')

let window;
let main;

app.whenReady().then(() => {

    window = new BrowserWindow({
        width: 1280,
        height: 768,
        webPreferences: {
            nodeIntegration: true
        },
        icon: path.join(__dirname, 'g/icon/icon64.png')
    })

    window.loadFile('index.html');

    Menu.setApplicationMenu(null);

    window.require = require;
    window.process = process;
    window.module = module;

    function F12(e) { return e.keyIdentifier === 'F12' }
    function Command_Option_J(e) { return e.keyCode === 74 && e.metaKey && e.altKey }

    window.dispatchEvent(new window.Event('app-ready'));
});

app.on('create', function()
{
    window.frame.show();
	window.frame.center();
});