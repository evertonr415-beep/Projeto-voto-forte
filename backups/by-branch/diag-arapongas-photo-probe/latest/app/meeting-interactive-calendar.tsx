"use client";

import { useMemo, useState } from "react";

type MeetingItem = {
  id: number;
  title: string;
  day?: string;
  date?: string;
  time?: string;
  place?: string;
  address?: string;
  ownerEmail?: string;
};

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function padZero(num: number) {
  return num < 10 ? `0${num}` : String(num);
}

function formatDateString(year: number, month: number, day: number) {
  return `${year}-${padZero(month + 1)}-${padZero(day)}`;
}

export default function MeetingInteractiveCalendar({
  meetings,
  onSelectDate,
}: {
  meetings: MeetingItem[];
  onSelectDate: (dateString: string) => void;
}) {
  const today = useMemo(() => new Date(), []);
  const todayString = useMemo(
    () => formatDateString(today.getFullYear(), today.getMonth(), today.getDate()),
    [today],
  );

  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  // Mapeia reuniões por dia (YYYY-MM-DD)
  const meetingsByDay = useMemo(() => {
    const map = new Map<string, MeetingItem[]>();
    for (const m of meetings) {
      const day = m.day || (m.date ? m.date.split(" · ")[0] : "");
      if (day) {
        const list = map.get(day) || [];
        list.push(m);
        map.set(day, list);
      }
    }
    return map;
  }, [meetings]);

  // Cálculos do calendário do mês atual
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const days: Array<{
      dayNumber: number;
      dateString: string;
      isCurrentMonth: boolean;
      isToday: boolean;
      meetingCount: number;
      dayMeetings: MeetingItem[];
    }> = [];

    // Dias do mês anterior para preencher a primeira semana
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dNum = daysInPrevMonth - i;
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dateStr = formatDateString(prevYear, prevMonth, dNum);
      const mList = meetingsByDay.get(dateStr) || [];
      days.push({
        dayNumber: dNum,
        dateString: dateStr,
        isCurrentMonth: false,
        isToday: dateStr === todayString,
        meetingCount: mList.length,
        dayMeetings: mList,
      });
    }

    // Dias do mês atual
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const dateStr = formatDateString(currentYear, currentMonth, d);
      const mList = meetingsByDay.get(dateStr) || [];
      days.push({
        dayNumber: d,
        dateString: dateStr,
        isCurrentMonth: true,
        isToday: dateStr === todayString,
        meetingCount: mList.length,
        dayMeetings: mList,
      });
    }

    // Dias do próximo mês para completar a grade de 35 ou 42 dias
    const remaining = 35 - days.length > 0 ? 35 - days.length : 42 - days.length;
    for (let nextD = 1; nextD <= remaining; nextD++) {
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const dateStr = formatDateString(nextYear, nextMonth, nextD);
      const mList = meetingsByDay.get(dateStr) || [];
      days.push({
        dayNumber: nextD,
        dateString: dateStr,
        isCurrentMonth: false,
        isToday: dateStr === todayString,
        meetingCount: mList.length,
        dayMeetings: mList,
      });
    }

    return days;
  }, [currentYear, currentMonth, meetingsByDay, todayString]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleGoToday = () => {
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", boxSizing: "border-box" }}>
      {/* Cabeçalho do Calendário */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, color: "#16a34a", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              📅 Calendário Interativo
            </span>
          </div>
          <h3 style={{ margin: "2px 0 0", fontSize: "17px", fontWeight: 900, color: "#0f172a" }}>
            {MONTH_NAMES[currentMonth]} de {currentYear}
          </h3>
        </div>

        {/* Controles de Navegação */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            type="button"
            onClick={handleGoToday}
            style={{
              padding: "4px 8px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#334155",
              fontSize: "11px",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={handlePrevMonth}
            title="Mês anterior"
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#334155",
              fontSize: "13px",
              fontWeight: 900,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
            }}
          >
            ‹
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            title="Próximo mês"
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#334155",
              fontSize: "13px",
              fontWeight: 900,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
            }}
          >
            ›
          </button>
        </div>
      </div>

      {/* Dias da Semana */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "4px",
          textAlign: "center",
          marginBottom: "6px",
        }}
      >
        {WEEKDAYS.map((w, idx) => (
          <span
            key={w}
            style={{
              fontSize: "11px",
              fontWeight: 800,
              color: idx === 0 || idx === 6 ? "#94a3b8" : "#64748b",
              textTransform: "uppercase",
              padding: "4px 0",
            }}
          >
            {w}
          </span>
        ))}
      </div>

      {/* Grade de Dias do Mês */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "4px",
          flex: 1,
        }}
      >
        {calendarDays.map((item) => {
          const hasMeetings = item.meetingCount > 0;
          const isHovered = hoveredDate === item.dateString;

          return (
            <button
              key={item.dateString}
              type="button"
              onClick={() => onSelectDate(item.dateString)}
              onMouseEnter={() => setHoveredDate(item.dateString)}
              onMouseLeave={() => setHoveredDate(null)}
              title={
                hasMeetings
                  ? `${item.meetingCount} reunião(ões) em ${item.dateString.split("-").reverse().join("/")}. Clique para agendar ou ver detalhes.`
                  : `Clique para agendar reunião em ${item.dateString.split("-").reverse().join("/")}`
              }
              style={{
                position: "relative",
                aspectRatio: "1",
                minHeight: "36px",
                padding: "3px",
                borderRadius: "8px",
                border: item.isToday
                  ? "2px solid #16a34a"
                  : isHovered
                  ? "1.5px solid #0284c7"
                  : hasMeetings
                  ? "1.5px solid #bae6fd"
                  : "1px solid #f1f5f9",
                background: hasMeetings
                  ? "#f0fdf4"
                  : item.isToday
                  ? "#f0fdf4"
                  : item.isCurrentMonth
                  ? "#ffffff"
                  : "#f8fafc",
                color: !item.isCurrentMonth
                  ? "#cbd5e1"
                  : item.isToday
                  ? "#15803d"
                  : "#0f172a",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "space-between",
                transition: "all 0.12s ease",
                boxShadow: isHovered ? "0 4px 10px rgba(0,0,0,0.08)" : "none",
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: item.isToday || hasMeetings ? 900 : 600,
                  lineHeight: "1",
                  marginTop: "2px",
                }}
              >
                {item.dayNumber}
              </span>

              {/* Indicador de Reunião Agendada */}
              {hasMeetings && (
                <span
                  style={{
                    fontSize: "9px",
                    fontWeight: 800,
                    color: "#ffffff",
                    background: "#16a34a",
                    padding: "1px 4px",
                    borderRadius: "999px",
                    lineHeight: "1.1",
                    marginBottom: "2px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.meetingCount} {item.meetingCount === 1 ? "reunião" : "reuniões"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Dica de Uso no Rodapé */}
      <div
        style={{
          marginTop: "10px",
          paddingTop: "8px",
          borderTop: "1px solid #f1f5f9",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "11px",
          color: "#64748b",
        }}
      >
        <span>💡 Toque em qualquer dia para agendar reunião</span>
        <button
          type="button"
          onClick={() => onSelectDate(todayString)}
          style={{
            background: "transparent",
            border: 0,
            color: "#0284c7",
            fontWeight: 800,
            cursor: "pointer",
            fontSize: "11px",
          }}
        >
          + Agendar hoje
        </button>
      </div>
    </div>
  );
}
