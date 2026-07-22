const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..', '..');

function filesUnder(directory, extension) {
  const output = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...filesUnder(absolute, extension));
    else if (entry.name.endsWith(extension)) output.push(absolute);
  }
  return output;
}

test('every literal frontend API call has a server route contract', () => {
  const frontend = filesUnder(path.join(root, 'src'), '.ts')
    .concat(filesUnder(path.join(root, 'src'), '.tsx'))
    .map((file) => fs.readFileSync(file, 'utf8'))
    .join('\n');
  const server = [path.join(root, 'server.cjs'), ...filesUnder(path.join(root, 'server'), '.cjs')]
    .map((file) => fs.readFileSync(file, 'utf8'))
    .join('\n');
  const routes = [...new Set(frontend.match(/\/api\/[a-zA-Z0-9_./:-]+/g) || [])]
    .filter((route) => !route.includes(':'))
    .map((route) => route.replace(/\/$/, ''));
  const missing = routes.filter((route) =>
    !server.includes(`'${route}'`)
    && !server.includes(`'${route}/`)
    && !server.includes(`\`${route}\``)
    && !server.includes(`\`${route}/`),
  );
  assert.deepEqual(missing, []);
});
