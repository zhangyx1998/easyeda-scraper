import { product, device } from "./search.js";
import { mkdir, writeFile } from "node:fs/promises";

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

await mkdir("var", { recursive: true }).catch(() => {});
await mkdir("var/FOOTPRINT", { recursive: true }).catch(() => {});
await mkdir("var/SYMBOL", { recursive: true }).catch(() => {});
await writeFile("var/devices.json", JSON.stringify(devices, null, 2));
