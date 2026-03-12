import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { MEMBERS } from "../config/members";
import { CATEGORIES } from "../config/categories";
import QuestionCard from "./QuestionCard";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const TABS = ["진행 현황", "저장 문제함", "전체 문제"];
const STATUS_LABEL = {
  not_started: "미시작",
  in_progress: "진행 중",
  completed: "완료",
};
const STATUS_DOT = {
  not_started: "bg-gray-300",
  in_progress: "bg-amber-400",
  completed: "bg-emerald-500",
};

const CHART_COLORS = [
  "#3b82f6", "#06b6d4", "#8b5cf6", "#f59e0b",
  "#10b981", "#ef4444", "#ec4899", "#6366f1",
];

const CHART_COLORS_ALT = [
  "#60a5fa", "#22d3ee", "#a78bfa", "#fbbf24",
  "#34d399", "#f87171", "#f472b6", "#818cf8",
];

export default function Dashboard() {
  const [tab, setTab] = useState(0);
  const [sessions, setSessions] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [catFilter, setCatFilter] = useState("전체");
  const [sessionFilter, setSessionFilter] = useState("전체");
  const [historyCopied, setHistoryCopied] = useState(false);

  useEffect(() => {
    const q1 = query(collection(db, "quiz_sessions"), orderBy("session", "desc"));
    const unsub1 = onSnapshot(q1, (snap) => {
      setSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const q2 = query(collection(db, "quiz_bookmarks"), orderBy("savedAt", "desc"));
    const unsub2 = onSnapshot(q2, (snap) => {
      setBookmarks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => { unsub1(); unsub2(); };
  }, []);

  const currentSession = sessions[0] || null;

  // 출제 범주 분포 (quiz_sessions 기준)
  const publishedCatCounts = {};
  let totalPublished = 0;
  const allPerspectiveTags = new Set();
  sessions.forEach((s) => {
    (s.questions || []).forEach((q) => {
      publishedCatCounts[q.category || "?"] = (publishedCatCounts[q.category || "?"] || 0) + 1;
      totalPublished++;
      if (q.perspectiveTag) allPerspectiveTags.add(q.perspectiveTag);
    });
  });
  const publishedChartData = Object.entries(CATEGORIES).map(([code, name]) => ({
    name: code, fullName: name, count: publishedCatCounts[code] || 0,
  }));

  // Category distribution (deduplicated bookmarks)
  const catCounts = {};
  const seenBookmark = new Set();
  bookmarks.forEach((b) => {
    const key = `${b.sessionId}_${b.questionId}`;
    if (!seenBookmark.has(key)) {
      seenBookmark.add(key);
      catCounts[b.category || "?"] = (catCounts[b.category || "?"] || 0) + 1;
      if (b.perspectiveTag) allPerspectiveTags.add(b.perspectiveTag);
    }
  });
  const chartData = Object.entries(CATEGORIES).map(([code, name]) => ({
    name: code, fullName: name, count: catCounts[code] || 0,
  }));
  const totalBookmarkCount = Object.values(catCounts).reduce((a, b) => a + b, 0);

  // 출제 이력 복사
  const copyHistory = () => {
    const maxSession = sessions.length > 0 ? Math.max(...sessions.map((s) => s.session)) : 0;
    const pubLine = Object.entries(CATEGORIES)
      .map(([code]) => `${code} ${publishedCatCounts[code] || 0}문항`)
      .join(", ");
    const bmLine = Object.entries(CATEGORIES)
      .map(([code]) => `${code} ${catCounts[code] || 0}문항`)
      .join(", ");
    let text = `=== 출제 이력 (1~${maxSession}회차) ===\n총 출제: ${totalPublished}문항\n범주별 출제 수: ${pubLine}\n범주별 저장(복습) 수: ${bmLine}`;
    if (allPerspectiveTags.size > 0) {
      text += `\n출제된 관점 태그: ${[...allPerspectiveTags].sort().join(", ")}`;
    }
    navigator.clipboard.writeText(text);
    setHistoryCopied(true);
    setTimeout(() => setHistoryCopied(false), 2000);
  };

  // Filtered bookmarks (deduplicated)
  const deduped = [];
  const seen = new Set();
  bookmarks.forEach((b) => {
    const key = `${b.sessionId}_${b.questionId}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (catFilter !== "전체" && b.category !== catFilter) return;
    if (sessionFilter !== "전체" && b.sessionId !== Number(sessionFilter)) return;
    deduped.push(b);
  });

  // All questions
  const allQuestions = [];
  sessions.forEach((s) => {
    (s.questions || []).forEach((q) => {
      allQuestions.push({ ...q, sessionNumber: s.session });
    });
  });
  const filteredAllQuestions = allQuestions.filter((q) => {
    if (catFilter !== "전체" && q.category !== catFilter) return false;
    if (sessionFilter !== "전체" && q.sessionNumber !== Number(sessionFilter)) return false;
    return true;
  });

  const sessionNumbers = sessions.map((s) => s.session);

  return (
    <div>
      {/* Tab bar */}
      <div className="flex bg-white rounded-2xl shadow-sm border border-gray-100 p-1.5 mb-8">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => { setTab(i); setCatFilter("전체"); setSessionFilter("전체"); }}
            className={`flex-1 py-3 text-base font-medium rounded-xl transition-colors ${
              tab === i ? "bg-blue-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {t}
            {i === 1 && totalBookmarkCount > 0 && (
              <span className={`ml-2 text-sm px-2 py-0.5 rounded-full ${
                tab === 1 ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-500"
              }`}>{totalBookmarkCount}</span>
            )}
            {i === 2 && allQuestions.length > 0 && (
              <span className={`ml-2 text-sm px-2 py-0.5 rounded-full ${
                tab === 2 ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-500"
              }`}>{allQuestions.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* 진행 현황 */}
      {tab === 0 && (
        <div className="space-y-6">
          {/* 출제 이력 복사 버튼 */}
          {sessions.length > 0 && (
            <div className="flex justify-end">
              <button
                onClick={copyHistory}
                className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-colors ${
                  historyCopied
                    ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                    : "bg-gray-800 text-white hover:bg-gray-900"
                }`}
              >
                {historyCopied ? "복사됨!" : "출제 이력 복사"}
              </button>
            </div>
          )}

          {currentSession ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-gray-800 text-lg">제{currentSession.session}회차</h3>
                <span className="text-sm text-gray-400">{currentSession.date}</span>
              </div>
              <div className="space-y-3">
                {MEMBERS.map((name) => {
                  const status = currentSession.progress?.[name] || "not_started";
                  return (
                    <div key={name} className="flex items-center justify-between py-3 px-4 rounded-xl bg-gray-50">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${STATUS_DOT[status]}`} />
                        <span className="text-base font-medium text-gray-700">{name}</span>
                      </div>
                      <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                        status === "completed" ? "bg-emerald-100 text-emerald-700"
                        : status === "in_progress" ? "bg-amber-100 text-amber-700"
                        : "bg-gray-200 text-gray-500"
                      }`}>{STATUS_LABEL[status]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center text-gray-400">
              활성 회차가 없습니다.
            </div>
          )}

          {/* Session history */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-bold text-gray-800 text-lg mb-4">회차 이력</h3>
            {sessions.length === 0 ? (
              <p className="text-gray-400">아직 회차가 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {sessions.map((s) => {
                  const done = MEMBERS.filter((m) => s.progress?.[m] === "completed").length;
                  return (
                    <div key={s.id} className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        <span className="text-base font-medium text-gray-700">제{s.session}회차</span>
                        <span className="text-sm text-gray-400">{s.questions?.length || 0}문항</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-400">{done}/{MEMBERS.length}명 완료</span>
                        <span className="text-sm text-gray-400">{s.date}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 출제 범주 분포 차트 */}
          {totalPublished > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-gray-800 text-lg mb-1">출제 문항 범주별 분포</h3>
              <p className="text-sm text-gray-400 mb-5">총 {totalPublished}개 출제 문항 (전 회차 누적)</p>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={publishedChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 14 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 14 }} />
                  <Tooltip formatter={(value, _name, props) => [`${value}건`, props.payload.fullName]} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {publishedChartData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS_ALT[i % CHART_COLORS_ALT.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* 저장 문항 범주 분포 차트 */}
          {totalBookmarkCount > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-gray-800 text-lg mb-1">저장 문항 범주별 분포</h3>
              <p className="text-sm text-gray-400 mb-5">총 {totalBookmarkCount}개 저장 문항</p>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 14 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 14 }} />
                  <Tooltip formatter={(value, _name, props) => [`${value}건`, props.payload.fullName]} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* 저장 문제함 */}
      {tab === 1 && (
        <div>
          <Filters catFilter={catFilter} setCatFilter={setCatFilter} sessionFilter={sessionFilter} setSessionFilter={setSessionFilter} sessionNumbers={sessionNumbers} />
          <p className="text-sm text-gray-400 mb-5">
            {deduped.length}개 문항{catFilter !== "전체" || sessionFilter !== "전체" ? " (필터 적용)" : ""}
          </p>
          {deduped.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </div>
              <p className="text-gray-400 text-lg">
                {catFilter !== "전체" || sessionFilter !== "전체" ? "필터에 맞는 저장 문항이 없습니다." : "아직 저장된 문항이 없습니다."}
              </p>
              <p className="text-gray-300 mt-1">퀴즈 중 "다시 보기 저장"을 누르면 여기에 표시됩니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {deduped.map((b, i) => (
                <QuestionCard key={b.id} q={{ ...b, sessionNumber: b.sessionId }} index={i} revealed={false} readOnly />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 전체 문제 */}
      {tab === 2 && (
        <div>
          <Filters catFilter={catFilter} setCatFilter={setCatFilter} sessionFilter={sessionFilter} setSessionFilter={setSessionFilter} sessionNumbers={sessionNumbers} />
          <p className="text-sm text-gray-400 mb-5">
            {filteredAllQuestions.length}개 문항{catFilter !== "전체" || sessionFilter !== "전체" ? " (필터 적용)" : ""}
          </p>
          {filteredAllQuestions.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-400 text-lg">문제가 없습니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredAllQuestions.map((q, i) => (
                <QuestionCard key={`${q.sessionNumber}_${q.id}`} q={q} index={i} revealed={false} readOnly />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Filters({ catFilter, setCatFilter, sessionFilter, setSessionFilter, sessionNumbers }) {
  const cats = ["전체", ...Object.keys(CATEGORIES)];

  return (
    <div className="mb-5 space-y-4">
      <div>
        <span className="text-sm font-semibold text-gray-500 mb-2 block">범주</span>
        <div className="flex flex-wrap gap-2">
          {cats.map((c) => (
            <button
              key={c}
              onClick={() => setCatFilter(c)}
              className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                catFilter === c ? "bg-blue-600 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {c === "전체" ? "전체" : `${c} ${CATEGORIES[c]}`}
            </button>
          ))}
        </div>
      </div>
      {sessionNumbers.length > 0 && (
        <div>
          <span className="text-sm font-semibold text-gray-500 mb-2 block">회차</span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSessionFilter("전체")}
              className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                sessionFilter === "전체" ? "bg-purple-600 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >전체</button>
            {sessionNumbers.map((n) => (
              <button
                key={n}
                onClick={() => setSessionFilter(String(n))}
                className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                  sessionFilter === String(n) ? "bg-purple-600 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                }`}
              >{n}회차</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
