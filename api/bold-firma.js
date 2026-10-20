// Genera la orden y la firma de integridad de Bold para cada producto.
// La llave secreta vive en las variables de entorno de Vercel, nunca en la página.
const crypto = require('crypto');

const PRODUCTOS = {
  clase: { amount: 25, currency: 'USD', description: 'Clase Notion para mentes creativas' },
  plantilla: { amount: 15, currency: 'USD', description: 'Plantilla de contenido en Notion' },
  sesion: { amount: 150, currency: 'USD', description: 'Sesion 1:1 con Gaby' },
  // Productos de prueba (1.000 COP), solo para la página escondida de prueba.
  testclase: { amount: 1000, currency: 'COP', description: 'Prueba clase' },
  testplantilla: { amount: 1000, currency: 'COP', description: 'Prueba plantilla' },
  testsesion: { amount: 1000, currency: 'COP', description: 'Prueba sesion' },
};

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const id = String((req.query && req.query.producto) || '');
  const producto = PRODUCTOS[id];
  if (!producto) {
    res.status(400).json({ error: 'Producto no válido' });
    return;
  }
  const apiKey = process.env.BOLD_API_KEY;
  const secret = process.env.BOLD_SECRET_KEY;
  if (!apiKey || !secret) {
    res.status(503).json({ error: 'Pagos no configurados' });
    return;
  }
  const orderId = `CCG-${id}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const amount = String(producto.amount);
  const signature = crypto
    .createHash('sha256')
    .update(`${orderId}${amount}${producto.currency}${secret}`)
    .digest('hex');
  res.status(200).json({
    apiKey,
    orderId,
    amount,
    currency: producto.currency,
    description: producto.description,
    signature,
  });
};
