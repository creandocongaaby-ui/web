// Recibe las notificaciones de pago de Bold y envía el correo de confirmación.
// Variables en Vercel:
//   BOLD_SECRET_KEY   llave secreta del botón de pagos (verifica la firma de Bold)
//   RESEND_API_KEY    llave de Resend para enviar correos
//   BOLD_MODO_PRUEBAS "1" solo mientras pruebas (Bold firma las pruebas con llave vacía)
const crypto = require('crypto');

const CORREO_GABY = 'creandocongaaby@gmail.com';
const REMITENTE = 'Gaby de Creando con Gaaby <hola@creandocongaaby.com>';
const WHATSAPP = 'https://wa.me/573208944328';

// Completa aquí los enlaces de acceso de cada producto.
const PRODUCTOS = {
  clase: {
    nombre: 'Clase Notion para mentes creativas',
    asunto: 'Tu clase Notion para mentes creativas',
    enlace: 'https://creandocongaaby.notion.site/Tu-primer-sistema-de-Notion-2c6b34cec75180d0b7f7c6c5aea5ded8',
    boton: 'Entrar a mi clase',
    texto: 'Ya tienes acceso a tu clase. Ahí encuentras la clase grabada, los recursos y tu espacio personal en Notion.',
  },
  plantilla: {
    nombre: 'Plantilla de contenido en Notion',
    asunto: 'Tu plantilla de contenido en Notion',
    enlace: 'https://creandocongaaby.notion.site/Plantilla-cb7b34cec751824dbac00184d41c85bc',
    boton: 'Duplicar mi plantilla',
    texto: 'Ya tienes tu plantilla. Ábrela y toca "Duplicar" para guardarla en tu propio Notion.',
  },
  sesion: {
    nombre: 'Sesión 1:1 con Gaby',
    asunto: 'Tu sesión 1:1 está confirmada',
    enlace: '',
    boton: 'Elegir mi horario',
    texto: 'Tu sesión está pagada. Ahora elige el día y la hora que mejor te quede.',
  },
};

function leerCuerpo(req) {
  return new Promise((resolve, reject) => {
    const partes = [];
    req.on('data', (c) => partes.push(Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(partes)));
    req.on('error', reject);
  });
}

function firmaValida(cuerpo, recibida) {
  if (!recibida) return false;
  const llaves = [process.env.BOLD_SECRET_KEY || ''];
  if (process.env.BOLD_MODO_PRUEBAS === '1') llaves.push('');
  const base = cuerpo.toString('base64');
  return llaves.some((llave) => {
    const esperada = crypto.createHmac('sha256', llave).update(base).digest('hex');
    const a = Buffer.from(esperada);
    const b = Buffer.from(String(recibida));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}

function escapar(t) {
  return String(t || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function plantillaCorreo(p, nombre, orden) {
  const saludo = nombre ? `Hola, ${escapar(nombre.split(' ')[0])}` : 'Hola';
  const accion = p.enlace
    ? `<p style="margin:28px 0;text-align:center"><a href="${p.enlace}" style="background:#75052F;color:#FEFCF9;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:10px;display:inline-block">${p.boton}</a></p>`
    : `<p>En las próximas horas te escribo con tu acceso. Si lo necesitas antes, escríbeme por <a href="${WHATSAPP}" style="color:#75052F;font-weight:600">WhatsApp</a>.</p>`;
  return `<!doctype html><html><body style="margin:0;background:#FFF1F6;font-family:Arial,Helvetica,sans-serif;color:#75052F">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF1F6;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:20px;overflow:hidden">
<tr><td style="background:#75052F;padding:22px;text-align:center"><img src="https://creandocongaaby.com/img/logo.png" alt="Creando con Gaaby" width="180" style="display:inline-block"></td></tr>
<tr><td style="padding:32px 32px 8px;font-size:16px;line-height:1.6">
<h1 style="font-family:Georgia,serif;font-weight:400;font-size:30px;margin:0 0 16px">${saludo}, gracias por tu compra</h1>
<p>${p.texto}</p>
${accion}
<p style="background:#FFF1F6;border-radius:10px;padding:12px 16px;font-size:14px">Compraste: <b>${p.nombre}</b><br>Orden: ${escapar(orden)}</p>
<p>Cualquier duda, respondes este correo o me escribes por <a href="${WHATSAPP}" style="color:#75052F;font-weight:600">WhatsApp</a>.</p>
<p style="margin-top:24px">Con orden y muchos brillitos,<br><b>Gaby</b></p>
</td></tr>
<tr><td style="padding:16px 32px 28px;font-size:12px;color:#75052F;opacity:.75">creandocongaaby.com · @creandocongaaby</td></tr>
</table></td></tr></table></body></html>`;
}

async function enviar(para, asunto, html, responderA) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: REMITENTE, to: [para], subject: asunto, html, reply_to: responderA }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).end(); return; }
  const cuerpo = await leerCuerpo(req);
  if (!firmaValida(cuerpo, req.headers['x-bold-signature'])) { res.status(401).json({ error: 'firma' }); return; }

  let evento;
  try { evento = JSON.parse(cuerpo.toString('utf8')); } catch (e) { res.status(400).end(); return; }
  if (evento.type !== 'SALE_APPROVED') { res.status(200).json({ ok: true, ignorado: evento.type }); return; }

  const d = evento.data || {};
  const referencia = (d.metadata && d.metadata.reference) || '';
  const id = (referencia.match(/^CCG-([a-z]+)-/) || [])[1];
  const p = PRODUCTOS[id];
  if (!p) {
    // Ventas de otras herramientas de Bold (datáfono, links) se ignoran.
    // Solo en modo pruebas se avisa a Gaby, para revisar qué datos manda Bold.
    try {
      if (process.env.RESEND_API_KEY && process.env.BOLD_MODO_PRUEBAS === '1') await enviar(CORREO_GABY, 'Venta aprobada en Bold (revisar producto)',
        `<p>Llegó una venta aprobada pero no pude identificar el producto.</p><p>Referencia: ${escapar(referencia || 'vacía')}<br>Cliente: ${escapar(d.payer_email || 'sin correo')}<br>Monto: ${escapar(d.amount ? d.amount.total + ' ' + d.amount.currency : '')}<br>Bold: ${escapar(d.payment_id)}</p>`);
    } catch (e) { console.error(e); }
    res.status(200).json({ ok: true, ignorado: 'producto' });
    return;
  }

  const correo = d.payer_email;
  const nombre = d.card && d.card.cardholder_name;
  const monto = d.amount ? `${d.amount.total} ${d.amount.currency}` : '';
  try {
    if (process.env.RESEND_API_KEY) {
      if (correo) await enviar(correo, p.asunto, plantillaCorreo(p, nombre, referencia), CORREO_GABY);
      await enviar(CORREO_GABY, `Nueva venta: ${p.nombre}`,
        `<p>Nueva venta aprobada en Bold.</p><p><b>${p.nombre}</b> · ${escapar(monto)}<br>Cliente: ${escapar(nombre || 'sin nombre')} · ${escapar(correo || 'sin correo')}<br>Orden: ${escapar(referencia)} · Bold: ${escapar(d.payment_id)}</p><p>${p.enlace ? 'El cliente recibió su acceso por correo.' : 'Falta enviarle el acceso: no hay enlace configurado.'}</p>`, correo);
    }
  } catch (e) {
    console.error(e);
  }
  res.status(200).json({ ok: true });
};
