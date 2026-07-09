import { IBAN, ALICI } from "../data/courts";

function PaymentCard({
  personCount,
  unitPrice,
  totalPrice,
  isStudentReservation,
  copyIban,
}) {
  return (
    <div
      style={{
        background: "#111827",
        color: "white",
        padding: 18,
        borderRadius: 10,
        marginBottom: 15,
      }}
    >
      <h3 style={{ marginTop: 0 }}>Ödeme Bilgileri</h3>

      {isStudentReservation && (
        <p style={{ fontSize: 14, lineHeight: 1.6 }}>
          Öğrenci rezervasyonları ücretsizdir. Dekont yerine öğrenci belgesi
          veya öğrenci kartı fotoğrafı yükleyebilirsiniz.
        </p>
      )}

      <p>
        {personCount} kişi x {unitPrice} TL ={" "}
        <strong>{totalPrice} TL</strong>
      </p>

      <p>
        Lütfen toplam <strong>{totalPrice} TL</strong> tutarı aşağıdaki
        IBAN'a gönderiniz.
      </p>

      <p>
        <strong>Alıcı:</strong> {ALICI}
      </p>

      <div
        style={{
          background: "#000",
          padding: 12,
          borderRadius: 8,
          fontWeight: "bold",
          fontSize: 18,
          letterSpacing: 1,
          marginBottom: 10,
        }}
      >
        {IBAN}
      </div>

      <div style={{ marginTop: 12, marginBottom: 12 }}>
        <button onClick={copyIban}>IBAN Kopyala</button>
      </div>

      <a
        href="/SahaUcret_Tablo.pdf"
        target="_blank"
        rel="noreferrer"
        style={{
          display: "inline-block",
          marginBottom: 12,
          color: "#60a5fa",
          fontWeight: "bold",
          textDecoration: "none",
        }}
      >
        Tesis Kullanım Şartları ve Ücretlendirme Bilgileri (PDF)
      </a>

      <p style={{ fontSize: 14, lineHeight: 1.6 }}>
        Banka açıklama kısmına mutlaka:
        <br />
        <strong>Ad Soyad + Tesis Adı + Tarih + Saat</strong>
        <br />
        bilgilerini yazınız.
      </p>
    </div>
  );
}

export default PaymentCard;