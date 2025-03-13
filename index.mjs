import { product, device, extract, search } from "./search.mjs";
import { mkdir, readdir, writeFile, rename } from "fs/promises";
import { createWriteStream, existsSync} from "fs";
import { promisify } from "util";
import { spawn } from "child_process";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from 'url';
import archiver from 'archiver';
import AdmZip from 'adm-zip';

// Get the directory name of the current module
const __dirname = dirname(fileURLToPath(import.meta.url));

// Create var directory if it doesn't exist
const varDir = join(__dirname, "var");
const zipPath = join(varDir, "LCSC.elibz");

console.log('Initializing with paths:', {
  varDir,
  zipPath
});

await mkdir(varDir, { recursive: true }).catch((err) => {
  console.error('Error creating var directory:', err);
});

// Initialize zip file
let zip;
if (existsSync(zipPath)) {
  console.log('Loading existing zip file');
  zip = new AdmZip(zipPath);
} else {
  console.log('Creating new zip file');
  zip = new AdmZip();
}

export async function searchPart(partNumber) {
  console.log(`Searching for part: ${partNumber}`);
  
  // Search for the part
  const res = (await product(partNumber))
    .filter(r => r?.stock > 0)
    .slice(0, 1);

  console.log(`Found ${res.length} results`);

  if (res.length === 0) {
    throw new Error('No results found for this part number');
  }

  const resultPath = join(varDir, "result.json");
  await writeFile(resultPath, JSON.stringify(res, null, 4));
  console.log('Wrote results to:', resultPath);

  console.log('Fetching device information...');
  const devices = Object.assign(
    ...(await Promise.all(
      res
        .map((r) => r?.device_info?.uuid)
        .filter(Boolean)
        .map((uuid) => device(uuid))
    ))
  );

  console.log('Extracting symbol information...');
  const symbols = Object.assign(
    ...(
      res
        .map((r) => r?.device_info?.symbol_info)
        .filter(Boolean)
        .map((symbol_info) => extract(symbol_info))
    )
  );

  console.log('Extracting footprint information...');
  const footprints = Object.assign(
    ...(
      res
        .map((r) => r?.device_info?.footprint_info)
        .filter(Boolean)
        .map((footprint_info) => extract(footprint_info))
    )
  );

  const deviceJsonEntry = zip.getEntry("device.json");
  let oldData = { devices: {}, symbols: {}, footprints: {} };

  if (deviceJsonEntry) {
    console.log('Loading existing device.json from zip');
    const content = deviceJsonEntry.getData().toString('utf8');
    oldData = JSON.parse(content);
  }

  oldData.devices = { ...oldData.devices, ...devices };
  oldData.symbols = { ...oldData.symbols, ...symbols };
  oldData.footprints = { ...oldData.footprints, ...footprints };

  console.log('Adding device.json to zip');
  zip.addFile("device.json", Buffer.from(JSON.stringify(oldData, null, 4)));

  // dump the symbol and footprint data
  console.log('Adding symbol and footprint data to zip');
  await Promise.all(
    res.map(async (r) => {
      const sym = r.device_info?.symbol_info;
      const ftp = r.device_info?.footprint_info;

      if (sym?.dataStr && ftp?.dataStr) {
        const symPath = `SYMBOL/${sym.uuid}.esym`;
        zip.addFile(symPath, Buffer.from(sym.dataStr));
        const fpPath = `FOOTPRINT/${ftp.uuid}.efoo`;
        zip.addFile(fpPath, Buffer.from(ftp.dataStr));
        console.log('Added files:', symPath, fpPath);
      }
    })
  );

  console.log('Writing zip file to:', zipPath);
  zip.writeZip(zipPath);
  return res;
} 