// build-us-map-svg.mjs
// Generates public/us-states.svg with one <path id="CA"> per state.
// Alaska & Hawaii are insets via Albers USA.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { feature } from "topojson-client";
import { geoAlbersUsa, geoPath } from "d3-geo";

const require = createRequire(import.meta.url);
const statesTopo = require("us-atlas/states-10m.json");

// USPS codes by 2-digit FIPS (add "11":"DC" if you want DC)
const FIPS_TO_USPS = {
  "01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE",
  /*"11":"DC",*/ "12":"FL","13":"GA","15":"HI","16":"ID","17":"IL","18":"IN","19":"IA",
  "20":"KS","21":"KY","22":"LA","23":"ME","24":"MD","25":"MA","26":"MI","27":"MN",
  "28":"MS","29":"MO","30":"MT","31":"NE","32":"NV","33":"NH","34":"NJ","35":"NM",
  "36":"NY","37":"NC","38":"ND","39":"OH","40":"OK","41":"OR","42":"PA","44":"RI",
  "45":"SC","46":"SD","47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA",
  "54":"WV","55":"WI","56":"WY"
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const WIDTH  = 960;
const HEIGHT = 600;
const OUT_DIR = path.join(__dirname, "public");
const OUT_FILE = path.join(OUT_DIR, "us-states.svg");

const statesFC = feature(statesTopo, statesTopo.objects.states);

// Albers USA puts AK/HI as insets
const projection = geoAlbersUsa();

// Fit the PROJECTION (not the path) to the feature collection
// (Use a small padding so strokes don't clip the edges)
projection.fitExtent([[5, 5], [WIDTH - 5, HEIGHT - 5]], statesFC);

// Now make the path generator from the fitted projection
const pathGen = geoPath(projection);

let svg = "";
svg += `<?xml version="1.0" encoding="UTF-8"?>\n`;
svg += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" role="img" aria-label="US States map">\n`;
svg += `  <style>
    .state { fill:#e5e7eb; stroke:#ffffff; stroke-width:1; vector-effect:non-scaling-stroke; }
    .state:hover { fill:#c7d2fe; }
  </style>\n`;
svg += `  <g id="states">\n`;

for (const f of statesFC.features) {
  const fips = String(f.id).padStart(2, "0");
  const usps = FIPS_TO_USPS[fips];
  if (!usps) continue; // skip non-states (e.g., DC if omitted)
  const d = pathGen(f);
  const name = f.properties?.name || usps;
  svg += `    <path id="${usps}" class="state" data-name="${name}" d="${d}"/>\n`;
}

svg += `  </g>\n</svg>\n`;

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_FILE, svg, "utf8");

console.log(`✓ Wrote ${path.relative(process.cwd(), OUT_FILE)} (${WIDTH}×${HEIGHT})`);
