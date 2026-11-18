const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Runs Apps Script files in one shared context, like Apps Script does.
function loadGs(files) {
  const ctx = vm.createContext({ console });
  for (const f of files) {
    const code = fs.readFileSync(path.join(__dirname, '..', 'backend', f), 'utf8');
    vm.runInContext(code, ctx, { filename: f });
  }
  return ctx;
}

module.exports = { loadGs };
