// Auto-generated bundled serverless function for JugaadVision

var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// api-src/test.ts
var test_exports = {};
__export(test_exports, {
  default: () => handler
});
module.exports = __toCommonJS(test_exports);
async function handler(req, res) {
  const data = {
    success: true,
    nodeVersion: typeof process !== "undefined" ? process.version : "edge",
    platform: typeof process !== "undefined" ? process.platform : "edge",
    hasRes: !!res,
    isReqInstanceOfRequest: typeof Request !== "undefined" && req instanceof Request,
    url: req?.url || "unknown"
  };
  if (res && typeof res.status === "function") {
    return res.status(200).json(data);
  }
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
