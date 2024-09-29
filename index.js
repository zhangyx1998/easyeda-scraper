import { product, device, extract, search} from "./search.js";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { spawn } from "node:child_process";
import { rename } from "fs/promises";
import { join } from "path";
import { resolve } from "node:path";
import { zipDirectories } from "./zip.js";

const productList = (await search("TPS25750"))

await writeFile("list.json", JSON.stringify(productList, null, 4));

// Search example
const res = (await product("TPS25750"))
            .filter(r => r?.stock > 0)
            .slice(0, 100);

await writeFile("result.json", JSON.stringify(res, null, 4));

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

await mkdir("var", { recursive: true }).catch(() => {});
await mkdir("var/FOOTPRINT", { recursive: true }).catch(() => {});
await mkdir("var/SYMBOL", { recursive: true }).catch(() => {});
await writeFile("var/device.json", JSON.stringify({ devices, symbols, footprints}, null, 4));

// dump the symbol and footprint data
await Promise.all(
  res.map(async (r) => {
    const sym = r.device_info?.symbol_info;
    const ftp = r.device_info?.footprint_info;

    if (sym?.dataStr && ftp?.dataStr) {
      const symPath = `var/SYMBOL/${sym.uuid}.esym`;
      await writeFile(symPath, sym.dataStr);
      const fpPath = `var/FOOTPRINT/${ftp.uuid}.efoo`;
      await writeFile(fpPath, ftp.dataStr);
    }
  })
);

const cwd = process.cwd();

const directories = (
  await readdir("var", { withFileTypes: true })
).map((dirent) => "var/" + dirent.name);

const outputZipPath = join(cwd, "LCSC.elibz");

zipDirectories(directories, outputZipPath)
  .then(() => console.log('Zipping completed successfully.'))
  .catch((error) => console.error(`Error while zipping: ${error.message}`));

// await new Promise((resolve, reject) => {
//   const zip = spawn("zip", ["-r", "LCSC.elibz", ...directories], { cwd: "var" });
//   zip.on("exit", (code) => {
//     if (code === 0) {
//       resolve();
//     } else {
//       reject(new Error("Failed to zip the files"));
//     }
//   }); 
// });

// await rename(join(cwd, "var/LCSC.elibz"), join(cwd, "LCSC.elibz"), (err) => {
//   if (err) {
//       console.error("Error moving the file:", err);
//   } else {
//       console.log("File has been moved successfully.");
//   }
// });
