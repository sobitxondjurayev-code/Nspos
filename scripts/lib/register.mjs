// `node --import ./scripts/lib/register.mjs ...` bilan ishlatiladi.
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./loader.mjs", pathToFileURL(import.meta.filename));
