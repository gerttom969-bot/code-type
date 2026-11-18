import { validateCode } from "../domain/validation.js";

/** Browser Python execution adapter. It is intentionally NOT described as a sandbox. */
export class PyodideRunner {
  #runtime = null;
  #loading = null;
  #loadRuntime;

  constructor(loadRuntime = () => globalThis.loadPyodide()) {
    this.#loadRuntime = loadRuntime;
  }

  get ready() {
    return this.#runtime !== null;
  }

  async initialize() {
    if (this.#runtime) return true;
    if (!this.#loading) {
      this.#loading = Promise.resolve().then(() => this.#loadRuntime()).then(runtime => {
        this.#runtime = runtime;
        return true;
      }).finally(() => {
        this.#loading = null;
      });
    }
    return this.#loading;
  }

  async run(code) {
    const validation = validateCode(code);
    if (!validation.valid) return { output: validation.message, error: true };
    return this.#execute(String(code), "");
  }

  async runFunctionTests(userCode, testCode) {
    const validation = validateCode(userCode);
    if (!validation.valid) return { passed: false, output: validation.message };
    const result = await this.#execute(`${userCode}\n\n${testCode}`, "");
    return {
      passed: !result.error && result.output.includes("ALL_PASSED"),
      output: result.output
    };
  }

  async runStdin(code, stdin) {
    const validation = validateCode(code);
    if (!validation.valid) return { output: "", error: validation.message };
    const result = await this.#execute(String(code), String(stdin ?? ""));
    return { output: result.output.trim(), error: result.error ? result.output : null };
  }

  async #execute(code, stdin) {
    if (!this.#runtime) return { output: "Python is still loading.", error: true };
    // SECURITY BOUNDARY: Python can import js/pyodide_js and reach the page's browser APIs.
    // Do not run code from other people. This adapter is for the user's own learning code only.
    const runtime = this.#runtime;
    try {
      runtime.runPython(`import sys, io\n_codetype_old_stdout = sys.stdout\n_codetype_old_stdin = sys.stdin\n_codetype_capture = io.StringIO()\nsys.stdout = _codetype_capture\nsys.stdin = io.StringIO(${JSON.stringify(stdin)})`);
      await runtime.runPythonAsync(code);
      const output = runtime.runPython("_codetype_capture.getvalue()");
      return { output: output || "(no output)", error: false };
    } catch (error) {
      return { output: String(error?.message ?? error), error: true };
    } finally {
      try {
        runtime.runPython("sys.stdout = _codetype_old_stdout\nsys.stdin = _codetype_old_stdin");
      } catch {
        // A user's Python can overwrite interpreter globals. That is another reason this is not isolation.
      }
    }
  }
}
