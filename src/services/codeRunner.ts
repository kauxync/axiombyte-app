/**
 * Code Execution Service
 * Supports multi-provider execution (Wandbox, Piston fallback)
 * and client-side web execution (HTML, CSS, JavaScript).
 */

export interface ExecutionResult {
  success: boolean;
  output: string;
  isError: boolean;
  language: string;
  version?: string;
}

const PISTON_LANGUAGE_MAP: Record<string, string> = {
  c: 'c',
  cpp: 'c++',
  'c++': 'c++',
  python: 'python',
  py: 'python',
  python3: 'python',
  rust: 'rust',
  rs: 'rust',
  asm: 'nasm',
  nasm: 'nasm',
  assembly: 'nasm',
  java: 'java',
  javascript: 'javascript',
  js: 'javascript',
  typescript: 'typescript',
  ts: 'typescript',
  go: 'go',
  golang: 'go',
  sql: 'sqlite3',
  sqlite: 'sqlite3',
  sqlite3: 'sqlite3',
  bash: 'bash',
  sh: 'bash',
  csharp: 'csharp',
  'c#': 'csharp',
  cs: 'csharp',
};

const WANDBOX_COMPILER_MAP: Record<string, string> = {
  c: 'gcc-head-c',
  cpp: 'gcc-head',
  'c++': 'gcc-head',
  python: 'cpython-head',
  py: 'cpython-head',
  python3: 'cpython-head',
  rust: 'rust-head',
  rs: 'rust-head',
  java: 'openjdk-head',
  javascript: 'nodejs-head',
  js: 'nodejs-head',
  typescript: 'typescript-head',
  ts: 'typescript-head',
  go: 'go-head',
  golang: 'go-head',
  bash: 'bash',
  sh: 'bash',
  csharp: 'dotnetcore-head',
  'c#': 'dotnetcore-head',
  cs: 'dotnetcore-head',
  sql: 'sqlite-head',
  sqlite: 'sqlite-head',
  sqlite3: 'sqlite-head',
};

/**
 * Checks if a language is a web/browser frontend language rendered visually (HTML, CSS, JS)
 */
export function isWebLanguage(lang?: string): boolean {
  if (!lang) return false;
  const clean = lang.trim().toLowerCase();
  return (
    clean === 'html' ||
    clean === 'htm' ||
    clean === 'css' ||
    clean === 'javascript' ||
    clean === 'js'
  );
}

/**
 * Checks if a language is executable or previewable
 */
export function isLanguageRunnable(lang?: string): boolean {
  if (!lang) return false;
  const clean = lang.trim().toLowerCase();
  return isWebLanguage(clean) || clean in WANDBOX_COMPILER_MAP || clean in PISTON_LANGUAGE_MAP;
}

/**
 * Executes code via Wandbox API (Open, unauthenticated, highly reliable)
 */
async function executeWithWandbox(
  compiler: string,
  sourceCode: string,
  language: string
): Promise<ExecutionResult | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch('https://wandbox.org/api/compile.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        code: sourceCode,
        compiler,
        options: '',
        stdin: '',
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    const status = String(data.status ?? '');
    const isSuccess = status === '0';

    // Compilation error / compiler diagnostics
    const compilerError = (data.compiler_error || '').trim();
    const compilerMessage = (data.compiler_message || '').trim();
    if (!isSuccess && (compilerError || compilerMessage)) {
      return {
        success: false,
        output: compilerError || compilerMessage,
        isError: true,
        language,
      };
    }

    // Program stdout and stderr
    const stdout = (data.program_output || '').trim();
    const stderr = (data.program_error || '').trim();

    if (stderr && stdout) {
      return {
        success: isSuccess,
        output: `${stdout}\n\n[Diagnostics / Stderr]:\n${stderr}`,
        isError: !isSuccess,
        language,
      };
    }

    if (stderr && !stdout) {
      return {
        success: isSuccess,
        output: stderr,
        isError: !isSuccess,
        language,
      };
    }

    return {
      success: isSuccess,
      output: stdout || (isSuccess ? 'Program exited 0 with no stdout.' : `Process exited with code ${status}.`),
      isError: !isSuccess,
      language,
    };
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

/**
 * Executes source code via Piston API
 */
async function executeWithPiston(
  targetLang: string,
  sourceCode: string
): Promise<ExecutionResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch('https://emkc.org/api/v2/piston/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        language: targetLang,
        version: '*',
        files: [{ content: sourceCode }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.status === 401) {
      return {
        success: false,
        output: 'Runner service is currently restricted by the public upstream server (HTTP 401 Unauthorized). Please try again shortly or check compiler support.',
        isError: true,
        language: targetLang,
      };
    }

    if (!res.ok) {
      return {
        success: false,
        output: `Runner server returned HTTP ${res.status}.`,
        isError: true,
        language: targetLang,
      };
    }

    const json = await res.json();

    // Check for compilation failure (C, C++, Rust, Java, etc.)
    if (json.compile && json.compile.code !== 0 && json.compile.stderr) {
      return {
        success: false,
        output: json.compile.stderr.trim(),
        isError: true,
        language: targetLang,
        version: json.version,
      };
    }

    // Check runtime output
    if (json.run) {
      const stdout = (json.run.stdout || '').trim();
      const stderr = (json.run.stderr || '').trim();

      if (stderr && !stdout) {
        return {
          success: false,
          output: stderr,
          isError: true,
          language: targetLang,
          version: json.version,
        };
      }

      if (stderr && stdout) {
        return {
          success: true,
          output: `${stdout}\n\n[Stderr / Diagnostics]:\n${stderr}`,
          isError: false,
          language: targetLang,
          version: json.version,
        };
      }

      return {
        success: true,
        output: stdout || 'Program exited 0 with no stdout.',
        isError: false,
        language: targetLang,
        version: json.version,
      };
    }

    if (json.message) {
      return {
        success: false,
        output: `Notice: ${json.message}`,
        isError: true,
        language: targetLang,
      };
    }

    return {
      success: true,
      output: 'Execution complete.',
      isError: false,
      language: targetLang,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err?.name === 'AbortError') {
      return {
        success: false,
        output: 'Execution timed out (15 second safety limit). Check for infinite loops.',
        isError: true,
        language: targetLang,
      };
    }

    return {
      success: false,
      output: 'Network error: Unable to reach compiler server. Please check your internet connection.',
      isError: true,
      language: targetLang,
    };
  }
}

/**
 * Executes source code across multi-provider runner (Wandbox with Piston fallback)
 */
export async function executeCodeWithPiston(
  language: string,
  sourceCode: string
): Promise<ExecutionResult> {
  const cleanLang = (language || 'c').trim().toLowerCase();
  const targetLang = PISTON_LANGUAGE_MAP[cleanLang] || cleanLang;

  if (!sourceCode.trim()) {
    return {
      success: false,
      output: 'Source code cannot be empty.',
      isError: true,
      language: targetLang,
    };
  }

  // 1. Try Wandbox primary execution engine
  const wandboxCompiler = WANDBOX_COMPILER_MAP[cleanLang];
  if (wandboxCompiler) {
    const wandboxResult = await executeWithWandbox(wandboxCompiler, sourceCode, cleanLang);
    if (wandboxResult) {
      return wandboxResult;
    }
  }

  // 2. Fall back to Piston execution engine
  return executeWithPiston(targetLang, sourceCode);
}

// Alias for modern syntax
export const executeCode = executeCodeWithPiston;
