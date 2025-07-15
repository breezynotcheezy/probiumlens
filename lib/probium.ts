const API_BASE = "http://127.0.0.1:8000/api/v1";

export async function getEngines() {
  const res = await fetch(`${API_BASE}/engines`);
  return res.json();
}

export async function getEngineStatus() {
  const res = await fetch(`${API_BASE}/engines/status`);
  return res.json();
}

export async function scanFile(file: File, options: {
  engines?: string,
  deep_analysis?: boolean,
  generate_hashes?: boolean,
  extract_metadata_flag?: boolean,
  validate_signatures?: boolean,
} = {}) {
  const formData = new FormData();
  formData.append("file", file);
  if (options.engines) formData.append("engines", options.engines);
  if (options.deep_analysis !== undefined) formData.append("deep_analysis", String(options.deep_analysis));
  if (options.generate_hashes !== undefined) formData.append("generate_hashes", String(options.generate_hashes));
  if (options.extract_metadata_flag !== undefined) formData.append("extract_metadata_flag", String(options.extract_metadata_flag));
  if (options.validate_signatures !== undefined) formData.append("validate_signatures", String(options.validate_signatures));
  const res = await fetch(`${API_BASE}/scan/file`, {
    method: "POST",
    body: formData,
  });
  return res.json();
}

export async function scanBatch(files: File[], options: {
  engines?: string,
  parallel_processing?: boolean,
  thread_pool_size?: number,
} = {}) {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  if (options.engines) formData.append("engines", options.engines);
  if (options.parallel_processing !== undefined) formData.append("parallel_processing", String(options.parallel_processing));
  if (options.thread_pool_size !== undefined) formData.append("thread_pool_size", String(options.thread_pool_size));
  const res = await fetch(`${API_BASE}/scan/batch`, {
    method: "POST",
    body: formData,
  });
  return res.json();
}

export async function getScanStatus(scanId: string) {
  const res = await fetch(`${API_BASE}/scan/${scanId}/status`);
  return res.json();
}

export async function getSystemMetrics() {
  const res = await fetch(`${API_BASE}/system/metrics`);
  return res.json();
}

export async function getScanHistory(limit = 100) {
  const res = await fetch(`${API_BASE}/scan/history?limit=${limit}`);
  return res.json();
} 