import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { CardBack } from "../src/components/CardBack";

const html = renderToStaticMarkup(
  <>
    <CardBack tier="member" />
    <CardBack tier="standard" />
    <CardBack tier="member" />
    <CardBack tier="standard" />
  </>,
);
const ids = [...html.matchAll(/<pattern id="([^"]+)"/g)].map((m) => m[1]);
const fills = [...html.matchAll(/fill="url\(#(fm-fractal-hex-[^)]+)\)"/g)].map((m) => m[1]);
assert.equal(ids.length, 4);
assert.equal(new Set(ids).size, 4);
assert.deepEqual(fills, ids);
console.log("Each card back has its own matching SVG pattern.");
