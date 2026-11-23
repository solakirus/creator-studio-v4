/* Printing for the morning paper — plain Node, nothing to install.

   PRINTER (the env setting) can be:
     192.168.4.50                      a network printer's address: IPP on :631/ipp/print
     ipp://192.168.4.50:631/ipp/print  the full IPP address (ipps:// works too)
     ipp://cups-host:631/printers/Name a CUPS queue
     raw://192.168.4.50:9100           the printer's raw port, the PDF wrapped in PJL
     none / empty                      don't print, only make the PDF

   Almost every network printer made in the last ten years (anything that
   works with AirPrint or "IPP Everywhere") takes a PDF straight over IPP.

     printPdf(target, pdfBuffer, { title, duplex })  → { ok, how, status, message, jobId }
     probe(target)                                   → { ok, model, state, pdf, duplex, formats, message } */
'use strict';
const http = require('http'), https = require('https'), net = require('net');

/* ---------------------------------------------------------------- the address */
function parseTarget(v){
  let s = String(v || '').trim();
  if (!s || /^(none|off|no)$/i.test(s)) return { kind: 'none' };
  if (/^raw:\/\//i.test(s)) {
    const u = new URL(s.replace(/^raw:/i, 'http:'));
    return { kind: 'raw', host: u.hostname, port: +u.port || 9100, label: `${u.hostname}:${+u.port || 9100} (raw)` };
  }
  if (!/^[a-z]+:\/\//i.test(s)) s = `ipp://${s}`;
  const u = new URL(s);
  const secure = /^(ipps|https):$/i.test(u.protocol);
  const port = +u.port || 631;
  const path = u.pathname && u.pathname !== '/' ? u.pathname : '/ipp/print';
  return { kind: 'ipp', secure, host: u.hostname, port, path,
           uri: `${secure ? 'ipps' : 'ipp'}://${u.hostname}:${port}${path}`, label: `${u.hostname}${path}` };
}

/* ---------------------------------------------------------------- IPP encoding */
const TAG = { op: 0x01, job: 0x02, end: 0x03, printer: 0x04, unsupported: 0x05 };
const VT = { integer: 0x21, boolean: 0x22, enum: 0x23, text: 0x41, name: 0x42, keyword: 0x44,
             uri: 0x45, charset: 0x47, lang: 0x48, mime: 0x49 };

function attr(type, name, values){
  const parts = [];
  [].concat(values).forEach((v, i) => {
    const n = Buffer.from(i === 0 ? name : '', 'utf8');
    let val;
    if (type === VT.integer || type === VT.enum) { val = Buffer.alloc(4); val.writeInt32BE(v); }
    else if (type === VT.boolean) val = Buffer.from([v ? 1 : 0]);
    else val = Buffer.from(String(v), 'utf8');
    const h = Buffer.alloc(3); h.writeUInt8(type, 0); h.writeUInt16BE(n.length, 1);
    const l = Buffer.alloc(2); l.writeUInt16BE(val.length, 0);
    parts.push(h, n, l, val);
  });
  return Buffer.concat(parts);
}

let reqId = 1;
function request(op, groups){
  const head = Buffer.alloc(8);
  head.writeUInt8(2, 0); head.writeUInt8(0, 1);          /* IPP/2.0 */
  head.writeUInt16BE(op, 2);
  head.writeUInt32BE(reqId++ & 0x7fffffff, 4);
  const body = [head];
  for (const [tag, attrs] of groups) {
    if (!attrs.length) continue;
    body.push(Buffer.from([tag]), ...attrs);
  }
  body.push(Buffer.from([TAG.end]));
  return Buffer.concat(body);
}

function decodeValue(type, buf){
  if (type === VT.integer || type === VT.enum) return buf.length === 4 ? buf.readInt32BE(0) : null;
  if (type === VT.boolean) return !!buf[0];
  if (type >= 0x30 && type <= 0x4f) return buf.toString('utf8');
  return buf;
}

function parseResponse(buf){
  if (!buf || buf.length < 8) throw new Error('The printer sent back something that isn’t IPP');
  const out = { version: buf[0] + '.' + buf[1], status: buf.readUInt16BE(2), id: buf.readUInt32BE(4), groups: [] };
  let i = 8, group = null, last = null;
  while (i < buf.length) {
    const tag = buf[i++];
    if (tag === TAG.end) break;
    if (tag < 0x10) { group = { tag, attrs: {} }; out.groups.push(group); last = null; continue; }
    const nl = buf.readUInt16BE(i); i += 2;
    const name = buf.toString('utf8', i, i + nl); i += nl;
    const vl = buf.readUInt16BE(i); i += 2;
    const val = decodeValue(tag, buf.subarray(i, i + vl)); i += vl;
    if (!group) { group = { tag: 0, attrs: {} }; out.groups.push(group); }
    if (name) { last = name; group.attrs[name] = [val]; }
    else if (last) group.attrs[last].push(val);
  }
  out.ok = out.status < 0x0100;
  out.attrs = Object.assign({}, ...out.groups.map(g => g.attrs));
  return out;
}

const STATUS = { 0x0400: 'the printer refused the request', 0x0401: 'it wants a password', 0x0403: 'it doesn’t allow this',
  0x0406: 'the address is wrong (no such printer queue)', 0x040A: 'it doesn’t take PDFs this way',
  0x0500: 'the printer had an internal error', 0x0507: 'the printer is busy', 0x0508: 'it isn’t taking jobs right now' };
const why = s => STATUS[s] || `IPP status 0x${s.toString(16).padStart(4, '0')}`;

function post(t, body, timeout){
  return new Promise((resolve, reject) => {
    const lib = t.secure ? https : http;
    const rq = lib.request({ host: t.host, port: t.port, path: t.path, method: 'POST', rejectUnauthorized: false,
      headers: { 'Content-Type': 'application/ipp', 'Content-Length': body.length } }, res => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`The printer answered HTTP ${res.statusCode}`));
        try { resolve(parseResponse(Buffer.concat(chunks))); } catch (e) { reject(e); }
      });
    });
    rq.setTimeout(timeout || 60000, () => rq.destroy(new Error('The printer didn’t answer in time')));
    rq.on('error', e => reject(new Error(e.code === 'ECONNREFUSED' ? 'The printer refused the connection — is IPP turned on?'
      : e.code === 'EHOSTUNREACH' || e.code === 'ENETUNREACH' || e.code === 'ETIMEDOUT' ? 'The printer isn’t answering at that address'
      : e.message)));
    rq.end(body);
  });
}

function opAttrs(t){
  return [attr(VT.charset, 'attributes-charset', 'utf-8'), attr(VT.lang, 'attributes-natural-language', 'en'),
          attr(VT.uri, 'printer-uri', t.uri)];
}

/* ---------------------------------------------------------------- what the printer can do */
async function probe(target){
  const t = typeof target === 'string' || !target ? parseTarget(target) : target;
  if (t.kind === 'none') return { ok: false, message: 'No printer is set (PRINTER is empty)' };
  if (t.kind === 'raw') {
    return new Promise(res => {
      const s = net.connect({ host: t.host, port: t.port, timeout: 5000 }, () => { s.end(); res({ ok: true, message: `The printer answers on ${t.label}` }); });
      s.on('error', e => res({ ok: false, message: `Nothing answers on ${t.label}: ${e.message}` }));
      s.on('timeout', () => { s.destroy(); res({ ok: false, message: `Nothing answers on ${t.label}` }); });
    });
  }
  const body = request(0x000B, [[TAG.op, [...opAttrs(t),
    attr(VT.keyword, 'requested-attributes', ['printer-make-and-model', 'printer-state', 'printer-state-message',
      'document-format-supported', 'sides-supported', 'printer-info'])]]]);
  try {
    const r = await post(t, body, 10000);
    if (!r.ok) return { ok: false, message: `The printer answered, but ${why(r.status)}` };
    const a = r.attrs, formats = a['document-format-supported'] || [];
    const states = { 3: 'ready', 4: 'printing', 5: 'stopped' };
    return { ok: true, model: (a['printer-make-and-model'] || a['printer-info'] || [''])[0],
             state: states[(a['printer-state'] || [])[0]] || '', stateMessage: (a['printer-state-message'] || [''])[0],
             pdf: formats.includes('application/pdf'), formats,
             duplex: (a['sides-supported'] || []).some(s => /two-sided/.test(s)),
             message: '' };
  } catch (e) { return { ok: false, message: e.message }; }
}

/* ---------------------------------------------------------------- print */
function pjl(pdf, duplex, title){
  const esc = '\x1B%-12345X';
  return Buffer.concat([
    Buffer.from(`${esc}@PJL JOB NAME="${String(title || 'paper').replace(/"/g, '')}"\r\n@PJL SET DUPLEX=${duplex ? 'ON' : 'OFF'}\r\n@PJL ENTER LANGUAGE=PDF\r\n`, 'latin1'),
    pdf, Buffer.from(`${esc}@PJL EOJ\r\n${esc}`, 'latin1')]);
}

async function printPdf(target, pdf, o){
  const opts = o || {};
  const t = typeof target === 'string' || !target ? parseTarget(target) : target;
  if (t.kind === 'none') return { ok: false, how: 'none', message: 'No printer is set, so it was only saved' };
  if (t.kind === 'raw') {
    return new Promise(res => {
      const s = net.connect({ host: t.host, port: t.port, timeout: 15000 }, () => {
        s.end(pjl(pdf, opts.duplex, opts.title), () => res({ ok: true, how: 'raw', message: `Sent to ${t.label}` }));
      });
      s.on('error', e => res({ ok: false, how: 'raw', message: `Couldn’t reach ${t.label}: ${e.message}` }));
      s.on('timeout', () => { s.destroy(); res({ ok: false, how: 'raw', message: `${t.label} didn’t answer` }); });
    });
  }
  const job = [];
  if (opts.duplex) job.push(attr(VT.keyword, 'sides', 'two-sided-long-edge'));
  const send = withJob => request(0x0002, [
    [TAG.op, [...opAttrs(t), attr(VT.name, 'requesting-user-name', 'creator-studio'),
              attr(VT.name, 'job-name', opts.title || 'Morning paper'), attr(VT.mime, 'document-format', 'application/pdf')]],
    [TAG.job, withJob ? job : []]]);
  try {
    let r = await post(t, Buffer.concat([send(true), pdf]), 120000);
    /* a printer that can't do two-sided says so: send it again one-sided */
    if (!r.ok && job.length && (r.status === 0x040B || r.status === 0x0400)) r = await post(t, Buffer.concat([send(false), pdf]), 120000);
    if (!r.ok) return { ok: false, how: 'ipp', status: r.status, message: `Not printed — ${why(r.status)}` };
    return { ok: true, how: 'ipp', status: r.status, jobId: (r.attrs['job-id'] || [null])[0], message: `Sent to ${t.label}` };
  } catch (e) { return { ok: false, how: 'ipp', message: `Not printed — ${e.message}` }; }
}

module.exports = { parseTarget, printPdf, probe, request, attr, parseResponse, VT, TAG };
