import { webcrypto } from "crypto";

require("./test.setup");

// Web Specific Setup
Object.defineProperty(window, "crypto", {
  value: webcrypto,
});
