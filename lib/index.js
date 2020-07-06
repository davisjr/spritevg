const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
var camelCase = require("lodash.camelcase");

const OUTPUT_SVG = path.normalize("./sprite.svg");
const OUTPUT_MAPPING = path.normalize("./sprite.js");

var enumerateFiles = function (dir) {
  let svgFiles = [];

  let files = fs.readdirSync(dir, { withFileTypes: true });
  files &&
    files.forEach((dirent) => {
      let filePath = path.normalize(path.join(dir, dirent.name));

      if (dirent.isDirectory()) {
        let deepFiles = enumerateFiles(filePath);
        svgFiles.push(...deepFiles);
      } else if (path.extname(filePath) == ".svg" && filePath != OUTPUT_SVG) {
        svgFiles.push(filePath);
      }
    });

  return svgFiles;
};

var readFile = function (file) {
  return fs.readFileSync(file);
};

var transformSVG = function (svg) {
  let dom = JSDOM.fragment(svg);

  let root = dom.firstElementChild;
  let w = root.attributes.width.value;
  let h = root.attributes.height.value;

  let g = root.firstElementChild;
  let id = g.attributes.id.value;

  if (!id || !w || !h) {
    return;
  }

  w && g.setAttribute("width", w);
  h && g.setAttribute("height", h);

  updateFillColor(g);

  let shape = {
    id: id,
    width: w,
    height: h,
    contents: g,
  };
  return shape;
};

var updateFillColor = function (node) {
  node.attributes.fill &&
    node.attributes.fill.value == "#212121" &&
    node.setAttribute("fill", "currentColor");
  node.children &&
    Array.from(node.children).forEach((childNode) =>
      updateFillColor(childNode)
    );
};

var generateSprite = function (shapes) {
  let svg = '<svg xmlns="http://www.w3.org/2000/svg">\n'; // style="fill: currentColor;';
  shapes.forEach((shape) => {
    svg += shape.contents.outerHTML + "\n";
  });
  svg += "</svg>";
  return svg;
};

var generateMapping = function (shapes) {
  let js = "const SpriteIcons = {\n";

  shapes
    .sort((first, second) => (first.id > second.id ? 1 : -1))
    .forEach((shape) => {
      let jsId = generateId(shape.id);
      js +=
        "\t" +
        jsId +
        ": { id: '" +
        shape.id +
        "', width: " +
        shape.width +
        ", height: " +
        shape.height +
        " },\n";
    });

  js += "};\n";
  return js;
};

var generateId = function (text) {
  let id = camelCase(text);
  id = id.replace(/^([0-9])/i, "_$1");
  return id;
};

var saveFile = function (file, contents) {
  fs.writeFileSync(file, contents);
};

var spritevg = function (dir) {
  console.info("Scanning directory " + path.normalize(dir) + "...");
  let files = enumerateFiles(dir);
  console.info(files.length + " SVGs found.");

  if (!files) {
    console.info("Done.");
    return;
  }

  console.info("Generating sprite...");
  let shapes = files.map((file) => {
    let originalSVG = readFile(file);
    let shape = transformSVG(originalSVG);
    return shape;
  });

  let svg = generateSprite(shapes);
  saveFile(OUTPUT_SVG, svg);
  console.info("Created sprite " + OUTPUT_SVG + ".");

  let js = generateMapping(shapes);
  saveFile(OUTPUT_MAPPING, js);
  console.info("Created mapping " + OUTPUT_MAPPING + ".");
  console.info("Done.");
};

module.exports = spritevg;
