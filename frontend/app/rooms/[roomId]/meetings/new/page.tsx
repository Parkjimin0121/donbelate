"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createMeeting, fetchRoomMembers, type RoomMember } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

type MeetingStep = "when" | "where" | "who";
type PlaceLocation = {
  id: string;
  name: string;
  branch: string;
  latitude: number;
  longitude: number;
};

type NominatimPlace = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
};

const STEPS: { key: MeetingStep; label: string }[] = [
  { key: "when", label: "언제" },
  { key: "where", label: "어디서" },
  { key: "who", label: "누구랑" }
];

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function NewMeetingPage() {
  const router = useRouter();
  const params = useParams<{ roomId: string }>();
  const roomId = params.roomId;
  const token = useAuthStore((state) => state.token);
  const [step, setStep] = useState<MeetingStep>("when");
  const [selectedDate, setSelectedDate] = useState(() => new Date(2026, 8, 9));
  const [hour, setHour] = useState("10");
  const [minute, setMinute] = useState("00");
  const [period, setPeriod] = useState<"AM" | "PM">("AM");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [locationResults, setLocationResults] = useState<PlaceLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<PlaceLocation | null>(null);
  const [hasSearchedPlace, setHasSearchedPlace] = useState(false);
  const [isSearchingPlace, setIsSearchingPlace] = useState(false);
  const [placeSearchError, setPlaceSearchError] = useState<string | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreated, setIsCreated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const membersQuery = useQuery({
    queryKey: ["rooms", roomId, "members"],
    queryFn: () => fetchRoomMembers(roomId),
    enabled: Boolean(roomId)
  });

  const members = membersQuery.data ?? [];

  useEffect(() => {
    if (selectedMemberIds.length > 0 || members.length === 0) return;
    setSelectedMemberIds(members.slice(0, 2).map((member) => member.userId));
  }, [members, selectedMemberIds.length]);

  const calendarDays = useMemo(() => buildCalendarDays(selectedDate), [selectedDate]);

  function goPreviousStep() {
    setError(null);
    if (step === "when") {
      router.replace(`/rooms/${roomId}`);
      return;
    }
    setStep(step === "where" ? "when" : "where");
  }

  async function goNextStep() {
    setError(null);
    if (step === "when") {
      setStep("where");
      return;
    }
    if (step === "where") {
      if (!selectedLocation) {
        setError("장소를 선택해주세요.");
        return;
      }
      setStep("who");
      return;
    }
    await submitMeeting();
  }

  async function searchPlaces() {
    const keyword = searchKeyword.trim();
    if (!keyword) {
      setPlaceSearchError("검색어를 입력해주세요.");
      setHasSearchedPlace(false);
      return;
    }

    setIsSearchingPlace(true);
    setPlaceSearchError(null);
    setHasSearchedPlace(true);
    try {
      const params = new URLSearchParams({
        q: keyword,
        format: "jsonv2",
        limit: "5",
        countrycodes: "kr",
        "accept-language": "ko"
      });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`);
      if (!response.ok) throw new Error("장소 검색에 실패했어요.");

      const places = (await response.json()) as NominatimPlace[];
      const nextResults = places.map((place) => normalizePlaceResult(place, keyword));
      if (nextResults.length === 0) {
        setPlaceSearchError("검색 결과가 없어요. 다른 이름으로 검색해보세요.");
        setLocationResults([]);
        return;
      }

      setLocationResults(nextResults);
      setSelectedLocation(nextResults[0]);
    } catch (searchError) {
      setPlaceSearchError(
        searchError instanceof Error ? searchError.message : "장소를 검색하지 못했어요."
      );
    } finally {
      setIsSearchingPlace(false);
    }
  }

  async function submitMeeting() {
    if (!token) {
      router.push("/login");
      return;
    }

    if (selectedMemberIds.length === 0) {
      setError("함께할 멤버를 한 명 이상 선택해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (!selectedLocation) {
        setError("장소를 선택해주세요.");
        return;
      }

      await createMeeting(
        {
          roomId,
          title: selectedLocation.name,
          scheduledAt: toScheduledAt(selectedDate, hour, minute, period),
          locationName: `${selectedLocation.name} ${selectedLocation.branch}`,
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
          capacity: selectedMemberIds.length,
          participantUserIds: selectedMemberIds
        },
        token
      );
      setIsCreated(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "약속을 만들지 못했어요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function toggleMember(memberId: string) {
    setSelectedMemberIds((current) =>
      current.includes(memberId)
        ? current.filter((item) => item !== memberId)
        : [...current, memberId]
    );
  }

  if (isCreated) {
    return (
      <main className="phone-frame simple-page meeting-wizard-page">
        <header className="page-header">
          <button
            className="back-button bare-button"
            type="button"
            aria-label="뒤로가기"
            onClick={() => router.replace(`/rooms/${roomId}`)}
          >
            <span className="back-icon" aria-hidden="true" />
          </button>
          <h1>약속 만들기</h1>
        </header>

        <section className="meeting-success-card" role="status" aria-live="polite">
          <div className="complete-title">
            <span className="info-icon" aria-hidden="true">
              i
            </span>
            <strong>약속이 만들어졌어요.</strong>
          </div>
          <p>방 페이지에서 새 약속을 확인할 수 있어요.</p>
          <button
            className="meeting-success-button"
            type="button"
            onClick={() => router.replace(`/rooms/${roomId}`)}
          >
            확인
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="phone-frame simple-page meeting-wizard-page">
      <header className="page-header">
        <button
          className="back-button bare-button"
          type="button"
          aria-label="뒤로가기"
          onClick={() => router.replace(`/rooms/${roomId}`)}
        >
          <span className="back-icon" aria-hidden="true" />
        </button>
        <h1>약속 만들기</h1>
      </header>

      <nav className="wizard-tabs" aria-label="약속 만들기 단계">
        {STEPS.map((item) => (
          <button
            key={item.key}
            className={item.key === step ? "wizard-tab wizard-tab-active" : "wizard-tab"}
            type="button"
            onClick={() => setStep(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {step === "when" ? (
        <WhenStep
          calendarDays={calendarDays}
          hour={hour}
          minute={minute}
          period={period}
          selectedDate={selectedDate}
          setHour={setHour}
          setMinute={setMinute}
          setPeriod={setPeriod}
          setSelectedDate={setSelectedDate}
        />
      ) : null}

      {step === "where" ? (
        <WhereStep
          isSearchingPlace={isSearchingPlace}
          locationResults={locationResults}
          placeSearchError={placeSearchError}
          hasSearchedPlace={hasSearchedPlace}
          searchPlaces={searchPlaces}
          searchKeyword={searchKeyword}
          selectedLocation={selectedLocation}
          setPlaceSearchError={setPlaceSearchError}
          setSearchKeyword={setSearchKeyword}
          setSelectedLocation={setSelectedLocation}
        />
      ) : null}

      {step === "who" ? (
        <WhoStep
          isLoading={membersQuery.isLoading}
          members={members}
          selectedMemberIds={selectedMemberIds}
          toggleMember={toggleMember}
        />
      ) : null}

      {error ? <p className="wizard-error">{error}</p> : null}

      <div className="wizard-actions">
        <button className="wizard-nav-button" type="button" onClick={goPreviousStep}>
          이전
        </button>
        <button className="wizard-nav-button wizard-nav-primary" disabled={isSubmitting} type="button" onClick={goNextStep}>
          {isSubmitting ? "만드는 중" : "다음"}
        </button>
      </div>
    </main>
  );
}

function WhenStep({
  calendarDays,
  hour,
  minute,
  period,
  selectedDate,
  setHour,
  setMinute,
  setPeriod,
  setSelectedDate
}: {
  calendarDays: CalendarDay[];
  hour: string;
  minute: string;
  period: "AM" | "PM";
  selectedDate: Date;
  setHour: (value: string) => void;
  setMinute: (value: string) => void;
  setPeriod: (value: "AM" | "PM") => void;
  setSelectedDate: (value: Date) => void;
}) {
  function moveMonth(offset: number) {
    setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + offset, selectedDate.getDate()));
  }

  return (
    <section className="wizard-step-content">
      <div className="calendar-card">
        <div className="calendar-controls">
          <button className="calendar-arrow" type="button" aria-label="이전 달" onClick={() => moveMonth(-1)}>
            <span className="chevron-left-icon" aria-hidden="true" />
          </button>
          <select
            aria-label="월 선택"
            value={selectedDate.getMonth()}
            onChange={(event) => setSelectedDate(new Date(selectedDate.getFullYear(), Number(event.target.value), selectedDate.getDate()))}
          >
            {MONTH_LABELS.map((label, index) => (
              <option key={label} value={index}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="연도 선택"
            value={selectedDate.getFullYear()}
            onChange={(event) => setSelectedDate(new Date(Number(event.target.value), selectedDate.getMonth(), selectedDate.getDate()))}
          >
            {[2026, 2027, 2028].map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <button className="calendar-arrow" type="button" aria-label="다음 달" onClick={() => moveMonth(1)}>
            <span className="chevron-right-icon" aria-hidden="true" />
          </button>
        </div>
        <div className="calendar-grid calendar-weekdays" aria-hidden="true">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="calendar-grid">
          {calendarDays.map((day) => (
            <button
              key={`${day.month}-${day.date}`}
              className={day.isSelected ? "calendar-day calendar-day-active" : "calendar-day"}
              type="button"
              disabled={!day.isCurrentMonth}
              onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day.date))}
            >
              {day.date}
            </button>
          ))}
        </div>
      </div>

      <div className="time-card">
        <p>시간을 입력하세요.</p>
        <div className="time-picker">
          <label>
            <input
              inputMode="numeric"
              maxLength={2}
              value={hour}
              onChange={(event) => setHour(normalizeTimePart(event.target.value, 12))}
            />
            <span>시간</span>
          </label>
          <span className="time-separator">:</span>
          <label>
            <input
              inputMode="numeric"
              maxLength={2}
              value={minute}
              onChange={(event) => setMinute(normalizeTimePart(event.target.value, 59))}
            />
            <span>분</span>
          </label>
          <div className="period-toggle">
            <button className={period === "AM" ? "period-active" : ""} type="button" onClick={() => setPeriod("AM")}>
              AM
            </button>
            <button className={period === "PM" ? "period-active" : ""} type="button" onClick={() => setPeriod("PM")}>
              PM
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function WhereStep({
  isSearchingPlace,
  locationResults,
  placeSearchError,
  hasSearchedPlace,
  searchPlaces,
  searchKeyword,
  selectedLocation,
  setPlaceSearchError,
  setSearchKeyword,
  setSelectedLocation
}: {
  isSearchingPlace: boolean;
  locationResults: PlaceLocation[];
  placeSearchError: string | null;
  hasSearchedPlace: boolean;
  searchPlaces: () => void;
  searchKeyword: string;
  selectedLocation: PlaceLocation | null;
  setPlaceSearchError: (value: string | null) => void;
  setSearchKeyword: (value: string) => void;
  setSelectedLocation: (value: PlaceLocation) => void;
}) {
  return (
    <section className="wizard-step-content where-step-content">
      <form
        className="place-search"
        onSubmit={(event) => {
          event.preventDefault();
          searchPlaces();
        }}
      >
        <input
          placeholder="장소를 검색하세요."
          value={searchKeyword}
          onChange={(event) => {
            setSearchKeyword(event.target.value);
            setPlaceSearchError(null);
          }}
        />
        <button type="submit" aria-label="장소 검색" disabled={isSearchingPlace}>
          <span className="place-search-icon" aria-hidden="true" />
        </button>
      </form>

      {placeSearchError ? <p className="place-search-error">{placeSearchError}</p> : null}

      <div className="place-result-panel">
        {isSearchingPlace ? <p className="place-search-status">검색하는 중</p> : null}
        {!isSearchingPlace && !hasSearchedPlace ? (
          <p className="place-search-status">장소를 검색하면 결과가 표시돼요.</p>
        ) : null}
        {!isSearchingPlace && hasSearchedPlace && locationResults.length === 0 ? (
          <p className="place-search-status">표시할 장소가 없어요.</p>
        ) : null}
        {locationResults.map((location) => (
          <button
            key={location.id}
            className={selectedLocation?.id === location.id ? "place-result place-result-active" : "place-result"}
            type="button"
            onClick={() => setSelectedLocation(location)}
          >
            <span className="star-circle-icon" aria-hidden="true" />
            <strong>{location.name}</strong>
            <span>{location.branch}</span>
            <span className="tiny-chevron-right" aria-hidden="true" />
          </button>
        ))}
      </div>
    </section>
  );
}

function WhoStep({
  isLoading,
  members,
  selectedMemberIds,
  toggleMember
}: {
  isLoading: boolean;
  members: RoomMember[];
  selectedMemberIds: string[];
  toggleMember: (memberId: string) => void;
}) {
  return (
    <section className="wizard-step-content who-step-content">
      <div className="wizard-member-panel">
        <h2>멤버</h2>
        <div className="wizard-member-list">
          {isLoading ? <WizardMemberCard name="불러오는 중" selected /> : null}
          {!isLoading && members.length === 0 ? <WizardMemberCard name="멤버가 없어요" selected={false} /> : null}
          {members.map((member) => {
            const selected = selectedMemberIds.includes(member.userId);
            return (
              <WizardMemberCard
                key={member.id}
                name={member.user?.name ?? "이름 없는 멤버"}
                selected={selected}
                onClick={() => toggleMember(member.userId)}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

function WizardMemberCard({
  name,
  selected,
  onClick
}: {
  name: string;
  selected: boolean;
  onClick?: () => void;
}) {
  return (
    <button className="wizard-member-card" type="button" onClick={onClick}>
      <span className="member-avatar" aria-hidden="true" />
      <strong>{name}</strong>
      <span className={selected ? "member-select-icon member-select-minus" : "member-select-icon member-select-plus"} aria-hidden="true" />
    </button>
  );
}

type CalendarDay = {
  date: number;
  month: number;
  isCurrentMonth: boolean;
  isSelected: boolean;
};

function buildCalendarDays(selectedDate: Date): CalendarDay[] {
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const previousMonthDays = new Date(year, month, 0).getDate();
  const days: CalendarDay[] = [];

  for (let index = firstWeekday - 1; index >= 0; index -= 1) {
    days.push({
      date: previousMonthDays - index,
      month: month - 1,
      isCurrentMonth: false,
      isSelected: false
    });
  }

  for (let date = 1; date <= daysInMonth; date += 1) {
    days.push({
      date,
      month,
      isCurrentMonth: true,
      isSelected: date === selectedDate.getDate()
    });
  }

  let nextDate = 1;
  while (days.length < 42) {
    days.push({
      date: nextDate,
      month: month + 1,
      isCurrentMonth: false,
      isSelected: false
    });
    nextDate += 1;
  }

  return days;
}

function normalizeTimePart(value: string, max: number) {
  const digits = value.replace(/\D/g, "").slice(0, 2);
  if (!digits) return "";
  const parsed = Math.min(Number(digits), max);
  return String(parsed).padStart(digits.length === 1 ? 1 : 2, "0");
}

function normalizePlaceResult(place: NominatimPlace, fallbackName: string): PlaceLocation {
  const parts = place.display_name.split(",").map((part) => part.trim()).filter(Boolean);
  const name = place.name || parts[0] || fallbackName;
  const branch = parts.filter((part) => part !== name).slice(0, 3).join(" ") || "검색 결과";

  return {
    id: String(place.place_id),
    name,
    branch,
    latitude: Number(place.lat),
    longitude: Number(place.lon)
  };
}

function toScheduledAt(date: Date, hourValue: string, minuteValue: string, period: "AM" | "PM") {
  const parsedHour = Number(hourValue || "0");
  const parsedMinute = Number(minuteValue || "0");
  const hour24 = period === "PM" ? (parsedHour % 12) + 12 : parsedHour % 12;
  const scheduledAt = new Date(date);
  scheduledAt.setHours(hour24, parsedMinute, 0, 0);
  return scheduledAt.toISOString();
}
