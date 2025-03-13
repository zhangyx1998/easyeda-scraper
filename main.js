// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')
const fs = require('fs')
const AdmZip = require('adm-zip')

// Import our ES module code
let searchModule;
console.log('Starting application...');

// Cache for parts list
let cachedPartsList = null;

// Import the search module
import('./index.mjs')
  .then(module => {
    console.log('Search module loaded');
    if (!module.searchPart) {
      throw new Error('searchPart function not found in module');
    }
    searchModule = module;
  })
  .catch(error => {
    console.error('Failed to load search module:', error);
  });

function createWindow () {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false // Temporarily disable CORS for testing
    }
  })

  // and load the index.html of the app.
  mainWindow.loadFile('index.html')

  // Open DevTools for debugging
  mainWindow.webContents.openDevTools()
}

// Function to extract LCSC.elibz if needed
async function extractLCSCElibz() {
  const varDir = path.join(__dirname, 'var');
  const elibzPath = path.join(varDir, 'LCSC.elibz');
  const extractPath = path.join(varDir, 'LCSC');

  // Check if var directory exists
  if (!fs.existsSync(varDir)) {
    return { success: false, message: 'var directory does not exist' };
  }

  // Check if LCSC.elibz exists
  if (!fs.existsSync(elibzPath)) {
    return { success: false, message: 'LCSC.elibz file does not exist' };
  }

  try {
    // Get file stats for LCSC.elibz
    const elibzStats = fs.statSync(elibzPath);
    const elibzMtime = elibzStats.mtime.getTime();

    // Check if extracted directory exists and is up to date
    if (fs.existsSync(extractPath)) {
      const extractedMarkerPath = path.join(extractPath, '.extracted_time');
      if (fs.existsSync(extractedMarkerPath)) {
        const extractedTime = parseInt(fs.readFileSync(extractedMarkerPath, 'utf8'));
        if (extractedTime >= elibzMtime) {
          return { success: true, message: 'Using existing extracted files' };
        }
      }
      // If we get here, we need to remove the old extracted files
      fs.rmSync(extractPath, { recursive: true, force: true });
    }

    // Create extraction directory
    fs.mkdirSync(extractPath, { recursive: true });

    // Extract the zip file
    const zip = new AdmZip(elibzPath);
    zip.extractAllTo(extractPath, true);

    // Save extraction time
    fs.writeFileSync(path.join(extractPath, '.extracted_time'), elibzMtime.toString());

    return { success: true, message: 'Successfully extracted LCSC.elibz' };
  } catch (error) {
    console.error('Error extracting LCSC.elibz:', error);
    return { success: false, message: error.message };
  }
}

// Function to read and parse the LCSC.elibz file
async function readPartsFromElibz() {
  try {
    const varDir = path.join(__dirname, 'var');
    const extractPath = path.join(varDir, 'LCSC');
    
    // Extract or update the files if needed
    const extractResult = await extractLCSCElibz();
    if (!extractResult.success) {
      return extractResult;
    }
    
    // Read device.json from the extracted directory
    const deviceFilePath = path.join(extractPath, 'device.json');
    if (!fs.existsSync(deviceFilePath)) {
      return { success: false, message: 'device.json file does not exist' };
    }
    
    console.log('Reading device.json from:', deviceFilePath);
    const deviceContent = fs.readFileSync(deviceFilePath, 'utf8');
    const deviceData = JSON.parse(deviceContent);
    
    const parts = [];
    
    // Log the structure of deviceData for debugging
    console.log('Device data structure:', JSON.stringify(deviceData, null, 2));
    
    // Extract parts from devices
    if (deviceData && deviceData.devices) {
      console.log('Found devices in device.json');
      Object.entries(deviceData.devices).forEach(([uuid, device]) => {
        console.log('Processing device with UUID:', uuid);
        console.log('Device data:', JSON.stringify(device, null, 2));
        
        if (device && device.attributes) {
          const part = {
            mpn: device.attributes['LCSC Part Name'],
            manufacturer: device.attributes['Manufacturer'],
            datasheet: device.attributes['Datasheet'],
            imageUrl: device.images ? device.images[0] : null
          };
          console.log('Created part object:', part);
          if (part.mpn) {
            parts.push(part);
          }
        }
      });
    } else {
      console.log('No devices found in device.json');
    }
    
    // Get last modified time of LCSC.elibz
    const elibzPath = path.join(varDir, 'LCSC.elibz');
    const stats = fs.statSync(elibzPath);
    const lastModified = stats.mtime.toLocaleString();
    
    console.log('Found parts:', parts);
    
    return { 
      success: true, 
      lastModified,
      parts,
      message: `Found ${parts.length} parts in device.json (extracted to ${extractPath})`
    };
  } catch (error) {
    console.error('Error reading parts from extracted LCSC:', error);
    return { success: false, message: error.message };
  }
}

// Handle search requests from the renderer
ipcMain.handle('search-part', async (event, partNumber) => {
  console.log('Searching for part:', partNumber);
  
  if (!searchModule?.searchPart) {
    const error = new Error('Search module not initialized or searchPart function not found');
    console.error(error);
    throw error;
  }

  try {
    const result = await searchModule.searchPart(partNumber);
    console.log('Search completed successfully');
    
    // Refresh the parts list cache after a new search
    cachedPartsList = null;
    
    return { success: true, result };
  } catch (error) {
    console.error('Search error:', error);
    throw error;
  }
});

// Handle requests to get the list of parts from LCSC.elibz
ipcMain.handle('get-parts-list', async (event, forceRefresh = false) => {
  console.log('Getting parts list from LCSC.elibz');
  
  try {
    // Use cached result if available and not forcing refresh
    if (cachedPartsList && !forceRefresh) {
      return cachedPartsList;
    }
    
    const result = await readPartsFromElibz();
    
    if (!result.success) {
      return {
        error: true,
        message: result.message
      };
    }
    
    // Return the raw parts data instead of formatting it
    return {
      error: false,
      lastModified: result.lastModified,
      parts: result.parts
    };
  } catch (error) {
    console.error('Error getting parts list:', error);
    return {
      error: true,
      message: error.message
    };
  }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
