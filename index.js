import { product, device } from "./search.js";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { spawn } from "node:child_process";

// Search example
const res = await product("LM324");

const devices = Object.assign(
  ...(await Promise.all(
    res
      .map((r) => r?.device_info?.uuid)
      .filter(Boolean)
      .map((uuid) => device(uuid))
  ))
);

await mkdir("var", { recursive: true }).catch(() => { });
await mkdir("var/FOOTPRINT", { recursive: true }).catch(() => { });
await mkdir("var/SYMBOL", { recursive: true }).catch(() => { });
await writeFile("var/devices.json", JSON.stringify({ devices }, null, 2));

// dump the symbol and footprint data
await Promise.all(
  res
    .map(async (r) => {
      const sym = r.device_info?.symbol_info;
      const ftp = r.device_info?.footprint_info;

      if (sym?.dataStr && ftp?.dataStr) {
        const symPath = `var/SYMBOL/${sym.uuid}.esym`;
        await writeFile(symPath, sym.dataStr);
        const fpPath = `var/FOOTPRINT/${ftp.uuid}.esym`;
        await writeFile(fpPath, ftp.dataStr);
      }
    })
);

const getDirectories = async source =>
  (await readdir(source, { withFileTypes: true }))
    .map(dirent => dirent.name)

const directories = await getDirectories("var");
console.log(directories);

spawn("zip", ["-r", "LCSC.elibz", ...directories], { cwd: "var"});
