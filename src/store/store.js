import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export class Store {
  constructor(file) { this.file = file; this.state = { users: {}, jobs: {}, config: { requiredChannels: [], requireAllChannels: true, subscriptionEnabled: false, maintenance: false, crawlDelayMs: 1000, retentionDays: 14 }, audit: [] }; }
  async init() { await fs.mkdir(path.dirname(this.file), { recursive: true }); try { this.state = JSON.parse(await fs.readFile(this.file, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; await this.save(); } return this; }
  async save() { const temp = `${this.file}.tmp`; await fs.writeFile(temp, JSON.stringify(this.state, null, 2), { mode: 0o600 }); await fs.rename(temp, this.file); }
  user(id, info = {}) { const key = String(id); return this.state.users[key] ||= { id: key, username: info.username || '', createdAt: new Date().toISOString(), jobs: [] }; }
  async addJob(job) { const id = randomUUID().slice(0, 12); this.state.jobs[id] = { ...job, id, createdAt: new Date().toISOString() }; this.user(job.userId).jobs.unshift(id); this.user(job.userId).jobs = this.user(job.userId).jobs.slice(0, 50); await this.save(); return this.state.jobs[id]; }
  async patchJob(id, patch) { if (this.state.jobs[id]) Object.assign(this.state.jobs[id], patch); await this.save(); }
  ownedJob(id, userId) { const job = this.state.jobs[id]; return job && String(job.userId) === String(userId) ? job : null; }
  recent(userId, limit = 10) { return (this.user(userId).jobs || []).slice(0, limit).map(id => this.state.jobs[id]).filter(Boolean); }
  async audit(actor, action, before, after) { this.state.audit.unshift({ actor: String(actor), action, before, after, at: new Date().toISOString() }); this.state.audit = this.state.audit.slice(0, 500); await this.save(); }
  async deleteUserData(userId) { const user = this.state.users[String(userId)]; if (!user) return; for (const id of user.jobs || []) delete this.state.jobs[id]; delete this.state.users[String(userId)]; await this.save(); }
}
