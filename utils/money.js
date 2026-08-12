function toKurus(value) {
  const amount = typeof value === 'string' ? Number(value.trim()) : Number(value);
  if (!Number.isFinite(amount)) throw new Error('Geçersiz para tutarı.');
  return Math.round((amount + Number.EPSILON) * 100);
}

function fromKurus(value) {
  return Number(value || 0) / 100;
}

function calculateChargeKurus(ratePer1000Kurus, quantity) {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error('Geçersiz miktar.');
  return Math.round((Number(ratePer1000Kurus) * quantity) / 1000);
}

module.exports = { toKurus, fromKurus, calculateChargeKurus };

