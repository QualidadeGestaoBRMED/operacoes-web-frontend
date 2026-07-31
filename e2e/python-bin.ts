import path from "node:path";

// Achado no code review do Tech Lead: "venv/bin/python" hardcoded prendia a
// suíte a um layout Unix/local muito específico (venv chamado exatamente
// "venv", no Windows fica em Scripts/python.exe, não bin/python). PYTHON_BIN
// sobrepõe tudo -- útil em CI, onde o interpretador pode nem estar num venv
// chamado "venv" (ex.: um Python já no PATH do runner). Path absoluto de
// propósito: caminho relativo passado pra execFileSync/comando de shell é
// resolvido a partir do cwd do processo Node que INICIOU a suíte (não do
// `cwd` passado pra spawn), então um relativo aqui apontaria pro lugar
// errado dependendo de onde `npx playwright test` foi rodado.
export function caminhoDoPython(backendDir: string): string {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  const relativo = process.platform === "win32" ? "venv/Scripts/python.exe" : "venv/bin/python";
  return path.resolve(backendDir, relativo);
}
