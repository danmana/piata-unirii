// Generation worker: builds voxel assets and returns meshed, transferable buffers.
import { runJob } from './build/jobs.js';

function transferList(obj, set) {
  if (!obj) return set;
  if (ArrayBuffer.isView(obj)) { set.add(obj.buffer); return set; }
  if (Array.isArray(obj)) { for (const o of obj) transferList(o, set); return set; }
  if (typeof obj === 'object') for (const k in obj) transferList(obj[k], set);
  return set;
}

self.onmessage = (e) => {
  const { id, job } = e.data;
  try {
    const res = runJob(job);
    self.postMessage({ id, res }, [...transferList(res, new Set())]);
  } catch (err) {
    self.postMessage({ id, error: (err && err.stack) || String(err) });
  }
};
