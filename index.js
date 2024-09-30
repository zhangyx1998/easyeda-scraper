import { product, device, extract, search } from "./search.js";
import { mkdir, readdir, writeFile, rename } from "fs/promises";
import { createWriteStream, existsSync} from "fs";
import { promisify } from "util";
import { spawn } from "child_process";
import { join, resolve } from "path";
import archiver from 'archiver';
import AdmZip from 'adm-zip';

await mkdir("var", { recursive: true }).catch(() => { });
const zipPath = "var/LCSC.elibz";

let zip;
if (existsSync(zipPath)) {
  zip = new AdmZip(zipPath);
} else {
  zip = new AdmZip();
}

// TODO: UNDER TEST
const productList = (await search("LM324"))
  .slice(0, 100)
  .filter(r => r?.stockNumber > 0);

// await writeFile("list.json", JSON.stringify(productList, null, 4));

// Search example
const res = (await product("LM324"))
  .filter(r => r?.stock > 0)
  .slice(0, 10);

// await writeFile("result.json", JSON.stringify(res, null, 4));

const devices = Object.assign(
  ...(await Promise.all(
    res
      .map((r) => r?.device_info?.uuid)
      .filter(Boolean)
      .map((uuid) => device(uuid))
  ))
);

const symbols = Object.assign(
  ...(
    res
      .map((r) => r?.device_info?.symbol_info)
      .filter(Boolean)
      .map((symbol_info) => extract(symbol_info))
  )
);

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
  const content = deviceJsonEntry.getData().toString('utf8');
  oldData = JSON.parse(content);
}

oldData.devices = { ...oldData.devices, ...devices };
oldData.symbols = { ...oldData.symbols, ...symbols };
oldData.footprints = { ...oldData.footprints, ...footprints };

zip.addFile("device.json", Buffer.from(JSON.stringify(oldData, null, 4)));



// dump the symbol and footprint data
await Promise.all(
  res.map(async (r) => {
    const sym = r.device_info?.symbol_info;
    const ftp = r.device_info?.footprint_info;

    if (sym?.dataStr && ftp?.dataStr) {
      const symPath = `SYMBOL/${sym.uuid}.esym`;
      zip.addFile(symPath, Buffer.from(sym.dataStr));
      const fpPath = `FOOTPRINT/${ftp.uuid}.efoo`;
      zip.addFile(fpPath, Buffer.from(ftp.dataStr));
    }
  })
);

// await archive.finalize();
zip.writeZip(zipPath);