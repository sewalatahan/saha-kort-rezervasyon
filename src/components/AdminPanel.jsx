import { useEffect, useMemo, useState } from "react";
import { courtsSeed, hours } from "../data/courts";
import { getToday } from "../utils/dateRules";
import { createNoShowWorkbook, getYesterday, groupNoShows } from "../utils/noShowReport";

function AdminPanel({
  adminOpen,
  adminRole,
  isSevval,
  adminUsername,
  adminPassword,
  setAdminUsername,
  setAdminPassword,
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
  markReservationArrived,
  noShowCandidates,
  blacklistedPeople,
  addNoShowToBlacklist,
  removeNoShowFromBlacklist,
  logoutAdmin,
}) {
  const [monthlyReportMonth, setMonthlyReportMonth] = useState(
    adminSelectedDate.slice(0, 7)
  );
  const [monthlyReportCourt, setMonthlyReportCourt] = useState("all");
  const [showMonthlyReport, setShowMonthlyReport] = useState(false);
  const [reportToday, setReportToday] = useState(getToday);
  const [exportingNoShows, setExportingNoShows] = useState(false);

  useEffect(() => {
    const refreshDate = () => setReportToday(getToday());
    const timer = setInterval(refreshDate, 30000);
    window.addEventListener("focus", refreshDate);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refreshDate);
    };
  }, []);

  const yesterdayNoShows = noShowCandidates.filter(
    (r) => String(r.reservation_date ?? "").slice(0, 10) === getYesterday(reportToday)
  );
  const noShowHistory = useMemo(
    () => isSevval && adminRole === "full" ? groupNoShows(reservations, reportToday) : [],
    [reservations, reportToday, isSevval, adminRole]
  );

  async function downloadNoShowReport() {
    setExportingNoShows(true);
    try {
      const blob = await createNoShowWorkbook(noShowHistory);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `gelmeme-raporu-${getToday()}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      alert("Excel raporu oluşturulamadı. Lütfen tekrar deneyiniz.");
    } finally {
      setExportingNoShows(false);
    }
  }

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

        {adminRole === "readonly" && (
          <>
            <br />
            <strong>{r.full_name || "İsim bilgisi yok"}</strong>
            {r.phone ? ` | ${r.phone}` : " | Telefon bilgisi yok"}
            <br />
            Durum: {r.arrived ? "Geldi" : "Bekleniyor"}
          </>
        )}

        {adminRole === "full" && (
          <>
            <br />
            {r.full_name} | {r.phone}
            <br />
            Kişi: {r.person_count} | {r.pricing_type} | {r.total_price} TL
            <br />
            Dekont: {r.receipt_name}
          </>
        )}

        <div style={{ marginTop: 8 }}>
          {adminRole === "readonly" &&
            !r.arrived &&
            r.reservation_date === getToday() && (
              <button onClick={() => markReservationArrived(r.id)}>
                Geldi olarak işaretle
              </button>
            )}

          {adminRole === "full" && (
            <>
              <button onClick={() => openReceipt(r.receipt_url)}>
                Dekontu Aç
              </button>
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
            </>
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
          <button onClick={logoutAdmin} style={{ marginBottom: 20 }}>
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

          {isSevval && adminRole === "full" && (
            <section style={{ marginTop: 30 }}>
              <details>
              <summary style={{ cursor: "pointer", fontWeight: "bold" }}>Dün Gelmeyenler</summary>
              {yesterdayNoShows.length === 0 ? (
                <p>Dün gelmeyen rezervasyon yok.</p>
              ) : (
                yesterdayNoShows.map((reservation) => (
                  <div
                    key={reservation.id}
                    style={{ padding: 12, borderBottom: "1px solid #ddd" }}
                  >
                    <strong>{reservation.full_name}</strong> | {reservation.phone}
                    <br />
                    {reservation.reservation_date} | {reservation.reservation_time} |{" "}
                    {reservation.court_name || reservation.court_id}
                    <br />
                    <button
                      onClick={() => addNoShowToBlacklist(reservation.id)}
                      style={{ marginTop: 8 }}
                    >
                      Kara listeye ekle
                    </button>
                  </div>
                ))
              )}

              </details>

              <details style={{ marginTop: 24 }}>
                <summary style={{ cursor: "pointer", fontWeight: "bold" }}>Gelmeme Geçmişi</summary>
                <button onClick={downloadNoShowReport} disabled={exportingNoShows || noShowHistory.length === 0} style={{ marginTop: 12 }}>
                  {exportingNoShows ? "Excel hazırlanıyor…" : "Excel İndir"}
                </button>
                {noShowHistory.length === 0 ? <p>Geçmiş gelmeme kaydı yok.</p> : noShowHistory.map((person) => (
                  <div key={person.key} style={{ padding: 12, borderBottom: "1px solid #ddd" }}>
                    <strong>{person.fullName || "İsim bilgisi yok"}</strong>
                    <br />Telefon: {person.phone}
                    <br />Toplam gelmeme sayısı: {person.count}
                    <br />Son gelmediği tarih: {person.lastDate}
                    <br />Gelmediği tarihler: {person.dates.join(", ")}
                  </div>
                ))}
              </details>

              <details style={{ marginTop: 24 }}>
              <summary style={{ cursor: "pointer", fontWeight: "bold" }}>Kara Liste</summary>
              {blacklistedPeople.length === 0 ? (
                <p>Kara listede kişi yok.</p>
              ) : (
                blacklistedPeople.map((person) => (
                  <div
                    key={person.phone}
                    style={{ padding: 12, borderBottom: "1px solid #ddd" }}
                  >
                    <strong>{person.full_name}</strong> | {person.phone}
                    <button
                      onClick={() => removeNoShowFromBlacklist(person.phone)}
                      style={{ marginLeft: 12 }}
                    >
                      Listeden çıkar
                    </button>
                  </div>
                ))
              )}
              </details>
            </section>
          )}

          {adminRole === "full" && (
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
          )}

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
