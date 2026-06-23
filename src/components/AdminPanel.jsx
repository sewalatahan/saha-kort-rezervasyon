import { useMemo, useState } from "react";
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
  reservations = [],
  downloadReceipts,
  deleteClosedSlot,
  deleteReservation,
  openReceipt,
}) {
  const [monthlyReportMonth, setMonthlyReportMonth] = useState(
    adminSelectedDate.slice(0, 7)
  );
  const [monthlyReportCourt, setMonthlyReportCourt] = useState("all");
  const [showMonthlyReport, setShowMonthlyReport] = useState(false);

  function getReservationMonth(reservationDate) {
    if (!reservationDate) return "";

    if (reservationDate.includes("-")) {
      return reservationDate.slice(0, 7);
    }

    if (reservationDate.includes(".")) {
      const parts = reservationDate.split(".");

      if (parts.length === 3) {
        return `${parts[2]}-${parts[1].padStart(2, "0")}`;
      }
    }

    return "";
  }

  function getCourtType(reservation) {
    const courtId = reservation.court_id?.toLowerCase() || "";
    const courtName = reservation.court_name?.toLowerCase() || "";

    if (courtId.includes("tenis") || courtName.includes("tenis")) {
      return "tenis";
    }

    if (
      courtId.includes("salon") ||
      courtId.includes("voleybol") ||
      courtName.includes("salon") ||
      courtName.includes("voleybol")
    ) {
      return "salon";
    }

    return "";
  }

  const monthlyReportReservations = useMemo(() => {
    return reservations
      .filter((reservation) => {
        const matchesMonth =
          getReservationMonth(reservation.reservation_date) === monthlyReportMonth;

        const matchesCourt =
          monthlyReportCourt === "all" ||
          getCourtType(reservation) === monthlyReportCourt;

        return matchesMonth && matchesCourt;
      })
      .sort((a, b) => {
        const dateCompare = String(a.reservation_date).localeCompare(
          String(b.reservation_date)
        );

        if (dateCompare !== 0) return dateCompare;

        return String(a.reservation_time).localeCompare(
          String(b.reservation_time)
        );
      });
  }, [reservations, monthlyReportMonth, monthlyReportCourt]);

  const monthlyReportTotal = monthlyReportReservations.reduce(
    (total, reservation) => total + Number(reservation.total_price || 0),
    0
  );

  const monthlyReceiptPaths = monthlyReportReservations
    .map((reservation) => reservation.receipt_url)
    .filter(Boolean);

  const tennisReservations = adminReservations
    .filter((reservation) => getCourtType(reservation) === "tenis")
    .sort((a, b) =>
      String(a.reservation_time).localeCompare(String(b.reservation_time))
    );

  const salonReservations = adminReservations
    .filter((reservation) => getCourtType(reservation) === "salon")
    .sort((a, b) =>
      String(a.reservation_time).localeCompare(String(b.reservation_time))
    );

  function renderReservationCard(r) {
    return (
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
    );
  }

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

          <div style={{ marginTop: 30, marginBottom: 20 }}>
            <button
              onClick={() => setShowMonthlyReport(!showMonthlyReport)}
              style={{
                padding: "12px 16px",
                background: "#111827",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                width: "100%",
                fontWeight: "bold",
              }}
            >
              {showMonthlyReport
                ? "📊 Aylık Rapor ve Dekontları Gizle"
                : "📊 Aylık Rapor ve Dekontlar"}
            </button>

            {showMonthlyReport && (
              <div
                style={{
                  border: "1px solid #ddd",
                  padding: 15,
                  borderRadius: 10,
                  marginTop: 12,
                  background: "#f9fafb",
                }}
              >
                <h3 style={{ marginTop: 0 }}>Aylık Dekont / Rapor Listesi</h3>

                <div style={{ display: "grid", gap: 10, marginBottom: 15 }}>
                  <label>
                    Ay Seç:
                    <input
                      type="month"
                      value={monthlyReportMonth}
                      onChange={(e) => setMonthlyReportMonth(e.target.value)}
                      style={{ width: "100%", padding: 10, marginTop: 4 }}
                    />
                  </label>

                  <label>
                    Tesis Seç:
                    <select
                      value={monthlyReportCourt}
                      onChange={(e) => setMonthlyReportCourt(e.target.value)}
                      style={{ width: "100%", padding: 10, marginTop: 4 }}
                    >
                      <option value="all">Tümü</option>
                      <option value="tenis">Tenis Kortu</option>
                      <option value="salon">Çok Amaçlı Salon / Voleybol</option>
                    </select>
                  </label>
                </div>

                <p>
                  <strong>Rezervasyon Sayısı:</strong>{" "}
                  {monthlyReportReservations.length}
                </p>
                <p>
                  <strong>Toplam Tutar:</strong> {monthlyReportTotal} TL
                </p>

                {monthlyReportReservations.length === 0 && (
                  <p>Seçilen ay ve tesis için kayıt bulunamadı.</p>
                )}

                {monthlyReportReservations.length > 0 && (
                  <button
                    onClick={() => downloadReceipts(monthlyReceiptPaths)}
                    style={{
                      padding: "10px 14px",
                      background: "black",
                      color: "white",
                      border: "none",
                      borderRadius: 8,
                      cursor: "pointer",
                      marginBottom: 12,
                    }}
                  >
                    Seçilen Aydaki Dekontları ZIP İndir
                  </button>
                )}

                {monthlyReportReservations.map((r) => (
                  <div
                    key={`monthly-${r.id}`}
                    style={{ padding: 10, borderTop: "1px solid #ddd" }}
                  >
                    <strong>{r.reservation_date}</strong> | {r.reservation_time} |{" "}
                    {r.court_name}
                    <br />
                    {r.full_name} | {r.phone}
                    <br />
                    Kişi: {r.person_count} | {r.pricing_type} | Tutar:{" "}
                    {r.total_price} TL
                    <br />
                    Dekont: {r.receipt_name}
                    <br />
                    <button
                      onClick={() => openReceipt(r.receipt_url)}
                      style={{ marginTop: 8 }}
                    >
                      Dekontu Aç
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <h3 style={{ marginTop: 30 }}>Rezervasyonlar</h3>

          {adminReservations.length === 0 && <p>Seçilen tarihte rezervasyon yok.</p>}

          {adminReservations.length > 0 && (
            <div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    window.innerWidth < 768 ? "1fr" : "1fr 1fr",
                  gap: 16,
                }}
              >
                <div
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: 10,
                    overflow: "hidden",
                    background: "white",
                  }}
                >
                  <h4
                    style={{
                      margin: 0,
                      padding: 12,
                      background: "#111827",
                      color: "white",
                    }}
                  >
                    Tenis Kortu Rezervasyonları
                  </h4>

                  {tennisReservations.length === 0 ? (
                    <p style={{ padding: 12 }}>Seçilen tarihte tenis rezervasyonu yok.</p>
                  ) : (
                    tennisReservations.map(renderReservationCard)
                  )}
                </div>

                <div
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: 10,
                    overflow: "hidden",
                    background: "white",
                  }}
                >
                  <h4
                    style={{
                      margin: 0,
                      padding: 12,
                      background: "#111827",
                      color: "white",
                    }}
                  >
                    Çok Amaçlı Salon / Voleybol Rezervasyonları
                  </h4>

                  {salonReservations.length === 0 ? (
                    <p style={{ padding: 12 }}>Seçilen tarihte salon rezervasyonu yok.</p>
                  ) : (
                    salonReservations.map(renderReservationCard)
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AdminPanel;