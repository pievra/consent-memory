// Lists the bundled Autoconsent rules whose self test reads stored consent state
// (a cookie or the CMP's own API). Every other self test only checks that the
// banner is no longer visible, which is not evidence that a refusal was stored.
// Run after every Autoconsent upgrade: `node scripts/gen-state-tests.mjs`.
import { readFileSync, writeFileSync } from 'node:fs';

const rules = JSON.parse(readFileSync('node_modules/@duckduckgo/autoconsent/rules/rules.json', 'utf8')).autoconsent;
const flatten = (steps, acc = []) => {
  for (const step of steps ?? []) {
    acc.push(step);
    for (const key of ['if', 'then', 'else', 'any']) {
      if (step[key]) flatten(Array.isArray(step[key]) ? step[key] : [step[key]], acc);
    }
  }
  return acc;
};
export function stateTestNames() {
  return rules
    .filter((rule) => flatten(rule.test).some((step) => 'eval' in step || 'cookieContains' in step))
    .map((rule) => rule.name)
    .sort();
}
if (process.argv[1]?.endsWith('gen-state-tests.mjs')) {
  const names = stateTestNames();
  writeFileSync('src/engines/autoconsent/state-tests.json', JSON.stringify(names) + '\n');
  console.log(`${names.length} of ${rules.length} JSON rules have a state reading self test`);
}
