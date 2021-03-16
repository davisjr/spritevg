const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const camelCase = require("lodash.camelcase");
const upperFirst = require("lodash.upperfirst");
const { dirname } = require("path");
const svgr = require("@svgr/core").default;
const SVGO = require("svgo");

const OUTPUT_FOLDER = "./output";
const OUTPUT_SVG = "sprite.svg";
const OUTPUT_MAPPING = "sprite.js";

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
  let svg = "";
  shapes.forEach((shape) => {
    svg += shape.contents.outerHTML + "\n";
  });
  return createSvg(svg);
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

var generateAndSaveOptimizedSvgs = function (shapes) {
  // let svgo = new SVGO();

  shapes.forEach((shape) => {
    let id = generateId(shape.id, true);
    let fileName = `${id}.svg`;
    let file = path.join("svg", fileName);
    let svg = createSvg(shape.contents.outerHTML, shape.width, shape.height);

    // svgo.optimize(svg, { path: file }).then(function (result) {
    //   saveFile(result.path, result.data);
    // });

    let optimizedSvg = svgr.sync(svg, {
      plugins: [
        "@svgr/plugin-svgo",
        // "@svgr/plugin-prettier",
      ],
    });

    saveFile(file, optimizedSvg);
  });
};

var generateAndSaveReactComponents = function (shapes) {
  shapes.forEach((shape) => {
    let component = generateId(shape.id, true);
    let svg = createSvg(shape.contents.outerHTML, shape.width, shape.height);

    let tsx = svgr.sync(
      svg,
      {
        plugins: [
          "@svgr/plugin-svgo",
          "@svgr/plugin-jsx",
          // "@svgr/plugin-prettier",
        ],
      },
      { componentName: component }
    );

    let fileName = `${component}.tsx`;
    let file = path.join("tsx", fileName);
    saveFile(file, tsx);
  });
};

var generateId = function (text, upperCamelCase) {
  let id = camelCase(text);
  id = id.replace(/^([0-9])/i, "x$1");
  upperCamelCase && (id = upperFirst(id));
  return id;
};

var createSvg = function (contents, width, height) {
  let attrs = ' style="fill: currentColor"';
  width && (attrs += ` width="${width}"`);
  height && (attrs += ` height="${height}"`);
  width && height && (attrs += ` viewBox="0 0 ${width} ${height}"`);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${contents}</svg>`;
  return svg;
};

var saveFile = function (file, contents) {
  let dir = path.join(OUTPUT_FOLDER, dirname(file));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_FOLDER, file), contents);
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

  console.info("Creating sprite " + OUTPUT_SVG + "...");
  let svg = generateSprite(shapes);
  saveFile(OUTPUT_SVG, svg);

  console.info("Creating mapping " + OUTPUT_MAPPING + "...");
  let js = generateMapping(shapes);
  saveFile(OUTPUT_MAPPING, js);

  console.info("Creating optimized SVGs...");
  generateAndSaveOptimizedSvgs(shapes);

  console.info("Creating React components...");
  generateAndSaveReactComponents(shapes);

  console.info("Done.");
};

module.exports = spritevg;
