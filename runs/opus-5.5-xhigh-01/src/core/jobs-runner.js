// Parallel job runner: a pool of module workers, with a main-thread fallback.

export class JobRunner {
  constructor(n) {
    this.workers = [];
    this.fallback = null;
    const count = Math.max(1, Math.min(n, 8));
    try {
      for (let i = 0; i < count; i++) {
        const w = new Worker(new URL('../worker.js', import.meta.url), { type: 'module' });
        this.workers.push(w);
      }
    } catch (e) {
      console.warn('Workers unavailable, generating on the main thread', e);
      this.workers = [];
    }
  }

  async _fallbackRun(job) {
    if (!this.fallback) this.fallback = await import('../build/jobs.js');
    // yield to keep the page responsive
    await new Promise((r) => setTimeout(r, 0));
    return this.fallback.runJob(job);
  }

  // Runs all jobs; onResult(res, job) is called as each finishes.
  run(jobs, onResult, onProgress) {
    let done = 0;
    const total = jobs.length;
    const queue = jobs.map((job, i) => ({ job, i })).sort((a, b) => (b.job.cost || 1) - (a.job.cost || 1));
    const finish = (res, job) => {
      done++;
      try { onResult(res, job); } catch (e) { console.error('result handler failed', job.type, e); }
      if (onProgress) onProgress(done, total, job);
    };
    if (!this.workers.length) {
      return (async () => {
        for (const { job } of queue) {
          try { finish(await this._fallbackRun(job), job); } catch (e) { console.error('job failed', job.type, e); finish(null, job); }
        }
      })();
    }
    return new Promise((resolve) => {
      let next = 0, active = 0;
      let seq = 0;
      const pending = new Map();
      const pump = (w) => {
        if (next >= queue.length) { if (active === 0) resolve(); return; }
        const item = queue[next++];
        const id = ++seq;
        pending.set(id, item);
        active++;
        w.postMessage({ id, job: item.job });
      };
      for (const w of this.workers) {
        w.onmessage = async (e) => {
          const { id, res, error } = e.data;
          const item = pending.get(id);
          pending.delete(id);
          active--;
          if (error) {
            console.error('Job failed in worker:', item.job.type, item.job.name || '', error);
            finish(null, item.job);
          } else finish(res, item.job);
          pump(w);
          if (next >= queue.length && active === 0) resolve();
        };
        w.onerror = async (e) => {
          console.error('Worker error', e.message || e);
          e.preventDefault && e.preventDefault();
          // retry outstanding jobs of this worker on the main thread
          for (const [id, item] of pending) {
            pending.delete(id); active--;
            try { finish(await this._fallbackRun(item.job), item.job); } catch (err) { console.error(err); finish(null, item.job); }
          }
          while (next < queue.length) {
            const item = queue[next++];
            try { finish(await this._fallbackRun(item.job), item.job); } catch (err) { console.error(err); finish(null, item.job); }
          }
          resolve();
        };
        pump(w);
      }
    });
  }

  dispose() {
    for (const w of this.workers) w.terminate();
    this.workers = [];
  }
}
