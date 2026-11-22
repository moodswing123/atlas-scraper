export class TelegramApi {
  constructor(token) { this.base = `https://api.telegram.org/bot${token}`; }
  async call(method, payload = {}) {
    const response = await fetch(`${this.base}/${method}`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(payload), signal:AbortSignal.timeout(30000) });
    const data = await response.json().catch(()=>({})); if (!response.ok || !data.ok) throw new Error(data.description || `Telegram API ${method} failed (${response.status})`); return data.result;
  }
  getUpdates(offset, timeout=30) { return this.call('getUpdates',{offset,timeout,allowed_updates:['message','callback_query']}); }
  sendMessage(chat_id,text,extra={}) { return this.call('sendMessage',{chat_id,text,parse_mode:'HTML',...extra}); }
  editMessage(chat_id,message_id,text,extra={}) { return this.call('editMessageText',{chat_id,message_id,text,parse_mode:'HTML',...extra}); }
  answerCallbackQuery(callback_query_id,text) { return this.call('answerCallbackQuery',{callback_query_id,text:text?.slice(0,180)}); }
  getChat(chat_id) { return this.call('getChat',{chat_id}); }
  getChatMember(chat_id,user_id) { return this.call('getChatMember',{chat_id,user_id}); }
  async sendDocument(chat_id,filePath,caption='') {
    const { readFile } = await import('node:fs/promises'); const data = await readFile(filePath); const form = new FormData(); form.append('chat_id',String(chat_id)); if(caption) form.append('caption',caption); form.append('document',new Blob([data]),filePath.split('/').pop());
    const res=await fetch(`${this.base}/sendDocument`,{method:'POST',body:form,signal:AbortSignal.timeout(120000)}); const json=await res.json(); if(!res.ok||!json.ok) throw new Error(json.description||'Could not send document.'); return json.result;
  }
}
