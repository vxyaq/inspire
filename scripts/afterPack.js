const fs = require("fs")
const path = require("path")

exports.default = async function (context) {
  const dir = context.appOutDir
  for (const file of ["LICENSES.chromium.html"]) {
    const target = path.join(dir, file)
    try {
      await fs.promises.unlink(target)
    } catch {}
  }
}
