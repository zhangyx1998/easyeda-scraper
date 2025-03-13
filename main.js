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
let lastModified = null;

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
    width: 1300,
    height: 800,
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
async function readPartsFromElibz(forceRefresh = false) {
  const varDir = path.join(__dirname, 'var');
  const elibzPath = path.join(varDir, 'LCSC.elibz');
  const extractDir = path.join(varDir, 'LCSC');

  try {
    // Check if LCSC.elibz exists
    if (!fs.existsSync(elibzPath)) {
      return { error: 'LCSC.elibz not found' };
    }

    // Get last modified time
    const stats = fs.statSync(elibzPath);
    const currentLastModified = stats.mtimeMs;

    // Return cached results if available and not forced refresh
    if (!forceRefresh && cachedPartsList && lastModified === currentLastModified) {
      return { parts: cachedPartsList };
    }

    // Extract the zip file
    const zip = new AdmZip(elibzPath);
    zip.extractAllTo(extractDir, true);

    // Read device.json
    const deviceJsonPath = path.join(extractDir, 'device.json');
    if (!fs.existsSync(deviceJsonPath)) {
      return { error: 'device.json not found in LCSC.elibz' };
    }

    const deviceData = JSON.parse(fs.readFileSync(deviceJsonPath, 'utf8'));
    const parts = [];

    // Extract parts information
    if (deviceData.devices) {
      for (const [uuid, device] of Object.entries(deviceData.devices)) {
        if (device.attributes && device.attributes['LCSC Part Name']) {
          parts.push({
            uuid: uuid,
            mpn: device.attributes['LCSC Part Name'],
            manufacturer: device.attributes['Manufacturer'] || 'Unknown',
            datasheet: device.attributes['Datasheet'] || null,
            imageUrl: device.images ? device.images[0] : null
          });
        }
      }
    }

    // Update cache
    cachedPartsList = parts;
    lastModified = currentLastModified;

    return { parts };
  } catch (error) {
    console.error('Error reading parts:', error);
    return { error: error.message };
  }
}

async function deletePartsFromElibz(uuids) {
  const varDir = path.join(__dirname, 'var');
  const elibzPath = path.join(varDir, 'LCSC.elibz');
  const extractDir = path.join(varDir, 'LCSC');
  const deviceJsonPath = path.join(extractDir, 'device.json');

  try {
    // Extract the zip file if not already extracted
    if (!fs.existsSync(deviceJsonPath)) {
      const zip = new AdmZip(elibzPath);
      zip.extractAllTo(extractDir, true);
    }

    // Read and parse device.json
    const deviceData = JSON.parse(fs.readFileSync(deviceJsonPath, 'utf8'));

    // Delete specified parts
    let deletedCount = 0;
    for (const uuid of uuids) {
      if (deviceData.devices && deviceData.devices[uuid]) {
        delete deviceData.devices[uuid];
        deletedCount++;
      }
    }

    if (deletedCount === 0) {
      return { success: false, error: 'No parts were found to delete' };
    }

    // Write updated device.json
    fs.writeFileSync(deviceJsonPath, JSON.stringify(deviceData, null, 2));

    // Create new zip file
    const newZip = new AdmZip();
    
    // Add all files from the extracted directory
    const addFilesToZip = (dir, baseDir = '') => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const relativePath = path.join(baseDir, file);
        if (fs.statSync(filePath).isDirectory()) {
          addFilesToZip(filePath, relativePath);
        } else {
          newZip.addLocalFile(filePath, baseDir);
        }
      }
    };
    
    addFilesToZip(extractDir);

    // Save the new zip file
    newZip.writeZip(elibzPath);

    // Clear cache to force refresh
    cachedPartsList = null;
    lastModified = null;

    return { success: true, deletedCount };
  } catch (error) {
    console.error('Error deleting parts:', error);
    return { success: false, error: error.message };
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
ipcMain.handle('get-parts-list', async (event, forceRefresh) => {
  return await readPartsFromElibz(forceRefresh);
});

// Handle requests to delete parts from LCSC.elibz
ipcMain.handle('delete-parts', async (event, uuids) => {
  return await deletePartsFromElibz(uuids);
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
