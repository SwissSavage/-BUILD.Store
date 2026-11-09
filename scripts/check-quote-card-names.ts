import assert from "node:assert/strict";
import { quoteCardName } from "../src/lib/quote-card-name";

const person = {
  firstName: "Daniel",
  lastName: "Smith",
  handle: "daniel",
  displayName: null,
  profileMode: "contributor" as const,
};

assert.equal(quoteCardName(person), "Daniel S.");
assert.equal(quoteCardName({ ...person, firstName: "Danielle" }), "Daniel… S.");
assert.equal(quoteCardName({ ...person, firstName: "Natalie", lastName: null }), "Natali…");
assert.equal(quoteCardName({ ...person, profileMode: "epk", displayName: "The Artist" }), "The Artist");
assert.equal(quoteCardName({ ...person, firstName: null }), "@daniel");
console.log("Quote card names preserve short names, aliases, and the long-name cutoff.");
