const fs = require("fs")

for (const folder of ["lib", "bundles"]) {
  if (fs.existsSync(folder)) {
    fs.rmSync(folder, { recursive: true, force: true })
    console.log(`Deleted ${folder}`)
  }
}
