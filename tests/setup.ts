// Loaded once per test file. Wire env vars for tests.
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env.test.local", override: true }); // optional overrides
