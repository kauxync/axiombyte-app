/**
 * Piston & Web Code Execution Service
 * Supports backend execution (C, C++, Python, Rust, Assembly, Java, Go, etc.)
 * and client-side web execution (HTML, CSS, JavaScript).
 */

export interface ExecutionResult {
  success: boolean;
  output: string;
  isError: boolean;
  language: string;
  version?: string;
}

const LANGUAGE_MAP: Record<string, string> = {
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
  return isWebLanguage(clean) || clean in LANGUAGE_MAP;
}

/**
 * Executes source code via Piston API (for backend CLI languages)
 */
export async function executeCodeWithPiston(
  language: string,
  sourceCode: string
): Promise<ExecutionResult> {
  const cleanLang = (language || 'c').trim().toLowerCase();
  const targetLang = LANGUAGE_MAP[cleanLang] || cleanLang;

  if (!sourceCode.trim()) {
    return {
      success: false,
      output: 'Source code cannot be empty.',
      isError: true,
      language: targetLang,
    };
  }

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
        output: `Piston Notice: ${json.message}`,
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
      output: 'Network error: Unable to reach compiler server. Please check internet connection.',
      isError: true,
      language: targetLang,
    };
  }
}
