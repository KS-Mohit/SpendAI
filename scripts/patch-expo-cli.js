const fs = require('fs');
const path = require('path');

const filePath = path.join(
  __dirname,
  '../node_modules/expo/node_modules/@expo/cli/build/src/run/android/resolveGradlePropsAsync.js'
);

let content = fs.readFileSync(filePath, 'utf8');

const original = `return validAbis.filter((abi, i, arr)=>arr.indexOf(abi) === i).join(',');`;
const patched = `return validAbis.filter((abi, i, arr)=>arr.indexOf(abi) === i).filter((abi)=>abi === 'arm64-v8a').join(',');`;

if (content.includes(original)) {
  content = content.replace(original, patched);
  fs.writeFileSync(filePath, content);
  console.log('✅ Patch applied successfully');
} else if (content.includes(patched)) {
  console.log('✅ Patch already applied');
} else {
  console.error('❌ Could not find target line — file may have changed');
}