import { useState, useEffect, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Play, CheckCircle2, Circle, ChevronDown, ExternalLink, RotateCcw, Copy, Check, Loader2, Terminal, BookOpen, FlaskConical, ChevronRight, Code2, Flame, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { problemApi, compileApi } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Example {
  input: string;
  output: string;
  explanation: string;
}

interface TestCase {
  input: string;
  expectedOutput: string;
  isHidden: boolean;
}

interface Problem {
  _id: string;
  title: string;
  slug: string;
  difficulty: "Easy" | "Medium" | "Hard";
  frequency: number;
  description: string;
  examples: Example[];
  testCases: TestCase[];
  starterCode: { python: string; javascript: string; cpp: string; java: string };
  topicTag: string;
  leetcodeUrl: string;
  companies?: string[];
  solutionArticle?: string;
  hiddenTestCaseCount?: number;
  totalTestCaseCount?: number;
  userStatus: "solved" | "attempted" | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const LANGUAGES = [
  { id: "python", label: "Python", ext: "py" },
  { id: "javascript", label: "JavaScript", ext: "js" },
  { id: "cpp", label: "C++", ext: "cpp" },
  { id: "java", label: "Java", ext: "java" },
] as const;

type LangId = (typeof LANGUAGES)[number]["id"];

const CODE_SUGGESTIONS: Record<LangId, string[]> = {
  python: ["def solve():", "for i in range(n):", "if x == y:", "return result", "print(result)"],
  javascript: ["function solve() {", "for (let i = 0; i < n; i++) {", "if (x === y) {", "return result;", "console.log(result);"],
  cpp: ["#include <bits/stdc++.h>", "int main() {", "for (int i = 0; i < n; i++) {", "if (x == y) {", "return 0;"],
  java: ["public class Solution {", "public static void main(String[] args) {", "for (int i = 0; i < n; i++) {", "if (x == y) {", "return;"],
};

const DIFFICULTY_STYLES: Record<string, string> = {
  Easy: "bg-green-100 text-green-700 border-green-200",
  Medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  Hard: "bg-red-100 text-red-700 border-red-200",
};

// ─── Markdown-ish renderer ────────────────────────────────────────────────────
function renderDescription(text: string) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="px-1.5 py-0.5 bg-slate-100 text-blue-700 rounded text-[0.85em] font-mono">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part.split("\n").map((line, j) => (
      <span key={`${i}-${j}`}>
        {j > 0 && <br />}
        {line}
      </span>
    ));
  });
}

// ─── Problem Solver ───────────────────────────────────────────────────────────
export default function ProblemSolver() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  // Problem state
  const [problem, setProblem] = useState<Problem | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"description" | "solution" | "testcases">("description");

  // Editor state
  const [language, setLanguage] = useState<LangId>("python");
  const [code, setCode] = useState<Record<LangId, string>>({
    python: "# Loading...",
    javascript: "// Loading...",
    cpp: "// Loading...",
    java: "// Loading...",
  });
  const [customInput, setCustomInput] = useState("");
  const [useCustomInput, setUseCustomInput] = useState(false);

  // Run state
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<{ stdout: string; stderr: string; exitCode: number } | null>(null);
  const [outputTab, setOutputTab] = useState<"output" | "input">("output");
  const [submissionResult, setSubmissionResult] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const [completionOptions, setCompletionOptions] = useState<string[]>([]);
  const [completionPrefix, setCompletionPrefix] = useState("");
  const [activeCompletionIndex, setActiveCompletionIndex] = useState(0);

  // Status
  const [status, setStatus] = useState<"solved" | "attempted" | null>(null);
  const [marking, setMarking] = useState(false);
  const [copied, setCopied] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Load problem ──────────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }
    if (!slug) return;

    setLoading(true);
    problemApi
      .getBySlug(slug)
      .then((data: any) => {
        setProblem(data);
        setStatus(data.userStatus);
        setCode({
          python: data.starterCode?.python || "# Write your solution here\npass",
          javascript: data.starterCode?.javascript || "// Write your solution here",
          cpp: data.starterCode?.cpp || "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    return 0;\n}",
          java: data.starterCode?.java || "public class Solution {\n    public static void main(String[] args) {}\n}",
        });
      })
      .catch((err: any) => {
        setLoadError(err?.message || "Problem not found");
      })
      .finally(() => setLoading(false));
  }, [slug, navigate]);

  const getCompletionPrefix = (value: string, cursor: number) => {
    const lineStart = value.lastIndexOf("\n", cursor - 1) + 1;
    const segment = value.slice(lineStart, cursor);
    const match = segment.match(/[\w$]+$/);
    return match?.[0] || "";
  };

  const updateCompletions = (value: string, cursor: number) => {
    const prefix = getCompletionPrefix(value, cursor);
    const options = prefix ? CODE_SUGGESTIONS[language].filter((item) => item.startsWith(prefix) && item !== prefix) : [];
    setCompletionPrefix(prefix);
    setCompletionOptions(options);
    setActiveCompletionIndex(0);
  };

  const insertCompletion = (completion: string, cursor: number) => {
    const current = code[language];
    const start = cursor - completionPrefix.length;
    const before = current.slice(0, start);
    const after = current.slice(cursor);
    const next = before + completion + after;
    setCode((prev) => ({ ...prev, [language]: next }));
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      const pos = start + completion.length;
      el.selectionStart = el.selectionEnd = pos;
      updateCompletions(next, pos);
      el.focus();
    });
  };

  // ── Tab key in textarea ───────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (e.key === "Tab") {
      if (completionOptions.length > 0) {
        e.preventDefault();
        insertCompletion(completionOptions[activeCompletionIndex], start);
        return;
      }
      e.preventDefault();
      const newVal = el.value.slice(0, start) + "    " + el.value.slice(end);
      setCode((prev) => ({ ...prev, [language]: newVal }));
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 4;
      });
      return;
    }

    if (e.key === "ArrowDown" && completionOptions.length > 0) {
      e.preventDefault();
      setActiveCompletionIndex((idx) => (idx + 1) % completionOptions.length);
      return;
    }

    if (e.key === "ArrowUp" && completionOptions.length > 0) {
      e.preventDefault();
      setActiveCompletionIndex((idx) => (idx - 1 + completionOptions.length) % completionOptions.length);
      return;
    }

    if (e.key === "Escape") {
      setCompletionOptions([]);
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const before = el.value.slice(0, start);
      const after = el.value.slice(end);
      const lineStart = before.lastIndexOf("\n") + 1;
      const indent = before.slice(lineStart).match(/^\s*/)?.[0] || "";
      const newVal = before + "\n" + indent + after;
      setCode((prev) => ({ ...prev, [language]: newVal }));
      requestAnimationFrame(() => {
        const pos = start + 1 + indent.length;
        el.selectionStart = el.selectionEnd = pos;
        updateCompletions(newVal, pos);
      });
    }
  };

  // ── Run code ──────────────────────────────────────────────────────────────
  const handleRun = async () => {
    if (!problem) return;
    setRunning(true);
    setOutput(null);
    setOutputTab("output");
    setSubmissionResult(null);

    try {
      const result = await compileApi.run({
        language,
        code: code[language],
        stdin: useCustomInput ? customInput : "",
      });
      setOutput(result as any);
    } catch (err: any) {
      const msg = err.message || "Failed to run code. Please try again.";
      setOutput({ stdout: "", stderr: msg, exitCode: 1 });
    } finally {
      setRunning(false);
    }
  };

  const handleSubmit = async () => {
    if (!problem) return;
    setSubmitting(true);
    setOutput(null);
    setOutputTab("output");
    setSubmissionResult(null);

    try {
      const result = await problemApi.submit(problem.slug, { language, code: code[language] });
      setSubmissionResult(result);
      if (result.status === "accepted") {
        setStatus("solved");
      } else {
        setStatus((prev) => (prev === "solved" ? prev : "attempted"));
      }
      setOutput({ stdout: result.passedCount != null ? `Passed ${result.passedCount}/${result.totalCount} hidden tests.` : "", stderr: result.message || "", exitCode: result.status === "accepted" ? 0 : 1 });
    } catch (err: any) {
      const msg = err.message || "Submission failed. Please try again.";
      setOutput({ stdout: "", stderr: msg, exitCode: 1 });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Mark as solved ────────────────────────────────────────────────────────
  const handleMarkSolved = async () => {
    if (!problem) return;
    setMarking(true);
    try {
      await problemApi.updateStatus(problem.slug, {
        status: "solved",
        language,
        code: code[language],
      });
      setStatus("solved");
    } catch {}
    setMarking(false);
  };

  // ── Reset code ────────────────────────────────────────────────────────────
  const handleReset = () => {
    if (!problem) return;
    setCode((prev) => ({
      ...prev,
      [language]: problem.starterCode?.[language as keyof typeof problem.starterCode] || "",
    }));
    setOutput(null);
  };

  // ── Copy code ─────────────────────────────────────────────────────────────
  const handleCopy = async () => {
    await navigator.clipboard.writeText(code[language]);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          <p className="text-slate-400 text-sm">Loading problem...</p>
        </div>
      </div>
    );
  }

  if (loadError || !problem) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-300 text-lg font-semibold mb-2">{loadError || "Problem not found"}</p>
          <button onClick={() => navigate(-1)} className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition-colors">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const currentCode = code[language];
  const hasOutput = output !== null;
  const isError = hasOutput && (output.exitCode !== 0 || output.stderr);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Top Bar */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="h-4 w-px bg-slate-600" />
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-white font-black text-sm">B</span>
            </div>
            <span className="text-slate-200 font-bold text-sm hidden sm:block">BeyondBasic</span>
          </Link>
          <div className="h-4 w-px bg-slate-600" />
          <span className="text-slate-300 font-semibold text-sm truncate max-w-[200px]">{problem.title}</span>
          <span className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${DIFFICULTY_STYLES[problem.difficulty]}`}>{problem.difficulty}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Status badge */}
          {status === "solved" ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-900/40 border border-green-700 rounded-lg">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
              <span className="text-green-400 text-xs font-bold">Solved</span>
            </div>
          ) : (
            <Button size="sm" onClick={handleMarkSolved} disabled={marking} className="bg-green-600 hover:bg-green-500 text-white text-xs h-8 px-3 gap-1.5">
              {marking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trophy className="w-3 h-3" />}
              Mark Solved
            </Button>
          )}
          <Button onClick={handleRun} disabled={running || submitting} className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-8 px-4 gap-1.5 shadow-lg">
            {running ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                Run Code
              </>
            )}
          </Button>
          <Button onClick={handleSubmit} disabled={running || submitting} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 px-4 gap-1.5 shadow-lg">
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                Submit
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden" style={{ height: "calc(100vh - 49px)" }}>
        {/* ── LEFT PANEL: Problem Description ── */}
        <div className="w-[45%] min-w-[320px] bg-slate-50 flex flex-col border-r border-slate-700 overflow-hidden">
          {/* Tabs */}
          <div className="flex items-center gap-0 border-b border-slate-200 bg-white shrink-0">
            <button onClick={() => setActiveTab("description")} className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === "description" ? "border-blue-500 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
              <BookOpen className="w-3.5 h-3.5" />
              Description
            </button>
            <button onClick={() => setActiveTab("solution")} className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === "solution" ? "border-blue-500 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
              <BookOpen className="w-3.5 h-3.5" />
              Solution
            </button>
            <button onClick={() => setActiveTab("testcases")} className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === "testcases" ? "border-blue-500 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
              <FlaskConical className="w-3.5 h-3.5" />
              Test Cases
              {problem.testCases.length > 0 && <span className="ml-1 px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold">{problem.testCases.filter((t) => !t.isHidden).length}</span>}
            </button>
            {problem.hiddenTestCaseCount != null && <span className="ml-auto mr-3 text-xs font-semibold text-slate-500">{problem.hiddenTestCaseCount} hidden tests</span>}
            {problem.leetcodeUrl && (
              <a href={problem.leetcodeUrl} target="_blank" rel="noopener noreferrer" className="ml-auto mr-3 flex items-center gap-1 text-orange-600 hover:text-orange-700 text-xs font-semibold">
                <span className="font-black">LC</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === "description" ? (
              <div className="p-5">
                {/* Title + meta */}
                <div className="mb-5">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <h1 className="text-xl font-black text-slate-900">{problem.title}</h1>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold border ${DIFFICULTY_STYLES[problem.difficulty]}`}>{problem.difficulty}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">{problem.topicTag}</span>
                    <div className="flex items-center gap-0.5 ml-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className={`w-1.5 h-3 rounded-sm ${i <= problem.frequency ? "bg-orange-400" : "bg-slate-200"}`} />
                      ))}
                      <span className="text-xs text-slate-400 ml-1">freq</span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="text-sm text-slate-700 leading-relaxed mb-6 whitespace-pre-wrap">{renderDescription(problem.description)}</div>

                {/* Examples */}
                {problem.examples.length > 0 && (
                  <div className="space-y-4">
                    {problem.examples.map((ex, i) => (
                      <div key={i} className="border border-slate-200 rounded-xl overflow-hidden">
                        <div className="px-4 py-2 bg-slate-100 border-b border-slate-200">
                          <span className="text-xs font-bold text-slate-500">Example {i + 1}</span>
                        </div>
                        <div className="p-4 space-y-2 bg-white">
                          <div>
                            <span className="text-xs font-bold text-slate-400 uppercase">Input</span>
                            <pre className="mt-1 text-sm font-mono bg-slate-50 rounded-lg p-3 text-slate-800 whitespace-pre-wrap border border-slate-100">{ex.input}</pre>
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-400 uppercase">Output</span>
                            <pre className="mt-1 text-sm font-mono bg-slate-50 rounded-lg p-3 text-slate-800 whitespace-pre-wrap border border-slate-100">{ex.output}</pre>
                          </div>
                          {ex.explanation && (
                            <div>
                              <span className="text-xs font-bold text-slate-400 uppercase">Explanation</span>
                              <p className="mt-1 text-sm text-slate-600">{ex.explanation}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : activeTab === "solution" ? (
              <div className="p-5">
                <div className="mb-5">
                  <h2 className="text-lg font-bold text-slate-900">Solution Article</h2>
                  <p className="text-sm text-slate-500">This solution content is loaded from the admin back office.</p>
                </div>
                {problem.solutionArticle ? (
                  <div className="prose prose-slate max-w-none text-sm leading-7">
                    <div dangerouslySetInnerHTML={{ __html: problem.solutionArticle }} />
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No solution article is available for this problem yet.</p>
                )}
              </div>
            ) : (
              /* Test Cases Tab */
              <div className="p-5">
                <p className="text-xs text-slate-400 mb-4 font-medium">Sample test cases — your code should produce these outputs.</p>
                {problem.testCases.filter((t) => !t.isHidden).length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">No visible test cases</p>
                ) : (
                  <div className="space-y-3">
                    {problem.testCases
                      .filter((t) => !t.isHidden)
                      .map((tc, i) => (
                        <div key={i} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                          <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-100">
                            <span className="text-xs font-bold text-slate-500">Case {i + 1}</span>
                            <button
                              onClick={() => {
                                setCustomInput(tc.input);
                                setUseCustomInput(true);
                                setOutputTab("input");
                              }}
                              className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                            >
                              Use as input
                            </button>
                          </div>
                          <div className="p-4 grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs font-bold text-slate-400 uppercase mb-1">Input</p>
                              <pre className="text-xs font-mono bg-slate-50 rounded-lg p-2.5 text-slate-700 whitespace-pre-wrap border border-slate-100 min-h-[2.5rem]">{tc.input}</pre>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-400 uppercase mb-1">Expected</p>
                              <pre className="text-xs font-mono bg-green-50 rounded-lg p-2.5 text-green-800 whitespace-pre-wrap border border-green-100 min-h-[2.5rem]">{tc.expectedOutput}</pre>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL: Editor + Output ── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-100">
          {/* Editor Toolbar */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-200 border-b border-slate-300 shrink-0">
            {/* Language selector */}
            <div className="flex items-center gap-1 bg-slate-900 rounded-lg p-0.5">
              {LANGUAGES.map((lang) => (
                <button key={lang.id} onClick={() => setLanguage(lang.id)} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${language === lang.id ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-slate-200 hover:bg-slate-700"}`}>
                  {lang.label}
                </button>
              ))}
            </div>

            {/* Editor actions */}
            <div className="flex items-center gap-2">
              <button onClick={handleCopy} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors">
                {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                {copied ? "Copied!" : "Copy"}
              </button>
              <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors" title="Reset to starter code">
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            </div>
          </div>

          {/* Code Editor */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={currentCode}
                onChange={(e) => {
                  const value = e.target.value;
                  const cursor = e.target.selectionStart;
                  setCode((prev) => ({ ...prev, [language]: value }));
                  updateCompletions(value, cursor);
                }}
                onKeyDown={handleKeyDown}
                onSelect={() => {
                  const el = textareaRef.current;
                  if (!el) return;
                  updateCompletions(code[language], el.selectionStart);
                }}
                spellCheck={false}
                className="w-full h-full bg-white text-slate-900 font-mono text-sm p-4 resize-none outline-none leading-6 selection:bg-blue-200 border border-slate-200"
                style={{
                  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, 'Courier New', monospace",
                  tabSize: 4,
                }}
                placeholder="Write your solution here..."
              />
            </div>
            <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold text-slate-500 mb-2">Auto-completions</p>
              {completionOptions.length === 0 ? (
                <p className="text-xs text-slate-500">Start typing to see completion candidates.</p>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {completionOptions.map((completion, index) => (
                    <button
                      key={completion}
                      type="button"
                      onClick={() => {
                        const el = textareaRef.current;
                        if (!el) return;
                        insertCompletion(completion, el.selectionStart);
                      }}
                      className={`w-full text-left rounded-lg px-3 py-2 text-xs ${index === activeCompletionIndex ? "bg-slate-200 text-slate-900" : "bg-white text-slate-700 hover:bg-slate-100"}`}
                    >
                      {completion}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t border-slate-300 bg-slate-100 shrink-0" style={{ height: "220px" }}>
              {/* Output Tabs */}
              <div className="flex items-center justify-between px-4 border-b border-slate-700">
                <div className="flex items-center gap-0">
                  <button onClick={() => setOutputTab("output")} className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${outputTab === "output" ? "border-blue-500 text-blue-400" : "border-transparent text-slate-400 hover:text-slate-200"}`}>
                    <Terminal className="w-3 h-3" />
                    Output
                    {hasOutput && <span className={`w-2 h-2 rounded-full ml-1 ${isError ? "bg-red-500" : "bg-green-500"}`} />}
                  </button>
                  <button onClick={() => setOutputTab("input")} className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${outputTab === "input" ? "border-blue-500 text-blue-400" : "border-transparent text-slate-400 hover:text-slate-200"}`}>
                    <Code2 className="w-3 h-3" />
                    Custom Input
                    {useCustomInput && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 ml-1" />}
                  </button>
                </div>
                {hasOutput && !running && (
                  <div className={`flex items-center gap-1.5 text-xs font-semibold ${isError ? "text-red-400" : "text-green-400"}`}>
                    {isError ? <Circle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                    {isError ? "Runtime Error" : "Success"}
                    {output?.exitCode !== 0 && <span className="text-slate-500">· Exit code {output?.exitCode}</span>}
                  </div>
                )}
              </div>

              {/* Output Content */}
              <div className="h-[168px] overflow-y-auto">
                {outputTab === "output" ? (
                  <div className="p-4">
                    {running ? (
                      <div className="flex items-center gap-2 text-slate-400">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                        <span className="text-sm">Running your code...</span>
                      </div>
                    ) : !hasOutput ? (
                      <p className="text-slate-500 text-sm">
                        Click <span className="text-blue-400 font-semibold">Run Code</span> to execute your solution and see output here.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {output.stdout && <pre className="text-sm font-mono text-green-300 whitespace-pre-wrap leading-5">{output.stdout}</pre>}
                        {output.stderr && <pre className="text-sm font-mono text-red-400 whitespace-pre-wrap leading-5">{output.stderr}</pre>}
                        {!output.stdout && !output.stderr && <p className="text-slate-400 text-sm italic">No output</p>}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                        <input type="checkbox" checked={useCustomInput} onChange={(e) => setUseCustomInput(e.target.checked)} className="rounded" />
                        Use custom stdin when running
                      </label>
                    </div>
                    <textarea value={customInput} onChange={(e) => setCustomInput(e.target.value)} placeholder="Enter custom input here (stdin)..." className="w-full h-24 bg-slate-900 text-slate-200 font-mono text-xs p-3 rounded-lg border border-slate-700 resize-none outline-none focus:border-blue-500 placeholder-slate-600" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
