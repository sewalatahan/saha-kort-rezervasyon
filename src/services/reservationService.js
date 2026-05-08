import React, { useState, useEffect } from "react";
import { fetchReservations, deleteReservationById } from "./services/reservationService";
import { courtsSeed, hours } from "./constants";

export default function App() {
  const [adminPassword, setAdminPassword] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [showAdminPage, setShowAdminPage] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminSelectedDate, setAdminSelectedDate] = useState("");
  const [adminReservations, setAdminReservations] = useState([]);
  const [adminClosedSlots, setAdminClosedSlots] = useState([]);
  const [closeCourt, setCloseCourt] = useState("");
  const [closeDate, setCloseDate] = useState("");
  const [closeStart, setCloseStart] = useState("");
  const [closeEnd, setCloseEnd] = useState("");
  const [closeReason, setCloseReason] = useState("");
  const [reservations, setReservations] = useState([]);

  useEffect(() => {
    async function loadReservations() {
      const data = await fetchReservations();
      setReservations(data);
    }
    loadReservations();
  }, []);

  function loginAdmin() {
    const users = {
      "EBRU.ERDEMİR": "12345.eE",
      "SEVVAL.ATAHAN": "12345.sA",
      "GUVENLİK": "12345.tA",
    };

    const username = adminUsername.trim().toLocaleUpperCase("tr-TR");

    if (users[username] === adminPassword) {
      setAdminOpen(true);
      setAdminUsername("");
      setAdminPassword("");
    } else {
      alert("Kullanıcı adı veya parola yanlış.");
    }
  }

  async function deleteReservation(id) {
    if (window.confirm("Rezervasyonu silmek istediğinize emin misiniz?")) {
      await deleteReservationById(id);
      setReservations((prev) => prev.filter((r) => r.id !== id));
      setAdminReservations((prev) => prev.filter((r) => r.id !== id));
    }
  }

  function openReceipt(url) {
    window.open(url, "_blank");
  }

  // Other admin functions like createClosedSlot, deleteClosedSlot, etc. would be here

  if (showAdminPage) {
    return (
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: 20, fontFamily: "Arial" }}>
        <button
          onClick={() => setShowAdminPage(false)}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #ccc",
            background: "white",
            cursor: "pointer",
            marginBottom: 20,
          }}
        >
          ← Rezervasyon Sayfasına Dön
        </button>

        <h1>Yönetici Paneli</h1>

        {!adminOpen ? (
          <div style={{ border: "1px solid #ddd", padding: 20, borderRadius: 10 }}>
            <h2>Yönetici Girişi</h2>

            <input
              placeholder="Kullanıcı adı"
              value={adminUsername}
              onChange={(e) => setAdminUsername(e.target.value)}
              style={{ width: "100%", padding: 10, marginBottom: 10 }}
            />

            <input
              type="password"
              placeholder="Parola"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              style={{ width: "100%", padding: 10, marginBottom: 10 }}
            />

            <button
              onClick={loginAdmin}
              style={{
                padding: 12,
                background: "black",
                color: "white",
                border: "none",
                borderRadius: 8,
                width: "100%",
              }}
            >
              Giriş Yap
            </button>
          </div>
        ) : (
          <div>
            <button onClick={() => setAdminOpen(false)}>
              Yönetici Oturumunu Kapat
            </button>

            <div style={{ border: "1px solid #ddd", padding: 15, borderRadius: 10, marginTop: 20, marginBottom: 20 }}>
              <h3>Saat Kapat</h3>

              <select value={closeCourt} onChange={(e) => setCloseCourt(e.target.value)}>
                {courtsSeed.map((court) => (
                  <option key={court.id} value={court.id}>
                    {court.name}
                  </option>
                ))}
              </select>

              <input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />

              <select value={closeStart} onChange={(e) => setCloseStart(e.target.value)}>
                {hours.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>

              <select value={closeEnd} onChange={(e) => setCloseEnd(e.target.value)}>
                {hours.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>

              <input
                placeholder="Sebep: Kurs, Bakım, Turnuva"
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
              />

              <button onClick={createClosedSlot}>Saati Kapat</button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label>
                Görüntülenecek tarih: {" "}
                <input
                  type="date"
                  value={adminSelectedDate}
                  onChange={(e) => setAdminSelectedDate(e.target.value)}
                  style={{ padding: 10 }}
                />
              </label>
            </div>

            <h3>Kapalı Saatler</h3>
            {adminClosedSlots.length === 0 && <p>Seçilen tarihte kapalı saat yok.</p>}
            {adminClosedSlots.map((s) => (
              <div key={s.id} style={{ padding: 10, borderBottom: "1px solid #ddd" }}>
                {s.close_date} | {s.court_id} | {s.start_time}-{s.end_time} | {s.reason}
                <br />
                <button onClick={() => deleteClosedSlot(s.id)}>Kapalı Saati Sil</button>
              </div>
            ))}

            <h3>Rezervasyonlar</h3>
            {adminReservations.length === 0 && <p>Seçilen tarihte rezervasyon yok.</p>}

            {adminReservations.map((r) => (
              <div key={r.id} style={{ padding: 12, borderBottom: "1px solid #ddd" }}>
                <strong>{r.reservation_date}</strong> | {r.reservation_time} | {r.court_name}
                <br />
                {r.full_name} | {r.phone}
                <br />
                Kişi: {r.person_count} | {r.pricing_type} | {r.day_type ? r.day_type : "-"} | Tutar: {r.total_price} TL
                <br />
                Dekont: {r.receipt_name}
                <br />

                <div style={{ marginTop: 8 }}>
                  <button onClick={() => openReceipt(r.receipt_url)}>
                    Dekontu Aç
                  </button>

                  <button
                    onClick={() => deleteReservation(r.id)}
                    style={{
                      background: "#991b1b",
                      color: "white",
                      border: "none",
                      padding: "6px 10px",
                      borderRadius: 6,
                      marginLeft: 8,
                    }}
                  >
                    Rezervasyonu Sil
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Other main page content here */}

      <div style={{ marginTop: 40, textAlign: "center" }}>
        <button
          onClick={() => setShowAdminPage(true)}
          style={{
            padding: "12px 18px",
            background: "#111827",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          Yönetici Paneli
        </button>
      </div>
    </div>
  );
}