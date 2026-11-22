// Conciliacao manual segura para Nubank Pix.
// Apenas o operador autorizado confere o credito no extrato do recebedor.
// O identificador EndToEndId nao equivale, por si so, a comprovacao de pagamento.
export function normalizePixEndToEndId(value) {
  if (typeof value !== "string") return null;
  const id = value.trim().toUpperCase();
  // Formato tradicional E2E Pix: E + ISPB (8 digitos) + 23 caracteres.
  return /^E[0-9]{8}[A-Z0-9]{23}$/.test(id) ? id : null;
}

export function preparePixApproval(db, requestId, productKind, rawEndToEndId) {
  const reference = normalizePixEndToEndId(rawEndToEndId);
  if (!db || !Number.isSafeInteger(requestId) || requestId < 1 ||
      !["vip_package", "skin"].includes(productKind) || !reference) {
    throw new Error("Conferencia Pix invalida.");
  }
  // A verificacao de nao reutilizacao da transacao ocorre no MESMO UPDATE que
  // aprova o pedido. Uma consulta previa separada nao protegeria concorrencia.
  // Os creditos executados pelo chamador dependem de changes() === 1.
  return db.prepare(
    "UPDATE purchase_requests " +
    "SET status='approved',payment_reference=?,reviewed_at=CURRENT_TIMESTAMP,reviewed_by='admin' " +
    "WHERE id=? AND status='pending' AND product_kind=? AND payment_method='pix' " +
    "AND currency='BRL' AND price_brl>0 " +
    "AND NOT EXISTS (" +
      "SELECT 1 FROM purchase_requests previous " +
      "WHERE previous.payment_method='pix' AND previous.status='approved' " +
      "AND previous.payment_reference IS NOT NULL " +
      "AND UPPER(previous.payment_reference)=?" +
    ")"
  ).bind(reference, requestId, productKind, reference);
}
