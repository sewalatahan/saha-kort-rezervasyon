import { courtsSeed, hours } from "../data/courts";

function AdminPanel({
  adminOpen,
  adminRole,
  adminUsername,
  adminPassword,
  setAdminUsername,
  setAdminPassword,
  setAdminOpen,
  setAdminRole,
  loginAdmin,

  closeCourt,
  setCloseCourt,
  closeDate,
  setCloseDate,
  closeStart,
  setCloseStart,
  closeEnd,
  setCloseEnd,
  closeReason,
  setCloseReason,
  createClosedSlot,

  adminSelectedDate,
  setAdminSelectedDate,
  adminClosedSlots,
  adminReservations,
  deleteClosedSlot,
  deleteReservation,
  openReceipt,
}) {
  return (
    <div>
      <h1 style={{ marginBottom: 20 }}>Yönetici Paneli</h1>

      {!adminOpen ? (
        <div style={{ border: "1px solid #ddd", padding: 20, borderRadius: 12 }}>
          <h3>Yönetici Girişi</h3>

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
              width: "100%",
              padding: 12,
              border: "none",
              borderRadius: 8,
              background: "black",
              color: "white",
            }}
          >
            Giriş Yap
          </button>
        </div>
      ) : (
        <div>
          <button
            onClick={() => {
              setAdminOpen(false);
              setAdminRole("");
            }}
            style={{ marginBottom: 20 }}
          >
            Oturumu Kapat
          </button>

          {adminRole === "full" && (
            <div
              style={{
                border: "1px solid #ddd",
                padding: 15,
                borderRadius: 10,
                marginBottom: 20,
                background: "#f9fafb",
              }}
            >
              <h3 style={{ marginTop: 0 }}>Saat Kapat / Kurs Ekle</h3>

              <div style={{ display: "grid", gap: 10 }}>
                <label>
                  Alan:
                  <select
                    value={closeCourt}
                    onChange={(e) => setCloseCourt(e.target.value)}
                    style={{ width: "100%", padding: 10, marginTop: 4 }}
                  >
                    {courtsSeed.map((court) => (
                      <option key={court.id} value={court.id}>
                        {court.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Tarih:
                  <input
                    type="date"
                    value={closeDate}
                    onChange={(e) => setCloseDate(e.target.value)}
                    style={{ width: "100%", padding: 10, marginTop: 4 }}
                  />
                </label>

                <label>
                  Başlangıç saati:
                  <select
                    value={closeStart}
                    onChange={(e) => setCloseStart(e.target.value)}
                    style={{ width: "100%", padding: 10, marginTop: 4 }}
                  >
                    {hours.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Bitiş saati:
                  <select
                    value={closeEnd}
                    onChange={(e) => setCloseEnd(e.target.value)}
                    style={{ width: "100%", padding: 10, marginTop: 4 }}
                  >
                    {hours.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Sebep:
                  <input
                    placeholder="Kurs, Bakım, Turnuva"
                    value={closeReason}
                    onChange={(e) => setCloseReason(e.target.value)}
                    style={{ width: "100%", padding: 10, marginTop: 4 }}
                  />
                </label>

                <button
                  onClick={createClosedSlot}
                  style={{
                    padding: 12,
                    background: "black",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer",
                  }}
                >
                  Saati Kapat
                </button>
              </div>
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <label>
              Görüntülenecek tarih:
              <input
                type="date"
                value={adminSelectedDate}
                onChange={(e) => setAdminSelectedDate(e.target.value)}
                style={{ marginLeft: 10, padding: 8 }}
              />
            </label>
          </div>

          <h3>Kapalı Saatler</h3>

          {adminClosedSlots.length === 0 && <p>Seçilen tarihte kapalı saat yok.</p>}

          {adminClosedSlots.map((s) => (
            <div key={s.id} style={{ padding: 12, borderBottom: "1px solid #ddd" }}>
              {s.close_date} | {s.court_id} | {s.start_time}-{s.end_time} | {s.reason}

              {adminRole === "full" && (
                <div style={{ marginTop: 8 }}>
                  <button onClick={() => deleteClosedSlot(s.id)}>
                    Kapalı Saati Sil
                  </button>
                </div>
              )}
            </div>
          ))}

          <h3 style={{ marginTop: 30 }}>Rezervasyonlar</h3>

          {adminReservations.length === 0 && <p>Seçilen tarihte rezervasyon yok.</p>}

          {adminReservations.map((r) => (
            <div key={r.id} style={{ padding: 12, borderBottom: "1px solid #ddd" }}>
              <strong>{r.reservation_date}</strong> | {r.reservation_time} | {r.court_name}
              <br />
              {r.full_name} | {r.phone}
              <br />
              Kişi: {r.person_count} | {r.pricing_type} | {r.total_price} TL
              <br />
              Dekont: {r.receipt_name}

              <div style={{ marginTop: 8 }}>
                <button onClick={() => openReceipt(r.receipt_url)}>
                  Dekontu Aç
                </button>

                {adminRole === "full" && (
                  <button
                    onClick={() => deleteReservation(r.id)}
                    style={{
                      marginLeft: 8,
                      background: "#991b1b",
                      color: "white",
                      border: "none",
                      padding: "6px 10px",
                      borderRadius: 6,
                    }}
                  >
                    Rezervasyonu Sil
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AdminPanel;